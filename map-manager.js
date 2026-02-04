// === Map Manager ===
// Manages Leaflet map initialization, markers, and navigation

class MapManager {
    constructor() {
        this.map = null;
        this.currentMarker = null;
        this.currentLocation = null;
        this.currentESAFacility = null; // Track current ESA facility
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
            this.updateLocationDetails(this.currentESAFacility);
        });

        // Click on map to get coordinates
        this.map.on('click', (e) => {
            this.goToLocation(e.latlng.lat, e.latlng.lng);
        });

        console.log('✅ Map initialized with ESRI World Imagery');
    }

    // ESA Facilities Data
    getESAFacilities() {
        return [
            {
                name: 'ESRIN',
                lat: 41.8273,
                lon: 12.6734,
                radius: 2,
                desc: 'ESA Centre for Earth Observation',
                location: 'Frascati, Italy',
                established: '1966',
                function: 'Earth observation data processing and distribution. Houses the ESA Climate Office and hosts mission control for several Earth observation satellites.',
                staff: '~370 employees'
            },
            {
                name: 'ESTEC',
                lat: 52.2167,
                lon: 4.4208,
                radius: 2,
                desc: 'European Space Research and Technology Centre',
                location: 'Noordwijk, Netherlands',
                established: '1968',
                function: 'ESA\'s largest establishment. Design, development and testing of spacecraft and technology. Home to mission control for several satellites.',
                staff: '~2,700 employees'
            },
            {
                name: 'ESOC',
                lat: 49.8719,
                lon: 8.6228,
                radius: 2,
                desc: 'European Space Operations Centre',
                location: 'Darmstadt, Germany',
                established: '1967',
                function: 'Mission control for ESA satellites. Operates spacecraft, plans missions, and maintains the ground station network.',
                staff: '~800 employees'
            },
            {
                name: 'ESA HQ',
                lat: 48.8467,
                lon: 2.3706,
                radius: 2,
                desc: 'ESA Headquarters',
                location: 'Paris, France',
                established: '1975',
                function: 'Administrative headquarters of the European Space Agency. Manages overall agency policy and programs.',
                staff: '~280 employees'
            },
            {
                name: 'ESAC',
                lat: 40.4425,
                lon: -3.9528,
                radius: 2,
                desc: 'European Space Astronomy Centre',
                location: 'Villanueva de la Cañada (Madrid), Spain',
                established: '2008',
                function: 'Houses science operations for ESA astronomy and planetary missions. Home to the ESA archive for space science missions.',
                staff: '~290 employees'
            },
            {
                name: 'CSG',
                lat: 5.2394,
                lon: -52.7683,
                radius: 3,
                desc: 'Guiana Space Centre',
                location: 'Kourou, French Guiana',
                established: '1968',
                function: 'Europe\'s Spaceport. Launch site for Ariane rockets and provides launch services for ESA and commercial customers.',
                staff: '~1,700 employees'
            }
        ];
    }

    goToLocation(lat, lon, zoom = 16) {
        if (!lat || !lon) {
            console.error('Invalid coordinates');
            return;
        }

        this.currentLocation = { lat, lon };

        // Check if matching ESA facility
        const esaFacility = this.getNearbyESA(lat, lon);
        this.currentESAFacility = esaFacility; // Store for later use
        const targetZoom = esaFacility ? 18 : zoom;

        // Remove previous marker
        if (this.currentMarker) {
            this.map.removeLayer(this.currentMarker);
        }

        // Add new marker
        this.currentMarker = L.marker([lat, lon], { icon: this.markerIcon })
            .addTo(this.map)
            .bindPopup(`
                <div style="color: #fff; font-family: Inter, sans-serif;">
                    <strong>${esaFacility ? 'ESA: ' + esaFacility.name : '📍 Location'}</strong><br>
                    <span style="font-size: 13px; color: #b8b8d1;">
                        ${lat.toFixed(6)}, ${lon.toFixed(6)}
                    </span>
                </div>
            `)
            .openPopup();

        // Pan to location with smooth animation
        this.map.flyTo([lat, lon], targetZoom, {
            animate: true,
            duration: 1.5
        });

        // Update location details panel
        this.updateLocationDetails(esaFacility);

        // Logic: Only show panel if ESA facility
        const detailsPanel = document.getElementById('details-panel');
        if (esaFacility) {
            detailsPanel.classList.remove('hidden');
            console.log(`✅ Navigate to ESA Facility: ${esaFacility.name}`);
        } else {
            detailsPanel.classList.add('hidden');
            console.log(`✅ Navigate to: ${lat}, ${lon} (Panel hidden)`);
        }
    }

    getNearbyESA(lat, lon) {
        const facilities = this.getESAFacilities();
        // Check if within 2km of any facility
        // Simple distance check (approximate)
        for (const facility of facilities) {
            const dist = this.calculateDistance(lat, lon, facility.lat, facility.lon);
            if (dist <= 2) { // 2km radius
                return facility;
            }
        }
        return null;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of the earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // Distance in km
        return d;
    }

    deg2rad(deg) {
        return deg * (Math.PI / 180);
    }

    updateLocationDetails(esaFacility = null) {
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

        // Update ESA Info
        const esaInfo = document.getElementById('esa-info');
        if (esaFacility) {
            esaInfo.classList.remove('hidden');
            document.getElementById('esa-name').textContent = esaFacility.name;
            document.getElementById('esa-desc').textContent = esaFacility.desc;
            document.getElementById('esa-location').textContent = esaFacility.location;
            document.getElementById('esa-established').textContent = esaFacility.established;
            document.getElementById('esa-staff').textContent = esaFacility.staff;
            document.getElementById('esa-function').textContent = esaFacility.function;
        } else {
            esaInfo.classList.add('hidden');
        }

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
