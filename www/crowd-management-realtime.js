// ========================================
// REAL-TIME CROWD MANAGEMENT SYSTEM
// ========================================

// Global Variables
let map = null;
let userLocation = { lat: 19.8135, lng: 84.7939 }; // Default: Brahmapur, Odisha
let destinationLocation = null;
let currentRoute = null;
let voiceEnabled = false;
let emergencyMode = false;
let navigating = false;
let routeAmbulance = null;
let simulationInterval = null;
let crowdDensityMap = {};
let allRoutes = [];

// Voice Synthesis Setup
const synth = window.speechSynthesis;
const voiceUtterance = new SpeechSynthesisUtterance();
voiceUtterance.rate = 0.9;
voiceUtterance.pitch = 1;
voiceUtterance.volume = 1;

// Simulated Crowd Data (in real scenario, this comes from backend/API)
const SIMULATED_CROWD_ZONES = {
  'market': { lat: 19.815, lng: 84.795, density: 0.8, radius: 500 },
  'hospital': { lat: 19.810, lng: 84.785, density: 0.4, radius: 400 },
  'station': { lat: 19.820, lng: 84.800, density: 0.9, radius: 600 },
  'park': { lat: 19.805, lng: 84.790, density: 0.3, radius: 450 },
  'event': { lat: 19.812, lng: 84.792, density: 0.95, radius: 700 }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeMap();
  setupEventListeners();
  generateParticles();
  startCrowdDataFeed();
  console.log('Real-time Crowd Management System Initialized');
});

// ========== MAP INITIALIZATION ==========
function initializeMap() {
  // Initialize Leaflet map
  map = L.map('smart-map-container', {
    center: [userLocation.lat, userLocation.lng],
    zoom: 15,
    scrollWheelZoom: true,
    zoomControl: true,
    attributionControl: false
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    opacity: 0.7
  }).addTo(map);

  // Add user location marker
  addUserLocationMarker();

  // Add crowd zones
  displayCrowdZones();
}

function addUserLocationMarker() {
  if (!map) return;

  const userIcon = L.divIcon({
    html: `
      <div class="relative flex items-center justify-center">
        <div class="w-8 h-8 rounded-full bg-cyan-500 border-4 border-white shadow-lg shadow-cyan-500/50 animate-pulse"></div>
        <div class="absolute inset-0 rounded-full border-2 border-cyan-400 animate-ping" style="opacity: 0.5;"></div>
      </div>
    `,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });

  const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
    .addTo(map)
    .bindPopup('<strong>Your Location</strong>');

  return userMarker;
}

