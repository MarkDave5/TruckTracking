let overviewMap = null;
let overviewMapLayers = null;
let overviewMapSelection = null;
function refreshOverviewMapSize() { if (overviewMap) overviewMap.invalidateSize(); if (typeof googleMapActive !== 'undefined' && googleMapActive && googleFleetMap) google.maps.event.trigger(googleFleetMap, 'resize'); }
async function toggleMapFullscreen() {
  const card = $('#fleet-map-card');
  const message = $('#map-fullscreen-message');
  try {
    if (document.fullscreenElement === card) await document.exitFullscreen();
    else if (document.fullscreenElement) { message.textContent = 'Close the current full-screen view first.'; return; }
    else if (card.requestFullscreen) await card.requestFullscreen();
    else { message.textContent = 'Full screen is not available in this browser.'; return; }
    message.textContent = '';
  } catch { message.textContent = 'Could not open full screen. Please try again.'; }
}
function updateMapFullscreen() {
  const full = document.fullscreenElement === $('#fleet-map-card');
  const button = $('#map-fullscreen');
  button.setAttribute('aria-pressed', String(full));
  button.setAttribute('aria-label', full ? 'Exit full screen' : 'Expand map to full screen');
  button.querySelector('span').textContent = full ? 'Exit full screen' : 'Full screen';
  requestAnimationFrame(refreshOverviewMapSize);
}
function updateOverviewMap(trucks, events, selection) {
  const unavailable = $('#map-unavailable');
  if (!window.L) { unavailable.hidden = false; return; }
  if (!overviewMap) {
    overviewMap = L.map('map', { scrollWheelZoom: false }).setView([14.71, 120.99], 11);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    tiles.on('tileerror', () => { if (typeof googleMapActive === 'undefined' || !googleMapActive) unavailable.hidden = false; });
    tiles.on('tileload', () => { if (typeof googleMapActive === 'undefined' || !googleMapActive) unavailable.hidden = true; });
    tiles.addTo(overviewMap);
    overviewMapLayers = L.layerGroup().addTo(overviewMap);
    overviewMap.on('click', selectDestinationOnMap);
    requestAnimationFrame(refreshOverviewMapSize);
  }
  overviewMapLayers.clearLayers();
  const bounds = [];
  let selectedMarker = null;
  let selectedPoint = null;
  const selectedTruck = selection === 'all' ? null : trucks.find(truck => truck.id === selection);
  const mapMessage = $('#map-location-message');
  const destination = (state.assignments || []).find(a => a.truckId === selection && Number.isFinite(a.latitude) && Number.isFinite(a.longitude) && Math.abs(a.latitude) <= 90 && Math.abs(a.longitude) <= 180);
  mapMessage.textContent = selection === 'all' ? 'Live truck GPS is not connected. Blue markers show planned destinations.' : selectedTruck && Number.isFinite(selectedTruck.latitude) && Number.isFinite(selectedTruck.longitude) && Math.abs(selectedTruck.latitude) <= 90 && Math.abs(selectedTruck.longitude) <= 180 ? `${selectedTruck.id}: last available position. Live GPS is not connected.` : destination ? 'No truck location is available. The blue marker shows its planned destination.' : 'No truck location or mapped destination is available for the selected truck.';
  const coordinates = item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude) && Math.abs(item.latitude) <= 90 && Math.abs(item.longitude) <= 180;
  trucks.filter(coordinates).forEach(truck => {
    const point = [truck.latitude, truck.longitude]; bounds.push(point);
    const marker = L.circleMarker(point, {radius: truck.id === selection ? 12 : 9, color: '#fff', weight: 3, fillColor: truck.status === 'Offline' ? '#85979e' : '#15866e', fillOpacity: 1});
    marker.bindPopup(`<strong>${escapeHtml(truck.id)}</strong><br>${escapeHtml(truck.location)}<br><small>Last available position · ${escapeHtml(truck.status)}</small>`);
    marker.addTo(overviewMapLayers);
    if (truck.id === selection) { selectedPoint = point; selectedMarker = marker; }
  });
  (state.assignments || []).filter(a => trucks.some(t => t.id === a.truckId) && coordinates(a)).forEach(assignment => {
    const point = [assignment.latitude, assignment.longitude]; bounds.push(point);
    const marker = L.circleMarker(point, {radius: 10, color:'#fff', weight:3, fillColor:'#3478c5', fillOpacity:1});
    marker.bindPopup(`<strong>Planned destination</strong><br>${escapeHtml(assignment.destination)}<br><small>${escapeHtml(assignment.truckId)} · ${escapeHtml(assignment.status)} (manual)</small>`).addTo(overviewMapLayers);
    if (assignment.truckId === selection && !selectedPoint) { selectedPoint = point; selectedMarker = marker; }
  });
  events.filter(coordinates).forEach(event => {
    const point = [event.latitude, event.longitude]; bounds.push(point);
    const marker = L.circleMarker(point, {radius: 7, color: '#fff', weight: 2, fillColor: '#db9146', fillOpacity: 1});
    marker.bindPopup(`<strong>Possible pothole</strong><br>${escapeHtml(event.location)}<br><small>Approximate sample position · ${escapeHtml(event.truck)}</small><br><button class="map-details" data-event="${event.id}">Review event</button>`);
    marker.addTo(overviewMapLayers);
  });
  if (selection !== overviewMapSelection) {
    overviewMapSelection = selection;
    if (selection !== 'all') {
      if (selectedPoint) { overviewMap.setView(selectedPoint, 14); selectedMarker.openPopup(); }
      else overviewMap.setView([14.71, 120.99], 11);
    } else if (bounds.length) overviewMap.fitBounds(bounds, {padding: [35, 35], maxZoom: 13});
    else overviewMap.setView([14.71, 120.99], 11);
  }
}
// Owner overview. All displayed records come from the same API sample data.
function renderOverview() {
  const selector = $('#map-vehicle');
  const previous = selector.value;
  const desiredIds = state.trucks.map(truck => truck.id);
  const existingIds = Array.from(selector.options).slice(1).map(option => option.value);
  if (desiredIds.length !== existingIds.length || desiredIds.some((id, index) => id !== existingIds[index])) {
    selector.options.length = 1;
    state.trucks.forEach(truck => selector.add(new Option(`${truck.id} · ${truck.plate}`, truck.id)));
    selector.value = desiredIds.includes(previous) ? previous : 'all';
  }
  const selected = selector.value;
  const trucks = state.trucks.filter(t => selected === 'all' || t.id === selected);
  const reviewsReady = typeof roadReviewsState !== 'undefined' && roadReviewsState === 'ready';
  const reviewStatus = typeof roadReviewsState !== 'undefined' && roadReviewsState === 'loading' ? 'Loading reviews…' : 'Reviews unavailable';
  const reviews = reviewsReady ? roadReviews.filter(e => selected === 'all' || e.truckId === selected) : [];
  const pending = reviews.filter(e => e.outcome === 'Needs review' || e.outcome === 'Follow-up');
  const planned = (state.assignments || []).filter(a => (selected === 'all' || a.truckId === selected) && a.status === 'In progress').length;
  const reviewed = reviews.filter(e => e.outcome === 'Reviewed').length;
  const cards = [
    {label:'Registered trucks', value:trucks.length, hint:'In this view', icon:'truck', href:'#vehicles'},
    {label:'Trips in progress', value:planned, hint:'Owner-set status', icon:'route', href:'#overview'},
    {label:'Need attention', value:reviewsReady ? pending.length : '—', hint:reviewsReady ? 'Review or follow up' : reviewStatus, icon:'road', href:'#detections'},
    {label:'Reviewed', value:reviewsReady ? reviewed : '—', hint:reviewsReady ? 'Owner-reviewed events' : reviewStatus, icon:'check', href:'#detections'}
  ];
  $('#metrics').innerHTML = cards.map(c => `<a class="owner-metric" href="${c.href}"><span class="owner-metric-icon" data-icon="${c.icon}"></span><div><span class="owner-metric-label">${c.label}</span><div class="owner-metric-value">${c.value}</div><small>${c.hint}</small></div><span class="metric-arrow">↗</span></a>`).join('');
  $('#queue-count').textContent = reviewsReady ? pending.length : '—';
  $('#overview-queue').innerHTML = !reviewsReady ? `<div class="queue-empty"><strong>${reviewStatus}</strong>${reviewStatus === 'Reviews unavailable' ? '<p>Check the connection and refresh.</p>' : ''}</div>` : pending.length ? pending.map(e => `<button class="queue-item" data-queue-review="${escapeHtml(e.id)}"><span class="queue-event-icon" data-icon="road"></span><span class="queue-event-text"><strong>${escapeHtml(e.truckPlate)} · ${escapeHtml(e.driver)}</strong><span>${escapeHtml(e.eventTime.replace('T',' '))}</span><small>${escapeHtml(e.source || 'Manually added')} · ${escapeHtml(e.outcome)}</small></span><span class="queue-arrow">→</span></button>`).join('') : '<div class="queue-empty"><span data-icon="check"></span><strong>No events awaiting review</strong><p>Saved events that need attention appear here.</p></div>';
  updateOverviewMap(trucks, [], selected);
  if (typeof updateGoogleFleetMap === 'function') updateGoogleFleetMap();
  $('#map-event-count').textContent = '';
  $('#overview-fleet-table').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Vehicle</th><th>Status</th><th>Last recorded location</th><th>Speed</th><th>Sample update</th></tr></thead><tbody>${trucks.map(t => `<tr><td><div class="fleet-identity"><span data-icon="truck"></span><div><strong>${escapeHtml(t.id)}</strong><small>${escapeHtml(t.model)}${t.isSample ? ' · Sample' : ''}</small></div></div></td><td><span class="badge ${statusClass(t.status)}">${escapeHtml(t.status)}</span></td><td>${escapeHtml(t.location)}</td><td>${(t.status==='Offline'||t.status==='Not connected')?'Unavailable':`${t.speed} <span class="muted">km/h</span>`}</td><td>${escapeHtml(t.updated)}</td></tr>`).join('')}</tbody></table></div>`;
  if (!trucks.length) $('#overview-fleet-table').innerHTML = '<div class="empty">No trucks registered yet. <a href="#vehicles">Add a truck</a> to see it here.</div>';
  paintIcons();
}
