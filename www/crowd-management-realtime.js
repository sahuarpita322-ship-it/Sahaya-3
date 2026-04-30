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
}

// ========== ROUTE FINDING & OPTIMIZATION ==========
function findCrowdFreeRoute() {
  const originInput = document.getElementById('originInput').value;
  const destinationInput = document.getElementById('destinationInput').value;

  if (!originInput || !destinationInput) {
    showNotification('Please enter both origin and destination', 'error');
    return;
  }

  // Show loading status
  showRouteStatus('Analyzing crowd data and calculating optimal routes...');

  // Simulate route calculation with delay
  setTimeout(() => {
    // Parse destination (in real scenario, use geocoding API)
    const destParts = destinationInput.split(',');
    if (destParts.length === 2) {
      destinationLocation = {
        lat: parseFloat(destParts[0]),
        lng: parseFloat(destParts[1])
      };
    } else {
      // Find closest match from crowd zones
      const closestZone = Object.values(SIMULATED_CROWD_ZONES)[0];
      destinationLocation = { lat: closestZone.lat, lng: closestZone.lng };
    }

    // Generate multiple route options
    generateMultipleRoutes();

    // Select best crowd-free route
    selectBestRoute();

    // Display route on map
    displayRouteOnMap();

    // Update UI
    updateRouteInfo();

    showRouteStatus('Route calculated! Safe path recommended.', true);

    // Start voice guidance if enabled
    if (voiceEnabled) {
      giveVoiceGuidance();
    }
  }, 1500);
}

function generateMultipleRoutes() {
  // Generate 3 route alternatives
  allRoutes = [
    {
      name: 'Fastest',
      waypoints: [userLocation, destinationLocation],
      distance: calculateDistance(userLocation, destinationLocation),
      crowdScore: calculateCrowdScore([userLocation, destinationLocation]),
      type: 'direct'
    },
    {
      name: 'Least Crowded',
      waypoints: generateCrowdAvoidingRoute('avoid'),
      distance: 1.2 * calculateDistance(userLocation, destinationLocation),
      crowdScore: 0.2,
      type: 'crowdAvoid'
    },
    {
      name: 'Balanced',
      waypoints: generateBalancedRoute(),
      distance: 1.05 * calculateDistance(userLocation, destinationLocation),
      crowdScore: 0.4,
      type: 'balanced'
    }
  ];

  // Sort by crowd score
  allRoutes.sort((a, b) => a.crowdScore - b.crowdScore);
}

function generateCrowdAvoidingRoute(mode) {
  // Create a route that avoids high crowd density areas
  const waypoints = [userLocation];

  // Calculate detour to avoid crowds
  const crowdZones = Object.values(SIMULATED_CROWD_ZONES).filter(z => z.density > 0.5);
  
  // Add waypoint that avoids crowds
  const avoidPoint = {
    lat: userLocation.lat - 0.01,
    lng: userLocation.lng + 0.01
  };

  waypoints.push(avoidPoint);
  waypoints.push(destinationLocation);

  return waypoints;
}

