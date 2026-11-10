// Optional browser-only Google Maps integration. Nothing is loaded until the owner supplies a key.
let googleMapActive = false;
let googleFleetMap = null;
let googleTrafficLayer = null;
let googleFleetMarkers = [];
let googleDraftMarker = null;
let googleSearchMarker = null;
let googleMapSelectionKey = null;
let googleMapsLoadedKey = null;

function googleMapStatus(message) { $('#google-map-message').textContent = message; }
function useOpenStreetMap() {
  googleMapActive = false;
  if (googleTrafficLayer) googleTrafficLayer.setMap(null);
  $('#google-traffic').checked = false; $('#google-traffic').disabled = true;
  $('#google-map').hidden = true; $('#map').hidden = false;
  $('#map-unavailable').hidden = !!window.L;
  googleMapStatus('OpenStreetMap is active. Traffic requires Google Maps.');
  requestAnimationFrame(refreshOverviewMapSize);
}
async function connectGoogleMap(event) {
  event.preventDefault();
  const key = $('#google-map-key').value.trim();
  const button = $('#google-map-connect');
  if (!key && !googleFleetMap) { googleMapStatus('Enter a Google Maps browser API key first.'); return; }
  if (googleMapsLoadedKey && key && key !== googleMapsLoadedKey) { googleMapStatus('Refresh this page before trying a different key.'); return; }
  button.disabled = true;
  try {
    if (!googleFleetMap) {
      googleMapStatus('Connecting to Google Maps…');
      await loadGoogleMaps(key);
      googleMapsLoadedKey = key;
      $('#google-map').hidden = false;
      googleFleetMap = new google.maps.Map($('#google-map'), {center:{lat:14.71,lng:120.99}, zoom:11, mapTypeControl:true, fullscreenControl:false, streetViewControl:false});
      googleTrafficLayer = new google.maps.TrafficLayer();
      googleFleetMap.addListener('click', e => selectDestinationOnMap({latlng:{lat:e.latLng.lat(),lng:e.latLng.lng()}}));
    }
    $('#google-map-key').value = '';
    googleMapActive = true; $('#map').hidden = true; $('#google-map').hidden = false; $('#map-unavailable').hidden = true;
    $('#google-traffic').disabled = false;
    googleMapSelectionKey = null;
    updateGoogleFleetMap(); updateGoogleDraft();
    googleMapStatus('Google Maps is active. Turn on traffic using the checkbox.');
    requestAnimationFrame(refreshOverviewMapSize);
  } catch {
    useOpenStreetMap();
    googleMapStatus('Google Maps could not load. Check the key, API, billing and internet connection; OpenStreetMap remains available.');
  } finally { button.disabled = false; }
}
function loadGoogleMaps(key) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const script = document.createElement('script');
    const finish = ok => { if (finished) return; finished = true; clearTimeout(timer); delete window.roadwatchGoogleReady; if (!ok) script.remove(); ok ? resolve() : reject(new Error('Google Maps failed')); };
    const timer = setTimeout(() => finish(false), 15000);
    window.roadwatchGoogleReady = () => finish(true);
    window.gm_authFailure = () => { finish(false); useOpenStreetMap(); googleMapStatus('Google rejected the key. Check API restrictions and billing, then reload the page.'); };
    const params = new URLSearchParams({key, callback:'roadwatchGoogleReady', loading:'async', v:'weekly'});
    script.async = true; script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.onerror = () => finish(false); document.head.appendChild(script);
  });
}
function updateGoogleTraffic() {
  if (googleTrafficLayer) googleTrafficLayer.setMap(googleMapActive && $('#google-traffic').checked ? googleFleetMap : null);
  googleMapStatus($('#google-traffic').checked ? 'Google traffic is on where coverage is available. Traffic can be delayed.' : 'Google traffic is off.');
}
function validGooglePoint(item) { return Number.isFinite(item.latitude) && Number.isFinite(item.longitude) && Math.abs(item.latitude) <= 90 && Math.abs(item.longitude) <= 180; }
function updateGoogleFleetMap() {
  if (!googleMapActive || !googleFleetMap) return;
  googleFleetMarkers.forEach(marker => marker.setMap(null)); googleFleetMarkers = [];
  const selected = $('#map-vehicle').value;
  const trucks = state.trucks.filter(t => selected === 'all' || t.id === selected);
  const points = [];
  const addPoint = (item, color, title) => {
    if (!validGooglePoint(item)) return;
    const position = {lat:item.latitude,lng:item.longitude}; points.push(position);
    const circle = new google.maps.Circle({map:googleFleetMap, center:position, radius:75, strokeColor:'#ffffff', strokeWeight:2, fillColor:color, fillOpacity:0.9, clickable:true});
    const info = new google.maps.InfoWindow({content:escapeHtml(title)});
    circle.addListener('click', () => { info.setPosition(position); info.open({map:googleFleetMap}); });
    googleFleetMarkers.push(circle);
  };
  trucks.forEach(t => addPoint(t,'#15866e', `${t.id} · ${t.location}`));
  (state.assignments || []).filter(a => trucks.some(t => t.id === a.truckId)).forEach(a => addPoint(a,'#3478c5',`Planned destination: ${a.destination} · ${a.truckId}`));
  const viewKey = JSON.stringify([selected, points]);
  if (viewKey !== googleMapSelectionKey) {
    googleMapSelectionKey = viewKey;
    if (points.length === 1) { googleFleetMap.setCenter(points[0]); googleFleetMap.setZoom(14); }
    else if (points.length > 1) { const bounds = new google.maps.LatLngBounds(); points.forEach(point => bounds.extend(point)); googleFleetMap.fitBounds(bounds, 35); }
    else { googleFleetMap.setCenter({lat:14.71,lng:120.99}); googleFleetMap.setZoom(11); }
  }
}
function centerGoogleMap(lat, lng, zoom) { if (googleMapActive && googleFleetMap) { googleFleetMap.setCenter({lat,lng}); googleFleetMap.setZoom(zoom); } }
function updateGoogleDraft() {
  if (googleDraftMarker) { googleDraftMarker.setMap(null); googleDraftMarker = null; }
  if (googleMapActive && googleFleetMap && assignmentPoint) googleDraftMarker = new google.maps.Circle({map:googleFleetMap,center:{lat:assignmentPoint.lat,lng:assignmentPoint.lng},radius:75,strokeColor:'#fff',strokeWeight:2,fillColor:'#3478c5',fillOpacity:0.9});
}
function showGoogleSearchPoint(place) {
  if (googleSearchMarker) { googleSearchMarker.setMap(null); googleSearchMarker = null; }
  if (googleMapActive && googleFleetMap && place) googleSearchMarker = new google.maps.Circle({map:googleFleetMap,center:{lat:place.lat,lng:place.lng},radius:75,strokeColor:'#fff',strokeWeight:2,fillColor:'#7157b8',fillOpacity:0.9});
}
