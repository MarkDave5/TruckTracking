let assignmentPoint = null;
let pickingDestination = false;
let assignmentDraftMarker = null;

function renderAssignments() {
  const selector = $('#assignment-truck');
  const previous = selector.value;
  const ids = state.trucks.map(truck => truck.id);
  const current = Array.from(selector.options).slice(1).map(option => option.value);
  if (ids.length !== current.length || ids.some((id, index) => id !== current[index])) {
    selector.options.length = 1;
    state.trucks.forEach(truck => selector.add(new Option(`${truck.plate} · ${truck.model}`, truck.id)));
    selector.value = ids.includes(previous) ? previous : '';
    if (previous && !selector.value) loadAssignmentForm();
  }
  const assignments = (state.assignments || []).filter(a => ids.includes(a.truckId));
  $('#assignment-list').innerHTML = assignments.length ? `<div class="table-wrap"><table><thead><tr><th>Truck</th><th>Driver</th><th>Destination</th><th>Planned departure</th><th>Status</th><th></th></tr></thead><tbody>${assignments.map(a => {
    const truck = state.trucks.find(t => t.id === a.truckId);
    return `<tr><td>${escapeHtml(truck.plate)}</td><td>${escapeHtml(a.driver)}</td><td>${escapeHtml(a.destination)}${a.latitude == null ? '<br><span class="muted">No map point</span>' : ''}</td><td>${escapeHtml(a.departure.replace('T', ' '))}</td><td>${escapeHtml(a.status)}</td><td><button class="detail-button" type="button" data-edit-assignment="${escapeHtml(a.truckId)}">Edit</button></td></tr>`;
  }).join('')}</tbody></table></div>` : '<div class="empty">No assignments yet. Choose a registered truck and enter its destination above.</div>';
}

function showAssignmentPoint() {
  $('#assignment-location').textContent = assignmentPoint ? `Map location: ${assignmentPoint.lat.toFixed(5)}, ${assignmentPoint.lng.toFixed(5)}` : 'No map location selected (optional).';
  if (assignmentDraftMarker && overviewMap) { overviewMap.removeLayer(assignmentDraftMarker); assignmentDraftMarker = null; }
  if (assignmentPoint && overviewMap && window.L) assignmentDraftMarker = L.circleMarker([assignmentPoint.lat, assignmentPoint.lng], {radius: 10, color:'#fff', weight:3, fillColor:'#3478c5', fillOpacity:1}).addTo(overviewMap).bindPopup('Selected destination (save assignment to keep it)');
  if (typeof updateGoogleDraft === 'function') updateGoogleDraft();
}
function loadAssignmentForm() {
  clearDestinationSuggestions();
  const a = (state.assignments || []).find(item => item.truckId === $('#assignment-truck').value);
  setAssignmentDriver(a?.driver || '');
  $('#assignment-destination').value = a?.destination || '';
  $('#assignment-departure').value = a?.departure || '';
  $('#assignment-status').value = a?.status || 'Planned';
  assignmentPoint = a && a.latitude != null && a.longitude != null ? {lat:a.latitude, lng:a.longitude} : null;
  pickingDestination = false;
  $('#assignment-message').textContent = '';
  showAssignmentPoint();
}
function beginDestinationPick() {
  if (!overviewMap && !(typeof googleMapActive !== 'undefined' && googleMapActive)) { $('#assignment-message').textContent = 'Map unavailable. Check your connection and reload the page.'; return; }
  pickingDestination = true;
  $('#assignment-message').textContent = 'Click the destination on the map below.';
  document.getElementById(typeof googleMapActive !== 'undefined' && googleMapActive ? 'google-map' : 'map').scrollIntoView({behavior:'smooth', block:'center'});
}
function clearDestinationPick() { pickingDestination = false; assignmentPoint = null; showAssignmentPoint(); $('#assignment-message').textContent = 'Map location cleared. Save to apply.'; }
function selectDestinationOnMap(event) {
  if (!pickingDestination) return;
  assignmentPoint = {lat:event.latlng.lat, lng:event.latlng.lng};
  pickingDestination = false;
  showAssignmentPoint();
  $('#assignment-message').textContent = 'Destination selected. Save the assignment to keep it.';
}
function editAssignment(id) {
  $('#assignment-panel').open = true;
  $('#assignment-truck').value = id;
  loadAssignmentForm();
  $('#map-vehicle').value = id;
  renderOverview();
  $('#assignment-form').scrollIntoView({behavior:'smooth', block:'center'});
}
async function saveAssignment(event) {
  event.preventDefault();
  const id = $('#assignment-truck').value;
  if (!state.trucks.some(t => t.id === id)) { $('#assignment-message').textContent = 'Select a registered truck first.'; return; }
  const body = { driver:$('#assignment-driver').value.trim(), destination:$('#assignment-destination').value.trim(), departure:$('#assignment-departure').value, status:$('#assignment-status').value, latitude:assignmentPoint?.lat ?? null, longitude:assignmentPoint?.lng ?? null };
  const button = $('#save-assignment'); button.disabled = true; $('#assignment-message').textContent = 'Saving…';
  try {
    const response = await authenticatedMutation(`/api/trucks/${encodeURIComponent(id)}/assignment`, 'PUT', body);
    if (!response.ok) { let data = {}; try { data = await response.json(); } catch {} throw new Error(data.error || 'Could not save. Please refresh and try again.'); }
    const saved = await response.json();
    state.assignments = (state.assignments || []).filter(a => a.truckId !== id); state.assignments.push(saved);
    if (assignmentDraftMarker && overviewMap) { overviewMap.removeLayer(assignmentDraftMarker); assignmentDraftMarker = null; }
    if (typeof googleDraftMarker !== 'undefined' && googleDraftMarker) { googleDraftMarker.setMap(null); googleDraftMarker = null; }
    $('#map-vehicle').value = id; overviewMapSelection = null; render();
    $('#assignment-message').textContent = 'Assignment saved. Trip status is set manually.';
  } catch (error) { $('#assignment-message').textContent = error.message || 'Could not save the assignment.'; }
  finally { button.disabled = false; }
}
