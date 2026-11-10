let vehicleView = 'cards';
function vehicleDriver(truck) {
  const assignment = (state.assignments || []).find(item => item.truckId === truck.id);
  return assignment ? `${assignment.driver} · ${assignment.status} (owner-set)` : 'No trip assigned';
}
function vehicleConnection(truck) { return truck.trackerConnected === true ? 'Connected' : 'Not connected'; }
function vehicleActions(truck) {
  const id = escapeHtml(truck.id), plate = escapeHtml(truck.plate);
  return `<button type="button" class="vehicle-action" data-vehicle-action="map" data-truck-id="${id}" aria-label="View ${plate} on map">Map ↗</button><button type="button" class="vehicle-action" data-vehicle-action="camera" data-truck-id="${id}" aria-label="View camera status for ${plate}">Camera ↗</button>${truck.isSample ? '' : `<button type="button" class="vehicle-action vehicle-remove" data-remove-truck="${id}" aria-label="Remove ${plate}">Remove</button>`}`;
}
function renderVehicles() {
  const trucks = state.trucks || [], query = $('#vehicle-search').value.trim().toLowerCase();
  const shown = trucks.filter(t => `${t.plate} ${t.model} ${t.id} ${vehicleDriver(t)}`.toLowerCase().includes(query));
  $('#vehicle-total').textContent = trucks.length;
  $('#vehicle-connected').textContent = trucks.filter(t => t.trackerConnected === true).length;
  $('#vehicle-view-cards').setAttribute('aria-pressed', String(vehicleView === 'cards'));
  $('#vehicle-view-table').setAttribute('aria-pressed', String(vehicleView === 'table'));
  const target = $('#vehicle-table');
  if (!trucks.length) { target.innerHTML = '<div class="vehicle-empty"><strong>No trucks registered yet</strong><p>Select + Add truck to register your first vehicle.</p></div>'; return; }
  if (!shown.length) { target.innerHTML = '<div class="vehicle-empty"><strong>No trucks found</strong><p>Try another plate number, model, or driver.</p></div>'; return; }
  if (vehicleView === 'table') {
    target.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Plate & vehicle</th><th>Assigned driver</th><th>Tracker status</th><th>Tracker reference</th><th>Fuel setting</th><th>Last location</th><th>Last update</th><th>Actions</th></tr></thead><tbody>${shown.map(t => `<tr><td><strong>${escapeHtml(t.plate)}</strong><br><span class="muted">${escapeHtml(t.model)} · ${escapeHtml(t.id)}</span></td><td>${escapeHtml(vehicleDriver(t))}</td><td><span class="vehicle-connection">${vehicleConnection(t)}</span></td><td>${t.trackerReference ? escapeHtml(t.trackerReference) : 'Not provided'}</td><td>${t.fuelEfficiencyKmPerLiter != null ? `${Number(t.fuelEfficiencyKmPerLiter).toFixed(2)} km/L` : 'Not set'}</td><td>${escapeHtml(t.location || 'Unavailable')}</td><td>${escapeHtml(t.updated || 'Never')}</td><td><div class="vehicle-card-actions">${vehicleActions(t)}</div></td></tr>`).join('')}</tbody></table></div>`;
  } else {
    target.innerHTML = `<div class="vehicle-card-grid">${shown.map(t => `<article class="vehicle-card"><div class="vehicle-card-head"><span class="vehicle-card-icon" aria-hidden="true">▰</span><div><h3>${escapeHtml(t.plate)}</h3><p>${escapeHtml(t.model)}</p></div><span class="vehicle-connection">${vehicleConnection(t)}</span></div><div class="vehicle-card-id">${escapeHtml(t.id)}</div><dl class="vehicle-card-details"><div><dt>Trip driver</dt><dd>${escapeHtml(vehicleDriver(t))}</dd></div><div><dt>Last location</dt><dd>${escapeHtml(t.location || 'Unavailable')}</dd></div><div><dt>Fuel setting</dt><dd>${t.fuelEfficiencyKmPerLiter != null ? `${Number(t.fuelEfficiencyKmPerLiter).toFixed(2)} km/L` : 'Not set'}</dd></div><div><dt>Last update</dt><dd>${escapeHtml(t.updated || 'Never')}</dd></div><div><dt>Tracker reference</dt><dd>${t.trackerReference ? escapeHtml(t.trackerReference) : 'Not provided'}</dd></div></dl><div class="vehicle-card-actions">${vehicleActions(t)}</div></article>`).join('')}</div>`;
  }
}
function setVehicleView(view) { if (view !== 'cards' && view !== 'table') return; vehicleView = view; renderVehicles(); }
function openVehicleDestination(id, action) {
  if (!state.trucks.some(truck => truck.id === id)) return;
  if (action === 'map') { location.hash = 'overview'; navigate(); $('#map-vehicle').value = id; renderOverview(); }
  if (action === 'camera') { selectCameraTruck(id); location.hash = 'camera'; navigate(); }
}
function openTruckForm() {
  $('#truck-form').reset(); $('#truck-form-message').textContent = '';
  $('#truck-dialog').showModal();
}
async function removeTruck(id, button) {
  const truck = state.trucks.find(item => item.id === id && !item.isSample);
  if (!truck || !window.confirm(`Remove ${truck.plate} (${truck.model}) from your registered trucks?`)) return;
  button.disabled = true;
  try {
    const response = await authenticatedMutation(`/api/trucks/${encodeURIComponent(id)}`, 'DELETE');
    if (!response.ok) throw new Error('Could not remove the truck. Please refresh and try again.');
    state.trucks = state.trucks.filter(item => item.id !== id);
    render();
    const toast = $('#toast'); toast.textContent = 'Truck removed.'; toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 4500);
  } catch (error) {
    button.disabled = false;
    const toast = $('#toast'); toast.textContent = error.message || 'Could not remove the truck.'; toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 4500);
  }
}
async function saveTruck(event) {
  event.preventDefault();
  const plate = $('#truck-plate').value.trim(), model = $('#truck-model').value.trim();
  const fuelEfficiencyKmPerLiter = Number($('#truck-efficiency').value);
  const trackerReference = $('#truck-reference').value.trim();
  const message = $('#truck-form-message'), button = $('#save-truck');
  if (!plate || !model || !Number.isFinite(fuelEfficiencyKmPerLiter) || fuelEfficiencyKmPerLiter < 0.1 || fuelEfficiencyKmPerLiter > 100) {
    message.textContent = 'Enter the truck details and a valid fuel efficiency.'; return;
  }
  button.disabled = true; message.textContent = 'Saving…';
  try {
    const response = await authenticatedMutation('/api/trucks', 'POST', {plate, model, fuelEfficiencyKmPerLiter, trackerReference});
    if (!response.ok) { let body = {}; try { body = await response.json(); } catch {} throw new Error(body.error || 'Could not save the truck.'); }
    const truck = await response.json(); state.trucks.push(truck); render();
    $('#truck-dialog').close();
    const toast = $('#toast'); toast.textContent = 'Truck saved. The tracker is not connected yet.'; toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 4500);
  } catch (error) { message.textContent = error.message || 'Could not save the truck.'; }
  finally { button.disabled = false; }
}
