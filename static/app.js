let map, marker, chart;
let currentLayer = 'street';
let baseLayers = {};
let autoUpdateInterval = null;
let isAutoUpdateEnabled = false;
let pollutionLayer = null;
let nasaLayers = {
	fires: null,
	aerosol: null,
	precipitation: null,
	aqiHeatmap: null
};
let nasaMarkers = [];
let isFullscreenMap = false; // Track fullscreen state

// 🗺️ Fullscreen Map Toggle Function
function toggleFullscreenMap() {
	const mapCard = document.getElementById('mapCard');
	const fullscreenBtn = document.getElementById('fullscreenBtn');
	const fullscreenIcon = fullscreenBtn.querySelector('.fullscreen-icon');
	
	if (!isFullscreenMap) {
		// Enter fullscreen mode
		mapCard.classList.add('fullscreen-mode');
		fullscreenIcon.textContent = '✕';
		isFullscreenMap = true;
		
		// Add notification
		showLocationNotification('🗺️ Fullscreen Mode Active - Press ESC or click Exit to close', 'info');
		
		// Add ESC key listener
		document.addEventListener('keydown', handleEscKey);
		
		// Invalidate map size after animation
		setTimeout(() => {
			if (map) {
				map.invalidateSize();
				addDebugMessage('Map resized for fullscreen mode');
			}
		}, 350);
		
	} else {
		// Exit fullscreen mode
		exitFullscreenMap();
	}
}

function exitFullscreenMap() {
	const mapCard = document.getElementById('mapCard');
	const fullscreenBtn = document.getElementById('fullscreenBtn');
	const fullscreenIcon = fullscreenBtn.querySelector('.fullscreen-icon');
	
	mapCard.classList.remove('fullscreen-mode');
	fullscreenIcon.textContent = '⛶';
	isFullscreenMap = false;
	
	// Remove ESC key listener
	document.removeEventListener('keydown', handleEscKey);
	
	// Invalidate map size after animation
	setTimeout(() => {
		if (map) {
			map.invalidateSize();
			addDebugMessage('Map resized back to normal');
		}
	}, 350);
}

function handleEscKey(event) {
	if (event.key === 'Escape' && isFullscreenMap) {
		exitFullscreenMap();
	}
}

function setStatus(text){
	const el = document.getElementById('status');
	if(el) el.textContent = text;
	
	// Also update debug panel
	addDebugMessage(`Status: ${text}`);
}

function addDebugMessage(message) {
	const debugEl = document.getElementById('debugMessages');
	if (debugEl) {
		const time = new Date().toLocaleTimeString();
		const newMessage = `[${time}] ${message}`;
		debugEl.innerHTML = newMessage + '<br>' + debugEl.innerHTML;
		
		// Keep only last 10 messages
		const lines = debugEl.innerHTML.split('<br>');
		if (lines.length > 10) {
			debugEl.innerHTML = lines.slice(0, 10).join('<br>');
		}
	}
	console.log('🔍 DEBUG:', message);
}

// AQI Color mapping function
function getAQIColor(aqi) {
	if (aqi <= 1) return '#00e400'; // Good - Bright Green
	if (aqi <= 2) return '#ffff00'; // Moderate - Yellow
	if (aqi <= 3) return '#ff7e00'; // Unhealthy for Sensitive - Orange
	if (aqi <= 4) return '#ff0000'; // Unhealthy - Red
	if (aqi <= 5) return '#8f3f97'; // Very Unhealthy - Purple
	return '#7e0023'; // Hazardous - Maroon
}

// Get AQI zone description
function getAQIZoneDescription(aqi) {
	if (aqi <= 1) return 'Good Air Quality ✅';
	if (aqi <= 2) return 'Moderate Air Quality ⚠️';
	if (aqi <= 3) return 'Unhealthy for Sensitive Groups 🟠';
	if (aqi <= 4) return 'Unhealthy Air Quality ❌';
	if (aqi <= 5) return 'Very Unhealthy Air Quality 🚫';
	return 'Hazardous Air Quality ☠️';
}

// Weather icon mapping function
function getWeatherIcon(iconCode) {
	// OpenWeather icon codes to emoji mapping
	const iconMap = {
		'01d': '☀️', '01n': '🌙', // clear sky
		'02d': '⛅', '02n': '☁️', // few clouds
		'03d': '☁️', '03n': '☁️', // scattered clouds
		'04d': '☁️', '04n': '☁️', // broken clouds
		'09d': '🌧️', '09n': '🌧️', // shower rain
		'10d': '🌦️', '10n': '🌧️', // rain
		'11d': '⛈️', '11n': '⛈️', // thunderstorm
		'13d': '❄️', '13n': '❄️', // snow
		'50d': '🌫️', '50n': '🌫️'  // mist
	};
	return iconMap[iconCode] || '🌤️';
}

// Update top bar location name
async function updateTopBarLocationName(lat, lon) {
	const locationNameEl = document.getElementById('weatherLocationName');
	if (!locationNameEl) return;
	
	try {
		locationNameEl.textContent = 'Loading...';
		const locationName = await getLocationName(lat, lon);
		
		// Extract just city/state or shorten if needed
		let displayName = locationName;
		if (locationName.includes(',')) {
			const parts = locationName.split(',').map(p => p.trim());
			// Show city and country/state only
			if (parts.length >= 2) {
				displayName = `${parts[0]}, ${parts[parts.length - 1]}`;
			}
		}
		
		locationNameEl.textContent = displayName;
	} catch (error) {
		console.error('Error updating location name:', error);
		locationNameEl.textContent = `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
	}
}

// Update weather display with attractive conditions
function updateWeatherDisplay(weatherCondition) {
	const iconEl = document.querySelector('.weather-icon');
	const textEl = document.querySelector('.weather-text');
	
	// Also update top weather bar
	const barIcon = document.querySelector('.weather-bar-icon');
	const barText = document.querySelector('.weather-bar-text');
	const barDetails = document.querySelector('.weather-bar-details');
	const locationNameEl = document.getElementById('weatherLocationName');
	
	addDebugMessage('🔍 Updating weather display...');
	
	if (weatherCondition) {
		const emoji = getWeatherIcon(weatherCondition.icon);
		const temp = weatherCondition.temp ? Math.round(weatherCondition.temp) : 'N/A';
		const feelsLike = weatherCondition.feels_like ? Math.round(weatherCondition.feels_like) : 'N/A';
		const humidity = weatherCondition.humidity || 'N/A';
		const windSpeed = weatherCondition.wind_speed ? (weatherCondition.wind_speed * 3.6).toFixed(1) : 'N/A'; // Convert m/s to km/h
		const visibility = weatherCondition.visibility ? (weatherCondition.visibility / 1000).toFixed(1) : 'N/A'; // Convert m to km
		
		// Update top weather bar
		if (barIcon && weatherCondition.icon) {
			barIcon.src = `https://openweathermap.org/img/wn/${weatherCondition.icon}@2x.png`;
			barIcon.style.display = 'block';
		}
		if (barText) {
			barText.innerHTML = `${emoji} ${temp}°C - ${weatherCondition.description}`;
		}
		if (barDetails) {
			barDetails.innerHTML = `
				<span>🌡️ Feels: ${feelsLike}°C</span>
				<span>💧 ${humidity}%</span>
				<span>💨 ${windSpeed} km/h</span>
				<span>👁️ ${visibility} km</span>
			`;
		}
		
		// Update location name if coordinates are available
		if (locationNameEl && weatherCondition.lat && weatherCondition.lon) {
			updateTopBarLocationName(weatherCondition.lat, weatherCondition.lon);
		}
		
		// Hide the old weather icon img and show emoji instead
		if (iconEl) {
			iconEl.style.display = 'none';
		}
		
		if (textEl) {
			textEl.innerHTML = `
				<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;" class="weather-display">
					<span class="weather-emoji" style="font-size: 36px;">${emoji}</span>
					<div>
						<div class="weather-temp" style="font-size: 20px; font-weight: bold;">${temp}°C</div>
						<div style="font-size: 12px; color: #64748b; text-transform: capitalize; margin-top: 2px;">${weatherCondition.description}</div>
					</div>
				</div>
				<div class="weather-details" style="font-size: 12px; color: #475569; line-height: 1.5;">
					<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
						<span>🌡️ Feels like: <strong>${feelsLike}°C</strong></span>
						<span>💧 Humidity: <strong>${humidity}%</strong></span>
						<span>💨 Wind: <strong>${windSpeed} km/h</strong></span>
						<span>👁️ Visibility: <strong>${visibility} km</strong></span>
					</div>
				</div>
			`;
			addDebugMessage(`🔍 Weather updated: ${weatherCondition.main} ${temp}°C`);
		}
	} else {
		// Update top bar fallback
		if (barText) {
			barText.innerHTML = '🌤️ Loading weather data...';
		}
		if (barDetails) {
			barDetails.innerHTML = '';
		}
		
		// Show fallback when no weather data
		if (iconEl) {
			iconEl.style.display = 'none';
		}
		if (textEl) {
			textEl.innerHTML = `
				<div style="display: flex; align-items: center; gap: 10px;">
					<span style="font-size: 36px;">🌤️</span>
					<div>
						<div style="font-size: 16px; color: #64748b;">Weather Unavailable</div>
						<div style="font-size: 12px; color: #9ca3af;">No current weather data</div>
					</div>
				</div>
			`;
			addDebugMessage('🔍 Weather display set to fallback');
		}
	}
}

function toggleAutoUpdate() {
	const btn = document.getElementById('autoUpdateBtn');
	if (isAutoUpdateEnabled) {
		// Stop auto update
		if (autoUpdateInterval) {
			clearInterval(autoUpdateInterval);
			autoUpdateInterval = null;
		}
		isAutoUpdateEnabled = false;
		btn.textContent = 'Start Auto-Update';
		btn.className = 'btn btn-success';
		setStatus('Auto-update stopped');
	} else {
		// Start auto update (every 5 minutes)
		autoUpdateInterval = setInterval(() => {
			console.log('Auto-updating data...');
			load();
		}, 5 * 60 * 1000); // 5 minutes
		isAutoUpdateEnabled = true;
		btn.textContent = 'Stop Auto-Update';
		btn.className = 'btn btn-danger';
		setStatus('Auto-update started (every 5 min)');
	}
}

// ----- User-provided constants -----
const PreLoader = document.querySelector('.loader');
const apikey = '40912be1499980a4e22d60c80e398463';
const apiurl = 'https://api.openweathermap.org/data/2.5/weather?units=metric&q=';
const ICONapi = 'https://openweathermap.org/img/wn/';
const RevGeoAPI = 'https://ipapi.co/json/';
const searchbox = document.querySelector('.search input');
const searchbtn = document.querySelector('.search button');
const loadingSpinner = document.querySelector('.SpinLoader');
const weathericon = document.querySelector('.weather-icon');

// Chat UI
let lastAggregate = null;
let chatHistory = [];
let isTyping = false;

function appendChat(role, content, isTemporary = false){
	const box = document.getElementById('chatbox');
	if(!box) return;
	const row = document.createElement('div');
	row.className = `msg ${role}`;
	if (isTemporary) {
		row.classList.add('temporary');
	}
	
	if (role === 'assistant' && content.includes('typing')) {
		row.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
	} else {
		row.textContent = content;
	}
	
	box.appendChild(row);
	box.scrollTop = box.scrollHeight;
	return row;
}

function removeTypingIndicator() {
	const box = document.getElementById('chatbox');
	const typingMsg = box.querySelector('.msg.temporary');
	if (typingMsg) {
		typingMsg.remove();
	}
}

async function sendChatMessage(msg){
	if (isTyping) return; // Prevent multiple simultaneous requests
	
	appendChat('user', msg);
	chatHistory.push({ role: 'user', content: msg });
	
	// Show typing indicator
	isTyping = true;
	const typingMsg = appendChat('assistant', 'AI is typing...', true);
	
	try{
		const res = await fetch('/api/gemini/chat', {
			method: 'POST', 
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ 
				message: msg, 
				history: chatHistory.slice(-10), // Keep only last 10 messages for context
				context: lastAggregate || {} 
			})
		});
		
		removeTypingIndicator();
		isTyping = false;
		
		if (!res.ok) {
			throw new Error(`HTTP ${res.status}: ${res.statusText}`);
		}
		
		const data = await res.json();
		const reply = data.reply || 'Sorry, I could not generate a response.';
		appendChat('assistant', reply);
		chatHistory.push({ role: 'assistant', content: reply });
		
	} catch(e) {
		removeTypingIndicator();
		isTyping = false;
		console.error('Chat error:', e);
		appendChat('assistant', `Sorry, chat is temporarily unavailable. Error: ${e.message}`);
	}
}

// 📍 Auto Location Detection Functions
function autoDetectLocation() {
	if (navigator.geolocation) {
		setStatus('🌍 Detecting your location...');
		addDebugMessage('Requesting location permission...');
		
		navigator.geolocation.getCurrentPosition(
			onLocationSuccess,
			onLocationError,
			{
				enableHighAccuracy: true,
				timeout: 10000,
				maximumAge: 300000 // 5 minutes cache
			}
		);
	} else {
		setStatus('❌ Geolocation not supported by browser');
		addDebugMessage('Geolocation API not available');
		useDefaultLocation();
	}
}

