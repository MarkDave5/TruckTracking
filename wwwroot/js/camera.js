let selectedCameraTruckId = null;
function renderCameraFleet() {
  const trucks = state.trucks || [];
  const grid = $('#truck-camera-grid');
  if (!grid) return;
  $('#camera-fleet-count').textContent = `${trucks.length} ${trucks.length === 1 ? 'truck' : 'trucks'}`;
  if (selectedCameraTruckId && !trucks.some(truck => truck.id === selectedCameraTruckId)) selectedCameraTruckId = null;
  const selector = $('#camera-truck-selector');
  const ids = trucks.map(truck => truck.id);
  const existing = Array.from(selector.options).slice(1).map(option => option.value);
  if (ids.length !== existing.length || ids.some((id, index) => id !== existing[index])) {
    selector.options.length = 1;
    trucks.forEach(truck => selector.add(new Option(`${truck.plate} · ${truck.model}`, truck.id)));
  }
  selector.value = selectedCameraTruckId || '';
  const visibleTrucks = trucks;
  $('#camera-truck-filter-summary').textContent = trucks.length ? `Showing all ${trucks.length} ${trucks.length === 1 ? 'truck' : 'trucks'}` : 'No trucks registered yet';
  grid.innerHTML = trucks.length ? visibleTrucks.map(truck => `<button type="button" class="truck-camera-card${truck.id === selectedCameraTruckId ? ' is-selected' : ''}" data-camera-truck="${escapeHtml(truck.id)}" aria-pressed="${truck.id === selectedCameraTruckId}"><span class="truck-camera-card-head"><span><strong>${escapeHtml(truck.id)}</strong><small>${escapeHtml(truck.plate)}${truck.isSample ? ' · Sample' : ''}</small></span><span class="truck-camera-status">Not connected</span></span><span class="truck-camera-frame"><span class="truck-camera-symbol">▣</span><strong>Camera unavailable</strong><small>No truck stream connected</small></span><span class="truck-camera-card-foot">${escapeHtml(truck.model)} <span>View status →</span></span></button>`).join('') : '<div class="camera-fleet-empty">No trucks are registered. <a href="#vehicles">Add a truck</a> to see it here.</div>';
  const detail = $('#selected-truck-camera');
  const selected = trucks.find(truck => truck.id === selectedCameraTruckId);
  detail.hidden = !selected;
  if (selected) {
    $('#selected-camera-title').textContent = `${selected.id} · ${selected.plate}`;
    $('#selected-camera-description').textContent = `${selected.model}${selected.isSample ? ' (sample truck)' : ''} — no remote camera stream is connected. Add and connect a compatible truck camera before live viewing is available.`;
  }
}
function selectCameraTruck(id) {
  if (!(state.trucks || []).some(truck => truck.id === id)) return;
  if (typeof stopAutoCapture === 'function' && selectedCameraTruckId !== id) stopAutoCapture();
  selectedCameraTruckId = id; renderCameraFleet();
}
function clearCameraSelection() { if (typeof stopAutoCapture === 'function' && selectedCameraTruckId) stopAutoCapture(); selectedCameraTruckId = null; renderCameraFleet(); }

let cameraStream = null;
let cameraRequest = 0;
let detectionTimer = null;
let detectionAbort = null;
let boxExpiryTimer = null;
let localTestRecorder = null;
let localTestClip = null;
let localTestTimer = null;