function generateBalancedRoute() {
  // Create a balanced route between speed and safety
  const waypoints = [userLocation];

  // Add intermediate waypoint
  const midPoint = {
    lat: (userLocation.lat + destinationLocation.lat) / 2,
    lng: (userLocation.lng + destinationLocation.lng) / 2
  };

  waypoints.push(midPoint);
  waypoints.push(destinationLocation);

  return waypoints;
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

  // Remove old route if exists
  if (routeAmbulance) {
    routeAmbulance.remove();
  }

  // Add destination marker
  const destIcon = L.divIcon({
    html: `
      <div class="relative flex items-center justify-center">
        <div class="w-8 h-8 rounded-full bg-red-500 border-4 border-white shadow-lg shadow-red-500/50"></div>
      </div>
    `,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });

  L.marker([destinationLocation.lat, destinationLocation.lng], { icon: destIcon })
    .addTo(map)
    .bindPopup('<strong>Destination</strong>');

  // Draw route polyline
  const latlngs = currentRoute.waypoints.map(p => [p.lat, p.lng]);

  L.polyline(latlngs, {
    color: '#06b6d4',
    weight: 3,
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
  // Add arrows along the route
  for (let i = 0; i < latlngs.length - 1; i++) {
    const start = latlngs[i];
    const end = latlngs[i + 1];
    const angle = calculateBearing(start, end);

    const arrowIcon = L.divIcon({
      html: `<div style="transform: rotate(${angle}deg); color: #06b6d4;">→</div>`,
      className: 'text-2xl font-bold',
      iconSize: [20, 20]
    });

    const midLat = (start[0] + end[0]) / 2;
    const midLng = (start[1] + end[1]) / 2;

    L.marker([midLat, midLng], { icon: arrowIcon }).addTo(map);
  }
}

function animateAmbulanceOnMap(latlngs) {
  // Animate ambulance moving along the route
  let currentIndex = 0;
  let currentStep = 0;
  const stepsPerSegment = 50;

  const ambulanceIcon = L.divIcon({
    html: `
      <div class="w-8 h-8 rounded-full bg-yellow-400 border-2 border-white shadow-lg shadow-yellow-400/50 flex items-center justify-center text-xs font-bold">
        🚑
      </div>
    `,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  routeAmbulance = L.marker([latlngs[0][0], latlngs[0][1]], { icon: ambulanceIcon }).addTo(map);

  const animationInterval = setInterval(() => {
    if (currentIndex >= latlngs.length - 1) {
      clearInterval(animationInterval);
      showNotification('Destination reached! 🎉', 'success');
      return;
    }

    const start = latlngs[currentIndex];
    const end = latlngs[currentIndex + 1];

    const lat = start[0] + (end[0] - start[0]) * (currentStep / stepsPerSegment);
    const lng = start[1] + (end[1] - start[1]) * (currentStep / stepsPerSegment);

    routeAmbulance.setLatLng([lat, lng]);

    currentStep++;
    if (currentStep >= stepsPerSegment) {
      currentStep = 0;
      currentIndex++;
    }
  }, 100);
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
  // Calculate average crowd score along the route
  let totalCrowdScore = 0;
  let countPoints = 0;

  waypoints.forEach(waypoint => {
    Object.values(SIMULATED_CROWD_ZONES).forEach(zone => {
      const distance = calculateDistance(waypoint, { lat: zone.lat, lng: zone.lng });
      if (distance < zone.radius / 111) { // Convert meters to degrees
        totalCrowdScore += zone.density;
        countPoints++;
      }
    });
  });

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
  const duration = Math.ceil(distance / 40 * 60); // Assume 40 km/h average speed

  document.getElementById('distanceDisplay').textContent = `${distance.toFixed(1)} km`;
  document.getElementById('durationDisplay').textContent = `${duration} mins`;
  
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
function searchDestination() {
  const input = document.getElementById('destinationInput').value;
  
  if (!input) {
    showNotification('Please enter a destination', 'error');
    return;
  }

  // Simulate geocoding (in real scenario, use Nominatim or Google Maps API)
  const commonLocations = {
    'hospital': { lat: 19.810, lng: 84.785 },
    'market': { lat: 19.815, lng: 84.795 },
    'station': { lat: 19.820, lng: 84.800 },
    'park': { lat: 19.805, lng: 84.790 },
    'airport': { lat: 19.825, lng: 84.805 }
  };

  const lowerInput = input.toLowerCase();
  for (const [location, coords] of Object.entries(commonLocations)) {
    if (lowerInput.includes(location)) {
      document.getElementById('destinationInput').value = `${coords.lat}, ${coords.lng}`;
      showNotification(`Found: ${location.toUpperCase()}`, 'success');
      return;
    }
  }

  showNotification('Location not found. Please enter coordinates (lat, lng)', 'warning');
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