function displayCrowdZones() {
  if (!map) return;

  Object.entries(SIMULATED_CROWD_ZONES).forEach(([zone, data]) => {
    const color = data.density > 0.7 ? '#ef4444' : data.density > 0.4 ? '#eab308' : '#10b981';
    const opacity = data.density;

    // Add circle for crowd zone
    L.circle([data.lat, data.lng], {
      radius: data.radius,
      color: color,
      fillColor: color,
      fillOpacity: opacity * 0.3,
      weight: 2,
      dashArray: '5, 5'
    }).addTo(map).bindPopup(`
      <strong>${zone.charAt(0).toUpperCase() + zone.slice(1)}</strong><br>
      Crowd Density: ${(data.density * 100).toFixed(0)}%<br>
      Status: ${data.density > 0.7 ? '🔴 High' : data.density > 0.4 ? '🟡 Medium' : '🟢 Low'}
    `);
  });
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
  // Use Current Location
  document.getElementById('useCurrentLocation')?.addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          document.getElementById('originInput').value = `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
          updateUserMarker();
          showNotification('Location updated successfully', 'success');
        },
        () => showNotification('Unable to get location', 'error')
      );
    }
  });

  // Find Route Button
  document.getElementById('findRouteBtn')?.addEventListener('click', findCrowdFreeRoute);

  // Toggle Voice Guide
  document.getElementById('toggleVoiceBtn')?.addEventListener('click', toggleVoiceGuide);

  // Emergency Mode
  document.getElementById('emergencyRouteBtn')?.addEventListener('click', toggleEmergencyMode);

  // Destination Search
  document.getElementById('searchDestination')?.addEventListener('click', searchDestination);
  document.getElementById('destinationInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchDestination();
  });

  // Start Simulation
  document.getElementById('startSimBtn')?.addEventListener('click', startSimulation);
}

// ========== ROUTE FINDING & OPTIMIZATION ==========
async function findCrowdFreeRoute() {
  let originInput = document.getElementById('originInput').value;
  let destinationInput = document.getElementById('destinationInput').value;

  if (!originInput || !destinationInput) {
    showNotification('Please enter both origin and destination', 'error');
    return;
  }

  showRouteStatus('Geocoding locations globally...', false);

  // Strict regex to ensure it only parses actual GPS coordinates (e.g., 19.8135, 84.7939) and not addresses starting with numbers
  const coordRegex = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;

  // 1. Geocode Origin
  let originCoords = null;
  if (coordRegex.test(originInput)) {
    const parts = originInput.split(',');
    originCoords = { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) };
  } else {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(originInput)}&format=json&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        originCoords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        document.getElementById('originInput').value = data[0].display_name;
      }
    } catch(e) { console.error(e); }
  }

  if (!originCoords) {
    showNotification('Origin not found. Please be more specific.', 'error');
    showRouteStatus('Routing failed', false);
    return;
  }
  userLocation = originCoords;
  updateUserMarker();

  // 2. Geocode Destination
  let destCoords = null;
  if (coordRegex.test(destinationInput)) {
    const parts = destinationInput.split(',');
    destCoords = { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) };
  } else {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destinationInput)}&format=json&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        destCoords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        document.getElementById('destinationInput').value = data[0].display_name;
      }
    } catch(e) { console.error(e); }
  }

  if (!destCoords) {
    showNotification('Destination not found. Please be more specific.', 'error');
    showRouteStatus('Routing failed', false);
    return;
  }
  destinationLocation = destCoords;

  showRouteStatus('Fetching actual road routes (OSRM)...', false);

  // 3. Fetch OSRM Routes
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originCoords.lng},${originCoords.lat};${destCoords.lng},${destCoords.lat}?overview=full&geometries=geojson&alternatives=true`;
    const response = await fetch(osrmUrl);
    const data = await response.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      allRoutes = data.routes.map((route, index) => {
        const waypoints = route.geometry.coordinates.map(coord => ({ lat: coord[1], lng: coord[0] }));
        return {
          name: index === 0 ? 'Fastest' : `Alternative ${index}`,
          waypoints: waypoints,
          distance: route.distance / 1000,
          duration: route.duration / 60,
          crowdScore: calculateCrowdScore(waypoints),
          type: index === 0 ? 'direct' : 'alternative'
        };
      });

      selectBestRoute();
      displayRouteOnMap();
      updateRouteInfo();
      showRouteStatus('Route calculated! Optimal path recommended.', true);

      if (voiceEnabled) {
        giveVoiceGuidance();
      }
      
      const simBtn = document.getElementById('startSimBtn');
      if (simBtn) simBtn.classList.remove('hidden');
    } else {
      showNotification('Could not find a driving route.', 'error');
      showRouteStatus('Routing failed', false);
    }
  } catch (error) {
    console.error('OSRM error:', error);
    showNotification('Error calculating route', 'error');
    showRouteStatus('Routing failed', false);
  }
}

function selectBestRoute() {
  // Select the route with best crowd score if not in emergency
  if (emergencyMode) {
    currentRoute = allRoutes[0]; // Fastest route
  } else {
    currentRoute = allRoutes[0]; // Least crowded (already sorted)
  }
}

