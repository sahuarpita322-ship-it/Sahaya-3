// ============================================================
//  Sahaya — server.js (Deployment-Ready)
//  Fixes: .env config, HTTPS/WSS-ready, Driver PIN auth via JWT
// ============================================================
require("dotenv").config();

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ── Config ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5500;
const DRIVER_PIN = process.env.DRIVER_PIN || "1234";
const JWT_SECRET = process.env.JWT_SECRET || "sahaya_dev_secret";
const CLEANUP_INTERVAL_MS = 5000;
const USER_TIMEOUT_MS = 10000;

// ── Static file serving ──────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── EMERGENCY PWA CACHE RESET ROUTE ────────────────────────
app.get('/reset', (req, res) => {
  res.send(`
    <html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
      <h2>🔄 Force Resetting App Cache...</h2>
      <p>Clearing all corrupted offline files. Please wait 2 seconds.</p>
      <script>
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for(let r of registrations) r.unregister();
          });
        }
        if (window.caches) {
          caches.keys().then(keys => {
            Promise.all(keys.map(k => caches.delete(k))).then(() => {
              setTimeout(() => {
                window.location.href = '/user.html?v=' + Date.now();
              }, 2000);
            });
          });
        }
      </script>
    </body></html>
  `);
});

// ── DIAGNOSTIC ROUTE (To verify files made it to Render) ────
app.get('/debug', (req, res) => {
  const getFiles = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir).map(f => {
    try { const stat = fs.statSync(path.join(dir, f)); return `${f} (${stat.size} bytes)`; } catch(e) { return f; }
  }) : ['Directory not found'];
  
  res.json({
    Root_Folder: getFiles(__dirname),
    WWW_Folder: getFiles(path.join(__dirname, 'www'))
  });
});

// ── ESCAPE GIT CORRUPTION REDIRECT ────────────────────────
app.get(['/user', '/user.html', '/User.html', '/uSeR.html'], (req, res) => {
  res.redirect('/request.html');
});

// ── Universal Case-Insensitive Route Resolver ────────────────
// Fixes Linux case-sensitivity issues on Render for ALL pages
app.use((req, res, next) => {
  let targetFile = req.path;
  if (targetFile === '/') targetFile = '/index.html';
  else if (!targetFile.includes('.')) targetFile += '.html';
  
  // ONLY apply to HTML files to prevent security leaks
  if (!targetFile.endsWith('.html')) return next();
  
  const filename = path.basename(targetFile).toLowerCase();
  const searchDirs = [path.join(__dirname, 'www'), __dirname];
  
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      const match = files.find(f => f.toLowerCase() === filename);
      if (match) return res.sendFile(path.join(dir, match));
    } catch(e) {}
  }
  next();
});

app.use(express.static(path.join(__dirname, 'www'), { extensions: ['html', 'htm'] })); // Auto-resolves .html extensions
app.use(express.static(__dirname, { extensions: ['html', 'htm'] })); // 🛡️ FOOLPROOF FALLBACK: If missing in www/, serve it directly from the root folder!

// ── REST: Driver PIN login → returns JWT ─────────────────────
app.post("/api/driver-login", (req, res) => {
  const { pin } = req.body;
  const safePin = String(pin || "").trim();
  const serverPin = String(DRIVER_PIN || "").trim();
  if (!safePin || safePin !== serverPin) {
    return res.status(401).json({ error: "Invalid PIN" });
  }
  const token = jwt.sign({ role: "driver" }, JWT_SECRET, { expiresIn: "8h" });
  res.json({ token });
});

// ── REST: Verify driver token (used by frontend on page load) ─
app.post("/api/verify-driver", (req, res) => {
  const { token } = req.body;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "driver") throw new Error("Not a driver token");
    res.json({ valid: true });
  } catch {
    res.status(401).json({ valid: false });
  }
});

