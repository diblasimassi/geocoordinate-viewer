// === Service Worker ===
// Handles offline caching and PWA functionality

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `geocoordinate-static-${CACHE_VERSION}`;
const TILE_CACHE = `geocoordinate-tiles-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `geocoordinate-dynamic-${CACHE_VERSION}`;

// Static resources to cache
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/map-manager.js',
    '/tile-cache.js',
    '/location-details.js',
    '/manifest.json',
    '/icons/icon-192x192.svg',
    '/icons/icon-512x512.svg',
    '/icons/favicon.svg',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// ESA Facilities to pre-cache (with surrounding areas)
// Format: { name, lat, lon, radius (in km) }
const ESA_FACILITIES = [
    { name: 'ESRIN', lat: 41.8273, lon: 12.6734, radius: 2 },      // Italy
    { name: 'ESTEC', lat: 52.2167, lon: 4.4208, radius: 2 },       // Netherlands
    { name: 'ESOC', lat: 49.8719, lon: 8.6228, radius: 2 },        // Germany
    { name: 'ESA HQ', lat: 48.8467, lon: 2.3706, radius: 2 },      // France
    { name: 'ESAC', lat: 40.4425, lon: -3.9528, radius: 2 },       // Spain
    { name: 'CSG', lat: 5.2394, lon: -52.7683, radius: 3 }         // French Guiana
];

// Zoom levels to pre-cache for ESA facilities
const ESA_ZOOM_LEVELS = [10, 11, 12, 13, 14, 15, 16];

// Install event - cache static assets and ESA facility tiles
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');

    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(STATIC_CACHE).then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
            }),

            // Pre-cache ESA facility tiles
            cacheESAFacilities()
        ])
            .then(() => self.skipWaiting())
            .catch(error => {
                console.error('[SW] Cache failed:', error);
            })
    );
});

// Function to generate tile URLs for a location
function generateTileURLsForLocation(lat, lon, radiusKm, zoomLevels) {
    const urls = [];
    const baseUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    // Calculate bounds from center point and radius
    const latOffset = radiusKm / 111; // 1 degree latitude ≈ 111 km
    const lonOffset = radiusKm / (111 * Math.cos(lat * Math.PI / 180));

    const bounds = {
        north: lat + latOffset,
        south: lat - latOffset,
        east: lon + lonOffset,
        west: lon - lonOffset
    };

    // Generate tile URLs for each zoom level
    for (const z of zoomLevels) {
        const nwTile = latLngToTile(bounds.north, bounds.west, z);
        const seTile = latLngToTile(bounds.south, bounds.east, z);

        for (let x = Math.min(nwTile.x, seTile.x); x <= Math.max(nwTile.x, seTile.x); x++) {
            for (let y = Math.min(nwTile.y, seTile.y); y <= Math.max(nwTile.y, seTile.y); y++) {
                const url = baseUrl
                    .replace('{z}', z)
                    .replace('{x}', x)
                    .replace('{y}', y);
                urls.push(url);
            }
        }
    }

    return urls;
}

// Helper function to convert lat/lng to tile coordinates
function latLngToTile(lat, lng, zoom) {
    const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) +
        1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));

    return { x, y };
}

// Cache ESA facility tiles
async function cacheESAFacilities() {
    console.log('[SW] Pre-caching ESA facility tiles...');

    try {
        const cache = await caches.open(TILE_CACHE);

        for (const facility of ESA_FACILITIES) {
            console.log(`[SW] Caching ${facility.name} (${facility.lat}, ${facility.lon})`);

            const urls = generateTileURLsForLocation(
                facility.lat,
                facility.lon,
                facility.radius,
                ESA_ZOOM_LEVELS
            );

            console.log(`[SW] ${facility.name}: ${urls.length} tiles`);

            // Cache tiles in batches to avoid overwhelming the server
            const batchSize = 10;
            for (let i = 0; i < urls.length; i += batchSize) {
                const batch = urls.slice(i, i + batchSize);

                await Promise.all(
                    batch.map(async (url) => {
                        try {
                            const response = await fetch(url);
                            if (response.ok) {
                                await cache.put(url, response);
                            }
                        } catch (error) {
                            console.warn(`[SW] Failed to cache tile: ${url}`, error);
                        }
                    })
                );

                // Small delay between batches
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(`[SW] ✅ ${facility.name} cached`);
        }

        console.log('[SW] ✅ All ESA facilities pre-cached');
    } catch (error) {
        console.error('[SW] Error caching ESA facilities:', error);
    }
}

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE &&
                            cacheName !== TILE_CACHE &&
                            cacheName !== DYNAMIC_CACHE) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Handle tile requests (ESRI imagery)
    if (url.hostname.includes('arcgisonline.com') && url.pathname.includes('/tile/')) {
        event.respondWith(handleTileRequest(request));
        return;
    }

    // Handle API requests (Nominatim geocoding)
    if (url.hostname.includes('nominatim.openstreetmap.org')) {
        event.respondWith(handleApiRequest(request));
        return;
    }

    // Handle static assets
    event.respondWith(handleStaticRequest(request));
});

// Handle tile requests with cache-first strategy
async function handleTileRequest(request) {
    try {
        // Try cache first
        const cache = await caches.open(TILE_CACHE);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        // If not in cache and online, fetch and cache
        if (navigator.onLine) {
            const networkResponse = await fetch(request);

            if (networkResponse.ok) {
                // Clone and cache the response
                cache.put(request, networkResponse.clone());
            }

            return networkResponse;
        }

        // Offline and not cached - return placeholder or error
        return new Response('Tile not available offline', {
            status: 404,
            statusText: 'Tile not cached'
        });

    } catch (error) {
        console.error('[SW] Tile fetch error:', error);
        return new Response('Error loading tile', { status: 500 });
    }
}

// Handle API requests with network-first, fallback to cache
async function handleApiRequest(request) {
    try {
        // Try network first
        if (navigator.onLine) {
            const networkResponse = await fetch(request);

            if (networkResponse.ok) {
                // Cache the response
                const cache = await caches.open(DYNAMIC_CACHE);
                cache.put(request, networkResponse.clone());
            }

            return networkResponse;
        }

        // If offline, try cache
        const cache = await caches.open(DYNAMIC_CACHE);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        // No cache, return error
        return new Response(JSON.stringify({ error: 'Offline - data not cached' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[SW] API fetch error:', error);
        return new Response(JSON.stringify({ error: 'Request failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Handle static requests with cache-first strategy
async function handleStaticRequest(request) {
    try {
        // Try cache first
        const cache = await caches.open(STATIC_CACHE);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        // If not cached, fetch from network
        if (navigator.onLine) {
            const networkResponse = await fetch(request);

            // Cache successful responses
            if (networkResponse.ok && request.method === 'GET') {
                cache.put(request, networkResponse.clone());
            }

            return networkResponse;
        }

        // Offline and not cached
        return new Response('Resource not available offline', {
            status: 404,
            statusText: 'Offline'
        });

    } catch (error) {
        console.error('[SW] Static fetch error:', error);
        return new Response('Error loading resource', { status: 500 });
    }
}

// Message handler for commands from main app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            })
        );
    }

    if (event.data && event.data.type === 'RECACHE_ESA') {
        event.waitUntil(cacheESAFacilities());
    }
});

console.log('[SW] Service Worker loaded');
