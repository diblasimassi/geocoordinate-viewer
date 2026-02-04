// === Map Manager ===
// Manages Leaflet map initialization, markers, and navigation

class MapManager {
    constructor() {
        this.map = null;
        this.currentMarker = null;
        this.currentLocation = null;
        this.init();
    }

    init() {
        // Initialize Leaflet map
        this.map = L.map('map', {
            center: [50.0, 10.0], // Center on Europe
            zoom: 4,
            zoomControl: true,
            attributionControl: true
        });

        // Add ESRI World Imagery tile layer (satellite)
        this.satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            maxZoom: 18,
            minZoom: 2
        }).addTo(this.map);

        // Add labels overlay (optional, for street names)
        this.labelsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
            attribution: '',
            maxZoom: 18,
            opacity: 0.7
        }).addTo(this.map);

        // Custom marker icon
        this.markerIcon = L.divIcon({
            className: 'custom-marker',
            html: `
                <div style="
                    background: #4a90e2;
                    width: 30px;
                    height: 30px;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    border: 3px solid white;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <div style="
                        transform: rotate(45deg);
                        font-size: 16px;
                    ">📍</div>
                </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 30]
        });

        // Update zoom display
        this.map.on('zoomend', () => {
            this.updateLocationDetails();
        });

        // Click on map to get coordinates
        this.map.on('click', (e) => {
            this.goToLocation(e.latlng.lat, e.latlng.lng);
        });

        console.log('✅ Map initialized with ESRI World Imagery');
    }

    goToLocation(lat, lon, zoom = 16) {
        if (!lat || !lon) {
            console.error('Invalid coordinates');
            return;
        }

        this.currentLocation = { lat, lon };

        // Remove previous marker
        if (this.currentMarker) {
            this.map.removeLayer(this.currentMarker);
        }

        // Add new marker
        this.currentMarker = L.marker([lat, lon], { icon: this.markerIcon })
            .addTo(this.map)
            .bindPopup(`
                <div style="color: #fff; font-family: Inter, sans-serif;">
                    <strong>📍 Location</strong><br>
                    <span style="font-size: 13px; color: #b8b8d1;">
                        ${lat.toFixed(6)}, ${lon.toFixed(6)}
                    </span>
                </div>
            `)
            .openPopup();

        // Pan to location with smooth animation
        this.map.flyTo([lat, lon], zoom, {
            animate: true,
            duration: 1.5
        });

        // Update location details panel
        this.updateLocationDetails();

        // Show details panel
        const detailsPanel = document.getElementById('details-panel');
        detailsPanel.classList.remove('hidden');

        console.log(`✅ Navigate to: ${lat}, ${lon}`);
    }

    updateLocationDetails() {
        if (!this.currentLocation) return;

        const { lat, lon } = this.currentLocation;
        const zoom = this.map.getZoom();

        // Update details
        document.getElementById('detail-coords').textContent =
            `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        document.getElementById('detail-lat').textContent =
            `${lat.toFixed(6)}°`;
        document.getElementById('detail-lon').textContent =
            `${lon.toFixed(6)}°`;
        document.getElementById('detail-zoom').textContent = zoom;

        // Trigger reverse geocoding
        if (window.locationDetails) {
            window.locationDetails.reverseGeocode(lat, lon);
        }
    }

    getCurrentBounds() {
        return this.map.getBounds();
    }

    getCurrentZoom() {
        return this.map.getZoom();
    }

    getCurrentCenter() {
        return this.map.getCenter();
    }

    // Get visible tile URLs for caching
    getVisibleTiles() {
        const bounds = this.map.getBounds();
        const zoom = this.map.getZoom();

        const tiles = [];
        const tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

        // Calculate tile coordinates
        const nwTile = this.latLngToTile(bounds.getNorthWest(), zoom);
        const seTile = this.latLngToTile(bounds.getSouthEast(), zoom);

        for (let x = nwTile.x; x <= seTile.x; x++) {
            for (let y = nwTile.y; y <= seTile.y; y++) {
                const url = tileUrl
                    .replace('{z}', zoom)
                    .replace('{x}', x)
                    .replace('{y}', y);
                tiles.push(url);
            }
        }

        return tiles;
    }

    latLngToTile(latLng, zoom) {
        const lat = latLng.lat;
        const lng = latLng.lng;

        const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
        const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) +
            1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));

        return { x, y };
    }
}

// Export
window.MapManager = MapManager;