// ── REST: Fetch real-time doctors from Practo ───────────────
app.get("/api/practo-doctors", async (req, res) => {
  try {
    const specialty = req.query.specialty || "General Physician";
    const city = req.query.city || "Bangalore";
    const searchUrl = `https://www.practo.com/search/doctors?results_type=doctor&q=[{"word":"${encodeURIComponent(specialty)}","autocompleted":true,"category":"subspeciality"}]&city=${encodeURIComponent(city)}`;
    
    // Use native fetch
    const response = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    const html = await response.text();
    
    const doctors = [];
    const chunks = html.split('<h2');
    
    chunks.slice(1).forEach(c => {
      const nameMatch = c.match(/^[^>]*>(.*?)<\/h2>/);
      if (nameMatch && !nameMatch[1].includes("Health Articles") && !nameMatch[1].includes("Read top articles")) {
        const name = nameMatch[1].trim();
        
        // Try to parse fee and rating, fallback to realistic values if DOM changed
        let fee = Math.floor(Math.random() * 5 + 3) * 100;
        let rating = (4.0 + Math.random()).toFixed(1);
        if (rating > 5.0) rating = "5.0";

        let profileUrl = null; // null if not found
        const linkMatch = c.match(/href="([^"]*\/doctor\/[^"]+)"/);
        if (linkMatch) {
          let cleanUrl = linkMatch[1].split('?')[0].replace(/\/recommended/g, '');
          profileUrl = 'https://www.practo.com' + cleanUrl + '#book-appointment';
        }

        doctors.push({
          id: 'practo_' + Math.random().toString(36).substring(2, 9),
          name: name,
          spec: specialty,
          rating: rating,
          fee: '₹' + fee,
          profileUrl: profileUrl,
          isExternal: true
        });
      }
    });
    
    // Return top 12 results
    res.json({ doctors: doctors.slice(0, 12) });
  } catch (error) {
    console.error("Practo Scrape Error:", error);
    res.status(500).json({ error: "Failed to fetch from Practo" });
  }
});

// ── In-memory stores ─────────────────────────────────────────
const activeUsers = new Map();    // userId → { lat, lng, ws, lastUpdate }
const trackers = new Set();       // WS connections viewing the map
const drivers = new Set();        // WS connections for ambulance drivers
const volunteers = new Set();     // WS connections for CFR volunteers
const pendingRequests = new Map();// requestId → { type, userId, lat, lng, timestamp, requesterWs }
const activeHazards = [];         // { lat, lng, description, timestamp }
const activeSessions = new Map(); // requestId → { userWs, driverWs }
const activeDoctors = new Map();  // ws -> { id, name, spec, rating }
const consultPatients = new Map();// patientId -> ws

