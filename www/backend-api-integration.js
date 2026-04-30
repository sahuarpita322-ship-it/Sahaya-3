// ========================================
// BACKEND API INTEGRATION TEMPLATE
// Replace these with your actual API endpoints
// ========================================

/**
 * SETUP INSTRUCTIONS:
 * 1. Replace API_BASE_URL with your backend server
 * 2. Implement the backend endpoints as shown
 * 3. Update the functions below to use real APIs
 * 4. Test each endpoint separately
 */

const API_BASE_URL = 'https://your-api.com/api'; // Change this to your backend URL

// ========== CROWD DATA API ==========
/**
 * Get real-time crowd data for all zones
 * 
 * Backend Endpoint:
 * GET /api/crowd-data
 * 
 * Expected Response:
 * {
 *   "zones": [
 *     {
 *       "id": "market",
 *       "name": "Central Market",
 *       "lat": 19.815,
 *       "lng": 84.795,
 *       "density": 0.75,      // 0-1 scale
 *       "count": 5000,        // estimated people
 *       "status": "high",     // low, medium, high
 *       "lastUpdated": "2024-04-29T10:30:00Z"
 *     },
 *     ...
 *   ]
 * }
 */
async function fetchCrowdData() {
  try {
    const response = await fetch(`${API_BASE_URL}/crowd-data`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) throw new Error('Failed to fetch crowd data');

    const data = await response.json();
    updateCrowdZones(data.zones);
    return data;
  } catch (error) {
    console.error('Error fetching crowd data:', error);
    return null;
  }
}

// ========== LOCATION GEOCODING API ==========
/**
 * Convert place name to coordinates
 * 
 * Backend Endpoint:
 * GET /api/geocode?query={placeName}
 * 
 * Expected Response:
 * {
 *   "results": [
 *     {
 *       "name": "Central Hospital",
 *       "lat": 19.810,
 *       "lng": 84.785,
 *       "type": "hospital",
 *       "address": "Main Street, Brahmapur"
 *     }
 *   ]
 * }
 */
async function geocodeLocation(placeName) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/geocode?query=${encodeURIComponent(placeName)}`,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    );

    const data = await response.json();
    return data.results[0] || null;
  } catch (error) {
    console.error('Error geocoding location:', error);
    return null;
  }
}

// ========== ROUTE PLANNING API ==========
/**
 * Get multiple route options with crowd avoidance
 * 
 * Backend Endpoint:
 * POST /api/routes/plan
 * 
 * Request Body:
 * {
 *   "origin": { "lat": 19.8135, "lng": 84.7939 },
 *   "destination": { "lat": 19.815, "lng": 84.795 },
 *   "mode": "ambulance",           // ambulance, car, pedestrian
 *   "avoidCrowd": true,            // Enable crowd avoidance
 *   "emergency": false             // Emergency mode (fastest only)
 * }
 * 
 * Expected Response:
 * {
 *   "routes": [
 *     {
 *       "id": "route_1",
 *       "name": "Fastest",
 *       "distance": 2.5,           // km
 *       "duration": 8,             // minutes
 *       "crowdScore": 0.8,         // 0-1 scale
 *       "status": "high_crowd",
 *       "coordinates": [
 *         [19.8135, 84.7939],
 *         [19.814, 84.794],
 *         ...
 *       ],
 *       "turns": [
 *         { "instruction": "Turn left", "distance": 0.5 },
 *         ...
 *       ]
 *     },
 *     ...
 *   ],
 *   "recommended": 0               // Index of recommended route
 * }
 */
async function planRoutes(origin, destination, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}/routes/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        origin,
        destination,
        mode: 'ambulance',
        avoidCrowd: !options.emergency,
        emergency: options.emergency || false
      })
    });

    if (!response.ok) throw new Error('Failed to plan routes');

    return await response.json();
  } catch (error) {
    console.error('Error planning routes:', error);
    return null;
  }
}

// ========== CROWD ALERT API ==========
/**
 * Get active crowd alerts in an area
 * 
 * Backend Endpoint:
 * GET /api/alerts?lat={lat}&lng={lng}&radius={radius}
 * 
 * Expected Response:
 * {
 *   "alerts": [
 *     {
 *       "id": "alert_123",
 *       "type": "overcrowding",
 *       "severity": "high",           // low, medium, high, critical
 *       "location": { "lat": 19.815, "lng": 84.795 },
 *       "message": "High crowd detected at Central Market",
 *       "affectedArea": {
 *         "center": [19.815, 84.795],
 *         "radius": 500
 *       },
 *       "estimatedDuration": 30,      // minutes
 *       "timestamp": "2024-04-29T10:30:00Z"
 *     },
 *     ...
 *   ]
 * }
 */
async function fetchCrowdAlerts(lat, lng, radius = 2000) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/alerts?lat=${lat}&lng=${lng}&radius=${radius}`,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    );

    return await response.json();
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return { alerts: [] };
  }
}

