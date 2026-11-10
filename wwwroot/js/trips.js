let selectedTripId = null;
function tripDateForFilter(value) {
  const match = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})$/.exec(value || '');
  if (!match) return '';
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(match[1]) + 1;
  return `${match[3]}-${String(month).padStart(2,'0')}-${match[2].padStart(2,'0')}`;
}
function updateTripFilterOptions(selector, values) {
  const previous = selector.value, options = [...new Set(values)].sort((a,b) => a.localeCompare(b));
  const existing = Array.from(selector.options).slice(1).map(option => option.value);
  if (options.length !== existing.length || options.some((value,i) => value !== existing[i])) {
    selector.options.length = 1;
    options.forEach(value => selector.add(new Option(value,value)));
    selector.value = options.includes(previous) ? previous : 'all';
  }
}
function clearTripFilters() {
  $('#trip-search').value = ''; $('#trip-vehicle-filter').value = 'all'; $('#trip-driver-filter').value = 'all'; $('#trip-date-filter').value = '';
  renderTrips();
}
function renderTrips() {
  const trips = state.trips || [];
  const distance = trips.reduce((sum, trip) => sum + trip.distanceKm, 0);
  const liters = trips.reduce((sum, trip) => sum + trip.distanceKm / trip.efficiencyKmPerLiter, 0);
  $('#trip-stats').innerHTML = `<div><span class="stat-glyph">↗</span><p>SAMPLE TRIPS</p><strong>${two(trips.length)}</strong><small>All example journeys</small></div><div><span class="stat-glyph">⌁</span><p>SAMPLE DISTANCE</p><strong>${distance.toFixed(1)} <em>km</em></strong><small>Across all sample trips</small></div><div><span class="stat-glyph">◒</span><p>ESTIMATED FUEL</p><strong>${liters.toFixed(1)} <em>L</em></strong><small>All sample trips · estimate</small></div>`;
  updateTripFilterOptions($('#trip-vehicle-filter'), trips.map(t => t.truck));
  updateTripFilterOptions($('#trip-driver-filter'), trips.map(t => t.driver || 'Unassigned'));
  const query = ($('#trip-search')?.value || '').trim().toLowerCase();
  const vehicle = $('#trip-vehicle-filter').value, driver = $('#trip-driver-filter').value, date = $('#trip-date-filter').value;
  const filtered = trips.filter(t => `${t.id} ${t.truck} ${t.driver || ''} ${t.from} ${t.to}`.toLowerCase().includes(query) && (vehicle === 'all' || t.truck === vehicle) && (driver === 'all' || (t.driver || 'Unassigned') === driver) && (!date || tripDateForFilter(t.date) === date));
  $('#trip-table').innerHTML = filtered.length ? `<div class="table-wrap"><table><thead><tr><th>Vehicle / trip</th><th>Driver</th><th>Route</th><th>Date</th><th>Status</th><th>Distance</th><th>Est. fuel</th><th>Road events</th><th></th></tr></thead><tbody>${filtered.map(t => `<tr><td><strong>${escapeHtml(t.truck)}</strong><br><span class="muted">${escapeHtml(t.id)} · Sample</span></td><td>${escapeHtml(t.driver || 'Unassigned')}</td><td><strong>${escapeHtml(t.from)}</strong><br><span class="muted">→ ${escapeHtml(t.to)}</span></td><td>${escapeHtml(t.date)}</td><td><span class="trip-status-unknown">Not recorded</span></td><td><strong>${t.distanceKm.toFixed(1)} km</strong></td><td>${(t.distanceKm/t.efficiencyKmPerLiter).toFixed(1)} L</td><td>${t.detections} sample</td><td><button class="detail-button" data-trip="${escapeHtml(t.id)}">View details ↗</button></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${trips.length ? 'No trips match these filters.' : 'No trip records available yet.'}</div>`;
}
function openTrip(id) {
 const t = (state.trips || []).find(x => x.id === id); if (!t) return;
 selectedTripId = id;
 const liters = t.distanceKm / t.efficiencyKmPerLiter;
 $('#trip-title').textContent = `Trip ${t.id}`;
 $('#trip-detail').innerHTML = `<div class="trip-detail-source">Sample trip · Not recorded from a registered truck</div><div class="route-detail"><span>●</span><div><strong>${escapeHtml(t.from)}</strong><small>Starting point</small><hr><strong>${escapeHtml(t.to)}</strong><small>Destination</small></div></div><div class="detail-grid"><div><span>Vehicle</span><strong>${escapeHtml(t.truck)}</strong></div><div><span>Driver</span><strong>${escapeHtml(t.driver || 'Unassigned')}</strong></div><div><span>Date</span><strong>${escapeHtml(t.date)}</strong></div><div><span>Trip status</span><strong>Not recorded</strong></div><div><span>Distance / duration</span><strong>${t.distanceKm.toFixed(1)} km / ${escapeHtml(t.duration)}</strong></div><div><span>Sample road events</span><strong>${t.detections} possible</strong></div><div><span>Estimated fuel</span><strong>${liters.toFixed(2)} L</strong></div><div><span>Estimated cost</span><strong>₱${(liters*t.pricePerLiter).toFixed(2)}</strong></div></div><div class="dialog-note">Sample trip distance. Estimate uses ${t.efficiencyKmPerLiter.toFixed(2)} km/L and ₱${t.pricePerLiter.toFixed(2)} per liter; it is not a direct fuel measurement. Sample road event counts are not linked to saved reviews.</div>`;
 $('#trip-driver').value = t.driver || ''; $('#trip-efficiency').value = t.efficiencyKmPerLiter; $('#trip-price').value = t.pricePerLiter;
 $('#fuel-form-message').textContent = ''; updateFuelPreview();
 if (!$('#trip-dialog').open) $('#trip-dialog').showModal();
}
function updateFuelPreview() {
 const trip = (state.trips || []).find(t => t.id === selectedTripId);
 const efficiency = Number($('#trip-efficiency').value), price = Number($('#trip-price').value);
 const valid = trip && $('#trip-efficiency').value !== '' && $('#trip-price').value !== '' && efficiency >= 0.1 && efficiency <= 100 && price >= 0 && price <= 10000;
 $('#fuel-preview').textContent = valid ? `Estimated for this trip: ${(trip.distanceKm/efficiency).toFixed(2)} L · ₱${(trip.distanceKm/efficiency*price).toFixed(2)}` : 'Enter a valid efficiency and price to preview the estimate.';
}
async function saveTripFuel(event) {
 event.preventDefault();
 const tripId = selectedTripId, button = $('#save-trip-fuel'), message = $('#fuel-form-message');
 const driver = $('#trip-driver').value.trim(), efficiency = Number($('#trip-efficiency').value), price = Number($('#trip-price').value);
 if (!driver) { message.textContent = 'Enter a driver name.'; return; }
 button.disabled = true; message.textContent = 'Saving…';
 try {
   const response = await authenticatedMutation(`/api/trips/${encodeURIComponent(tripId)}/fuel`, 'PUT', {driver, efficiencyKmPerLiter:efficiency, pricePerLiter:price});
   if (!response.ok) { let detail = {}; try { detail = await response.json(); } catch {} throw new Error(detail.error || 'Could not save trip settings.'); }
   const updated = await response.json(); const index = state.trips.findIndex(t => t.id === updated.id);
   if (index >= 0) state.trips[index] = updated;
   render(); renderStudy();
   if ($('#trip-dialog').open && selectedTripId === tripId) { openTrip(tripId); message.textContent = 'Trip settings saved.'; }
 } catch (error) { message.textContent = error.message || 'Could not save trip settings.'; }
 finally { button.disabled = false; }
}
