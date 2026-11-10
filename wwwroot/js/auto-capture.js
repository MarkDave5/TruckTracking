// Optional local-camera test. This does not represent a remote truck camera.
let autoCaptureActive = false;
let autoCaptureRecorder = null;
let autoCaptureTimer = null;
let autoCaptureSession = 0;
let autoCaptureTruck = null;
let autoCaptureDriver = '';
let autoCaptureMime = '';

function autoCaptureStatus(message) { $('#auto-capture-message').textContent = message; }
function startAutoCapture() {
  if (!cameraStream || typeof MediaRecorder === 'undefined') { autoCaptureStatus('Start the local camera in a browser that supports recording.'); return; }
  if (localTestRecorder && localTestRecorder.state !== 'inactive') { autoCaptureStatus('Stop the manual test recording first.'); return; }
  const truck = (state.trucks || []).find(t => t.id === selectedCameraTruckId);
  const driver = $('#auto-capture-driver').value.trim();
  if (!truck || !driver) { autoCaptureStatus('Select a truck above and enter a test driver first.'); return; }
  const mime = ['video/webm;codecs=vp8','video/webm','video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
  if (!mime) { autoCaptureStatus('This browser cannot record MP4 or WebM.'); return; }
  autoCaptureActive = true; autoCaptureTruck = truck.id; autoCaptureDriver = driver; autoCaptureMime = mime;
  ++autoCaptureSession;
  $('#auto-capture-start').disabled = true; $('#auto-capture-stop').disabled = false; $('#record-local-test').disabled = true; $('#auto-capture-driver').disabled = true;
  autoCaptureStatus('Monitoring this local camera. Recording starts when a possible pothole is detected.');
}
function triggerAutoCapture(capturedAt) {
  if (!autoCaptureActive || autoCaptureRecorder || autoCaptureTimer || !cameraStream) return;
  const session = autoCaptureSession;
  const captured = {truckId:autoCaptureTruck, driver:autoCaptureDriver, time:capturedAt};
  try {
    const recorder = new MediaRecorder(cameraStream, {mimeType:autoCaptureMime, videoBitsPerSecond:1000000});
    const chunks = []; let failed = false; autoCaptureRecorder = recorder;
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onerror = () => { failed = true; stopAutoCapture(); autoCaptureStatus('Recording failed. Check the camera and try again.'); };
    recorder.onstop = async () => {
      if (failed) { if (autoCaptureRecorder === recorder) autoCaptureRecorder = null; return; }
      const type = recorder.mimeType.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';
      const clip = new Blob(chunks, {type});
      const saved = await saveAutomaticTestClip(captured, clip);
      if (autoCaptureRecorder === recorder) autoCaptureRecorder = null;
      if (autoCaptureActive && session === autoCaptureSession) {
        if (!saved) { stopAutoCapture(); autoCaptureStatus('Could not save the clip. Check your sign-in and connection, then try again.'); return; }
        autoCaptureStatus('Clip saved to Driver event review. Monitoring resumes in 10 seconds.');
        autoCaptureTimer = setTimeout(() => { autoCaptureTimer = null; if (autoCaptureActive && session === autoCaptureSession) autoCaptureStatus('Monitoring this local camera. Recording starts when a possible pothole is detected.'); }, 10000);
      }
    };
    recorder.start();
    autoCaptureStatus('Possible pothole detected. Recording for approximately 10 seconds…');
    autoCaptureTimer = setTimeout(() => { autoCaptureTimer = null; if (recorder.state !== 'inactive') recorder.stop(); }, 10000);
  } catch { autoCaptureRecorder = null; stopAutoCapture(); autoCaptureStatus('Could not start automatic recording.'); }
}
function stopAutoCapture() {
  autoCaptureActive = false; autoCaptureSession++; clearTimeout(autoCaptureTimer); autoCaptureTimer = null;
  if (autoCaptureRecorder && autoCaptureRecorder.state !== 'inactive') autoCaptureRecorder.stop();
  $('#auto-capture-start').disabled = !cameraStream; $('#auto-capture-stop').disabled = true; $('#auto-capture-driver').disabled = false;
  $('#record-local-test').disabled = !cameraStream;
  autoCaptureStatus('Automatic local capture is off.');
}
function localEventTime(ms) {
  const d = new Date(ms), pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
async function saveAutomaticTestClip(event, clip) {
  if (!clip.size || clip.size > 40000000) { autoCaptureStatus('The test clip could not be saved: empty or larger than 40 MB.'); return false; }
  autoCaptureStatus('Saving the local test clip…');
  try {
    const tokenResponse = await fetch('/api/auth/token', {cache:'no-store'});
    if (!tokenResponse.ok) throw new Error('Sign in again.');
    const {token} = await tokenResponse.json();
    const body = new FormData(); body.append('source','local-test'); body.append('truckId',event.truckId); body.append('driver',event.driver); body.append('eventTime',localEventTime(event.time)); body.append('location','');
    body.append('clip',clip,clip.type === 'video/mp4' ? 'auto-test.mp4' : 'auto-test.webm');
    const response = await fetch('/api/road-reviews', {method:'POST', headers:{'X-CSRF-TOKEN':token}, body});
    if (!response.ok) throw new Error('Could not save clip. Restart the app or check your connection.');
    const saved = await response.json(); roadReviews.unshift(saved); renderRoadReviews();
    autoCaptureStatus('Local test clip saved. Open Driver event review to review and play it.');
    return true;
  } catch (error) { autoCaptureStatus(error.message || 'Could not save the local test clip.'); return false; }
}