// ========== NAVIGATION EVENT LOG API ==========
/**
 * Send real-time location during navigation
 * Useful for fleet management and analytics
 * 
 * Backend Endpoint:
 * POST /api/navigation/log
 * 
 * Request Body:
 * {
 *   "userId": "user_123",
 *   "routeId": "route_456",
 *   "location": { "lat": 19.814, "lng": 84.794 },
 *   "speed": 45,                     // km/h
 *   "timestamp": "2024-04-29T10:30:00Z"
 * }
 */
async function logNavigationEvent(userId, routeId, location, speed) {
  try {
    await fetch(`${API_BASE_URL}/navigation/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        userId,
        routeId,
        location,
        speed,
        timestamp: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('Error logging navigation:', error);
  }
}

// ========== VOLUNTEER COORDINATION API ==========
/**
 * Get nearby volunteers for crowd management
 * 
 * Backend Endpoint:
 * GET /api/volunteers?lat={lat}&lng={lng}&radius={radius}
 * 
 * Expected Response:
 * {
 *   "volunteers": [
 *     {
 *       "id": "vol_123",
 *       "name": "John Doe",
 *       "lat": 19.814,
 *       "lng": 84.794,
 *       "distance": 0.5,             // km
 *       "status": "available",
 *       "phone": "9876543210"
 *     },
 *     ...
 *   ]
 * }
 */
async function fetchNearbyVolunteers(lat, lng, radius = 5000) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/volunteers?lat=${lat}&lng=${lng}&radius=${radius}`,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    );

    return await response.json();
  } catch (error) {
    console.error('Error fetching volunteers:', error);
    return { volunteers: [] };
  }
}

// ========== ANALYTICS API ==========
/**
 * Submit route analysis for machine learning
 * Helps improve future route recommendations
 * 
 * Backend Endpoint:
 * POST /api/analytics/route
 * 
 * Request Body:
 * {
 *   "routeId": "route_123",
 *   "predictedCrowd": 0.75,
 *   "actualCrowd": 0.82,
 *   "predictedDuration": 8,
 *   "actualDuration": 9,
 *   "accuracy": 0.9,
 *   "feedback": "Route was good but took longer due to weather"
 * }
 */
