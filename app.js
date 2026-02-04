// === Main Application ===
// Coordinates all components and handles user interactions

let mapManager;
let tileCache;
let locationDetails;

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing GeoCoordinate Viewer...');

    // Initialize components
    mapManager = new MapManager();
    tileCache = new TileCache();
    locationDetails = new LocationDetails();

    // Store globally for access from other modules
    window.mapManager = mapManager;
    window.tileCache = tileCache;
    window.locationDetails = locationDetails;

    // Set up event listeners
    setupEventListeners();

    // Monitor online/offline status
    setupOnlineStatusMonitor();

    console.log('✅ Application initialized');
});

// Set up all event listeners
function setupEventListeners() {
    // Go to location button
    document.getElementById('go-button').addEventListener('click', handleGoToLocation);

    // Enter key in input fields
    document.getElementById('latitude').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleGoToLocation();
    });
    document.getElementById('longitude').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleGoToLocation();
    });

    // Details panel close button
    document.getElementById('close-details').addEventListener('click', () => {
        document.getElementById('details-panel').classList.add('hidden');
    });


}

// Handle go to location
function handleGoToLocation() {
    const lat = parseFloat(document.getElementById('latitude').value);
    const lon = parseFloat(document.getElementById('longitude').value);

    // Validate coordinates
    if (isNaN(lat) || isNaN(lon)) {
        alert('⚠️ Please enter valid coordinates');
        return;
    }

    if (lat < -90 || lat > 90) {
        alert('⚠️ Latitude must be between -90 and 90');
        return;
    }

    if (lon < -180 || lon > 180) {
        alert('⚠️ Longitude must be between -180 and 180');
        return;
    }

    // Navigate to location
    mapManager.goToLocation(lat, lon);
}

// Monitor online/offline status
function setupOnlineStatusMonitor() {
    const updateStatus = () => {
        const isOnline = navigator.onLine;
        const statusDot = document.getElementById('online-status');
        const statusText = document.getElementById('status-text');

        if (isOnline) {
            statusDot.classList.add('online');
            statusText.textContent = 'Online';
        } else {
            statusDot.classList.remove('online');
            statusText.textContent = 'Offline';
        }
    };

    window.addEventListener('online', () => {
        updateStatus();
        locationDetails.showNotification('🌐 Connection restored');
    });

    window.addEventListener('offline', () => {
        updateStatus();
        locationDetails.showNotification('📵 Offline mode');
    });

    updateStatus();
}

// Auto-cache visible tiles when map moves (smart caching)
if (window.mapManager && window.mapManager.map) {
    let cacheTimeout;

    mapManager.map.on('moveend', () => {
        clearTimeout(cacheTimeout);
        cacheTimeout = setTimeout(async () => {
            if (navigator.onLine) {
                const tiles = mapManager.getVisibleTiles();
                console.log(`💾 Auto-caching ${tiles.length} visible tiles...`);
                await tileCache.cacheTiles(tiles.slice(0, 50)); // Limit to 50 tiles per move
            }
        }, 1000);
    });
}
