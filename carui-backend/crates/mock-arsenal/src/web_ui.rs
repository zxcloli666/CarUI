

use axum::{
    extract::Path,
    http::{header, StatusCode},
    response::{Html, IntoResponse, Response},
};
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "static/"]
struct Assets;

pub async fn index() -> Html<&'static str> {
    Html(INDEX_HTML)
}

pub async fn static_file(Path(path): Path<String>) -> Response {
    match Assets::get(&path) {
        Some(content) => {
            let mime = mime_guess::from_path(&path).first_or_octet_stream();
            (
                [(header::CONTENT_TYPE, mime.as_ref())],
                content.data.into_owned(),
            )
                .into_response()
        }
        None => (StatusCode::NOT_FOUND, "Not found").into_response(),
    }
}

const INDEX_HTML: &str = r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mock Arsenal - CarUI</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e;
            color: #eee;
            padding: 20px;
        }
        h1 { color: #00d9ff; margin-bottom: 20px; }
        h2 { color: #888; font-size: 14px; margin-bottom: 10px; text-transform: uppercase; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card {
            background: #252540;
            border-radius: 12px;
            padding: 20px;
            border: 1px solid #333;
        }
        .card h3 { color: #00d9ff; margin-bottom: 15px; }
        button {
            background: #00d9ff;
            color: #1a1a2e;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            margin: 5px;
        }
        button:hover { background: #00b8d9; }
        button.active { background: #ff6b6b; }
        button.secondary { background: #444; color: #fff; }
        button.success { background: #4caf50; }
        input, select {
            background: #333;
            border: 1px solid #444;
            color: #fff;
            padding: 10px;
            border-radius: 6px;
            width: 100%;
            margin-bottom: 10px;
        }
        .door-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .door-btn { width: 100%; }
        .door-btn.open { background: #ff6b6b; }
        .slider-row { display: flex; align-items: center; gap: 10px; margin: 10px 0; }
        .slider-row input[type="range"] { flex: 1; }
        .slider-row span { min-width: 60px; text-align: right; }
        .status { font-size: 12px; color: #888; margin-top: 10px; }
        .status.connected { color: #4caf50; }
        #log {
            background: #111;
            border-radius: 6px;
            padding: 10px;
            font-family: monospace;
            font-size: 12px;
            height: 150px;
            overflow-y: auto;
            margin-top: 10px;
        }
        .gps-display {
            font-family: monospace;
            background: #111;
            padding: 10px;
            border-radius: 6px;
            margin: 10px 0;
        }
        .camera-status {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin: 10px 0;
        }
        .camera-item {
            background: #333;
            padding: 10px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .camera-item .dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #666;
        }
        .camera-item .dot.active { background: #4caf50; }
        .camera-item .name { flex: 1; font-weight: bold; }
    </style>
</head>
<body>
    <h1>Mock Arsenal</h1>
    <p class="status" id="ws-status">Connecting...</p>

    <div class="grid">
        <!-- GPIO Section -->
        <div class="card">
            <h3>GPIO Simulation</h3>

            <h2>Doors</h2>
            <div class="door-grid">
                <button class="door-btn" id="door-fl" onclick="toggleDoor('front_left')">Front Left</button>
                <button class="door-btn" id="door-fr" onclick="toggleDoor('front_right')">Front Right</button>
                <button class="door-btn" id="door-rl" onclick="toggleDoor('rear_left')">Rear Left</button>
                <button class="door-btn" id="door-rr" onclick="toggleDoor('rear_right')">Rear Right</button>
            </div>

            <h2 style="margin-top: 15px;">Reverse</h2>
            <button id="reverse-btn" onclick="toggleReverse()">Reverse: OFF</button>

            <h2 style="margin-top: 15px;">Parking Sensors (cm)</h2>

            <h4 style="color: #666; margin: 10px 0 5px;">Rear</h4>
            <div class="slider-row">
                <span>L:</span>
                <input type="range" id="parking-0" min="0" max="400" value="400" oninput="updateParking()">
                <span id="parking-0-val">400</span>
            </div>
            <div class="slider-row">
                <span>LC:</span>
                <input type="range" id="parking-1" min="0" max="400" value="400" oninput="updateParking()">
                <span id="parking-1-val">400</span>
            </div>
            <div class="slider-row">
                <span>RC:</span>
                <input type="range" id="parking-2" min="0" max="400" value="400" oninput="updateParking()">
                <span id="parking-2-val">400</span>
            </div>
            <div class="slider-row">
                <span>R:</span>
                <input type="range" id="parking-3" min="0" max="400" value="400" oninput="updateParking()">
                <span id="parking-3-val">400</span>
            </div>

            <h4 style="color: #666; margin: 10px 0 5px;">Front</h4>
            <div class="slider-row">
                <span>L:</span>
                <input type="range" id="parking-4" min="0" max="400" value="400" oninput="updateParking()">
                <span id="parking-4-val">400</span>
            </div>
            <div class="slider-row">
                <span>LC:</span>
                <input type="range" id="parking-5" min="0" max="400" value="400" oninput="updateParking()">
                <span id="parking-5-val">400</span>
            </div>
            <div class="slider-row">
                <span>RC:</span>
                <input type="range" id="parking-6" min="0" max="400" value="400" oninput="updateParking()">
                <span id="parking-6-val">400</span>
            </div>
            <div class="slider-row">
                <span>R:</span>
                <input type="range" id="parking-7" min="0" max="400" value="400" oninput="updateParking()">
                <span id="parking-7-val">400</span>
            </div>

            <h4 style="color: #666; margin: 10px 0 5px;">Side</h4>
            <div class="slider-row">
                <span>LF:</span>
                <input type="range" id="parking-8" min="0" max="400" value="400" oninput="updateParking()">
                <span id="parking-8-val">400</span>
            </div>
            <div class="slider-row">
                <span>LR:</span>
                <input type="range" id="parking-9" min="0" max="400" value="400" oninput="updateParking()">
                <span id="parking-9-val">400</span>
            </div>
            <div class="slider-row">
                <span>RF:</span>
                <input type="range" id="parking-10" min="0" max="400" value="400" oninput="updateParking()">
                <span id="parking-10-val">400</span>
            </div>
            <div class="slider-row">
                <span>RR:</span>
                <input type="range" id="parking-11" min="0" max="400" value="400" oninput="updateParking()">
                <span id="parking-11-val">400</span>
            </div>
        </div>

        <!-- GPS Section -->
        <div class="card">
            <h3>GPS Simulation</h3>

            <div class="gps-display" id="gps-display">
                Lat: 55.7558<br>
                Lon: 37.6173<br>
                Bearing: 0°<br>
                Speed: 0 km/h
            </div>

            <h2>Manual Position</h2>
            <input type="number" id="gps-lat" placeholder="Latitude" value="55.7558" step="0.0001">
            <input type="number" id="gps-lon" placeholder="Longitude" value="37.6173" step="0.0001">
            <input type="number" id="gps-bearing" placeholder="Bearing" value="0" step="1">
            <input type="number" id="gps-speed" placeholder="Speed (km/h)" value="0" step="1">
            <button onclick="setPosition()">Set Position</button>

            <h2 style="margin-top: 15px;">GPX Route</h2>
            <input type="file" id="gpx-file" accept=".gpx">
            <button onclick="loadGpx()">Load GPX</button>

            <div style="margin-top: 10px;">
                <button onclick="gpsControl('start')">Play</button>
                <button onclick="gpsControl('pause')">Pause</button>
                <button onclick="gpsControl('reset')">Reset</button>
            </div>

            <h2 style="margin-top: 15px;">Movement Speed</h2>
            <div class="slider-row">
                <input type="number" id="move-speed" value="60" min="1" max="300" step="1" style="width: 80px;">
                <span>km/h</span>
                <button onclick="setMoveSpeed()" style="margin-left: 10px;">Set</button>
            </div>

            <h2 style="margin-top: 15px;">Time Multiplier</h2>
            <div class="slider-row">
                <span>Speed:</span>
                <input type="range" id="speed-mult" min="1" max="100" value="1" oninput="updateSpeedMult()">
                <span id="speed-mult-val">1x</span>
            </div>
        </div>

        <!-- Cameras Section -->
        <div class="card">
            <h3>Camera Simulation</h3>

            <h2>V4L2 Stream Status</h2>
            <div class="camera-status" id="camera-status">
                <!-- Populated by JS -->
            </div>

            <h2 style="margin-top: 15px;">Video Source</h2>
            <input type="text" id="video-path" placeholder="/path/to/video.mp4">
            <div>
                <button onclick="setVideoSource()">Set Video</button>
                <button class="secondary" onclick="setTestPattern()">Test Pattern</button>
            </div>

            <p class="status" style="margin-top: 10px;">
                Cameras stream directly to v4l2loopback devices.<br>
                Use carui-cameras service to view streams.
            </p>
        </div>

        <!-- Log Section -->
        <div class="card">
            <h3>Event Log</h3>
            <div id="log"></div>
            <button class="secondary" onclick="clearLog()">Clear</button>
        </div>
    </div>

    <script>
        let ws;
        let doors = { front_left: false, front_right: false, rear_left: false, rear_right: false };
        let reverse = false;

        function connect() {
            ws = new WebSocket(`ws://${location.host}/ws`);

            ws.onopen = () => {
                document.getElementById('ws-status').textContent = 'Connected';
                document.getElementById('ws-status').className = 'status connected';
                log('WebSocket connected');
                refreshCameraStatus();
            };

            ws.onclose = () => {
                document.getElementById('ws-status').textContent = 'Disconnected - reconnecting...';
                document.getElementById('ws-status').className = 'status';
                setTimeout(connect, 2000);
            };

            ws.onmessage = (e) => {
                const msg = JSON.parse(e.data);
                log(`${msg.topic}/${msg.type}: ${JSON.stringify(msg.data)}`);

                if (msg.topic === 'gpio' && msg.type === 'state') {
                    updateDoorUI(msg.data.doors);
                    updateReverseUI(msg.data.reverse);
                } else if (msg.topic === 'gpio' && msg.type === 'doors') {
                    updateDoorUI(msg.data);
                } else if (msg.topic === 'gpio' && msg.type === 'reverse') {
                    updateReverseUI(msg.data);
                } else if (msg.topic === 'gps' && msg.type === 'position') {
                    updateGpsUI(msg.data);
                }
            };
        }

        function log(msg) {
            const el = document.getElementById('log');
            const time = new Date().toLocaleTimeString();
            el.innerHTML = `<div>[${time}] ${msg}</div>` + el.innerHTML;
        }

        function clearLog() {
            document.getElementById('log').innerHTML = '';
        }

        function toggleDoor(door) {
            doors[door] = !doors[door];
            updateDoorUI(doors);
            fetch('/api/gpio/doors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(doors)
            }).then(r => {
                if (!r.ok) log('ERROR: Failed to set doors');
            }).catch(e => log('ERROR: ' + e));
        }

        function updateDoorUI(state) {
            doors = state;
            document.getElementById('door-fl').className = 'door-btn' + (state.front_left ? ' open' : '');
            document.getElementById('door-fr').className = 'door-btn' + (state.front_right ? ' open' : '');
            document.getElementById('door-rl').className = 'door-btn' + (state.rear_left ? ' open' : '');
            document.getElementById('door-rr').className = 'door-btn' + (state.rear_right ? ' open' : '');
        }

        function toggleReverse() {
            reverse = !reverse;
            updateReverseUI(reverse);
            fetch('/api/gpio/reverse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: reverse })
            }).then(r => {
                if (!r.ok) log('ERROR: Failed to set reverse');
            }).catch(e => log('ERROR: ' + e));
        }

        function updateReverseUI(state) {
            reverse = state;
            const btn = document.getElementById('reverse-btn');
            btn.textContent = 'Reverse: ' + (state ? 'ON' : 'OFF');
            btn.className = state ? 'active' : '';
        }

        function updateParking() {
            const sensors = [];
            for (let i = 0; i < 12; i++) {
                const el = document.getElementById(`parking-${i}`);
                if (el) {
                    const val = el.value;
                    document.getElementById(`parking-${i}-val`).textContent = val;
                    sensors.push(parseInt(val));
                }
            }

            fetch('/api/gpio/parking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sensors })
            });
        }

        function setPosition() {
            fetch('/api/gps/position', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat: parseFloat(document.getElementById('gps-lat').value),
                    lon: parseFloat(document.getElementById('gps-lon').value),
                    bearing: parseFloat(document.getElementById('gps-bearing').value),
                    speed: parseFloat(document.getElementById('gps-speed').value)
                })
            });
        }

        function updateGpsUI(pos) {
            document.getElementById('gps-display').innerHTML = `
                Lat: ${pos.lat.toFixed(6)}<br>
                Lon: ${pos.lon.toFixed(6)}<br>
                Bearing: ${pos.bearing.toFixed(0)}°<br>
                Speed: ${(pos.speed_ms * 3.6).toFixed(0)} km/h
            `;
        }

        function loadGpx() {
            const file = document.getElementById('gpx-file').files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                fetch('/api/gps/gpx', {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/xml' },
                    body: e.target.result
                }).then(r => r.json()).then(data => {
                    log(`Loaded GPX: ${data.points} points`);
                });
            };
            reader.readAsText(file);
        }

        function gpsControl(action) {
            fetch('/api/gps/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
        }

        function updateSpeedMult() {
            const val = document.getElementById('speed-mult').value;
            document.getElementById('speed-mult-val').textContent = val + 'x';
            fetch('/api/gps/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'speed', multiplier: parseFloat(val) })
            });
        }

        function setMoveSpeed() {
            const kmh = parseFloat(document.getElementById('move-speed').value);
            const ms = kmh / 3.6;
            fetch('/api/gps/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'set_speed', speed_ms: ms })
            }).then(() => {
                log(`Movement speed set: ${kmh} km/h (${ms.toFixed(2)} m/s)`);
            });
        }

        function refreshCameraStatus() {
            fetch('/api/cameras/status')
                .then(r => r.json())
                .then(data => {
                    console.log('Camera status:', data);
                    const container = document.getElementById('camera-status');
                    if (!data.cameras || data.cameras.length === 0) {
                        container.innerHTML = '<div style="color: #888; padding: 10px;">No cameras configured</div>';
                        return;
                    }
                    container.innerHTML = data.cameras.map(cam => {
                        let sourceText = 'off';
                        if (cam.source) {
                            if (typeof cam.source === 'string') {
                                sourceText = cam.source === 'test_pattern' ? 'test' : cam.source;
                            } else if (cam.source.video_file) {
                                sourceText = 'video';
                            }
                        }
                        return `
                            <div class="camera-item">
                                <div class="dot ${cam.streaming ? 'active' : ''}"></div>
                                <span class="name">${cam.id}</span>
                                <span style="color: #888; font-size: 12px;">${sourceText}</span>
                            </div>
                        `;
                    }).join('');
                })
                .catch(e => {
                    log('ERROR loading cameras: ' + e);
                    console.error('Camera status error:', e);
                });
        }

        function setVideoSource() {
            const path = document.getElementById('video-path').value;
            if (!path) {
                log('ERROR: Enter video path');
                return;
            }
            fetch('/api/cameras/source', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            }).then(r => r.json()).then(data => {
                if (data.ok) {
                    log('Video source set: ' + path);
                    setTimeout(refreshCameraStatus, 500);
                } else {
                    log('ERROR: ' + (data.error || 'Failed to set source'));
                }
            }).catch(e => log('ERROR: ' + e));
        }

        function setTestPattern() {
            fetch('/api/cameras/source', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: null })
            }).then(r => r.json()).then(data => {
                if (data.ok) {
                    log('Switched to test pattern');
                    setTimeout(refreshCameraStatus, 500);
                } else {
                    log('ERROR: ' + (data.error || 'Failed to set source'));
                }
            }).catch(e => log('ERROR: ' + e));
        }

        setInterval(refreshCameraStatus, 5000);

        connect();
    </script>
</body>
</html>"#;