async function submitRouteAnalytics(routeId, metrics) {
  try {
    await fetch(`${API_BASE_URL}/analytics/route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        routeId,
        ...metrics,
        timestamp: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('Error submitting analytics:', error);
  }
}

// ========== EMERGENCY DISPATCH API ==========
/**
 * Send emergency request with optimal routing
 * 
 * Backend Endpoint:
 * POST /api/emergency/dispatch
 * 
 * Request Body:
 * {
 *   "userId": "user_123",
 *   "location": { "lat": 19.8135, "lng": 84.7939 },
 *   "serviceType": "ambulance",     // ambulance, police, fire
 *   "emergency": true,
 *   "description": "Medical emergency"
 * }
 * 
 * Expected Response:
 * {
 *   "requestId": "req_789",
 *   "estimatedArrival": 5,          // minutes
 *   "assignedVehicle": {
 *     "id": "amb_456",
 *     "driverId": "drv_123",
 *     "lat": 19.810,
 *     "lng": 84.785,
 *     "eta": "2024-04-29T10:35:00Z"
 *   },
 *   "optimalRoute": { ... }
 * }
 */
async function sendEmergencyDispatch(userId, location, serviceType, description) {
  try {
    const response = await fetch(`${API_BASE_URL}/emergency/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        userId,
        location,
        serviceType,
        emergency: true,
        description
      })
    });

    return await response.json();
  } catch (error) {
    console.error('Error sending emergency dispatch:', error);
    return null;
  }
}

// ========== HELPER FUNCTIONS ==========

/**
 * Setup real-time WebSocket connection for live updates
 */
function setupWebSocketConnection(userId) {
  const ws = new WebSocket('wss://your-api.com/ws'); // Change to your WebSocket URL

  ws.onopen = () => {
    console.log('WebSocket connected');
    // Subscribe to crowd data updates
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'crowd-data',
      userId: userId
    }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'crowd-update') {
      updateCrowdZones(data.zones);
    } else if (data.type === 'alert') {
      handleCrowdAlert(data);
    } else if (data.type === 'location-update') {
      updateAmbulanceLocation(data);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    // Attempt to reconnect after 5 seconds
    setTimeout(() => setupWebSocketConnection(userId), 5000);
  };

  return ws;
}

/**
 * Update crowd zones from API data
 */
function updateCrowdZones(zones) {
  SIMULATED_CROWD_ZONES = {};
  zones.forEach(zone => {
    SIMULATED_CROWD_ZONES[zone.id] = {
      lat: zone.lat,
      lng: zone.lng,
      density: zone.density,
      radius: zone.radius || 500
    };
  });
  
  // Refresh map visualization
  if (map) {
    displayCrowdZones();
  }
}

/**
 * Handle incoming crowd alerts
 */
function handleCrowdAlert(alert) {
  const message = alert.message;
  const severity = alert.severity;
  
  // Show notification
  showNotification(message, severity === 'critical' ? 'error' : 'warning');
  
  // Voice alert if enabled
  if (voiceEnabled) {
    speak(`Alert: ${message}`);
  }
}

/**
 * Update ambulance location in real-time
 */
function updateAmbulanceLocation(data) {
  if (routeAmbulance && map) {
    routeAmbulance.setLatLng([data.location.lat, data.location.lng]);
  }
}

/**
 * Get stored authentication token
 */
function getAuthToken() {
  return localStorage.getItem('token') || null;
}

/**
 * Set authentication token after login
 */
function setAuthToken(token) {
  localStorage.setItem('token', token);
}

/**
 * Initialize all real-time connections
 */
async function initializeRealTimeSystem(userId) {
  // Setup WebSocket for live updates
  setupWebSocketConnection(userId);
  
  // Fetch initial crowd data
  await fetchCrowdData();
  
  // Fetch nearby volunteers
  const volunteers = await fetchNearbyVolunteers(userLocation.lat, userLocation.lng);
  console.log('Nearby volunteers:', volunteers);
  
  // Start periodic updates (every 10 seconds)
  setInterval(() => {
    fetchCrowdData();
    fetchCrowdAlerts(userLocation.lat, userLocation.lng);
  }, 10000);
}

// Export functions for use in main script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fetchCrowdData,
    geocodeLocation,
    planRoutes,
    fetchCrowdAlerts,
    logNavigationEvent,
    fetchNearbyVolunteers,
    submitRouteAnalytics,
    sendEmergencyDispatch,
    setupWebSocketConnection,
    initializeRealTimeSystem
  };
}
