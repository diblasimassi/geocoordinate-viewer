// === Location Details Manager ===
// Manages location details panel and reverse geocoding

class LocationDetails {
    constructor() {
        this.geocodeCache = new Map();
        this.init();
    }

    init() {
        console.log('✅ Location Details Manager initialized');
    }

    // Reverse geocoding using Nominatim (OpenStreetMap)
    async reverseGeocode(lat, lon) {
        const addressEl = document.getElementById('detail-address');

        // Check cache first
        const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;

        if (this.geocodeCache.has(cacheKey)) {
            addressEl.textContent = this.geocodeCache.get(cacheKey);
            addressEl.classList.remove('loading');
            return;
        }

        // Check if online
        if (!navigator.onLine) {
            addressEl.textContent = 'Not available offline';
            addressEl.classList.remove('loading');
            return;
        }

        // Show loading
        addressEl.innerHTML = '<span class="spinner"></span> Loading...';
        addressEl.classList.add('loading');

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
                {
                    headers: {
                        'Accept-Language': 'it'
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                const address = this.formatAddress(data);

                // Cache the result
                this.geocodeCache.set(cacheKey, address);

                // Update UI
                addressEl.textContent = address;
                addressEl.classList.remove('loading');

                // Store in localStorage for offline use
                this.saveToLocalStorage(cacheKey, address);
            } else {
                addressEl.textContent = 'Address not found';
                addressEl.classList.remove('loading');
            }
        } catch (error) {
            console.error('Reverse geocoding error:', error);

            // Try to load from localStorage
            const cached = this.loadFromLocalStorage(cacheKey);
            if (cached) {
                addressEl.textContent = cached + ' (cache)';
            } else {
                addressEl.textContent = 'Error retrieving address';
            }
            addressEl.classList.remove('loading');
        }
    }

    formatAddress(data) {
        if (!data || !data.address) {
            return 'Indirizzo sconosciuto';
        }

        const addr = data.address;
        const parts = [];

        // Build address string
        if (addr.road) parts.push(addr.road);
        if (addr.house_number) parts.push(addr.house_number);
        if (addr.village || addr.town || addr.city) {
            parts.push(addr.village || addr.town || addr.city);
        }
        if (addr.state) parts.push(addr.state);
        if (addr.country) parts.push(addr.country);

        return parts.length > 0 ? parts.join(', ') : 'Unknown address';
    }

    saveToLocalStorage(key, value) {
        try {
            const geocodeData = JSON.parse(localStorage.getItem('geocode-cache') || '{}');
            geocodeData[key] = value;
            localStorage.setItem('geocode-cache', JSON.stringify(geocodeData));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }

    loadFromLocalStorage(key) {
        try {
            const geocodeData = JSON.parse(localStorage.getItem('geocode-cache') || '{}');
            return geocodeData[key] || null;
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return null;
        }
    }

    // Copy coordinates to clipboard
    async copyCoordinates(lat, lon) {
        const coords = `${lat}, ${lon}`;

        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(coords);
                this.showNotification('✅ Coordinate copiate!');
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = coords;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.showNotification('✅ Coordinate copiate!');
            }
        } catch (error) {
            console.error('Error copying coordinates:', error);
            this.showNotification('❌ Copy error');
        }
    }

    // Share location
    async shareLocation(lat, lon) {
        const coords = `${lat}, ${lon}`;
        const url = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=16`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Geographic Coordinates',
                    text: `Coordinates: ${coords}`,
                    url: url
                });
                this.showNotification('✅ Shared!');
            } catch (error) {
                console.error('Error sharing:', error);
            }
        } else {
            // Fallback: copy URL to clipboard
            try {
                await navigator.clipboard.writeText(url);
                this.showNotification('✅ Link copied to clipboard!');
            } catch (error) {
                console.error('Error copying URL:', error);
            }
        }
    }

    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            background: var(--surface);
            color: var(--text-primary);
            padding: 15px 25px;
            border-radius: 12px;
            box-shadow: var(--shadow-lg);
            z-index: 9999;
            border: 1px solid var(--glass-border);
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Export
window.LocationDetails = LocationDetails;