function onLocationSuccess(position) {
	const lat = position.coords.latitude;
	const lon = position.coords.longitude;
	const accuracy = position.coords.accuracy;
	
	addDebugMessage(`Location detected: ${lat.toFixed(4)}, ${lon.toFixed(4)} (±${accuracy}m)`);
	setStatus(`📍 Location detected! Accuracy: ±${Math.round(accuracy)}m`);
	
	// Update input fields
	document.getElementById('lat').value = lat.toFixed(4);
	document.getElementById('lon').value = lon.toFixed(4);
	
	// Update map view and marker
	map.setView([lat, lon], 12);
	if (marker) {
		marker.setLatLng([lat, lon]);
	} else {
		marker = L.marker([lat, lon]).addTo(map);
	}
	
	// Load data for detected location
	load();
	
	// Show success notification
	showLocationNotification('success', `📍 Your location detected: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
}

function onLocationError(error) {
	let errorMessage = 'Location detection failed';
	
	switch(error.code) {
		case error.PERMISSION_DENIED:
			errorMessage = '❌ Location access denied by user';
			addDebugMessage('User denied the request for Geolocation.');
			break;
		case error.POSITION_UNAVAILABLE:
			errorMessage = '❌ Location information unavailable';
			addDebugMessage('Location information is unavailable.');
			break;
		case error.TIMEOUT:
			errorMessage = '❌ Location request timeout';
			addDebugMessage('The request to get user location timed out.');
			break;
		default:
			errorMessage = '❌ Unknown location error';
			addDebugMessage('An unknown error occurred while retrieving location.');
			break;
	}
	
	setStatus(errorMessage);
	showLocationNotification('error', errorMessage);
	useDefaultLocation();
}

function useDefaultLocation() {
	const defaultLat = 28.6139;
	const defaultLon = 77.2090;
	
	addDebugMessage(`Using default location: Delhi (${defaultLat}, ${defaultLon})`);
	setStatus('🏢 Using default location: Delhi, India');
	
	// Ensure map and marker are set to default
	map.setView([defaultLat, defaultLon], 10);
	if (!marker) {
		marker = L.marker([defaultLat, defaultLon]).addTo(map);
	}
	
	showLocationNotification('info', '🏢 Using default location: Delhi, India');
}

function showLocationNotification(type, message) {
	// Create notification element
	const notification = document.createElement('div');
	notification.className = `location-notification ${type}`;
	notification.innerHTML = `
		<div style="display: flex; align-items: center; gap: 8px;">
			<span style="font-size: 16px;">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
			<span style="flex: 1; font-size: 13px;">${message}</span>
			<button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 16px; cursor: pointer; color: #666;">×</button>
		</div>
	`;
	
	// Add to page
	document.body.appendChild(notification);
	
	// Auto remove after 5 seconds
	setTimeout(() => {
		if (notification.parentElement) {
			notification.remove();
		}
	}, 5000);
}

function initMap(){
	map = L.map('map').setView([28.6139, 77.2090], 10);
	
	// Use HD Satellite View as default (Google Satellite)
	const satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
		maxZoom: 20,
		attribution: '&copy; Google',
		subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
	});
	
	satelliteLayer.addTo(map);
	
	// Add labels overlay layer for place names (hybrid view)
	const labelsLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
		maxZoom: 20,
		attribution: '&copy; Google',
		subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
	});
	
	labelsLayer.addTo(map);
	currentLayer = 'satellite';

	// Auto-detect user location on page load
	autoDetectLocation();

	marker = L.marker([28.6139, 77.2090], {draggable:true}).addTo(map);
	marker.on('dragend', () => {
		const {lat, lng} = marker.getLatLng();
		document.getElementById('lat').value = lat.toFixed(4);
		document.getElementById('lon').value = lng.toFixed(4);
		load();
	});

	map.on('click', async (e) => {
		marker.setLatLng(e.latlng);
		document.getElementById('lat').value = e.latlng.lat.toFixed(4);
		document.getElementById('lon').value = e.latlng.lng.toFixed(4);
		
		// Update status with location name
		const statusEl = document.getElementById('status');
		if (statusEl) {
			statusEl.innerHTML = `
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
					<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="#6366f1" stroke-width="2" fill="none"/>
					<circle cx="12" cy="10" r="3" fill="#6366f1"/>
				</svg>
				<span>Loading location...</span>
			`;
		}
		
		// Get location name
		const locationName = await getLocationName(e.latlng.lat, e.latlng.lng);
		if (statusEl) {
			statusEl.innerHTML = `
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
					<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="#10b981" stroke-width="2" fill="none"/>
					<circle cx="12" cy="10" r="3" fill="#10b981"/>
				</svg>
				<span>📍 ${locationName}</span>
			`;
		}
		
		load();
		
		// 🎬 Generate 24-hour video timeline on map click!
		get24HourPrediction(e.latlng.lat, e.latlng.lng);
	});
	
	// Add NASA Map Controls
	addNASAMapControls();
	
	// Add location search functionality
	const searchBtn = document.getElementById('searchBtn');
	const searchInput = document.getElementById('locationSearch');
	const searchResults = document.getElementById('searchResults');
	
	if (searchBtn && searchInput) {
		searchBtn.addEventListener('click', () => performLocationSearch());
		searchInput.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') {
				performLocationSearch();
			}
		});
		
		// Close search results when clicking outside
		document.addEventListener('click', (e) => {
			if (!e.target.closest('.location-search-container') && !e.target.closest('.search-results')) {
				searchResults.classList.remove('active');
			}
		});
	}
}

async function performLocationSearch() {
	const searchInput = document.getElementById('locationSearch');
	const searchResults = document.getElementById('searchResults');
	const query = searchInput.value.trim();
	
	if (!query) {
		showLocationNotification('error', 'Please enter a location to search');
		return;
	}
	
	try {
		searchResults.innerHTML = '<div class="search-result-item" style="text-align:center;color:#94a3b8;">🔍 Searching...</div>';
		searchResults.classList.add('active');
		
		// Use Nominatim geocoding API
		const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`);
		
		if (!response.ok) {
			throw new Error('Search failed');
		}
		
		const results = await response.json();
		
		if (results.length === 0) {
			searchResults.innerHTML = '<div class="search-result-item" style="text-align:center;color:#f87171;">❌ No locations found</div>';
			return;
		}
		
		// Display results
		searchResults.innerHTML = results.map(result => `
			<div class="search-result-item" data-lat="${result.lat}" data-lon="${result.lon}">
				<span class="search-result-name">📍 ${result.name || result.display_name.split(',')[0]}</span>
				<span class="search-result-address">${result.display_name}</span>
			</div>
		`).join('');
		
		// Add click handlers to results
		searchResults.querySelectorAll('.search-result-item').forEach(item => {
			item.addEventListener('click', () => {
				const lat = parseFloat(item.dataset.lat);
				const lon = parseFloat(item.dataset.lon);
				
				// Update map and inputs
				document.getElementById('lat').value = lat.toFixed(4);
				document.getElementById('lon').value = lon.toFixed(4);
				marker.setLatLng([lat, lon]);
				map.setView([lat, lon], 12);
				
				// Load data for this location
				load();
				
				// Clear search
				searchInput.value = '';
				searchResults.classList.remove('active');
				
				showLocationNotification('success', `� Location updated to ${item.querySelector('.search-result-name').textContent}`);
			});
		});
		
	} catch (error) {
		console.error('Search error:', error);
		searchResults.innerHTML = '<div class="search-result-item" style="text-align:center;color:#f87171;">❌ Search failed. Please try again.</div>';
		showLocationNotification('error', 'Failed to search location. Please try again.');
	}
}

// Add pollution zone visualization
function addPollutionZone(lat, lon, aqi, radius = 2000) {
	// Remove existing pollution layer
	if (pollutionLayer) {
		map.removeLayer(pollutionLayer);
	}
	
	if (!aqi || aqi === null) return;
	
	const color = getAQIColor(aqi);
	const description = getAQIZoneDescription(aqi);
	
	// Create a circle to show pollution zone
	pollutionLayer = L.circle([lat, lon], {
		color: color,
		fillColor: color,
		fillOpacity: 0.3,
		radius: radius,
		weight: 3
	}).addTo(map);
	
	// Add popup with AQI information
	pollutionLayer.bindPopup(`
		<div style="text-align: center; padding: 10px;">
			<h4 style="margin: 0 0 8px 0; color: ${color};">🌬️ Air Quality Zone</h4>
			<p style="margin: 0; font-weight: bold;">AQI Level: ${aqi}</p>
			<p style="margin: 4px 0 0 0; font-size: 14px;">${description}</p>
		</div>
	`);
	
	// Update marker with AQI color
	const aqiIcon = L.divIcon({
		className: 'aqi-marker',
		html: `
			<div style="
				background: ${color}; 
				width: 25px; 
				height: 25px; 
				border-radius: 50%; 
				border: 3px solid white; 
				display: flex; 
				align-items: center; 
				justify-content: center; 
				font-weight: bold; 
				color: white; 
				font-size: 12px;
				box-shadow: 0 2px 5px rgba(0,0,0,0.3);
			">${Math.round(aqi)}</div>
		`,
		iconSize: [25, 25],
		iconAnchor: [12, 12]
	});
	
	marker.setIcon(aqiIcon);
}

async function fetchAggregate(lat, lon){
	const url = `/api/aggregate?lat=${lat}&lon=${lon}`;
	console.log('🔍 DEBUG: Fetching URL:', url);
	try {
		const res = await fetch(url);
		console.log('🔍 DEBUG: Response status:', res.status);
		console.log('🔍 DEBUG: Response headers:', [...res.headers.entries()]);
		
		if(!res.ok) {
			console.error('🔍 DEBUG: API Error:', res.status, res.statusText);
			const errorText = await res.text();
			console.error('🔍 DEBUG: Error response body:', errorText);
			throw new Error(`API returned ${res.status}: ${res.statusText} - ${errorText}`);
		}
		const data = await res.json();
		console.log('🔍 DEBUG: Aggregate response:', data);
		lastAggregate = data;
		return data;
	} catch (error) {
		console.error('🔍 DEBUG: Fetch error details:', error);
		console.error('🔍 DEBUG: Error stack:', error.stack);
		throw error;
	}
}

function buildChartData(realtime, daily){
	const labels = [];
	const values = [];
	if(realtime && typeof realtime.aqi === 'number'){
		labels.push('Now');
		values.push(realtime.aqi);
	}
	if(daily && daily.length){
		for(const [d, v] of daily){
			labels.push(d);
			values.push(v);
		}
	}
	return { labels, values };
}