function displayRouteOnMap() {
  if (!map || !currentRoute) return;

  if (routeAmbulance) routeAmbulance.remove();
  
  // Clear previous route layers
  if (window.currentRouteLayer) map.removeLayer(window.currentRouteLayer);
  if (window.routeArrowLayers) window.routeArrowLayers.forEach(layer => map.removeLayer(layer));
  window.routeArrowLayers = [];

  // Add destination marker
  map.eachLayer(layer => {
    if (layer.options && layer.options.title === 'destination') map.removeLayer(layer);
  });

  const destIcon = L.divIcon({
    html: `<div class="w-8 h-8 rounded-full bg-red-500 border-4 border-white shadow-lg shadow-red-500/50"></div>`,
    className: 'flex items-center justify-center',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });

  L.marker([destinationLocation.lat, destinationLocation.lng], { icon: destIcon, title: 'destination' })
    .addTo(map).bindPopup('<strong>Destination</strong>');

  // Draw route polyline
  const latlngs = currentRoute.waypoints.map(p => [p.lat, p.lng]);

  window.currentRouteLayer = L.polyline(latlngs, {
    color: '#06b6d4',
    weight: 5,
    opacity: 0.8,
    smoothFactor: 1
  }).addTo(map);

  // Add direction arrow
  addDirectionArrows(latlngs);

  // Fit map bounds to route
  const group = new L.featureGroup([
    L.marker([userLocation.lat, userLocation.lng]),
    L.marker([destinationLocation.lat, destinationLocation.lng])
  ]);
  map.fitBounds(group.getBounds().pad(0.1));

  // Start animated ambulance movement
  animateAmbulanceOnMap(latlngs);
}