function startLocalTestRecording() {
  const message = $('#local-record-message');
  if (!cameraStream || typeof MediaRecorder === 'undefined') { message.textContent = 'Start the camera in a browser that supports recording.'; return; }
  if (typeof autoCaptureActive !== 'undefined' && autoCaptureActive) { message.textContent = 'Stop auto capture before recording a manual test clip.'; return; }
  if (localTestRecorder && localTestRecorder.state !== 'inactive') return;
  try {
    const mime = ['video/webm;codecs=vp8','video/webm','video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mime) { message.textContent = 'This browser cannot record MP4 or WebM. You can upload a clip instead.'; return; }
    const recorder = new MediaRecorder(cameraStream, {mimeType:mime});
    const chunks = []; localTestRecorder = recorder; localTestClip = null;
    $('#road-review-use-local').checked = false; $('#road-review-local-status').textContent = 'Recording a local test clip…';
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = () => { message.textContent = 'Could not record the test clip. Try again.'; };
    recorder.onstop = () => {
      clearTimeout(localTestTimer); localTestTimer = null; localTestRecorder = null;
      const type = recorder.mimeType.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';
      const clip = new Blob(chunks, {type});
      localTestClip = clip.size ? clip : null;
      $('#record-local-test').disabled = !cameraStream; $('#stop-local-test').disabled = true;
      message.textContent = localTestClip ? 'Test clip ready. Go to Driver event review and choose it when adding an event.' : 'No clip was recorded. Please try again.';
      $('#road-review-local-status').textContent = localTestClip ? 'Local test clip ready in this browser session.' : 'No local test clip recorded in this session.';
    };
    recorder.start(1000); $('#record-local-test').disabled = true; $('#stop-local-test').disabled = false;
    message.textContent = 'Recording local test… stops automatically after 20 seconds.';
    localTestTimer = setTimeout(stopLocalTestRecording, 20000);
  } catch { localTestRecorder = null; message.textContent = 'Could not start recording. You can upload a clip instead.'; }
}
function stopLocalTestRecording() {
  clearTimeout(localTestTimer); localTestTimer = null;
  if (localTestRecorder && localTestRecorder.state !== 'inactive') localTestRecorder.stop();
}

function detectionStatus(text) {
  $('#detection-status').textContent = text;
  $('#model-status').textContent = text;
}
async function refreshCameraDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  try {
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput');
    const selector = $('#camera-device');
    const activeId = cameraStream?.getVideoTracks()[0]?.getSettings().deviceId;
    const previous = activeId || selector.value;
    selector.options.length = 1;
    devices.forEach((device, i) => { if (device.deviceId) selector.add(new Option(device.label || `Camera ${i + 1}`, device.deviceId)); });
    selector.value = devices.some(device => device.deviceId && device.deviceId === previous) ? previous : '';
  } catch { /* Camera preview can still run if listing devices is unavailable. */ }
}
function changeCameraDevice() {
  if (cameraStream) { stopCamera(); startCamera(); }
}
async function startCamera() {
  const message = $('#camera-message');
  if (!navigator.mediaDevices?.getUserMedia) { message.textContent = 'Camera access is not available. Use localhost or HTTPS and a supported browser.'; return; }
  $('#start-camera').disabled = true;
  const request = ++cameraRequest;
  try {
    const selectedDevice = $('#camera-device').value;
    const videoSettings = selectedDevice ? {deviceId:{exact:selectedDevice}} : {facingMode:{ideal:'environment'}};
    const stream = await navigator.mediaDevices.getUserMedia({ video: videoSettings, audio: false });
    if (request !== cameraRequest || location.hash !== '#camera') { stream.getTracks().forEach(track => track.stop()); return; }
    cameraStream = stream;
    const video = $('#camera-video'); const detectionVideo = $('#detection-video');
    video.srcObject = stream; detectionVideo.srcObject = stream; await Promise.all([video.play(), detectionVideo.play()]);
    if (request !== cameraRequest) return;
    $('#camera-placeholder').hidden = true; $('#camera-overlay').hidden = false;
    $('#detection-placeholder').hidden = true; $('#detection-overlay').hidden = false; $('#detection-label').textContent = 'STARTING MODEL';
    $('#camera-status').textContent = '●  PREVIEW ON'; $('#camera-status').classList.add('is-on');
    $('#camera-source').textContent = 'This device’s camera'; $('#stop-camera').disabled = false;
    $('#record-local-test').disabled = false; $('#local-record-message').textContent = 'Ready to record a local test clip.';
    $('#auto-capture-start').disabled = false; $('#auto-capture-message').textContent = 'Select a truck and enter a test driver to enable auto capture.';
    $('#detection-placeholder').querySelector('strong').textContent = 'Starting detection';
    $('#detection-placeholder').querySelector('p').textContent = 'Loading the trained model; the first frame may take longer.';
    detectionStatus('Starting model');
    message.textContent = 'Camera preview is active. Select another camera in the Camera menu to switch.';
    refreshCameraDevices();
    stream.getVideoTracks()[0]?.addEventListener('ended', stopCamera, { once: true });
    const tokenResponse = await fetch('/api/auth/token', {cache:'no-store'});
    if (!tokenResponse.ok) throw new Error('Could not start detection session');
    const {token} = await tokenResponse.json();
    if (request === cameraRequest) analyzeFrame(request, token);
  } catch (error) {
    if (request !== cameraRequest) return;
    stopCamera();
    message.textContent = error.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser settings and try again.' : error.name === 'NotFoundError' || error.name === 'OverconstrainedError' ? 'The selected camera was not found. Reconnect it or choose another camera.' : error.name === 'NotReadableError' ? 'The camera is unavailable or in use by another app. Close the other app and try again.' : 'Unable to start camera or detection. Check the camera and sign-in, then try again.';
  }
}
async function analyzeFrame(request, token) {
  if (request !== cameraRequest || !cameraStream) return;
  const message = $('#camera-message');
  const video = $('#camera-video');
  if (!video.videoWidth || !video.videoHeight) { detectionTimer = setTimeout(() => analyzeFrame(request, token), 500); return; }
  const frame = document.createElement('canvas');
  const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
  frame.width = Math.max(1, Math.round(video.videoWidth * scale)); frame.height = Math.max(1, Math.round(video.videoHeight * scale));
  frame.getContext('2d').drawImage(video, 0, 0, frame.width, frame.height);
  const capturedAt = Date.now();
  detectionAbort = new AbortController();
  try {
    const response = await fetch('/api/detection/frame', {method:'POST', headers:{'Content-Type':'application/json','X-CSRF-TOKEN':token}, body:JSON.stringify({image:frame.toDataURL('image/jpeg', 0.8).split(',')[1]}), signal:detectionAbort.signal});
    if (response.status === 401) { location.replace('/login.html'); return; }
    if (response.status === 429) { if (request === cameraRequest) detectionTimer = setTimeout(() => analyzeFrame(request, token), 1500); return; }
    if (!response.ok) { const error = new Error('Detection request failed'); error.status = response.status; throw error; }
    const result = await response.json();
    if (request !== cameraRequest) return;
    const canvas = $('#detection-canvas'); canvas.width = frame.width; canvas.height = frame.height;
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    clearTimeout(boxExpiryTimer);
    ctx.lineWidth = Math.max(2, frame.width / 220); ctx.font = `bold ${Math.max(13, Math.round(frame.width / 40))}px sans-serif`;
    const stale = Date.now() - capturedAt > 1500;
    if (!stale && result.boxes.length && typeof triggerAutoCapture === 'function') triggerAutoCapture(capturedAt);
    for (const box of stale ? [] : result.boxes) {
      const x = box.x1 * frame.width, y = box.y1 * frame.height, w = (box.x2-box.x1) * frame.width, h = (box.y2-box.y1) * frame.height;
      ctx.strokeStyle = '#ff5b4d'; ctx.strokeRect(x, y, w, h);
      const label = 'Possible pothole';
      const labelHeight = Math.max(19, Math.round(frame.width / 30)); const labelWidth = ctx.measureText(label).width + 10;
      const labelY = Math.max(0, y-labelHeight); ctx.fillStyle = '#b42f27'; ctx.fillRect(x, labelY, labelWidth, labelHeight);
      ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(label, x+5, labelY+labelHeight/2);
    }
    $('#detection-placeholder').hidden = true; $('#detection-overlay').hidden = false;
    boxExpiryTimer = setTimeout(() => { if (request === cameraRequest) { ctx.clearRect(0, 0, canvas.width, canvas.height); $('#detection-label').textContent = 'WAITING FOR ANALYSIS'; } }, 1500);
    detectionStatus('Model active');
    $('#detection-label').textContent = stale ? 'ANALYSIS DELAYED' : result.boxes.length ? `${result.boxes.length} POSSIBLE POTHOLE${result.boxes.length === 1 ? '' : 'S'}` : 'NO DETECTION IN FRAME';
    message.textContent = typeof autoCaptureActive !== 'undefined' && autoCaptureActive ? 'Analyzing this device’s camera. Automatic local test capture is active; detections require review.' : 'Analyzing sampled frames from this device. Boxes may lag behind live video; detections are not saved unless auto capture is enabled.';
    detectionTimer = setTimeout(() => analyzeFrame(request, token), 100);
  } catch (error) {
    if (request !== cameraRequest || error.name === 'AbortError') return;
    const canvas = $('#detection-canvas'); canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    clearTimeout(boxExpiryTimer); $('#detection-overlay').hidden = false; $('#detection-label').textContent = 'ANALYSIS UNAVAILABLE';
    const restartNeeded = error.status === 404;
    detectionStatus(restartNeeded ? 'Restart app needed' : 'Reconnecting');
    message.textContent = restartNeeded ? 'The detection service is missing. Restart RoadWatch, then reload this page.' : `Camera preview is active; detection is reconnecting${error.status ? ` (error ${error.status})` : ''}.`;
    if (!restartNeeded) detectionTimer = setTimeout(() => analyzeFrame(request, token), 5000);
  }
}
function stopCamera() {
  cameraRequest++; clearTimeout(detectionTimer); clearTimeout(boxExpiryTimer); detectionTimer = null;
  if (typeof stopAutoCapture === 'function') stopAutoCapture();
  $('#auto-capture-start').disabled = true;
  stopLocalTestRecording(); $('#record-local-test').disabled = true;
  if (detectionAbort) { detectionAbort.abort(); detectionAbort = null; }
  if (cameraStream) { const stream = cameraStream; cameraStream = null; stream.getTracks().forEach(track => track.stop()); }
  const video = $('#camera-video'); if (!video) return;
  video.srcObject = null; $('#detection-video').srcObject = null; $('#camera-placeholder').hidden = false; $('#camera-overlay').hidden = true;
  $('#detection-placeholder').hidden = false; $('#detection-overlay').hidden = true;
  $('#detection-placeholder').querySelector('strong').textContent = 'No camera connected';
  $('#detection-placeholder').querySelector('p').textContent = 'The analyzed camera frame will appear here.';
  const canvas = $('#detection-canvas'); canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  $('#camera-status').textContent = '●  CAMERA OFF'; $('#camera-status').classList.remove('is-on');
  $('#camera-source').textContent = 'No active feed'; $('#stop-camera').disabled = true; $('#start-camera').disabled = false;
  detectionStatus('Ready when camera starts');
  $('#camera-message').textContent = 'Start the camera and allow access, then choose your USB camera from the Camera menu. A truck camera feed has not been connected.';
}