function renderChartFrom(realtime, daily){
	const ctx = document.getElementById('aqiChart');
	const { labels, values } = buildChartData(realtime, daily);
	if(chart){ chart.destroy(); }
	
	// Create gradient
	const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
	gradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
	gradient.addColorStop(0.5, 'rgba(251, 191, 36, 0.3)');
	gradient.addColorStop(1, 'rgba(239, 68, 68, 0.2)');
	
	chart = new Chart(ctx, {
		type: 'line',
		data: {
			labels,
			datasets: [{
				label: 'AQI Forecast',
				data: values,
				borderColor: 'rgba(16, 185, 129, 1)',
				backgroundColor: gradient,
				borderWidth: 3,
				pointBackgroundColor: values.map(v => 
					v <= 50 ? '#10b981' : 
					v <= 100 ? '#fbbf24' : 
					v <= 150 ? '#f59e0b' : '#ef4444'
				),
				pointBorderColor: '#ffffff',
				pointBorderWidth: 2,
				pointRadius: 6,
				pointHoverRadius: 8,
				tension: 0.4,
				fill: true
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			plugins: {
				legend: {
					display: true,
					labels: {
						color: '#d1fae5',
						font: {
							size: 12,
							weight: 'bold'
						},
						padding: 15,
						usePointStyle: true
					}
				},
				tooltip: {
					backgroundColor: 'rgba(6, 78, 59, 0.95)',
					titleColor: '#ffffff',
					bodyColor: '#d1fae5',
					borderColor: '#10b981',
					borderWidth: 2,
					padding: 12,
					displayColors: true,
					callbacks: {
						label: function(context) {
							const value = context.parsed.y;
							let level = 'Good';
							if (value > 150) level = 'Unhealthy';
							else if (value > 100) level = 'Sensitive';
							else if (value > 50) level = 'Moderate';
							return `AQI: ${value} (${level})`;
						}
					}
				}
			},
			scales: { 
				y: { 
					beginAtZero: false,
					grid: {
						color: 'rgba(255, 255, 255, 0.1)',
						drawBorder: false
					},
					ticks: {
						color: '#a7f3d0',
						font: {
							size: 11,
							weight: '600'
						},
						callback: function(value) {
							return value;
						}
					},
					title: {
						display: true,
						text: 'AQI Level',
						color: '#d1fae5',
						font: {
							size: 12,
							weight: 'bold'
						}
					}
				},
				x: {
					grid: {
						color: 'rgba(255, 255, 255, 0.05)',
						drawBorder: false
					},
					ticks: {
						color: '#a7f3d0',
						font: {
							size: 10,
							weight: '600'
						}
					}
				}
			},
			interaction: {
				intersect: false,
				mode: 'index'
			}
		}
	});
}

function renderNASA7DayChart(forecastData) {
	const ctx = document.getElementById('aqiChart');
	
	// Prepare data for chart
	const labels = forecastData.map(day => day.day);
	const values = forecastData.map(day => day.predicted_aqi);
	const colors = forecastData.map(day => day.level_color);
	
	// Create gradient
	const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
	gradient.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
	gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.3)');
	gradient.addColorStop(1, 'rgba(16, 185, 129, 0.2)');
	
	if(chart){ chart.destroy(); }
	chart = new Chart(ctx, {
		type: 'line',
		data: {
			labels,
			datasets: [{
				label: 'NASA 7-Day AQI Forecast',
				data: values,
				borderColor: '#8b5cf6',
				backgroundColor: gradient,
				borderWidth: 3,
				pointBackgroundColor: colors,
				pointBorderColor: '#ffffff',
				pointBorderWidth: 2,
				pointRadius: 7,
				pointHoverRadius: 9,
				tension: 0.4,
				fill: true
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			plugins: {
				title: {
					display: true,
					text: '🛰️ NASA + Weather 7-Day AQI Forecast',
					color: '#e0e7ff',
					font: {
						size: 14,
						weight: 'bold'
					},
					padding: {
						top: 10,
						bottom: 15
					}
				},
				legend: {
					display: true,
					labels: {
						color: '#d1fae5',
						font: {
							size: 12,
							weight: 'bold'
						},
						padding: 15,
						usePointStyle: true
					}
				},
				tooltip: {
					backgroundColor: 'rgba(6, 78, 59, 0.95)',
					titleColor: '#ffffff',
					bodyColor: '#d1fae5',
					borderColor: '#8b5cf6',
					borderWidth: 2,
					padding: 12,
					displayColors: true,
					callbacks: {
						label: function(context) {
							const value = context.parsed.y;
							let level = 'Good';
							if (value > 150) level = 'Unhealthy';
							else if (value > 100) level = 'Sensitive';
							else if (value > 50) level = 'Moderate';
							return `AQI: ${value} (${level})`;
						}
					}
				}
			},
			scales: { 
				y: { 
					beginAtZero: false,
					grid: {
						color: 'rgba(255, 255, 255, 0.1)',
						drawBorder: false
					},
					ticks: {
						color: '#a7f3d0',
						font: {
							size: 11,
							weight: '600'
						}
					},
					title: {
						display: true,
						text: 'AQI Value',
						color: '#d1fae5',
						font: {
							size: 12,
							weight: 'bold'
						}
					}
				},
				x: {
					grid: {
						color: 'rgba(255, 255, 255, 0.05)',
						drawBorder: false
					},
					ticks: {
						color: '#a7f3d0',
						font: {
							size: 10,
							weight: '600'
						}
					}
				}
			},
			interaction: {
				intersect: false,
				mode: 'index'
			}
		}
	});
}

// 🤖 AI Suggestion Cards Functions
function displaySuggestionCards(suggestionText, data) {
	console.log('🤖 Creating real-time AI suggestion cards with location data');
	
	// Show loading
	showSuggestionLoading();
	
	setTimeout(() => {
		// Generate cards from real-time data
		const cards = generateRealTimeSuggestions(data, suggestionText);
		
		// Hide loading and placeholder
		document.getElementById('suggestionLoading').style.display = 'none';
		document.getElementById('suggestionPlaceholder').style.display = 'none';
		
		// Show cards container
		const cardsContainer = document.getElementById('suggestionCards');
		cardsContainer.style.display = 'block';
		cardsContainer.innerHTML = '';
		
		// Add cards with staggered animation
		cards.forEach((card, index) => {
			setTimeout(() => {
				cardsContainer.appendChild(card);
			}, index * 100);
		});
	}, 800);
}

function generateRealTimeSuggestions(data, aiText) {
	const cards = [];
	
	// Extract real-time data
	const currentAQI = data?.aqi500?.overall || data?.realtimeAqi?.aqi || 50;
	const pollutants = data?.pollutants?.openweather || {};
	const weather = data?.weather || {};
	const location = data?.location || 'Unknown';
	
	const pm25 = pollutants.pm2_5 || 0;
	const pm10 = pollutants.pm10 || 0;
	const temp = weather.main?.temp || 25;
	const humidity = weather.main?.humidity || 60;
	const windSpeed = weather.wind?.speed || 2;
	
	// 1. Main AQI Status Card
	const aqiLevel = getDetailedAQILevel(currentAQI);
	cards.push(createSuggestionCard({
		icon: aqiLevel.icon,
		title: `Air Quality: ${aqiLevel.level}`,
		content: `Current AQI is ${currentAQI}. ${aqiLevel.healthAdvice}`,
		type: aqiLevel.type,
		priority: aqiLevel.priority,
		source: `Real-time · ${location}`
	}));
	
	// 2. PM2.5 Specific Advice (most harmful)
	if (pm25 > 35) {
		cards.push(createSuggestionCard({
			icon: '🔴',
			title: 'High PM2.5 Detected',
			content: `PM2.5 level is ${pm25.toFixed(1)} µg/m³. Wear N95 mask outdoors. These fine particles can penetrate deep into lungs.`,
			type: 'danger',
			priority: 'high',
			source: 'Pollutant Analysis'
		}));
	} else if (pm25 > 12) {
		cards.push(createSuggestionCard({
			icon: '🟡',
			title: 'Moderate PM2.5 Levels',
			content: `PM2.5 is ${pm25.toFixed(1)} µg/m³. Sensitive groups should limit prolonged outdoor activities.`,
			type: 'warning',
			priority: 'medium',
			source: 'Pollutant Analysis'
		}));
	}
	
	// 3. Outdoor Activity Recommendations
	if (currentAQI <= 50) {
		cards.push(createSuggestionCard({
			icon: '🏃',
			title: 'Great for Outdoor Activities',
			content: 'Air quality is excellent! Perfect time for jogging, cycling, or outdoor exercises.',
			type: 'health',
			priority: 'low',
			source: 'Activity Recommendation'
		}));
	} else if (currentAQI <= 100) {
		cards.push(createSuggestionCard({
			icon: '🚶',
			title: 'Outdoor Activities OK',
			content: 'Moderate air quality. Unusually sensitive people should consider reducing prolonged outdoor exertion.',
			type: 'info',
			priority: 'medium',
			source: 'Activity Recommendation'
		}));
	} else if (currentAQI <= 150) {
		cards.push(createSuggestionCard({
			icon: '😷',
			title: 'Limit Outdoor Exposure',
			content: 'Children, elderly, and people with respiratory issues should reduce outdoor activities. Wear mask if going outside.',
			type: 'warning',
			priority: 'high',
			source: 'Activity Recommendation'
		}));
	} else {
		cards.push(createSuggestionCard({
			icon: '🚫',
			title: 'Avoid Outdoor Activities',
			content: 'Air quality is unhealthy. Stay indoors. Keep windows closed. Use air purifiers if available.',
			type: 'danger',
			priority: 'high',
			source: 'Activity Recommendation'
		}));
	}
	
	// 4. Weather-Based Advice
	if (temp > 35) {
		cards.push(createSuggestionCard({
			icon: '🌡️',
			title: 'High Temperature Alert',
			content: `Temperature is ${temp.toFixed(1)}°C. Combined with pollution, this can worsen respiratory issues. Stay hydrated and indoors during peak hours.`,
			type: 'warning',
			priority: 'high',
			source: 'Weather + AQI Analysis'
		}));
	}
	
	if (windSpeed < 1) {
		cards.push(createSuggestionCard({
			icon: '💨',
			title: 'Low Wind Conditions',
			content: `Wind speed is only ${windSpeed.toFixed(1)} m/s. Pollutants may accumulate. Air quality might worsen.`,
			type: 'warning',
			priority: 'medium',
			source: 'Weather Analysis'
		}));
	} else if (windSpeed > 5) {
		cards.push(createSuggestionCard({
			icon: '🌬️',
			title: 'Good Wind Dispersion',
			content: `Strong winds (${windSpeed.toFixed(1)} m/s) are helping disperse pollutants. Air quality may improve.`,
			type: 'health',
			priority: 'low',
			source: 'Weather Analysis'
		}));
	}
	
	// 5. Time-based advice
	const currentHour = new Date().getHours();
	if (currentHour >= 7 && currentHour <= 9) {
		cards.push(createSuggestionCard({
			icon: '🚗',
			title: 'Morning Rush Hour',
			content: 'Traffic pollution peaks during 7-9 AM. Avoid exercising near roads. Keep vehicle windows closed.',
			type: 'warning',
			priority: 'medium',
			source: 'Time-based Analysis'
		}));
	} else if (currentHour >= 17 && currentHour <= 19) {
		cards.push(createSuggestionCard({
			icon: '🚦',
			title: 'Evening Rush Hour',
			content: 'Evening traffic increases pollution. Stay away from busy roads. Air quality usually worst at this time.',
			type: 'warning',
			priority: 'medium',
			source: 'Time-based Analysis'
		}));
	}
	
	// 6. Indoor recommendations
	if (currentAQI > 100) {
		cards.push(createSuggestionCard({
			icon: '🏠',
			title: 'Indoor Air Quality Tips',
			content: 'Keep windows closed. Use air purifiers with HEPA filters. Avoid burning incense or candles. Increase indoor plants.',
			type: 'info',
			priority: 'medium',
			source: 'Indoor Health Tips'
		}));
	}
	
	// 7. Add AI-generated insights if available
	if (aiText && aiText.length > 20 && !aiText.includes('unavailable')) {
		const aiInsights = extractKeyInsights(aiText);
		if (aiInsights.length > 0) {
			aiInsights.forEach(insight => {
				cards.push(createSuggestionCard({
					icon: '🤖',
					title: 'AI Insight',
					content: insight,
					type: 'info',
					priority: 'low',
					source: 'Google Gemini AI'
				}));
			});
		}
	}
	
	return cards;
}

function getDetailedAQILevel(aqi) {
	if (aqi <= 50) {
		return {
			level: 'Good',
			icon: '🌟',
			healthAdvice: 'Air quality is satisfactory, and air pollution poses little or no risk. Enjoy your outdoor activities!',
			type: 'health',
			priority: 'low'
		};
	} else if (aqi <= 100) {
		return {
			level: 'Moderate',
			icon: '😊',
			healthAdvice: 'Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution.',
			type: 'info',
			priority: 'medium'
		};
	} else if (aqi <= 150) {
		return {
			level: 'Unhealthy for Sensitive Groups',
			icon: '😷',
			healthAdvice: 'Members of sensitive groups may experience health effects. The general public is less likely to be affected.',
			type: 'warning',
			priority: 'medium'
		};
	} else if (aqi <= 200) {
		return {
			level: 'Unhealthy',
			icon: '😨',
			healthAdvice: 'Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects.',
			type: 'warning',
			priority: 'high'
		};
	} else if (aqi <= 300) {
		return {
			level: 'Very Unhealthy',
			icon: '🤢',
			healthAdvice: 'Health alert: The risk of health effects is increased for everyone. Avoid outdoor activities.',
			type: 'danger',
			priority: 'high'
		};
	} else {
		return {
			level: 'Hazardous',
			icon: '💀',
			healthAdvice: 'Health warning of emergency conditions: everyone is more likely to be affected. Stay indoors!',
			type: 'danger',
			priority: 'high'
		};
	}
}

function extractKeyInsights(aiText) {
	// Extract meaningful sentences from AI response
	const sentences = aiText.split(/[.!?]+/)
		.filter(s => s.trim().length > 30 && s.trim().length < 200)
		.map(s => s.trim())
		.slice(0, 2); // Take max 2 insights
	
	return sentences;
}

function showSuggestionLoading() {
	document.getElementById('suggestionLoading').style.display = 'block';
	document.getElementById('suggestionPlaceholder').style.display = 'none';
	document.getElementById('suggestionCards').style.display = 'none';
}

function createSuggestionCard(config) {
	const card = document.createElement('div');
	card.className = `suggestion-card ${config.type || 'info'}`;
	
	// Add priority badge
	const priorityClass = config.priority === 'high' ? 'priority-high' : 
	                     config.priority === 'medium' ? 'priority-medium' : 'priority-low';
	
	card.innerHTML = `
		<div class="suggestion-icon ${priorityClass}">${config.icon}</div>
		<div class="suggestion-content">
			<div class="suggestion-header">
				<h4>${config.title}</h4>
				${config.priority === 'high' ? '<span class="priority-badge">⚠️ Important</span>' : ''}
			</div>
			<p>${config.content}</p>
			<div class="suggestion-source">
				<span class="source-icon">📍</span>
				<span>${config.source || 'AI Analysis'}</span>
			</div>
		</div>
	`;
	
	return card;
}

function getAQILevel(aqi) {
	if (aqi <= 50) {
		return {
			level: 'Good',
			description: 'Air quality is satisfactory and poses little or no health risk.',
			type: 'health',
			priority: 'low'
		};
	} else if (aqi <= 100) {
		return {
			level: 'Moderate',
			description: 'Air quality is acceptable for most people.',
			type: 'info',
			priority: 'medium'
		};
	} else if (aqi <= 150) {
		return {
			level: 'Unhealthy for Sensitive',
			description: 'Sensitive individuals may experience health effects.',
			type: 'warning',
			priority: 'medium'
		};
	} else if (aqi <= 200) {
		return {
			level: 'Unhealthy',
			description: 'Everyone may experience health effects.',
			type: 'warning',
			priority: 'high'
		};
	} else {
		return {
			level: 'Very Unhealthy',
			description: 'Health warnings for emergency conditions.',
			type: 'danger',
			priority: 'high'
		};
	}
}

function getAQIIcon(aqi) {
	if (aqi <= 50) return '🌟';
	if (aqi <= 100) return '😊';
	if (aqi <= 150) return '😐';
	if (aqi <= 200) return '😷';
	return '💀';
}

function createWeatherSuggestion(weather) {
	if (!weather || !weather.main) return null;
	
	const temp = weather.main.temp;
	const humidity = weather.main.humidity;
	const condition = weather.weather?.[0]?.main || 'Clear';
	
	let suggestion = null;
	
	if (temp > 35) {
		suggestion = {
			icon: '🌡️',
			title: 'High Temperature Alert',
			content: `Temperature is ${temp}°C. Stay hydrated and avoid prolonged outdoor exposure.`,
			type: 'warning',
			priority: 'medium',
			source: 'Weather Monitor'
		};
	} else if (humidity > 80) {
		suggestion = {
			icon: '💧',
			title: 'High Humidity',
			content: `Humidity is ${humidity}%. Consider using dehumidifiers for comfort.`,
			type: 'info',
			priority: 'low',
			source: 'Weather Monitor'
		};
	} else if (condition.includes('Rain')) {
		suggestion = {
			icon: '🌧️',
			title: 'Rainy Weather',
			content: 'Rain may help clear air pollutants. Good time for outdoor activities after rain stops.',
			type: 'health',
			priority: 'low',
			source: 'Weather Monitor'
		};
	}
	
	return suggestion;
}

function showInfo(sources, used, pollutants, daily, realtime){
	// Check if old suggestionText element exists (backward compatibility)
	const sug = document.getElementById('suggestionText');
	if (!sug) {
		// New card-based system - add debug info to debug panel instead
		const debugInfo = [];
		const parts = [];
		if(sources){
			parts.push(`OpenWeather: ${sources.openweather ? '✔' : '—'}`);
		}
		const header = parts.length ? `Sources → ${parts.join('  |  ')}` : 'Sources unavailable';
		const usedLine = used ? `Used: ${used}` : 'Used: —';
		const rtLine = realtime ? `Realtime AQI: ${realtime.aqi} (via ${realtime.source})` : 'Realtime AQI: —';
		const pol = [];
		if (pollutants && pollutants.openweather) pol.push(`OW pm2_5=${pollutants.openweather.pm2_5 ?? '—'}, pm10=${pollutants.openweather.pm10 ?? '—'}`);
		const polLine = pol.length ? `Pollutants → ${pol.join(' | ')}` : 'Pollutants: —';
		const listLine = daily && daily.length ? `Daily AQI → ${daily.map(d=>`${d[0]}:${d[1]}`).join(', ')}` : 'Daily AQI: —';
		
		debugInfo.push(header, usedLine, rtLine, polLine, listLine);
		debugInfo.forEach(info => addDebugMessage(info));
		return;
	}
	
	// Legacy support for old text-based system
	const parts = [];
	if(sources){
		parts.push(`OpenWeather: ${sources.openweather ? '✔' : '—'}`);
	}
	const header = parts.length ? `Sources → ${parts.join('  |  ')}` : 'Sources unavailable';
	const usedLine = used ? `Used: ${used}` : 'Used: —';
	const rtLine = realtime ? `Realtime AQI: ${realtime.aqi} (via ${realtime.source})` : 'Realtime AQI: —';
	const pol = [];
	if (pollutants && pollutants.openweather) pol.push(`OW pm2_5=${pollutants.openweather.pm2_5 ?? '—'}, pm10=${pollutants.openweather.pm10 ?? '—'}`);
	const polLine = pol.length ? `Pollutants → ${pol.join(' | ')}` : 'Pollutants: —';
	const listLine = daily && daily.length ? `Daily AQI → ${daily.map(d=>`${d[0]}:${d[1]}`).join(', ')}` : 'Daily AQI: —';
	sug.textContent = [header, usedLine, rtLine, polLine, listLine, '', (sug.textContent || '')].join('\n');
}

async function fetchSuggestion(payload){
	console.log('POST /api/gemini/suggest');
	const res = await fetch('/api/gemini/suggest', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	console.log('suggest status', res.status);
	if(!res.ok) throw new Error('Failed to get suggestion');
	const data = await res.json();
	console.log('suggest json', data);
	return data;
}

async function fetchWeatherCity(city){
	const url = `${apiurl}${encodeURIComponent(city)}&appid=${apikey}`;
	const res = await fetch(url);
	if(!res.ok) throw new Error('weather fetch failed');
	return res.json();
}

async function fetchRevGeo(){
	const res = await fetch(RevGeoAPI);
	if(!res.ok) throw new Error('revgeo failed');
	return res.json();
}

function updateWeatherWidget(w){
	const iconEl = weathericon;
	const textEl = document.querySelector('.weather-text');
	if(!w || !w.weather || !w.weather[0]){
		if(iconEl){ iconEl.style.display = 'none'; }
		if(textEl){ textEl.textContent = 'Weather unavailable'; }
		return;
	}
	const icon = w.weather[0].icon;
	const desc = w.weather[0].description;
	const temp = Math.round(w.main?.temp ?? 0);
	if(iconEl){
		iconEl.src = `${ICONapi}${icon}@2x.png`;
		iconEl.style.display = '';
		iconEl.alt = desc;
	}
	if(textEl){
		const city = w.name;
		textEl.textContent = `${city}: ${temp}°C, ${desc}`;
	}
	if(w.coord && typeof w.coord.lat === 'number' && typeof w.coord.lon === 'number'){
		marker.setLatLng([w.coord.lat, w.coord.lon]);
		map.setView([w.coord.lat, w.coord.lon], 11);
		document.getElementById('lat').value = w.coord.lat.toFixed(4);
		document.getElementById('lon').value = w.coord.lon.toFixed(4);
		load();
	}
}

function updateRealtimeAndPollutants(data){
	const rt = data.realtimeAqi;
	const badge = document.getElementById('realtimeBadge');
	const text = document.getElementById('realtimeText');
	
	// Update realtime AQI badge and text
	if(rt){
		if(badge) badge.textContent = `AQI ${rt.aqi} (${rt.source})`;
		if(text) text.textContent = `Realtime AQI is ${rt.aqi} on OpenWeather 1..5 scale.`;
	}else{
		if(badge) badge.textContent = '—';
		if(text) text.textContent = 'Realtime unavailable';
	}
	
	// Create beautiful pollutant cards
	displayPollutantCards(data);
}

function displayPollutantCards(data) {
	const pollutantsGrid = document.getElementById('pollutantsGrid');
	const placeholder = document.getElementById('pollutantsPlaceholder');
	
	if (!pollutantsGrid) return;
	
	const p = data.pollutants?.openweather || {};
	const aqi500 = data.aqi500 || {};
	const overallAQI = aqi500.overall || 0;
	
	// Hide placeholder, show grid
	if (placeholder) placeholder.style.display = 'none';
	pollutantsGrid.style.display = 'grid';
	pollutantsGrid.innerHTML = '';
	
	// Create main AQI summary card
	const aqiLevel = getAQILevel(overallAQI);
	const summaryCard = document.createElement('div');
	summaryCard.className = 'aqi-summary-card';
	summaryCard.style.setProperty('--aqi-color-start', aqiLevel.colorStart);
	summaryCard.style.setProperty('--aqi-color-end', aqiLevel.colorEnd);
	
	summaryCard.innerHTML = `
		<div class="aqi-summary-value">${overallAQI}</div>
		<div class="aqi-summary-label">Air Quality Index</div>
		<div class="aqi-summary-status">${aqiLevel.level} ${aqiLevel.icon}</div>
	`;
	
	pollutantsGrid.appendChild(summaryCard);
	
	// Define pollutants with their configurations
	const pollutants = [
		{
			key: 'pm2_5',
			name: 'PM2.5',
			icon: '🔴',
			unit: 'µg/m³',
			max: 100,
			description: 'Fine Particles'
		},
		{
			key: 'pm10',
			name: 'PM10',
			icon: '🟠',
			unit: 'µg/m³',
			max: 150,
			description: 'Coarse Particles'
		},
		{
			key: 'o3',
			name: 'O₃',
			icon: '💜',
			unit: 'µg/m³',
			max: 180,
			description: 'Ozone'
		},
		{
			key: 'no2',
			name: 'NO₂',
			icon: '🟡',
			unit: 'µg/m³',
			max: 200,
			description: 'Nitrogen Dioxide'
		},
		{
			key: 'so2',
			name: 'SO₂',
			icon: '🔵',
			unit: 'µg/m³',
			max: 350,
			description: 'Sulfur Dioxide'
		},
		{
			key: 'co',
			name: 'CO',
			icon: '⚫',
			unit: 'µg/m³',
			max: 10000,
			description: 'Carbon Monoxide'
		},
		{
			key: 'nh3',
			name: 'NH₃',
			icon: '🟢',
			unit: 'µg/m³',
			max: 200,
			description: 'Ammonia'
		},
		{
			key: 'no',
			name: 'NO',
			icon: '🩷',
			unit: 'µg/m³',
			max: 100,
			description: 'Nitric Oxide'
		}
	];
	
	// Create card for each pollutant
	pollutants.forEach((pollutant, index) => {
		const value = p[pollutant.key];
		if (value !== undefined && value !== null) {
			const card = createPollutantCard(pollutant, value);
			setTimeout(() => {
				pollutantsGrid.appendChild(card);
			}, (index + 1) * 50); // Staggered animation
		}
	});
}

function createPollutantCard(pollutant, value) {
	const card = document.createElement('div');
	card.className = `pollutant-card pollutant-${pollutant.key}`;
	
	// Calculate percentage for progress bar
	const percentage = Math.min((value / pollutant.max) * 100, 100);
	
	// Determine status
	const status = getPollutantStatus(value, pollutant.max);
	
	card.innerHTML = `
		<div class="pollutant-icon">${pollutant.icon}</div>
		<div class="pollutant-name">${pollutant.name}</div>
		<div class="pollutant-value">${value.toFixed(2)}</div>
		<div class="pollutant-unit">${pollutant.unit}</div>
		<div class="pollutant-bar-container">
			<div class="pollutant-bar" style="width: ${percentage}%"></div>
		</div>
		<div class="pollutant-status ${status.class}">${status.label}</div>
	`;
	
	// Add tooltip with description
	card.title = `${pollutant.description} - ${value.toFixed(2)} ${pollutant.unit}`;
	
	return card;
}

function getPollutantStatus(value, max) {
	const percentage = (value / max) * 100;
	
	if (percentage <= 25) {
		return { label: 'Good', class: 'status-good' };
	} else if (percentage <= 50) {
		return { label: 'Moderate', class: 'status-moderate' };
	} else if (percentage <= 75) {
		return { label: 'Unhealthy', class: 'status-unhealthy' };
	} else {
		return { label: 'Hazardous', class: 'status-hazardous' };
	}
}

function getAQILevel(aqi) {
	if (aqi <= 50) {
		return {
			level: 'Good',
			icon: '😊',
			colorStart: '#10b981',
			colorEnd: '#059669'
		};
	} else if (aqi <= 100) {
		return {
			level: 'Moderate',
			icon: '😐',
			colorStart: '#f59e0b',
			colorEnd: '#d97706'
		};
	} else if (aqi <= 150) {
		return {
			level: 'Unhealthy for Sensitive',
			icon: '😷',
			colorStart: '#f97316',
			colorEnd: '#ea580c'
		};
	} else if (aqi <= 200) {
		return {
			level: 'Unhealthy',
			icon: '😨',
			colorStart: '#ef4444',
			colorEnd: '#dc2626'
		};
	} else if (aqi <= 300) {
		return {
			level: 'Very Unhealthy',
			icon: '🤢',
			colorStart: '#a855f7',
			colorEnd: '#9333ea'
		};
	} else {
		return {
			level: 'Hazardous',
			icon: '💀',
			colorStart: '#7f1d1d',
			colorEnd: '#991b1b'
		};
	}
}

async function load(){
	try{
		addDebugMessage('🔍 Starting load function...');
		setStatus('Loading...');
		const lat = parseFloat(document.getElementById('lat').value);
		const lon = parseFloat(document.getElementById('lon').value);
		
		addDebugMessage(`🔍 Coordinates: lat=${lat}, lon=${lon}`);
		
		if (isNaN(lat) || isNaN(lon)) {
			throw new Error('Invalid coordinates');
		}
		
		marker.setLatLng([lat, lon]);
		map.setView([lat, lon], 11);
		
		// Update location name in top bar
		updateTopBarLocationName(lat, lon);
		
		addDebugMessage('🔍 Fetching aggregate data...');
		const data = await fetchAggregate(lat, lon);
		addDebugMessage(`🔍 Aggregate data received: ${data ? 'SUCCESS' : 'FAILED'}`);
		
		// Add pollution zone visualization
		const currentAQI = data.realtimeAqi?.aqi;
		if (currentAQI) {
			addPollutionZone(lat, lon, currentAQI);
		}
		
		renderChartFrom(data.realtimeAqi, data.dailyAqi || []);
		showInfo(data.sources, data.used, data.pollutants, data.dailyAqi, data.realtimeAqi);
		updateRealtimeAndPollutants(data);
		
		// 🌡️ Update Weather Widget with attractive weather conditions
		updateWeatherDisplay(data.weatherCondition);
		
		// Update timestamp
		const now = new Date().toLocaleTimeString();
		const timestampEl = document.getElementById('lastUpdate');
		if (timestampEl) {
			timestampEl.textContent = `Last updated: ${now}`;
		}
		
		try{
			const sug = await fetchSuggestion(data);
			displaySuggestionCards(sug.suggestion || 'No suggestions available', data);
			setStatus(`Loaded successfully at ${now}`);
		}catch(err){
			console.error('Suggestion error:', err);
			displaySuggestionCards('AI suggestions temporarily unavailable. Using heuristic analysis.', data);
			setStatus(`Loaded with heuristic suggestion at ${now}`);
		}
	}catch(err){
		console.error('🔍 DEBUG: Load function error:', err);
		console.error('🔍 DEBUG: Error details:', {
			message: err.message,
			stack: err.stack,
			name: err.name
		});
		
		setStatus(`Failed to load: ${err.message}`);
		
		// Show detailed error message on page
		const errorEl = document.getElementById('errorMessage') || document.getElementById('status');
		if (errorEl) {
			errorEl.innerHTML = `
				<div style="background:#fee2e2;border:1px solid #fca5a5;padding:8px;border-radius:4px;margin:4px 0;">
					<strong>❌ Error Details:</strong><br>
					• Message: ${err.message}<br>
					• Type: ${err.name}<br>
					• Time: ${new Date().toLocaleTimeString()}<br>
					<small>📋 Copy this error and paste to developer for fix</small>
				</div>
			`;
			errorEl.style.display = 'block';
		}
	}
}

window.addEventListener('DOMContentLoaded', async () => {
	initMap();
	document.getElementById('loadBtn').addEventListener('click', async () => {
		const lat = parseFloat(document.getElementById('lat').value);
		const lon = parseFloat(document.getElementById('lon').value);
		
		// Update marker position
		if (marker) {
			marker.setLatLng([lat, lon]);
		}
		
		// Update status with location name
		const statusEl = document.getElementById('status');
		if (statusEl) {
			statusEl.innerHTML = `
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
					<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="#6366f1" stroke-width="2" fill="none"/>
					<circle cx="12" cy="10" r="3" fill="#6366f1"/>
				</svg>
				<span>Loading location...</span>
			`;
		}
		
		// Get location name
		const locationName = await getLocationName(lat, lon);
		if (statusEl) {
			statusEl.innerHTML = `
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
					<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="#10b981" stroke-width="2" fill="none"/>
					<circle cx="12" cy="10" r="3" fill="#10b981"/>
				</svg>
				<span>📍 ${locationName}</span>
			`;
		}
		
		load();
	});
	
	// Add auto-update button
	const controlsDiv = document.querySelector('.controls') || document.querySelector('.left');
	if (controlsDiv) {
		const autoUpdateBtn = document.createElement('button');
		autoUpdateBtn.id = 'autoUpdateBtn';
		autoUpdateBtn.textContent = 'Start Auto-Update';
		autoUpdateBtn.className = 'btn btn-success';
		autoUpdateBtn.style.marginLeft = '10px';
		autoUpdateBtn.addEventListener('click', toggleAutoUpdate);
		controlsDiv.appendChild(autoUpdateBtn);
		
		// Add timestamp display
		const timestampDiv = document.createElement('div');
		timestampDiv.innerHTML = '<span id="lastUpdate" style="font-size:0.9em;color:#666;margin-left:10px;">Never updated</span>';
		controlsDiv.appendChild(timestampDiv);
		
		// Add error message display
		const errorDiv = document.createElement('div');
		errorDiv.innerHTML = '<div id="errorMessage" style="color:red;margin-top:10px;display:none;"></div>';
		controlsDiv.appendChild(errorDiv);
	}
	
	const chatInput = document.createElement('div');
	chatInput.innerHTML = `
		<div id="chatbox" style="height:200px;overflow:auto;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-top:10px;background:#f9fafb;">
			<div class="msg assistant">🌤️ Hi! I'm your Weather AI assistant. Ask me anything about air quality, weather conditions, health tips, or forecasts!</div>
		</div>
		<div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
			<input id="chatmsg" type="text" placeholder="Ask about weather, air quality, health tips..." style="flex:1;padding:10px;border:1px solid #d1d5db;border-radius:6px;" />
			<button id="chatsend" style="padding:10px 16px;background:#10b981;border:none;border-radius:6px;color:white;cursor:pointer;">Send</button>
			<button id="clearchat" style="padding:10px 12px;background:#6b7280;border:none;border-radius:6px;color:white;cursor:pointer;">Clear</button>
		</div>
		<div style="margin-top:4px;font-size:0.8em;color:#6b7280;display:flex;justify-content:space-between;">
			<span>🌤️ Try asking: "What's the weather like?" or "Air quality recommendations?"</span>
			<span id="chatStatus">🟢 Weather AI Ready</span>
		</div>
	`;
	document.querySelector('.right')?.appendChild(chatInput);
	
	// Chat event listeners
	const chatMsgInput = document.getElementById('chatmsg');
	const chatSendBtn = document.getElementById('chatsend');
	const clearChatBtn = document.getElementById('clearchat');
	
	function updateChatStatus(status, color = 'green') {
		const statusEl = document.getElementById('chatStatus');
		const colors = {green: '🟢', yellow: '🟡', red: '🔴'};
		const statusTexts = {
			'Connected': 'Weather AI Ready',
			'Sending...': 'Weather AI Thinking...',
			'Ready': 'Weather AI Ready'
		};
		if (statusEl) {
			statusEl.textContent = `${colors[color] || '🟢'} ${statusTexts[status] || status}`;
		}
	}
	
	function sendMessage() {
		const msg = (chatMsgInput?.value || '').trim();
		if(!msg || isTyping) return;
		chatMsgInput.value = '';
		updateChatStatus('Sending...', 'yellow');
		sendChatMessage(msg);
	}
	
	chatSendBtn?.addEventListener('click', sendMessage);
		clearChatBtn?.addEventListener('click', () => {
		const chatbox = document.getElementById('chatbox');
		if (chatbox) {
			chatbox.innerHTML = '<div class="msg assistant">🌤️ Weather AI Chat cleared! How can I help you with weather and air quality information?</div>';
			chatHistory = [];
			updateChatStatus('Connected', 'green');
		}
	});
	
	chatMsgInput?.addEventListener('keypress', (e) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	});
	
	// Real-time typing feedback
	chatMsgInput?.addEventListener('input', () => {
		const sendBtn = document.getElementById('chatsend');
		if (sendBtn) {
			sendBtn.style.background = chatMsgInput.value.trim() ? '#10b981' : '#9ca3af';
		}
	});
	
	// Update the sendChatMessage function to use status updates
	const originalSendChatMessage = sendChatMessage;
	sendChatMessage = async function(msg) {
		await originalSendChatMessage(msg);
		updateChatStatus('Connected', 'green');
	};
	if(searchbtn){
		searchbtn.addEventListener('click', async () => {
			const q = (searchbox?.value || '').trim();
			if(!q) return;
			try{
				const w = await fetchWeatherCity(q);
				updateWeatherWidget(w);
			}catch(e){ console.error(e); }
		});
	}
	try{
		const g = await fetchRevGeo();
		if(g && typeof g.latitude === 'number' && typeof g.longitude === 'number'){
			marker.setLatLng([g.latitude, g.longitude]);
			map.setView([g.latitude, g.longitude], 11);
			document.getElementById('lat').value = g.latitude.toFixed(4);
			document.getElementById('lon').value = g.longitude.toFixed(4);
			load();
		}
	}catch(e){ console.warn('revgeo failed', e); }
	
	// ML Prediction Event Listeners
	document.getElementById('trainModelBtn')?.addEventListener('click', trainMLModel);
	document.getElementById('quickPredictBtn')?.addEventListener('click', quickPredict);
	document.getElementById('futurePredictBtn')?.addEventListener('click', predictFuture);
});

// ============ ML PREDICTION FUNCTIONS ============

function setMLStatus(text, isError = false) {
	const el = document.getElementById('mlStatus');
	if (el) {
		el.textContent = text;
		el.style.color = isError ? '#dc2626' : '#666';
	}
}

function displayMLResults(data) {
	const el = document.getElementById('mlResults');
	if (!el) return;
	
	let html = '';
	if (data.prediction !== undefined) {
		html += `<div style="font-weight:bold;color:#0ea5e9;">🎯 Predicted AQI: ${data.prediction}</div>`;
	}
	
	if (data.predictions) {
		html += '<div style="margin-top:8px;"><strong>📈 Future Predictions:</strong></div>';
		const next6 = data.predictions.slice(0, 6);
		html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">';
		next6.forEach(p => {
			const time = new Date(p.timestamp).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'});
			html += `<div style="background:#f3f4f6;padding:4px 8px;border-radius:4px;font-size:12px;">${time}: ${p.predicted_aqi}</div>`;
		});
		html += '</div>';
	}
	
	if (data.performance) {
		html += '<div style="margin-top:8px;"><strong>📊 Model Performance:</strong></div>';
		for (const [model, perf] of Object.entries(data.performance)) {
			html += `<div style="font-size:12px;">${model}: R² ${perf.r2.toFixed(3)}</div>`;
		}
	}
	
	if (data.model_used) {
		html += `<div style="margin-top:4px;font-size:12px;color:#666;">Model: ${data.model_used}</div>`;
	}
	
	el.innerHTML = html;
}

async function trainMLModel() {
	try {
		setMLStatus('🔄 Training ML models...', false);
		const trainBtn = document.getElementById('trainModelBtn');
		if (trainBtn) trainBtn.disabled = true;
		
		const response = await fetch('/api/ml/train', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				use_synthetic: true,
				num_samples: 1000,
				target_column: 'aqi'
			})
		});
		
		const data = await response.json();
		
		if (response.ok) {
			setMLStatus('✅ Model training completed!', false);
			displayMLResults(data);
		} else {
			setMLStatus(`❌ Training failed: ${data.error}`, true);
		}
		
	} catch (error) {
		setMLStatus(`❌ Training error: ${error.message}`, true);
	} finally {
		const trainBtn = document.getElementById('trainModelBtn');
		if (trainBtn) trainBtn.disabled = false;
	}
}