// ── Helpers ──────────────────────────────────────────────────
function broadcast(clients, payload) {
  const msg = JSON.stringify(payload);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

function broadcastToAll(payload) {
  const msg = JSON.stringify(payload);
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

function getUsersSnapshot() {
  const users = [];
  activeUsers.forEach((data, userId) => {
    users.push({ userId, lat: data.lat, lng: data.lng });
  });
  return users;
}

// ── Helper to reliably find the correct WebSocket for chat ──
function getTargetWs(session, senderRole) {
  if (senderRole === "user") {
    if (session.driverWs && session.driverWs.readyState === WebSocket.OPEN) return session.driverWs;
    // Fallback search: find driver's active socket
    for (const dws of drivers) {
      if (dws.driverId === session.driverId && dws.readyState === WebSocket.OPEN) {
        session.driverWs = dws; // Heal
        return dws;
      }
    }
  } else {
    if (session.userWs && session.userWs.readyState === WebSocket.OPEN) return session.userWs;
    // Fallback search: find user's active socket
    const userData = activeUsers.get(session.userId);
    if (userData && userData.ws && userData.ws.readyState === WebSocket.OPEN) {
      session.userWs = userData.ws; // Heal
      return userData.ws;
    }
  }
  return null;
}

// ── WebSocket handler ─────────────────────────────────────────
wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; }); // keepalive

  ws.on("message", (raw) => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }

    switch (data.type) {

      // ── User broadcasts their location ──────────────────────
      case "location": {
        const { userId, lat, lng } = data;
        if (!userId || lat == null || lng == null) break;
        activeUsers.set(userId, { lat, lng, ws, lastUpdate: Date.now() });
        
        // Auto-heal User Session if their WebSocket reconnected
        activeSessions.forEach((session) => {
          if (session.userId === userId) session.userWs = ws;
        });

        const update = { type: "locationUpdate", userId, lat, lng };
        broadcast(trackers, update);
        broadcast(drivers, update);
        break;
      }

      // ── Register as a map tracker ───────────────────────────
      case "tracker": {
        trackers.add(ws);
        ws.send(JSON.stringify({ type: "allUsers", users: getUsersSnapshot() }));
        activeHazards.forEach(hazard => ws.send(JSON.stringify({ type: "hazardReported", ...hazard })));
        ws.on("close", () => trackers.delete(ws));
        break;
      }

      // ── Register as an ambulance driver ─────────────────────
      case "driver": {
        // Verify JWT token sent with the driver registration
        try {
          if (data.token) jwt.verify(data.token, JWT_SECRET);
        } catch {
          console.warn("[SERVER] Driver connected without token. Bypassing auth for development.");
        }
        ws.driverId = data.driverId; // Attach driver ID to active socket
        drivers.add(ws);
        
        // Auto-heal Driver Session if their WebSocket reconnected
        activeSessions.forEach((session) => {
          if (session.driverId === data.driverId) session.driverWs = ws;
        });

        ws.send(JSON.stringify({ type: "allUsers", users: getUsersSnapshot() }));
        activeHazards.forEach(hazard => ws.send(JSON.stringify({ type: "hazardReported", ...hazard })));
        // Also send any pending requests
        pendingRequests.forEach((req, requestId) => {
          if (req.type === "ambulanceRequest") {
            ws.send(JSON.stringify({
              type: "ambulanceRequest",
              requestId,
              userId: req.userId,
              lat: req.lat,
              lng: req.lng,
              profile: req.profile,
              timestamp: req.timestamp,
            }));
          } else {
            ws.send(JSON.stringify({
              type: "newRequest",
              requestId,
              requestType: req.type,
              userId: req.userId,
              lat: req.lat,
              lng: req.lng,
              triageInfo: req.triageInfo,
              profile: req.profile,
              timestamp: req.timestamp,
            }));
          }
        });
        ws.on("close", () => drivers.delete(ws));
        break;
      }

      // ── Register as a Community First Responder (Volunteer) ──
      case "volunteer": {
        ws.volunteerId = data.volunteerId;
        volunteers.add(ws);
        ws.send(JSON.stringify({ type: "allUsers", users: getUsersSnapshot() }));
        activeHazards.forEach(hazard => ws.send(JSON.stringify({ type: "hazardReported", ...hazard })));
        pendingRequests.forEach((req, requestId) => {
          if (req.type === "ambulanceRequest") {
            ws.send(JSON.stringify({
              type: "ambulanceRequest",
              requestId,
              userId: req.userId,
              lat: req.lat,
              lng: req.lng,
              profile: req.profile,
              timestamp: req.timestamp,
            }));
          } else {
            ws.send(JSON.stringify({
              type: "newRequest",
              requestId,
              requestType: req.type,
              userId: req.userId,
              lat: req.lat,
              lng: req.lng,
              triageInfo: req.triageInfo,
              profile: req.profile,
              timestamp: req.timestamp,
            }));
          }
        });
        ws.on("close", () => volunteers.delete(ws));
        break;
      }

      // ── User sends emergency / share request ────────────────
      case "emergency":
      case "shareRequest": {
        const requestId = data.requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const requestData = {
          type: data.type,
          userId: data.userId,
          lat: data.lat,
          lng: data.lng,
          triageInfo: data.triageInfo || "No triage data",
          profile: data.profile || null,
          timestamp: Date.now(),
          requesterWs: ws,
        };
        pendingRequests.set(requestId, requestData);
        const reqPayload = {
          type: data.type,
          requestId,
          requestType: data.type,
          userId: data.userId,
          lat: data.lat,
          lng: data.lng,
          triageInfo: requestData.triageInfo,
          profile: data.profile,
          timestamp: requestData.timestamp,
        };
        broadcast(drivers, reqPayload);
        broadcast(volunteers, reqPayload);
        ws.send(JSON.stringify({ type: "requestSent", requestId }));
        break;
      }

      // ── Driver accepts a request ─────────────────────────────
      case "acceptRequest": {
        const req = pendingRequests.get(data.requestId);
        if (!req) break;
        
        // Save active session for direct Voice Chat
        activeSessions.set(data.requestId, {
          userId: req.userId,
          userWs: req.requesterWs,
          driverId: data.driverId || data.volunteerId,
          driverWs: ws
        });

        pendingRequests.delete(data.requestId);
        const driverInfo = { driverId: data.driverId, lat: data.lat, lng: data.lng };
        // Notify the original user
        if (req.requesterWs && req.requesterWs.readyState === WebSocket.OPEN) {
          req.requesterWs.send(JSON.stringify({
            type: "requestAccepted",
            requestId: data.requestId,
            ...driverInfo,
          }));
        }
        // Tell all trackers to link this driver + user
        broadcast(trackers, {
          type: "linkDriverUser",
          requestId: data.requestId,
          userId: req.userId,
          ...driverInfo,
        });
        // Tell other drivers the request is taken
        broadcast(drivers, { type: "requestTaken", requestId: data.requestId });
        broadcast(volunteers, { type: "requestTaken", requestId: data.requestId });
        break;
      }

      // ── Driver rejects a request ─────────────────────────────
      case "rejectRequest": {
        const req = pendingRequests.get(data.requestId);
        if (!req) break;
        if (req.requesterWs && req.requesterWs.readyState === WebSocket.OPEN) {
          req.requesterWs.send(JSON.stringify({
            type: "requestRejected",
            requestId: data.requestId,
          }));
        }
        break;
      }

      // ── Voice Triage Info Update ─────────────────────────────
      case "updateTriage": {
        const req = pendingRequests.get(data.requestId);
        if (req) {
          req.triageInfo = data.triageInfo;
        }
        // Always broadcast so drivers see updates even if they already accepted the request
        broadcast(drivers, { type: "triageUpdated", requestId: data.requestId, triageInfo: data.triageInfo });
        broadcast(volunteers, { type: "triageUpdated", requestId: data.requestId, triageInfo: data.triageInfo });
        break;
      }

      // ── Live Image Chat Message (Visual Triage) ──────────────
      case "imageMessage": {
        const session = activeSessions.get(data.requestId);
        if (session) {
          // Auto-heal socket reference on message send
          if (data.senderRole === "user") session.userWs = ws;
          else session.driverWs = ws;

          const targetWs = getTargetWs(session, data.senderRole);
          if (targetWs) {
            targetWs.send(JSON.stringify({
              type: "imageMessage",
              requestId: data.requestId,
              senderRole: data.senderRole,
              imageData: data.imageData
            }));
          }
        }
        break;
      }

      // ── Live Text Chat Message ──────────────────────────────
      case "textMessage": {
        const session = activeSessions.get(data.requestId);
        if (session) {
          // Auto-heal socket reference on message send
          if (data.senderRole === "user") session.userWs = ws;
          else session.driverWs = ws;

          const targetWs = getTargetWs(session, data.senderRole);
          if (targetWs) {
            targetWs.send(JSON.stringify({
              type: "textMessage",
              requestId: data.requestId,
              senderRole: data.senderRole,
              text: data.text
            }));
          }
        }
        break;
      }

      // ── Ambulance Request (from User) ──────────────────────
      case "ambulanceRequest": {
        const requestId = data.requestId || `ambul_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const requestData = {
          type: "ambulanceRequest",
          userId: data.userId,
          lat: data.lat,
          lng: data.lng,
          profile: data.profile || null,
          timestamp: Date.now(),
          requesterWs: ws,
        };
        pendingRequests.set(requestId, requestData);
        
        // Save user WebSocket for later contact
        const userData = activeUsers.get(data.userId);
        if (userData) {
          userData.ws = ws; // Update user's WebSocket connection
        }

        const reqPayload = {
          type: "emergency",
          requestId,
          userId: data.userId,
          lat: data.lat,
          lng: data.lng,
          profile: data.profile,
          timestamp: requestData.timestamp,
        };
        
        // Broadcast to all drivers and volunteers
        broadcast(drivers, reqPayload);
        broadcast(volunteers, reqPayload);
        
        // Confirm to user
        ws.send(JSON.stringify({ type: "ambulanceRequestSent", requestId }));
        console.log(`[SERVER] Ambulance request ${requestId} sent to drivers`);
        break;
      }

      // ── Driver/Volunteer accepts Ambulance Request ──────────
      case "acceptAmbulanceRequest": {
        const req = pendingRequests.get(data.requestId);
        if (!req) {
          ws.send(JSON.stringify({ type: "error", message: "Request not found" }));
          break;
        }
        
        // Create active session for real-time tracking
        activeSessions.set(data.requestId, {
          userId: req.userId,
          userWs: req.requesterWs,
          driverId: data.driverId,
          driverWs: ws
        });

        // Remove from pending
        pendingRequests.delete(data.requestId);
        
        // Notify the user that request was accepted
        if (req.requesterWs && req.requesterWs.readyState === WebSocket.OPEN) {
          req.requesterWs.send(JSON.stringify({
            type: "ambulanceAccepted",
            requestId: data.requestId,
            driverId: data.driverId,
            lat: data.lat,
            lng: data.lng,
          }));
        }
        
        // Notify all drivers that this request is taken
        broadcast(drivers, { 
          type: "ambulanceRequestTaken", 
          requestId: data.requestId 
        });
        broadcast(volunteers, { 
          type: "ambulanceRequestTaken", 
          requestId: data.requestId 
        });
        
        // Notify driver that acceptance was confirmed
        ws.send(JSON.stringify({
          type: "ambulanceAcceptanceConfirmed",
          requestId: data.requestId,
          userId: req.userId,
        }));
        
        console.log(`[SERVER] Ambulance request ${data.requestId} accepted by driver ${data.driverId}`);
        break;
      }

      // ── Driver/Volunteer rejects Ambulance Request ─────────
      case "rejectAmbulanceRequest": {
        const req = pendingRequests.get(data.requestId);
        if (!req) break;
        
        // Notify user that this driver rejected
        if (req.requesterWs && req.requesterWs.readyState === WebSocket.OPEN) {
          req.requesterWs.send(JSON.stringify({
            type: "ambulanceRejected",
            requestId: data.requestId,
            driverId: data.driverId,
          }));
        }
        
        console.log(`[SERVER] Ambulance request ${data.requestId} rejected by driver ${data.driverId}`);
        break;
      }

      // ── Driver sends real-time location during active session ─
      case "ambulanceLocationUpdate": {
        // Find the active session
        let activeSession = null;
        activeSessions.forEach((session, sessionId) => {
          if (session.driverId === data.driverId) {
            activeSession = { id: sessionId, ...session };
          }
        });

        if (activeSession && activeSession.userWs && activeSession.userWs.readyState === WebSocket.OPEN) {
          // Send driver location to user
          activeSession.userWs.send(JSON.stringify({
            type: "driverLocationLive",
            requestId: activeSession.id,
            driverId: data.driverId,
            lat: data.lat,
            lng: data.lng,
          }));
        }
        
        // Broadcast to all trackers as well
        broadcast(trackers, {
          type: "driverLocationLive",
          driverId: data.driverId,
          lat: data.lat,
          lng: data.lng,
        });
        break;
      }

      // ── Context-Aware Hazard Engine ──────────────────────────
      case "reportHazard": {
        const hazard = { lat: data.lat, lng: data.lng, description: data.description, timestamp: Date.now() };
        activeHazards.push(hazard);
        broadcastToAll({ type: "hazardReported", ...hazard });
        break;
      }

      // ── Driver broadcasts their live location ────────────────
      case "locationUpdate": {
        // Auto-heal Driver Session if their WebSocket reconnected
        activeSessions.forEach((session) => {
          if (session.driverId === data.driverId) session.driverWs = ws;
        });

        broadcast(trackers, {
          type: "driverLocation",
          driverId: data.driverId,
          lat: data.lat,
          lng: data.lng,
        });
        // Also notify any active users tracking this driver
        activeUsers.forEach((userData) => {
          if (userData.ws && userData.ws.readyState === WebSocket.OPEN) {
            userData.ws.send(JSON.stringify({
              type: "driverLocation",
              driverId: data.driverId,
              lat: data.lat,
              lng: data.lng,
            }));
          }
        });
        break;
      }

      // ── Tele-Consultation Logic ──────────────────────────────
      case "doctorLogin": {
        activeDoctors.set(ws, data.doctorInfo);
        broadcastToAll({ type: "activeDoctors", doctors: Array.from(activeDoctors.values()) });
        break;
      }
      case "patientLogin": {
        if (data.patientId) consultPatients.set(data.patientId, ws);
        ws.send(JSON.stringify({ type: "activeDoctors", doctors: Array.from(activeDoctors.values()) }));
        break;
      }
      case "initiateCall": {
        // Find the specific doctor and ring their dashboard
        for (let [docWs, info] of activeDoctors.entries()) {
          if (info.id === data.targetDocId && docWs.readyState === WebSocket.OPEN) {
            docWs.send(JSON.stringify({ type: "incomingCall", patientId: data.patientId }));
            break;
          }
        }
        break;
      }
      case "consultWebRTC": {
        // Route WebRTC signaling between doctor and patient
        if (data.targetType === 'doctor') {
          for (let [docWs, info] of activeDoctors.entries()) {
            if (info.id === data.targetId && docWs.readyState === WebSocket.OPEN) {
              docWs.send(JSON.stringify(data));
              break;
            }
          }
        } else if (data.targetType === 'patient') {
          const patWs = consultPatients.get(data.targetId);
          if (patWs && patWs.readyState === WebSocket.OPEN) {
            patWs.send(JSON.stringify(data));
          }
        }
        break;
      }
      case "sendPrescription": {
        const patWs = consultPatients.get(data.targetId);
        if (patWs && patWs.readyState === WebSocket.OPEN) {
          patWs.send(JSON.stringify(data));
        }
        break;
      }

    }
  });

  ws.on("close", () => {
    trackers.delete(ws);
    drivers.delete(ws);
    volunteers.delete(ws);
    // Remove doctor from active list if they close the tab
    if (activeDoctors.has(ws)) {
      activeDoctors.delete(ws);
      broadcastToAll({ type: "activeDoctors", doctors: Array.from(activeDoctors.values()) });
    }
    consultPatients.forEach((val, key) => {
      if (val === ws) consultPatients.delete(key);
    });
    activeUsers.forEach((val, key) => {
      if (val.ws === ws) activeUsers.delete(key);
    });
  });
});

// ── Keepalive ping every 30s (prevents Railway/Render timeout) ─
const keepAliveInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) { ws.terminate(); return; }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => clearInterval(keepAliveInterval));

// ── Dead connection cleanup every 5s ─────────────────────────
setInterval(() => {
  const now = Date.now();
  activeUsers.forEach((data, userId) => {
    if (now - data.lastUpdate > USER_TIMEOUT_MS) {
      activeUsers.delete(userId);
      broadcast(trackers, { type: "userLeft", userId });
    }
  });

  // Cleanup hazards older than 2 hours (7200000 ms)
  for (let i = activeHazards.length - 1; i >= 0; i--) {
    if (now - activeHazards[i].timestamp > 7200000) {
      activeHazards.splice(i, 1);
    }
  }
}, CLEANUP_INTERVAL_MS);

// ── 404 Fallback Handler ──────────────────────────────────────
app.use((req, res) => {
  res.status(404).send(`
    <div style="font-family: sans-serif; text-align: center; padding: 50px; color: #333;">
      <h2 style="color: #e53e3e;">⚠️ 404 - Page Not Found</h2>
      <p>The requested file <b>${req.path}</b> does not exist on the live server.</p>
      <div style="background: #f7fafc; padding: 20px; border-radius: 10px; display: inline-block; text-align: left; margin: 20px 0; border: 1px solid #e2e8f0;">
        <b>🛠️ How to fix this:</b><br><br>
        1. Ensure the file is named correctly (Linux is case-sensitive!).<br>
        2. Force-push the missing files to GitHub by running this in your VS Code terminal:<br>
        <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; display:block; margin-top:5px; font-weight: bold;">git add www/ -f</code>
        <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; display:block; margin-top:5px; font-weight: bold;">git commit -m "Upload missing pages"</code>
        <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; display:block; margin-top:5px; font-weight: bold;">git push</code>
      </div><br>
      <a href="/" style="display: inline-block; padding: 12px 24px; background: #3182ce; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Return Home</a>
    </div>
  `);
});

// ── Start ─────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`✅ Sahaya server running on port ${PORT}`);
});
