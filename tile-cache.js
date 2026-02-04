// === Tile Cache Manager ===
// Manages offline caching of map tiles using Cache API

class TileCache {
    constructor() {
        this.cacheName = 'geocoordinate-tiles-v1';
        this.staticCacheName = 'geocoordinate-static-v1';
        this.maxCacheSize = 500; // Maximum number of tiles to cache
        this.tileQueue = [];
        this.isDownloading = false;

        this.init();
    }

    async init() {
        // Check if Cache API is supported
        if ('caches' in window) {
            console.log('✅ Cache API supported');
            this.updateCacheInfo();
        } else {
            console.warn('⚠️ Cache API not supported');
        }
    }

    // Cache a single tile URL
    async cacheTile(url) {
        try {
            const cache = await caches.open(this.cacheName);
            const response = await fetch(url);

            if (response.ok) {
                await cache.put(url, response.clone());
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error caching tile:', error);
            return false;
        }
    }

    // Cache multiple tiles
    async cacheTiles(urls, onProgress = null) {
        const cache = await caches.open(this.cacheName);
        let completed = 0;
        const total = urls.length;

        for (const url of urls) {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    await cache.put(url, response.clone());
                }
            } catch (error) {
                console.error('Error caching tile:', url, error);
            }

            completed++;
            if (onProgress) {
                onProgress(completed, total);
            }
        }

        this.updateCacheInfo();
        return completed;
    }

    // Download area for offline use
    async downloadArea(bounds, minZoom, maxZoom, onProgress = null) {
        this.isDownloading = true;
        const urls = this.generateTileUrls(bounds, minZoom, maxZoom);

        console.log(`📥 Downloading ${urls.length} tiles...`);

        const cached = await this.cacheTiles(urls, onProgress);

        this.isDownloading = false;
        console.log(`✅ Downloaded ${cached} tiles`);

        return cached;
    }

    // Generate tile URLs for a bounding box and zoom range
    generateTileUrls(bounds, minZoom, maxZoom) {
        const urls = [];
        const baseUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

        for (let z = minZoom; z <= maxZoom; z++) {
            const nwTile = this.latLngToTile(bounds.north, bounds.west, z);
            const seTile = this.latLngToTile(bounds.south, bounds.east, z);

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

    latLngToTile(lat, lng, zoom) {
        const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
        const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) +
            1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));

        return { x, y };
    }

    // Estimate tile count for area
    estimateTileCount(bounds, minZoom, maxZoom) {
        let count = 0;

        for (let z = minZoom; z <= maxZoom; z++) {
            const nwTile = this.latLngToTile(bounds.north, bounds.west, z);
            const seTile = this.latLngToTile(bounds.south, bounds.east, z);

            const width = Math.abs(seTile.x - nwTile.x) + 1;
            const height = Math.abs(seTile.y - nwTile.y) + 1;
            count += width * height;
        }

        return count;
    }

    // Get cache info
    async updateCacheInfo() {
        try {
            const cache = await caches.open(this.cacheName);
            const keys = await cache.keys();
            const count = keys.length;

            const cacheInfoEl = document.getElementById('cached-tiles');
            if (cacheInfoEl) {
                cacheInfoEl.textContent = `${count} tiles in cache`;
            }

            return count;
        } catch (error) {
            console.error('Error getting cache info:', error);
            return 0;
        }
    }

    // Clear cache
    async clearCache() {
        try {
            await caches.delete(this.cacheName);
            console.log('✅ Cache cleared');
            this.updateCacheInfo();
        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    }

    // Check if cache size is approaching limit
    async checkCacheSize() {
        const count = await this.updateCacheInfo();

        if (count > this.maxCacheSize) {
            console.warn(`⚠️ Cache size (${count}) exceeds limit (${this.maxCacheSize})`);
            // Could implement LRU cache eviction here
        }
    }
}

// Export
window.TileCache = TileCache;