async function quickPredict() {
	try {
		setMLStatus('🔮 Making prediction...', false);
		const lat = document.getElementById('lat').value;
		const lon = document.getElementById('lon').value;
		const model = document.getElementById('modelSelect').value;
		
		const response = await fetch(`/api/ml/quick-predict?lat=${lat}&lon=${lon}&model=${model}`);
		const data = await response.json();
		
		if (response.ok) {
			setMLStatus('✅ Prediction completed!', false);
			displayMLResults(data);
		} else {
			setMLStatus(`❌ Prediction failed: ${data.error}`, true);
		}
		
	} catch (error) {
		setMLStatus(`❌ Prediction error: ${error.message}`, true);
	}
}

async function predictFuture() {
	try {
		setMLStatus('📈 Predicting future AQI...', false);
		const model = document.getElementById('modelSelect').value;
		
		const response = await fetch(`/api/ml/predict-future?hours=24&model=${model}`);
		const data = await response.json();
		
		if (response.ok) {
			setMLStatus('✅ Future predictions ready!', false);
			displayMLResults(data);
		} else {
			setMLStatus(`❌ Future prediction failed: ${data.error}`, true);
		}
		
	} catch (error) {
		setMLStatus(`❌ Future prediction error: ${error.message}`, true);
	}
}