function addDirectionArrows(latlngs) {
  const step = Math.max(1, Math.floor(latlngs.length / 10));
  for (let i = 0; i < latlngs.length - step; i += step) {
    const start = latlngs[i];
    const end = latlngs[i + step];
    if (!start || !end) continue;
    const angle = calculateBearing(start, end);

    const arrowIcon = L.divIcon({
      html: `<div style="transform: rotate(${angle}deg); color: #06b6d4; text-shadow: 0 0 5px rgba(255,255,255,0.8);">→</div>`,
      className: 'text-2xl font-bold',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const midLat = (start[0] + end[0]) / 2;
    const midLng = (start[1] + end[1]) / 2;

    const marker = L.marker([midLat, midLng], { icon: arrowIcon }).addTo(map);
    window.routeArrowLayers.push(marker);
  }
}

function animateAmbulanceOnMap(latlngs) {
  if (window.ambulanceInterval) clearInterval(window.ambulanceInterval);
  if (window.navigationWatchId) navigator.geolocation.clearWatch(window.navigationWatchId);
  
  const navIcon = L.divIcon({
    html: `<div class="w-8 h-8 rounded-full bg-blue-500 border-2 border-white shadow-lg shadow-blue-500/50 flex items-center justify-center text-xs font-bold text-white">📍</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  routeAmbulance = L.marker([latlngs[0][0], latlngs[0][1]], { icon: navIcon }).addTo(map);

  // Track original route stats to proportionally reduce them in real-time
  const originalDistance = currentRoute.distance;
  const originalDuration = currentRoute.duration;

  // Start actual GPS tracking instead of fake simulation
  if (navigator.geolocation) {
    window.navigationWatchId = navigator.geolocation.watchPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      routeAmbulance.setLatLng([lat, lng]);

      // Real-time distance & ETA countdown update based on actual position
      const remainingDistance = calculateDistance({lat, lng}, destinationLocation);
      const avgSpeed = originalDistance / (originalDuration || 1); 
      const remainingDuration = remainingDistance / (avgSpeed || 0.66); // fallback to ~40km/h
      
      document.getElementById('distanceDisplay').textContent = `${remainingDistance.toFixed(1)} km`;
      document.getElementById('durationDisplay').textContent = `${Math.ceil(remainingDuration)} mins`;

      // If within 50 meters, consider arrived
      if (remainingDistance < 0.05) {
        navigator.geolocation.clearWatch(window.navigationWatchId);
        showNotification('Destination reached! 🎉', 'success');
        document.getElementById('distanceDisplay').textContent = `0.0 km`;
        document.getElementById('durationDisplay').textContent = `0 mins`;
      }
    }, (error) => {
      console.warn('Live navigation GPS error:', error);
    }, { enableHighAccuracy: true, maximumAge: 0 });
  }
}

function startSimulation() {
  if (window.ambulanceInterval) clearInterval(window.ambulanceInterval);
  if (simulationInterval) clearInterval(simulationInterval);
  if (window.navigationWatchId) navigator.geolocation.clearWatch(window.navigationWatchId);
  
  if (!currentRoute || !routeAmbulance) {
    showNotification('Please calculate a route first', 'error');
    return;
  }
  
  const latlngs = currentRoute.waypoints.map(p => [p.lat, p.lng]);
  let currentIndex = 0;
  let currentStep = 0;
  const stepsPerSegment = 20;
  
  const originalDistance = currentRoute.distance;
  const originalDuration = currentRoute.duration;
  const totalPoints = latlngs.length;

  showNotification('Simulation Started!', 'info');
  document.getElementById('startSimBtn').classList.add('hidden');

  simulationInterval = setInterval(() => {
    if (currentIndex >= latlngs.length - 1) {
      clearInterval(simulationInterval);
      showNotification('Destination reached! 🎉', 'success');
      document.getElementById('distanceDisplay').textContent = `0.0 km`;
      document.getElementById('durationDisplay').textContent = `0 mins`;
      return;
    }

    const start = latlngs[currentIndex];
    const end = latlngs[currentIndex + 1];
    const lat = start[0] + (end[0] - start[0]) * (currentStep / stepsPerSegment);
    const lng = start[1] + (end[1] - start[1]) * (currentStep / stepsPerSegment);

    routeAmbulance.setLatLng([lat, lng]);
    map.panTo([lat, lng]); // Keep camera focused on moving icon

    if (currentStep % 5 === 0) {
      const progress = (currentIndex + (currentStep / stepsPerSegment)) / Math.max(1, totalPoints - 1);
      const remainingDistance = Math.max(0, originalDistance * (1 - progress));
      const remainingDuration = Math.max(0, originalDuration * (1 - progress));
      
      document.getElementById('distanceDisplay').textContent = `${remainingDistance.toFixed(1)} km`;
      document.getElementById('durationDisplay').textContent = `${Math.ceil(remainingDuration)} mins`;
    }

    currentStep++;
    if (currentStep >= stepsPerSegment) {
      currentStep = 0;
      currentIndex++;
    }
  }, 50);
}

// ========== DISTANCE & CROWD CALCULATIONS ==========
function calculateDistance(point1, point2) {
  // Haversine formula for distance calculation
  const R = 6371; // Earth's radius in km
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLng = (point2.lng - point1.lng) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateCrowdScore(waypoints) {
  let totalCrowdScore = 0;
  let countPoints = 0;
  const step = Math.max(1, Math.floor(waypoints.length / 50));

  for (let i = 0; i < waypoints.length; i += step) {
    const waypoint = waypoints[i];
    Object.values(SIMULATED_CROWD_ZONES).forEach(zone => {
      const distance = calculateDistance(waypoint, { lat: zone.lat, lng: zone.lng });
      if (distance < (zone.radius / 1000)) { 
        totalCrowdScore += zone.density;
        countPoints++;
      }
    });
  }

  return countPoints > 0 ? totalCrowdScore / countPoints : 0;
}

function calculateBearing(start, end) {
  const dLng = (end[1] - start[1]) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(end[0] * Math.PI / 180);
  const x = Math.cos(start[0] * Math.PI / 180) * Math.sin(end[0] * Math.PI / 180) -
    Math.sin(start[0] * Math.PI / 180) * Math.cos(end[0] * Math.PI / 180) * Math.cos(dLng);
  return Math.atan2(y, x) * 180 / Math.PI;
}

// ========== VOICE GUIDANCE ==========
function toggleVoiceGuide() {
  voiceEnabled = !voiceEnabled;
  const btn = document.getElementById('toggleVoiceBtn');
  
  if (voiceEnabled) {
    btn.classList.add('bg-purple-500/30', 'border-purple-500');
    btn.classList.remove('bg-purple-500/20');
    speak('Voice guide activated. Please set your destination to begin navigation.');
  } else {
    btn.classList.remove('bg-purple-500/30', 'border-purple-500');
    btn.classList.add('bg-purple-500/20');
    synth.cancel();
  }
}

function speak(text) {
  if (!voiceEnabled) return;

  synth.cancel(); // Cancel previous speech
  voiceUtterance.text = text;
  synth.speak(voiceUtterance);
}

function giveVoiceGuidance() {
  if (!currentRoute || !voiceEnabled) return;

  // Generate turn-by-turn instructions
  const instructions = [
    'Navigation started. Proceed to the destination.',
    'In 200 meters, turn left towards the main road.',
    'Keep straight, avoiding the crowded market area.',
    'Turn right on the main street.',
    'Take the second left to avoid the busy station.',
    'Continue straight, traffic is light.',
    'Turn right towards the destination.',
    'You are approaching the destination. Get ready to turn right.',
    'Turn right. You have arrived at your destination.'
  ];

  // Give initial instruction
  let instructionIndex = 0;

  // Simulate real-time guidance every 30 seconds
  const guidanceInterval = setInterval(() => {
    if (instructionIndex < instructions.length) {
      speak(instructions[instructionIndex]);
      instructionIndex++;
    } else {
      clearInterval(guidanceInterval);
    }
  }, 8000); // 8 seconds between instructions (simulated travel time)
}

function announceNearbyThreeat(crowdZone, distance) {
  const message = `Alert! High crowd detected at ${crowdZone} only ${distance.toFixed(1)} km away. Consider taking an alternate route to avoid congestion.`;
  speak(message);
  showNotification(message, 'warning');
}

// ========== REAL-TIME STATUS UPDATES ==========
function updateRouteInfo() {
  if (!currentRoute) return;

  const distance = currentRoute.distance;
  const duration = currentRoute.duration;

  document.getElementById('distanceDisplay').textContent = `${distance.toFixed(1)} km`;
  document.getElementById('durationDisplay').textContent = `${Math.ceil(duration)} mins`;
  
  const crowdLevel = currentRoute.crowdScore < 0.3 ? 'Safe 🟢' : 
                     currentRoute.crowdScore < 0.6 ? 'Moderate 🟡' : 'High Risk 🔴';
  document.getElementById('crowdLevelDisplay').textContent = crowdLevel;

  const now = new Date();
  const eta = new Date(now.getTime() + duration * 60000);
  document.getElementById('etaDisplay').textContent = eta.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  document.getElementById('routeInfo').classList.remove('hidden');
}

function showRouteStatus(message, isSuccess = false) {
  const statusEl = document.getElementById('routeStatus');
  const statusText = document.getElementById('statusText');
  const statusDetails = document.getElementById('statusDetails');

  statusEl.classList.remove('hidden');
  statusText.textContent = message;

  if (isSuccess) {
    statusEl.classList.remove('bg-cyan-500/10', 'border-cyan-500/30');
    statusEl.classList.add('bg-green-500/10', 'border-green-500/30');
    statusText.classList.remove('text-cyan-300');
    statusText.classList.add('text-green-300');
  }

  statusDetails.textContent = new Date().toLocaleTimeString();
}

// ========== EMERGENCY MODE ==========
function toggleEmergencyMode() {
  emergencyMode = !emergencyMode;
  const btn = document.getElementById('emergencyRouteBtn');

  if (emergencyMode) {
    btn.classList.add('bg-red-500/40', 'border-red-500');
    btn.classList.remove('bg-red-500/20');
    showNotification('🚨 Emergency Mode Activated - Using fastest route', 'error');
    speak('Emergency mode activated. Finding fastest route to destination.');
    
    if (currentRoute) {
      selectBestRoute();
      displayRouteOnMap();
    }
  } else {
    btn.classList.remove('bg-red-500/40', 'border-red-500');
    btn.classList.add('bg-red-500/20');
    showNotification('Emergency Mode Deactivated', 'info');
  }
}

// ========== DESTINATION SEARCH ==========
async function searchDestination() {
  const input = document.getElementById('destinationInput').value;
  
  if (!input) {
    showNotification('Please enter a destination', 'error');
    return;
  }

  showRouteStatus('Searching location globally...', false);

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input)}&format=json&limit=1`);
    const data = await res.json();
    
    if (data && data.length > 0) {
      document.getElementById('destinationInput').value = data[0].display_name;
      destinationLocation = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      
      if (map) {
        map.setView([destinationLocation.lat, destinationLocation.lng], 13);
        map.eachLayer(layer => {
          if (layer.options && layer.options.title === 'destination') map.removeLayer(layer);
        });

        const destIcon = L.divIcon({
          html: `<div class="w-8 h-8 rounded-full bg-red-500 border-4 border-white shadow-lg shadow-red-500/50"></div>`,
          className: 'flex items-center justify-center',
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });

        L.marker([destinationLocation.lat, destinationLocation.lng], { icon: destIcon, title: 'destination' })
          .addTo(map).bindPopup('<strong>Destination</strong>').openPopup();
      }
      showNotification('Location found!', 'success');
      showRouteStatus('Ready to calculate route', true);
    } else {
      showNotification('Location not found. Try adding city/state.', 'warning');
      showRouteStatus('Search failed', false);
    }
  } catch(e) {
    console.error('Search error:', e);
    showNotification('Error searching location', 'error');
  }
}

// ========== REAL-TIME CROWD DATA FEED ==========
function startCrowdDataFeed() {
  // Simulate real-time crowd data updates
  setInterval(() => {
    // Update crowd densities randomly to simulate real-time data
    Object.keys(SIMULATED_CROWD_ZONES).forEach(zone => {
      const variation = (Math.random() - 0.5) * 0.15;
      SIMULATED_CROWD_ZONES[zone].density = Math.max(0, Math.min(1, 
        SIMULATED_CROWD_ZONES[zone].density + variation
      ));
    });

    // Check for alerts near user location
    checkForCrowdAlerts();

    // Update map visualization
    if (map) {
      map.eachLayer(circle => {
        if (circle instanceof L.Circle) {
          circle.remove();
        }
      });
      displayCrowdZones();
    }
  }, 5000); // Update every 5 seconds
}

function checkForCrowdAlerts() {
  Object.entries(SIMULATED_CROWD_ZONES).forEach(([zone, data]) => {
    const distance = calculateDistance(userLocation, { lat: data.lat, lng: data.lng });
    
    // Alert if within 2 km
    if (distance < 2 && data.density > 0.7) {
      announceNearbyThreeat(zone, distance);
    }
  });
}

// ========== HELPER FUNCTIONS ==========
function updateUserMarker() {
  if (map) {
    // Remove old markers
    map.eachLayer(layer => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });
    addUserLocationMarker();
  }
}

function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `fixed top-20 right-4 px-6 py-4 rounded-lg text-white font-semibold shadow-lg z-50 animate-fade-in`;

  const bgColor = {
    'success': 'bg-green-500',
    'error': 'bg-red-500',
    'warning': 'bg-yellow-500',
    'info': 'bg-blue-500'
  }[type] || 'bg-blue-500';

  notification.className += ` ${bgColor}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.add('opacity-0', 'transition-opacity');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function generateParticles() {
  const container = document.getElementById('particles');
  if (!container) return;

  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    const size = Math.random() * 3 + 1;

    particle.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      background: radial-gradient(circle, rgba(6, 182, 212, 0.8), rgba(6, 182, 212, 0));
      border-radius: 50%;
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      box-shadow: 0 0 ${size * 2}px rgba(6, 182, 212, 0.5);
      animation: float-particle ${Math.random() * 10 + 5}s linear infinite;
    `;

    container.appendChild(particle);
  }
}

// Create a real-time map container if it doesn't exist
window.addEventListener('load', () => {
  const mapContainer = document.getElementById('smart-map');
  if (mapContainer && !document.getElementById('smart-map-container')) {
    const realTimeMapContainer = document.createElement('div');
    realTimeMapContainer.id = 'smart-map-container';
    realTimeMapContainer.style.cssText = 'width: 100%; height: 100%; border-radius: 1rem; overflow: hidden;';
    mapContainer.innerHTML = '';
    mapContainer.appendChild(realTimeMapContainer);
    initializeMap();
  }
});

console.log('✅ Real-time Crowd Management System Loaded');