// TEMPO Satellite Data Functions
let tempoDataLoaded = false;

function setTempoStatus(text, isError = false) {
	const el = document.getElementById('tempoStatus');
	if (el) {
		el.textContent = text;
		el.style.color = isError ? '#dc2626' : '#666';
	}
}

function setTempoResults(text) {
	const el = document.getElementById('tempoResults');
	if (el) el.innerHTML = text;
}

function enableTempoButtons(enabled) {
	document.getElementById('extractTempoBtn').disabled = !enabled;
	document.getElementById('tempoTrainBtn').disabled = !enabled;
	document.getElementById('tempoPredictBtn').disabled = !enabled;
	document.getElementById('tempoFeaturesBtn').disabled = !enabled;
}

async function loadExistingTempo() {
	try {
		setTempoStatus('📡 Loading existing TEMPO file...');
		
		const response = await fetch('/api/tempo/load-existing', {
			method: 'POST'
		});
		
		const data = await response.json();
		
		if (response.ok) {
			tempoDataLoaded = true;
			enableTempoButtons(true);
			setTempoStatus(`✅ Existing TEMPO file loaded successfully`);
			setTempoResults(`
				<div style="background:#f0f9ff;padding:8px;border-radius:4px;margin:4px 0;">
					<strong>📊 File Info:</strong><br>
					• Groups: ${data.file_info.groups?.length || 'N/A'}<br>
					• Variables: ${data.file_info.variables?.length || 'N/A'}<br>
					• Observation Time: ${data.summary.metadata?.observation_time || 'Unknown'}<br>
					• Status: Ready for data extraction
				</div>
			`);
		} else {
			setTempoStatus(`❌ Load failed: ${data.error}`, true);
		}
		
	} catch (error) {
		setTempoStatus(`❌ Load error: ${error.message}`, true);
	}
}

async function uploadTempoFile() {
	const fileInput = document.getElementById('tempoFileInput');
	const file = fileInput.files[0];
	
	if (!file) {
		setTempoStatus('Please select a TEMPO NetCDF file', true);
		return;
	}
	
	if (!file.name.toLowerCase().endsWith('.nc')) {
		setTempoStatus('Please select a NetCDF (.nc) file', true);
		return;
	}
	
	try {
		setTempoStatus('📡 Uploading and processing TEMPO file...');
		
		const formData = new FormData();
		formData.append('file', file);
		
		const response = await fetch('/api/tempo/upload', {
			method: 'POST',
			body: formData
		});
		
		const data = await response.json();
		
		if (response.ok) {
			tempoDataLoaded = true;
			enableTempoButtons(true);
			setTempoStatus(`✅ TEMPO file loaded: ${file.name}`);
			setTempoResults(`
				<div style="background:#f0f9ff;padding:8px;border-radius:4px;margin:4px 0;">
					<strong>📊 File Info:</strong><br>
					• Variables: ${data.file_info.variables.length}<br>
					• Dimensions: ${JSON.stringify(data.file_info.dimensions)}<br>
					• Observation Time: ${data.summary.metadata.observation_time || 'Unknown'}<br>
					• Data Points: ${Object.values(data.summary.data_summary)[0]?.valid_points || 'Unknown'}
				</div>
			`);
		} else {
			setTempoStatus(`❌ Upload failed: ${data.error}`, true);
		}
		
	} catch (error) {
		setTempoStatus(`❌ Upload error: ${error.message}`, true);
	}
}

async function extractTempoData() {
	if (!tempoDataLoaded) {
		setTempoStatus('Please upload TEMPO data first', true);
		return;
	}
	
	try {
		setTempoStatus('🔍 Extracting NO2 data from TEMPO file...');
		
		const response = await fetch('/api/tempo/extract-data');
		const data = await response.json();
		
		if (response.ok) {
			setTempoStatus('✅ NO2 data extracted successfully');
			setTempoResults(`
				<div style="background:#f0f9ff;padding:8px;border-radius:4px;margin:4px 0;">
					<strong>🌍 NO2 Data Summary:</strong><br>
					• Total Observations: ${data.data_summary.total_observations}<br>
					• NO2 Mean: ${data.data_summary.no2_statistics.mean.toExponential(2)} molecules/cm²<br>
					• Geographic Coverage:<br>
					  Lat: ${data.data_summary.geographic_bounds.lat_min.toFixed(2)}° to ${data.data_summary.geographic_bounds.lat_max.toFixed(2)}°<br>
					  Lon: ${data.data_summary.geographic_bounds.lon_min.toFixed(2)}° to ${data.data_summary.geographic_bounds.lon_max.toFixed(2)}°
				</div>
			`);
		} else {
			setTempoStatus(`❌ Extraction failed: ${data.error}`, true);
		}
		
	} catch (error) {
		setTempoStatus(`❌ Extraction error: ${error.message}`, true);
	}
}

async function trainWithTempo() {
	if (!tempoDataLoaded) {
		setTempoStatus('Please upload and extract TEMPO data first', true);
		return;
	}
	
	try {
		setTempoStatus('🤖 Training ML model with TEMPO satellite data...');
		
		const model = document.getElementById('modelSelect').value;
		const response = await fetch(`/api/tempo/train-model?model=${model}&grid_size=0.1`, {
			method: 'POST'
		});
		
		const data = await response.json();
		
		if (response.ok) {
			setTempoStatus('✅ Model trained with TEMPO data!');
			setTempoResults(`
				<div style="background:#ecfdf5;padding:8px;border-radius:4px;margin:4px 0;">
					<strong>🎯 Training Results:</strong><br>
					• Training Size: ${data.training_data_size} grid cells<br>
					• Model: ${model}<br>
					• Grid Size: ${data.grid_size}°<br>
					• Data Source: ${data.data_source}<br>
					• Status: Model saved and ready for predictions
				</div>
			`);
			
			// Update ML status too
			setMLStatus('✅ Model trained with real satellite data!', false);
		} else {
			setTempoStatus(`❌ Training failed: ${data.error}`, true);
		}
		
	} catch (error) {
		setTempoStatus(`❌ Training error: ${error.message}`, true);
	}
}

async function predictWithTempo() {
	if (!tempoDataLoaded) {
		setTempoStatus('Please upload TEMPO data first', true);
		return;
	}
	
	try {
		setTempoStatus('🔮 Making prediction with TEMPO data...');
		
		const lat = parseFloat(document.getElementById('lat').value);
		const lon = parseFloat(document.getElementById('lon').value);
		const model = document.getElementById('modelSelect').value;
		
		const response = await fetch(`/api/tempo/predict?lat=${lat}&lon=${lon}&model=${model}`);
		const data = await response.json();
		
		if (response.ok) {
			setTempoStatus('✅ TEMPO prediction complete!');
			setTempoResults(`
				<div style="background:#fef3c7;padding:8px;border-radius:4px;margin:4px 0;">
					<strong>🛰️ TEMPO Prediction:</strong><br>
					• Predicted AQI: <strong>${data.prediction}</strong><br>
					• Model: ${data.model_used}<br>
					• Location: ${lat.toFixed(4)}°, ${lon.toFixed(4)}°<br>
					• Target NO2: ${data.tempo_features.target_no2?.toExponential(2) || 'N/A'} molecules/cm²<br>
					• Local Observations: ${data.tempo_features.local_observations || 0}
				</div>
			`);
			
			// Also update main ML results
			displayMLResults({
				prediction: data.prediction,
				model_used: data.model_used,
				data_source: 'TEMPO Satellite',
				location: data.location
			});
		} else {
			setTempoStatus(`❌ Prediction failed: ${data.error}`, true);
		}
		
	} catch (error) {
		setTempoStatus(`❌ Prediction error: ${error.message}`, true);
	}
}

async function showTempoFeatures() {
	if (!tempoDataLoaded) {
		setTempoStatus('Please upload TEMPO data first', true);
		return;
	}
	
	try {
		setTempoStatus('📊 Extracting ML features from TEMPO data...');
		
		const lat = parseFloat(document.getElementById('lat').value);
		const lon = parseFloat(document.getElementById('lon').value);
		
		const response = await fetch(`/api/tempo/ml-features?lat=${lat}&lon=${lon}`);
		const data = await response.json();
		
		if (response.ok) {
			setTempoStatus('✅ TEMPO features extracted');
			
			const features = data.features;
			const featuresHtml = Object.entries(features)
				.map(([key, value]) => {
					let displayValue = value;
					if (typeof value === 'number') {
						displayValue = value < 1e-3 || value > 1e6 ? value.toExponential(2) : value.toFixed(3);
					}
					return `• ${key}: ${displayValue}`;
				})
				.join('<br>');
			
			setTempoResults(`
				<div style="background:#f3f4f6;padding:8px;border-radius:4px;margin:4px 0;max-height:200px;overflow:auto;">
					<strong>🔬 TEMPO ML Features (${data.feature_count}):</strong><br>
					${featuresHtml}
				</div>
			`);
		} else {
			setTempoStatus(`❌ Feature extraction failed: ${data.error}`, true);
		}
		
	} catch (error) {
		setTempoStatus(`❌ Feature extraction error: ${error.message}`, true);
	}
}

// NASA Earthdata Functions
function setNASAStatus(text, isError = false) {
	const el = document.getElementById('nasaStatus');
	if (el) {
		el.textContent = text;
		el.style.color = isError ? '#dc2626' : '#666';
	}
}

function setNASAResults(html) {
	const el = document.getElementById('nasaResults');
	if (el) el.innerHTML = html;
}

async function getNASAComprehensiveAnalysis() {
	try {
		setNASAStatus('🌍 Getting comprehensive NASA Earth data analysis...');
		
		const lat = parseFloat(document.getElementById('lat').value);
		const lon = parseFloat(document.getElementById('lon').value);
		
		const response = await fetch(`/api/nasa/comprehensive?lat=${lat}&lon=${lon}`);
		const data = await response.json();
		
		if (response.ok && data.success) {
			setNASAStatus('✅ NASA analysis complete!');
			
			const assessment = data.combined_assessment;
			const aerosol = data.aerosol_analysis;
			const fire = data.fire_analysis;
			const precip = data.precipitation_analysis;
			
			setNASAResults(`
				<div style="background:#f0f9ff;padding:8px;border-radius:4px;margin:4px 0;">
					<strong>🌍 NASA Earth Analysis:</strong><br>
					• Overall Score: <span style="color:${assessment.level_color};font-weight:bold;">${assessment.overall_score}/100 (${assessment.air_quality_level})</span><br>
					• Confidence: ${assessment.confidence}<br>
					• Data Sources: ${data.data_sources.join(', ')}<br><br>
					
					<strong>☁️ Aerosol Data:</strong><br>
					• AOD: ${aerosol.estimated_aod || 'N/A'}<br>
					• Granules: ${aerosol.granules_found || 0}<br>
					• Impact: ${aerosol.air_quality_impact || 'N/A'}<br><br>
					
					<strong>🔥 Fire Analysis:</strong><br>
					• Risk Level: ${fire.fire_risk_level}<br>
					• Fires Detected: ${fire.fires_detected}<br>
					• Warning: ${fire.air_quality_warning}<br><br>
					
					<strong>🌧️ Precipitation:</strong><br>
					• Events: ${precip.precipitation_events}<br>
					• Impact: ${precip.weather_impact}<br><br>
					
					<strong>💡 Recommendation:</strong><br>
					${assessment.recommendation}
				</div>
			`);
			
			// Also update ML status
			setMLStatus(`✅ NASA satellite data ready for predictions!`, false);
			
		} else {
			setNASAStatus(`❌ Analysis failed: ${data.error}`, true);
		}
		
	} catch (error) {
		setNASAStatus(`❌ NASA analysis error: ${error.message}`, true);
	}
}

async function getNASAAerosol() {
	try {
		setNASAStatus('☁️ Getting MODIS aerosol data...');
		
		const lat = parseFloat(document.getElementById('lat').value);
		const lon = parseFloat(document.getElementById('lon').value);
		
		const response = await fetch(`/api/nasa/aerosol?lat=${lat}&lon=${lon}&days=7`);
		const data = await response.json();
		
		if (response.ok && data.success) {
			setNASAStatus('✅ MODIS aerosol data retrieved');
			setNASAResults(`
				<div style="background:#fff3cd;padding:8px;border-radius:4px;margin:4px 0;">
					<strong>☁️ MODIS Aerosol Analysis:</strong><br>
					• AOD (Aerosol Optical Depth): ${data.estimated_aod}<br>
					• Granules Found: ${data.granules_found}<br>
					• Date Range: ${data.date_range}<br>
					• Air Quality Impact: ${data.air_quality_impact}<br>
					• Location: ${data.location ? `${data.location.lat.toFixed(4)}°, ${data.location.lon.toFixed(4)}°` : `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`}
				</div>
			`);
		} else {
			setNASAStatus(`❌ Aerosol data failed: ${data.error}`, true);
		}
		
	} catch (error) {
		setNASAStatus(`❌ Aerosol error: ${error.message}`, true);
	}
}

async function getNASAFires() {
	try {
		setNASAStatus('🔥 Getting MODIS fire data...');
		
		const lat = parseFloat(document.getElementById('lat').value);
		const lon = parseFloat(document.getElementById('lon').value);
		
		const response = await fetch(`/api/nasa/fires?lat=${lat}&lon=${lon}&days=7`);
		const data = await response.json();
		
		if (response.ok && data.success) {
			setNASAStatus('✅ MODIS fire data retrieved');
			setNASAResults(`
				<div style="background:#fee2e2;padding:8px;border-radius:4px;margin:4px 0;">
					<strong>🔥 MODIS Fire Analysis:</strong><br>
					• Fires Detected: ${data.fires_detected}<br>
					• Risk Level: ${data.fire_risk_level}<br>
					• Impact Score: ${(data.fire_impact_score * 100).toFixed(1)}%<br>
					• Warning: ${data.air_quality_warning}<br>
					• Location: ${data.location ? `${data.location.lat.toFixed(4)}°, ${data.location.lon.toFixed(4)}°` : `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`}
				</div>
			`);
		} else {
			setNASAStatus(`❌ Fire data failed: ${data.error}`, true);
		}
		
	} catch (error) {
		setNASAStatus(`❌ Fire error: ${error.message}`, true);
	}
}

async function getNASAPrecipitation() {
	try {
		setNASAStatus('🌧️ Getting GPM precipitation data...');
		
		const lat = parseFloat(document.getElementById('lat').value);
		const lon = parseFloat(document.getElementById('lon').value);
		
		const response = await fetch(`/api/nasa/precipitation?lat=${lat}&lon=${lon}&days=3`);
		const data = await response.json();
		
		if (response.ok && data.success) {
			setNASAStatus('✅ GPM precipitation data retrieved');
			setNASAResults(`
				<div style="background:#ecfdf5;padding:8px;border-radius:4px;margin:4px 0;">
					<strong>🌧️ GPM Precipitation Analysis:</strong><br>
					• Precipitation Events: ${data.precipitation_events}<br>
					• Weather Impact: ${data.weather_impact}<br>
					• Air Quality Effect: ${data.air_quality_effect}<br>
					• Location: ${data.location ? `${data.location.lat.toFixed(4)}°, ${data.location.lon.toFixed(4)}°` : `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`}
				</div>
			`);
		} else {
			setNASAStatus(`❌ Precipitation data failed: ${data.error}`, true);
		}
		
	} catch (error) {
		setNASAStatus(`❌ Precipitation error: ${error.message}`, true);
	}
}

async function trainWithNASA() {
	try {
		setNASAStatus('🤖 Training ML model with NASA satellite data...');
		
		const lat = parseFloat(document.getElementById('lat').value);
		const lon = parseFloat(document.getElementById('lon').value);
		const model = document.getElementById('modelSelect').value;
		
		const response = await fetch(`/api/ml/train-with-nasa?lat=${lat}&lon=${lon}&model=${model}`, {
			method: 'POST'
		});
		
		const data = await response.json();
		
		if (response.ok && data.success) {
			setNASAStatus('✅ NASA-enhanced model trained successfully!');
			setNASAResults(`
				<div style="background:#ecfdf5;padding:8px;border-radius:4px;margin:4px 0;">
					<strong>🤖 NASA ML Training Results:</strong><br>
					• Training Samples: ${data.training_data_size}<br>
					• NASA Features: ${data.nasa_features_used}<br>
					• Model: ${model}<br>
					• Data Sources: ${data.data_sources.join(', ')}<br>
					• NASA Score: ${data.nasa_assessment.overall_score}/100<br>
					• Status: Model saved and ready for enhanced predictions
				</div>
			`);
			
			// Update ML status
			setMLStatus('✅ NASA-enhanced model ready for predictions!', false);
			
		} else {
			setNASAStatus(`❌ NASA training failed: ${data.error}`, true);
		}
		
	} catch (error) {
		setNASAStatus(`❌ NASA training error: ${error.message}`, true);
	}
}

async function predictWithNASA() {
	try {
		setNASAStatus('🔮 Making NASA-enhanced prediction...');
		
		const lat = parseFloat(document.getElementById('lat').value);
		const lon = parseFloat(document.getElementById('lon').value);
		const model = document.getElementById('modelSelect').value;
		
		const response = await fetch(`/api/ml/predict-with-nasa?lat=${lat}&lon=${lon}&model=${model}`);
		const data = await response.json();
		
		if (response.ok && data.success) {
			setNASAStatus('✅ NASA-enhanced prediction complete!');
			
			const nasaFeatures = data.nasa_features_summary;
			
			setNASAResults(`
				<div style="background:#fef3c7;padding:8px;border-radius:4px;margin:4px 0;">
					<strong>🛰️ NASA-Enhanced Prediction:</strong><br>
					• Predicted AQI: <strong>${data.prediction}</strong><br>
					• Model: ${data.model_used}<br>
					• NASA Score: ${data.nasa_assessment.overall_score}/100<br>
					• Confidence: ${(data.satellite_confidence * 100).toFixed(0)}%<br><br>
					
					<strong>📊 NASA Features:</strong><br>
					• Aerosol Optical Depth: ${nasaFeatures.aerosol_optical_depth}<br>
					• Fire Risk: ${(nasaFeatures.fire_risk * 100).toFixed(1)}%<br>
					• Precip Benefit: ${(nasaFeatures.precipitation_benefit * 100).toFixed(1)}%<br><br>
					
					<strong>💡 Recommendation:</strong><br>
					${data.recommendation}
				</div>
			`);
			
			// Also update main ML results
			displayMLResults({
				prediction: data.prediction,
				model_used: data.model_used,
				data_source: 'NASA Enhanced',
				location: data.location,
				confidence: data.satellite_confidence
			});
			
		} else {
			setNASAStatus(`❌ NASA prediction failed: ${data.error}`, true);
		}
		
	} catch (error) {
		setNASAStatus(`❌ NASA prediction error: ${error.message}`, true);
	}
}

// Weather icon mapping for forecast cards
function getWeatherIconForForecast(aqi, temp, humidity) {
	// Choose icon based on AQI and weather conditions
	if (aqi <= 50) {
		if (temp > 30) return '☀️';
		if (temp > 20) return '🌤️';
		return '⛅';
	} else if (aqi <= 100) {
		if (humidity > 70) return '🌦️';
		if (temp > 25) return '🌤️';
		return '☁️';
	} else if (aqi <= 150) {
		if (humidity > 60) return '🌧️';
		return '🌫️';
	} else {
		return '🌫️'; // Polluted/hazy conditions
	}
}

// Get AQI level description with emoji
function getAQILevelEmoji(aqi) {
	if (aqi <= 50) return '😊';
	if (aqi <= 100) return '😐';
	if (aqi <= 150) return '😷';
	if (aqi <= 200) return '🤢';
	if (aqi <= 300) return '🚨';
	return '☠️';
}

// Get location name from coordinates using reverse geocoding
async function getLocationName(lat, lon) {
	try {
		// Try to get location name using OpenStreetMap Nominatim (free service)
		const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`);
		const data = await response.json();
		
		if (data && data.display_name) {
			// Extract relevant parts of the address
			const address = data.address || {};
			const city = address.city || address.town || address.village || address.county;
			const state = address.state;
			const country = address.country;
			
			if (city && state && country) {
				return `${city}, ${state}, ${country}`;
			} else if (city && country) {
				return `${city}, ${country}`;
			} else if (data.display_name.length > 50) {
				// If display name is too long, truncate it
				return data.display_name.substring(0, 50) + '...';
			} else {
				return data.display_name;
			}
		}
		
		// Fallback to coordinates if no name found
		return `📍 ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
		
	} catch (error) {
		console.log('Location lookup failed:', error);
		// Fallback to coordinates
		return `📍 ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
	}
}

// Display beautiful weather forecast widget
async function displayWeatherForecast(forecastData, nasaScore, dataSources, location) {
	const widget = document.getElementById('weatherForecastWidget');
	const placeholder = document.getElementById('forecastPlaceholder');
	const container = document.getElementById('forecastContainer');
	const locationEl = document.getElementById('forecastLocation');
	const sourcesEl = document.getElementById('forecastSources');
	
	// Check if elements exist
	if (!widget || !container) {
		console.warn('Weather forecast elements not found in DOM');
		return;
	}
	
	// Hide placeholder and show widget
	if (placeholder) {
		placeholder.style.display = 'none';
	}
	widget.style.display = 'block';
	
	// Get location name (this will update asynchronously)
	const locationName = await getLocationName(location.lat, location.lon);
	
	// Update header info with better location display
	if (locationEl) locationEl.innerHTML = `📍 <strong>${locationName}</strong><br><small>Coordinates: ${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}</small>`;
	if (sourcesEl) sourcesEl.textContent = `�️ NASA Score: ${nasaScore}/100 • 📊 Sources: ${dataSources.join(', ')}`;
	
	// Clear existing cards
	container.innerHTML = '';
	
	// Create forecast cards
	forecastData.forEach((day, index) => {
		const icon = getWeatherIconForForecast(day.predicted_aqi, day.temperature, day.humidity);
		const aqiEmoji = getAQILevelEmoji(day.predicted_aqi);
		
		const card = document.createElement('div');
		card.className = 'forecast-card';
		card.innerHTML = `
			<div class="forecast-day">${day.day.substring(0, 3)}</div>
			<div class="forecast-icon">${icon}</div>
			<div class="forecast-temp">${day.temperature}°C</div>
			<div class="forecast-aqi" style="background-color: ${day.level_color};">
				${aqiEmoji} ${day.predicted_aqi}
			</div>
			<div class="forecast-details">
				💧 ${day.humidity}%<br>
				💨 ${day.wind_speed}m/s
			</div>
			<div class="forecast-confidence">${day.confidence}%</div>
		`;
		
		// Add click handler for card details
		card.addEventListener('click', () => {
			showDayDetails(day, locationName);
		});
		
		container.appendChild(card);
	});
	
	// Update temperature chart
	renderTemperatureChart(forecastData);
}

// Show detailed view for a specific day
function showDayDetails(day, locationName = "Selected Location") {
	const icon = getWeatherIconForForecast(day.predicted_aqi, day.temperature, day.humidity);
	
	alert(`🌤️ ${day.day} (${day.date})
📍 Location: ${locationName}

${icon} Weather Conditions:
🌡️ Temperature: ${day.temperature}°C
💧 Humidity: ${day.humidity}%
💨 Wind Speed: ${day.wind_speed} m/s

🏭 Air Quality:
📊 AQI: ${day.predicted_aqi} (${day.air_quality_level})
🎯 Confidence: ${day.confidence}%

🎨 Color Code: ${day.level_color}`);
}

// Render temperature chart for the forecast
function renderTemperatureChart(forecastData) {
	const canvas = document.getElementById('tempChart');
	if (!canvas) return;
	
	const ctx = canvas.getContext('2d');
	
	// Destroy existing chart if it exists and has destroy method
	if (window.tempChart && typeof window.tempChart.destroy === 'function') {
		window.tempChart.destroy();
	}
	
	const labels = forecastData.map(day => day.day.substring(0, 3));
	const temperatures = forecastData.map(day => day.temperature);
	const aqiData = forecastData.map(day => day.predicted_aqi);
	
	window.tempChart = new Chart(ctx, {
		type: 'line',
		data: {
			labels: labels,
			datasets: [{
				label: 'Temperature (°C)',
				data: temperatures,
				borderColor: '#f59e0b',
				backgroundColor: 'rgba(245, 158, 11, 0.1)',
				borderWidth: 2,
				tension: 0.3,
				yAxisID: 'y'
			}, {
				label: 'AQI',
				data: aqiData,
				borderColor: '#8b5cf6',
				backgroundColor: 'rgba(139, 92, 246, 0.1)',
				borderWidth: 2,
				tension: 0.3,
				yAxisID: 'y1'
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				y: {
					type: 'linear',
					display: true,
					position: 'left',
					title: {
						display: true,
						text: 'Temperature (°C)'
					}
				},
				y1: {
					type: 'linear',
					display: true,
					position: 'right',
					title: {
						display: true,
						text: 'AQI'
					},
					grid: {
						drawOnChartArea: false,
					},
				}
			},
			plugins: {
				legend: {
					display: true,
					position: 'top'
				}
			}
		}
	});
}

async function getNASA7DayForecast() {
	try {
		setNASAStatus('📅 Getting 7-day NASA forecast...');
		
		const lat = parseFloat(document.getElementById('lat').value);
		const lon = parseFloat(document.getElementById('lon').value);
		
		const response = await fetch(`/api/nasa/7day-forecast?lat=${lat}&lon=${lon}`);
		const data = await response.json();
		
		if (response.ok && data.success) {
			setNASAStatus('✅ 7-day forecast complete!');
			
			// Update the original chart with NASA forecast data
			renderNASA7DayChart(data.forecast);
			
			// NEW: Display beautiful weather forecast widget
			await displayWeatherForecast(data.forecast, data.nasa_base_score, data.data_sources, data.location);
			
			// Also set a brief text summary in NASA results
			const summaryHTML = `
				<div style="background:#f0f9ff;padding:8px;border-radius:4px;margin:4px 0;border-left:4px solid #3b82f6;">
					<strong>📅 7-Day Forecast Generated!</strong><br>
					🛰️ NASA Score: ${data.nasa_base_score}/100<br>
					📍 Location: ${data.location.lat.toFixed(4)}, ${data.location.lon.toFixed(4)}<br>
					📊 Check the Weather Forecast widget below for detailed view
				</div>
			`;
			setNASAResults(summaryHTML);
			
		} else {
			setNASAStatus(`❌ 7-day forecast failed: ${data.error}`, true);
		}
		
	} catch (error) {
		setNASAStatus(`❌ 7-day forecast error: ${error.message}`, true);
		console.error('7-day forecast error details:', error);
	}
}

// Initialize TEMPO event listeners when page loads
document.addEventListener('DOMContentLoaded', function() {
	// Add existing event listeners...
	
	// Update default location name (Delhi)
	updateTopBarLocationName(28.6139, 77.2090);
	
	// NASA Earthdata event listeners
	document.getElementById('nasaComprehensiveBtn')?.addEventListener('click', getNASAComprehensiveAnalysis);
	document.getElementById('nasaAerosolBtn')?.addEventListener('click', getNASAAerosol);
	document.getElementById('nasaFiresBtn')?.addEventListener('click', getNASAFires);
	document.getElementById('nasaPrecipBtn')?.addEventListener('click', getNASAPrecipitation);
	document.getElementById('nasaTrainBtn')?.addEventListener('click', trainWithNASA);
	document.getElementById('nasaPredictBtn')?.addEventListener('click', predictWithNASA);
	document.getElementById('nasa7DayBtn')?.addEventListener('click', getNASA7DayForecast);
	
	// 🗺️ Fullscreen Map Button Event Listener
	const fullscreenBtn = document.getElementById('fullscreenBtn');
	if (fullscreenBtn) {
		fullscreenBtn.addEventListener('click', toggleFullscreenMap);
	}
});

// 🛰️ NASA HACKATHON MAP FEATURES 🛰️

function addNASAMapControls() {
	// Create NASA Layer Control Panel
	const controlDiv = L.DomUtil.create('div', 'nasa-controls');
	controlDiv.innerHTML = `
		<div style="background:white;padding:8px;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.2);margin:10px;">
			<div style="font-weight:bold;margin-bottom:6px;">🛰️ NASA Layers</div>
			<label style="display:block;margin:2px 0;font-size:12px;">
				<input type="checkbox" id="toggleFires" style="margin-right:4px;"> 🔥 Fire Hotspots
			</label>
			<label style="display:block;margin:2px 0;font-size:12px;">
				<input type="checkbox" id="toggleAerosol" style="margin-right:4px;"> ☁️ Aerosol Density
			</label>
			<label style="display:block;margin:2px 0;font-size:12px;">
				<input type="checkbox" id="togglePrecip" style="margin-right:4px;"> 🌧️ Precipitation
			</label>
			<label style="display:block;margin:2px 0;font-size:12px;">
				<input type="checkbox" id="toggleAQI" style="margin-right:4px;"> 🌡️ AQI Heatmap
			</label>
		</div>
	`;
	
	const nasaControl = L.control({position: 'topright'});
	nasaControl.onAdd = function() { return controlDiv; };
	nasaControl.addTo(map);
	
	// Add event listeners for toggles
	document.getElementById('toggleFires').addEventListener('change', toggleFireLayer);
	document.getElementById('toggleAerosol').addEventListener('change', toggleAerosolLayer);
	document.getElementById('togglePrecip').addEventListener('change', togglePrecipLayer);
	document.getElementById('toggleAQI').addEventListener('change', toggleAQIHeatmap);
}

function instantNASAAnalysis(lat, lon) {
	// Show instant popup with NASA analysis
	const popup = L.popup()
		.setLatLng([lat, lon])
		.setContent(`
			<div style="min-width:200px;">
				<strong>🛰️ NASA Analysis</strong><br>
				<div id="quickNASA">🔄 Getting satellite data...</div>
			</div>
		`)
		.openOn(map);
	
	// Quick NASA analysis
	fetch(`/api/nasa/comprehensive?lat=${lat}&lon=${lon}`)
		.then(r => r.json())
		.then(data => {
			if (data.success) {
				const assessment = data.combined_assessment;
				document.getElementById('quickNASA').innerHTML = `
					📊 AQI Score: <strong style="color:${assessment.level_color}">${assessment.overall_score}/100</strong><br>
					🌍 Level: ${assessment.air_quality_level}<br>
					🔥 Fires: ${data.fire_analysis.fires_detected}<br>
					☁️ Aerosol: ${data.aerosol_analysis.granules_found} granules<br>
					💡 ${assessment.recommendation.substring(0,50)}...
				`;
			}
		})
		.catch(() => {
			document.getElementById('quickNASA').innerHTML = '❌ Analysis failed';
		});
}

function showFireHotspots() {
	// Add fire simulation markers around current location
	clearNASAMarkers();
	const center = map.getCenter();
	
	// Simulate fire hotspots
	const fireLocations = [
		{lat: center.lat + 0.1, lng: center.lng + 0.1, intensity: 'High'},
		{lat: center.lat - 0.08, lng: center.lng + 0.15, intensity: 'Medium'},
		{lat: center.lat + 0.12, lng: center.lng - 0.1, intensity: 'Low'},
		{lat: center.lat - 0.05, lng: center.lng - 0.12, intensity: 'High'}
	];
	
	fireLocations.forEach(fire => {
		const color = fire.intensity === 'High' ? '#ff0000' : 
					 fire.intensity === 'Medium' ? '#ff7e00' : '#ffff00';
		
		const fireMarker = L.circleMarker([fire.lat, fire.lng], {
			radius: fire.intensity === 'High' ? 12 : fire.intensity === 'Medium' ? 8 : 5,
			fillColor: color,
			color: '#000',
			weight: 1,
			opacity: 0.8,
			fillOpacity: 0.6
		}).addTo(map);
		
		fireMarker.bindPopup(`
			<strong>🔥 Fire Hotspot</strong><br>
			Intensity: ${fire.intensity}<br>
			AQI Impact: ${fire.intensity === 'High' ? '+50' : fire.intensity === 'Medium' ? '+25' : '+10'}
		`);
		
		nasaMarkers.push(fireMarker);
	});
}

function hideFireHotspots() {
	clearNASAMarkers();
}

function showAerosolDensity() {
	// Add aerosol density visualization
	clearNASAMarkers();
	const center = map.getCenter();
	
	// Create aerosol density circles
	for (let i = 0; i < 8; i++) {
		const lat = center.lat + (Math.random() - 0.5) * 0.3;
		const lng = center.lng + (Math.random() - 0.5) * 0.3;
		const density = Math.random();
		
		const color = density > 0.7 ? '#8b0000' : density > 0.4 ? '#ff4500' : '#ffa500';
		
		const aerosolCircle = L.circle([lat, lng], {
			radius: 3000 + (density * 5000),
			fillColor: color,
			color: color,
			weight: 1,
			opacity: 0.4,
			fillOpacity: 0.2
		}).addTo(map);
		
		aerosolCircle.bindPopup(`
			<strong>☁️ Aerosol Density</strong><br>
			AOD: ${(density * 0.8).toFixed(3)}<br>
			Impact: ${density > 0.7 ? 'High' : density > 0.4 ? 'Medium' : 'Low'}
		`);
		
		nasaMarkers.push(aerosolCircle);
	}
}

function hideAerosolDensity() {
	clearNASAMarkers();
}

function showPrecipitationZones() {
	// Add precipitation visualization
	clearNASAMarkers();
	const center = map.getCenter();
	
	const precipZones = [
		{lat: center.lat + 0.15, lng: center.lng + 0.05, amount: 'Heavy'},
		{lat: center.lat - 0.1, lng: center.lng + 0.2, amount: 'Light'},
		{lat: center.lat + 0.05, lng: center.lng - 0.15, amount: 'Moderate'}
	];
	
	precipZones.forEach(zone => {
		const color = zone.amount === 'Heavy' ? '#0000ff' : 
					 zone.amount === 'Moderate' ? '#4169e1' : '#87ceeb';
		const radius = zone.amount === 'Heavy' ? 8000 : zone.amount === 'Moderate' ? 5000 : 3000;
		
		const precipCircle = L.circle([zone.lat, zone.lng], {
			radius: radius,
			fillColor: color,
			color: color,
			weight: 2,
			opacity: 0.6,
			fillOpacity: 0.3
		}).addTo(map);
		
		precipCircle.bindPopup(`
			<strong>🌧️ Precipitation Zone</strong><br>
			Amount: ${zone.amount}<br>
			AQI Effect: ${zone.amount === 'Heavy' ? '-30 (Cleansing)' : zone.amount === 'Moderate' ? '-15' : '-5'}
		`);
		
		nasaMarkers.push(precipCircle);
	});
}

function hidePrecipitationZones() {
	clearNASAMarkers();
}

function showAQIHeatmap() {
	// Add AQI heatmap simulation
	clearNASAMarkers();
	const center = map.getCenter();
	
	// Generate AQI grid
	for (let i = -3; i <= 3; i++) {
		for (let j = -3; j <= 3; j++) {
			const lat = center.lat + (i * 0.05);
			const lng = center.lng + (j * 0.05);
			const aqi = 20 + Math.random() * 150; // Random AQI 20-170
			
			const color = aqi <= 50 ? '#00e400' : aqi <= 100 ? '#ffff00' : 
						 aqi <= 150 ? '#ff7e00' : '#ff0000';
			
			const aqiMarker = L.circleMarker([lat, lng], {
				radius: 4,
				fillColor: color,
				color: color,
				weight: 1,
				opacity: 0.8,
				fillOpacity: 0.6
			}).addTo(map);
			
			aqiMarker.bindPopup(`
				<strong>🌡️ AQI Reading</strong><br>
				Value: ${Math.round(aqi)}<br>
				Level: ${aqi <= 50 ? 'Good' : aqi <= 100 ? 'Moderate' : aqi <= 150 ? 'Unhealthy for Sensitive' : 'Unhealthy'}
			`);
			
			nasaMarkers.push(aqiMarker);
		}
	}
}

function hideAQIHeatmap() {
	clearNASAMarkers();
}

function clearNASAMarkers() {
	nasaMarkers.forEach(marker => map.removeLayer(marker));
	nasaMarkers = [];
}

// 🎬 DYNAMIC ANIMATION FEATURES 🎬
let animationInterval = null;

function startWeatherAnimation() {
	if (animationInterval) return; // Already running
	
	let animationStep = 0;
	animationInterval = setInterval(() => {
		animationStep++;
		
		// Animate fire intensity
		if (document.getElementById('toggleFires').checked) {
			animateFireIntensity(animationStep);
		}
		
		// Animate aerosol movement
		if (document.getElementById('toggleAerosol').checked) {
			animateAerosolMovement(animationStep);
		}
		
		// Animate precipitation
		if (document.getElementById('togglePrecip').checked) {
			animatePrecipitation(animationStep);
		}
		
		// Reset animation after 50 steps
		if (animationStep >= 50) {
			animationStep = 0;
		}
	}, 200); // Update every 200ms
}

function stopWeatherAnimation() {
	if (animationInterval) {
		clearInterval(animationInterval);
		animationInterval = null;
	}
}

function animateFireIntensity(step) {
	nasaMarkers.forEach((marker, index) => {
		if (marker instanceof L.CircleMarker && marker.options.fillColor.includes('#ff')) {
			// Pulse fire markers
			const baseRadius = 8;
			const pulseRadius = baseRadius + Math.sin(step * 0.3 + index) * 3;
			marker.setRadius(pulseRadius);
			
			// Change opacity
			const opacity = 0.6 + Math.sin(step * 0.2 + index) * 0.2;
			marker.setStyle({fillOpacity: opacity});
		}
	});
}

function animateAerosolMovement(step) {
	// Create moving aerosol particles
	const center = map.getCenter();
	
	if (step % 10 === 0) { // Add new particles every 2 seconds
		const particle = L.circleMarker([
			center.lat + (Math.random() - 0.5) * 0.1,
			center.lng + (Math.random() - 0.5) * 0.1
		], {
			radius: 2,
			fillColor: '#ff6b35',
			color: '#ff6b35',
			weight: 1,
			opacity: 0.8,
			fillOpacity: 0.6
		}).addTo(map);
		
		// Remove particle after 3 seconds
		setTimeout(() => {
			map.removeLayer(particle);
		}, 3000);
	}
}

function animatePrecipitation(step) {
	// Create falling rain effect
	const center = map.getCenter();
	
	if (step % 5 === 0) { // Rain drops every second
		for (let i = 0; i < 3; i++) {
			const raindrop = L.circleMarker([
				center.lat + (Math.random() - 0.5) * 0.2,
				center.lng + (Math.random() - 0.5) * 0.2
			], {
				radius: 1,
				fillColor: '#00bfff',
				color: '#00bfff',
				weight: 1,
				opacity: 0.9,
				fillOpacity: 0.7
			}).addTo(map);
			
			// Remove raindrop after 1 second
			setTimeout(() => {
				if (map.hasLayer(raindrop)) {
					map.removeLayer(raindrop);
				}
			}, 1000);
		}
	}
}

// 🎯 AUTO-START ANIMATIONS when layers are enabled
function toggleFireLayer(e) {
	if (e.target.checked) {
		showFireHotspots();
		startWeatherAnimation();
	} else {
		hideFireHotspots();
		if (!hasAnyLayerEnabled()) stopWeatherAnimation();
	}
}

function toggleAerosolLayer(e) {
	if (e.target.checked) {
		showAerosolDensity();
		startWeatherAnimation();
	} else {
		hideAerosolDensity();
		if (!hasAnyLayerEnabled()) stopWeatherAnimation();
	}
}

function togglePrecipLayer(e) {
	if (e.target.checked) {
		showPrecipitationZones();
		startWeatherAnimation();
	} else {
		hidePrecipitationZones();
		if (!hasAnyLayerEnabled()) stopWeatherAnimation();
	}
}

function hasAnyLayerEnabled() {
	return document.getElementById('toggleFires').checked ||
		   document.getElementById('toggleAerosol').checked ||
		   document.getElementById('togglePrecip').checked;
}

// 🎬 24-Hour Video Timeline Functions
let videoTimelineData = null;
let videoTimer = null;
let currentHourIndex = 0;
let isVideoPlaying = false;
let videoSpeed = 1;

async function get24HourPrediction(lat, lon) {
	try {
		console.log(`🎬 Fetching 24-hour prediction for ${lat}, ${lon}`);
		
		const response = await fetch(`/api/nasa/24hour-hourly?lat=${lat}&lon=${lon}`);
		const data = await response.json();
		
		if (data.success) {
			videoTimelineData = data;
			display24HourTimeline(data);
			return data;
		} else {
			throw new Error(data.error || 'Failed to fetch 24-hour prediction');
		}
	} catch (error) {
		console.error('Error fetching 24-hour prediction:', error);
		showVideoError(error.message);
		return null;
	}
}

function display24HourTimeline(data) {
	console.log('🎬 Displaying 24-hour timeline:', data);
	
	// Show the video widget
	document.getElementById('hourlyVideoWidget').style.display = 'block';
	document.getElementById('videoPlaceholder').style.display = 'none';
	
	// Update location info
	const locationElement = document.getElementById('videoLocation');
	locationElement.textContent = `📍 Lat: ${data.location.lat}, Lon: ${data.location.lon}`;
	
	// Reset video state
	currentHourIndex = 0;
	isVideoPlaying = false;
	stopVideoTimer();
	
	// Generate hourly timeline cards
	generateHourlyCards(data.hourly_forecast);
	
	// Show first hour data
	updateCurrentHourDisplay(data.hourly_forecast[0]);
	updateVideoProgress();
	
	// Setup video controls
	setupVideoControls();
}

function generateHourlyCards(hourlyData) {
	const timeline = document.getElementById('hourlyTimeline');
	timeline.innerHTML = '';
	
	hourlyData.forEach((hour, index) => {
		const card = document.createElement('div');
		card.className = 'hourly-card';
		card.setAttribute('data-hour', index);
		
		// Add time period class
		card.classList.add(`time-${hour.time_period.toLowerCase()}`);
		
		// Add rush hour indicator
		if (hour.is_rush_hour) {
			card.classList.add('rush-hour');
		}
		
		card.innerHTML = `
			<div class="hourly-time">${hour.time}</div>
			<div class="hourly-icon">${hour.weather_icon}</div>
			<div class="hourly-temp">${hour.temperature}°C</div>
			<div class="hourly-aqi" style="background-color: ${hour.level_color};">${hour.predicted_aqi}</div>
		`;
		
		// Add click handler
		card.addEventListener('click', () => {
			jumpToHour(index);
		});
		
		timeline.appendChild(card);
	});
	
	// Highlight first hour
	timeline.children[0]?.classList.add('active');
}

function updateCurrentHourDisplay(hourData) {
	document.getElementById('currentTime').textContent = hourData.datetime;
	document.getElementById('currentIcon').textContent = hourData.weather_icon;
	document.getElementById('currentCondition').textContent = hourData.weather_condition;
	document.getElementById('currentTemp').textContent = `${hourData.temperature}°C`;
	document.getElementById('currentAQI').innerHTML = `AQI: <span style="color: ${hourData.level_color};">${hourData.predicted_aqi}</span>`;
	document.getElementById('currentHumidity').textContent = `${hourData.humidity}%`;
	document.getElementById('currentWind').textContent = `${hourData.wind_speed} m/s`;
	document.getElementById('currentPeriod').textContent = hourData.time_period;
}

function updateVideoProgress() {
	if (!videoTimelineData || !videoTimelineData.hourly_forecast) return;
	
	const totalHours = videoTimelineData.hourly_forecast.length;
	const progress = ((currentHourIndex + 1) / totalHours) * 100;
	document.getElementById('progressBar').style.width = `${progress}%`;
	document.getElementById('timeProgress').textContent = `${currentHourIndex + 1} / ${totalHours} intervals`;
	
	// Update active card
	const cards = document.querySelectorAll('.hourly-card');
	cards.forEach((card, index) => {
		card.classList.toggle('active', index === currentHourIndex);
	});
}

function setupVideoControls() {
	document.getElementById('playBtn').onclick = () => playVideo();
	document.getElementById('pauseBtn').onclick = () => pauseVideo();
	document.getElementById('resetBtn').onclick = () => resetVideo();
	document.getElementById('speedSelect').onchange = (e) => setVideoSpeed(parseInt(e.target.value));
}

function playVideo() {
	if (!videoTimelineData || isVideoPlaying) return;
	
	isVideoPlaying = true;
	const interval = 1000 / videoSpeed; // Base speed: 1 second per hour
	
	videoTimer = setInterval(() => {
		advanceToNextHour();
	}, interval);
	
	console.log(`🎬 Video playing at ${videoSpeed}x speed`);
}

function pauseVideo() {
	isVideoPlaying = false;
	stopVideoTimer();
	console.log('🎬 Video paused');
}

function resetVideo() {
	pauseVideo();
	currentHourIndex = 0;
	if (videoTimelineData) {
		updateCurrentHourDisplay(videoTimelineData.hourly_forecast[0]);
		updateVideoProgress();
	}
	console.log('🎬 Video reset');
}

function setVideoSpeed(speed) {
	videoSpeed = speed;
	if (isVideoPlaying) {
		pauseVideo();
		playVideo(); // Restart with new speed
	}
	console.log(`🎬 Video speed set to ${speed}x`);
}

function advanceToNextHour() {
	if (!videoTimelineData || !videoTimelineData.hourly_forecast) return;
	
	const totalHours = videoTimelineData.hourly_forecast.length;
	currentHourIndex++;
	
	if (currentHourIndex >= totalHours) {
		currentHourIndex = totalHours - 1; // Stay at last hour
		pauseVideo(); // Auto-pause at end
		return;
	}
	
	updateCurrentHourDisplay(videoTimelineData.hourly_forecast[currentHourIndex]);
	updateVideoProgress();
}

function jumpToHour(hourIndex) {
	if (!videoTimelineData || !videoTimelineData.hourly_forecast) return;
	
	const totalHours = videoTimelineData.hourly_forecast.length;
	if (hourIndex < 0 || hourIndex >= totalHours) return;
	
	currentHourIndex = hourIndex;
	updateCurrentHourDisplay(videoTimelineData.hourly_forecast[currentHourIndex]);
	updateVideoProgress();
	
	console.log(`🎬 Jumped to interval ${hourIndex} (${videoTimelineData.hourly_forecast[currentHourIndex].time})`);
}

function stopVideoTimer() {
	if (videoTimer) {
		clearInterval(videoTimer);
		videoTimer = null;
	}
}

function showVideoError(message) {
	const placeholder = document.getElementById('videoPlaceholder');
	placeholder.innerHTML = `
		<div style="color: #dc2626; text-align: center; padding: 20px;">
			❌ Error loading 24-hour prediction<br>
			<small>${message}</small><br>
			<button onclick="location.reload()" style="margin-top: 8px; padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button>
		</div>
	`;
	
	// Hide video widget
	document.getElementById('hourlyVideoWidget').style.display = 'none';
	placeholder.style.display = 'block';
}

// 🎯 Sidebar Navigation Functionality
document.addEventListener('DOMContentLoaded', () => {
	// Sidebar toggle
	const sidebarToggle = document.getElementById('sidebarToggle');
	const sidebar = document.querySelector('.sidebar-nav');
	
	if (sidebarToggle) {
		sidebarToggle.addEventListener('click', () => {
			sidebar.classList.toggle('collapsed');
			document.body.classList.toggle('sidebar-collapsed');
			
			// Rotate arrow
			const arrow = sidebarToggle.querySelector('svg');
			if (sidebar.classList.contains('collapsed')) {
				arrow.style.transform = 'rotate(180deg)';
			} else {
				arrow.style.transform = 'rotate(0deg)';
			}
		});
	}
	
	// Smooth scroll and active state
	const sidebarItems = document.querySelectorAll('.sidebar-item');
	
	sidebarItems.forEach(item => {
		item.addEventListener('click', (e) => {
			e.preventDefault();
			
			// Remove active class from all items
			sidebarItems.forEach(i => i.classList.remove('active'));
			
			// Add active class to clicked item
			item.classList.add('active');
			
			// Smooth scroll to section
			const targetId = item.getAttribute('href');
			const targetSection = document.querySelector(targetId);
			
			if (targetSection) {
				targetSection.scrollIntoView({
					behavior: 'smooth',
					block: 'start'
				});
			}
		});
	});
	
	// Update active state on scroll
	window.addEventListener('scroll', () => {
		let current = '';
		
		const sections = document.querySelectorAll('[id$="-section"]');
		sections.forEach(section => {
			const sectionTop = section.offsetTop;
			const sectionHeight = section.clientHeight;
			
			if (pageYOffset >= sectionTop - 200) {
				current = section.getAttribute('id');
			}
		});
		
		sidebarItems.forEach(item => {
			item.classList.remove('active');
			if (item.getAttribute('href') === `#${current}`) {
				item.classList.add('active');
			}
		});
	});
});

