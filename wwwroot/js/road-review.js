let roadReviews = [];
let roadReviewsState = 'loading';
let selectedRoadReviewId = null;

async function loadRoadReviews() {
  try {
    const response = await fetch('/api/road-reviews', {cache:'no-store'});
    if (!response.ok) throw new Error();
    roadReviews = await response.json(); roadReviewsState = 'ready'; renderRoadReviews();
  } catch { roadReviewsState = 'error'; $('#road-review-list').innerHTML = '<div class="empty">Could not load saved events. Restart the app and refresh.</div>'; updateReviewSummary(); }
}
function updateReviewSummary() {
  $('#nav-events').textContent = roadReviewsState === 'ready' ? roadReviews.filter(e => e.outcome === 'Needs review' || e.outcome === 'Follow-up').length : '—';
  if (typeof renderOverview === 'function') renderOverview();
  if (typeof renderRoadConditions === 'function') renderRoadConditions();
}
function fillRoadTruckSelect(selector, includeAll) {
  const trucks = state.trucks || [], previous = selector.value;
  const ids = trucks.map(t => t.id), existing = Array.from(selector.options).slice(1).map(o => o.value);
  if (ids.length !== existing.length || ids.some((id, i) => id !== existing[i])) {
    selector.options.length = 1;
    trucks.forEach(t => selector.add(new Option(`${t.plate} · ${t.model}`, t.id)));
    selector.value = ids.includes(previous) ? previous : (includeAll ? 'all' : '');
  }
}
function renderRoadReviews() {
  const list = $('#road-review-list'); if (!list) return;
  fillRoadTruckSelect($('#road-review-truck'), false); fillRoadTruckSelect($('#road-review-filter'), true);
  updateReviewSummary();
  if (roadReviewsState !== 'ready') { list.innerHTML = `<div class="empty">${roadReviewsState === 'loading' ? 'Loading saved events…' : 'Could not load saved events. Refresh and try again.'}</div>`; return; }
  const filter = $('#road-review-filter').value;
  const records = roadReviews.filter(e => filter === 'all' || e.truckId === filter);
  list.innerHTML = records.length ? `<div class="table-wrap"><table><thead><tr><th>Truck</th><th>Driver</th><th>Time (local)</th><th>Source</th><th>Video</th><th>Review</th><th></th></tr></thead><tbody>${records.map(e => `<tr><td>${escapeHtml(e.truckPlate)}</td><td>${escapeHtml(e.driver)}</td><td>${escapeHtml(e.eventTime.replace('T',' '))}</td><td>${escapeHtml(e.source || 'Manually added')}</td><td>${e.clipType ? 'Available' : 'No clip'}</td><td>${escapeHtml(e.outcome)}</td><td><button type="button" class="detail-button" data-road-review="${escapeHtml(e.id)}">Review</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No saved road events in this view.</div>';
}
async function saveRoadReview(event) {
  event.preventDefault();
  const button = $('#road-review-save'), message = $('#road-review-message');
  const useLocal = $('#road-review-use-local').checked;
  const clip = useLocal ? localTestClip : $('#road-review-clip').files[0];
  if (useLocal && !clip) { message.textContent = 'No local test clip is available. Record one or choose a video file.'; return; }
  if (clip && clip.size > 40_000_000) { message.textContent = 'Video must be under 40 MB.'; return; }
  const body = new FormData();
  body.append('source', useLocal ? 'local-test' : 'manual');
  for (const [key, selector] of Object.entries({truckId:'#road-review-truck',driver:'#road-review-driver',eventTime:'#road-review-time',location:'#road-review-location',acceleration:'#road-review-accel',gyroX:'#road-review-gx',gyroY:'#road-review-gy',gyroZ:'#road-review-gz'})) body.append(key, $(selector).value.trim());
  if (clip) body.append('clip', clip, useLocal ? (clip.type === 'video/mp4' ? 'local-test.mp4' : 'local-test.webm') : clip.name);
  button.disabled = true; message.textContent = 'Saving event…';
  try {
    const tokenResponse = await fetch('/api/auth/token', {cache:'no-store'}); if (!tokenResponse.ok) throw new Error('Please sign in again.');
    const {token} = await tokenResponse.json();
    const response = await fetch('/api/road-reviews', {method:'POST', headers:{'X-CSRF-TOKEN':token}, body});
    if (!response.ok) { let data = {}; try { data = await response.json(); } catch {} throw new Error(data.error || 'Could not save event. Restart the app and try again.'); }
    const saved = await response.json(); roadReviews.unshift(saved); $('#road-review-form').reset(); renderRoadReviews();
    message.textContent = 'Event saved. Open it below to play the clip and add your review.';
  } catch (error) { message.textContent = error.message || 'Could not save the event.'; }
  finally { button.disabled = false; }
}
function reading(value, unit) { return value == null ? 'Not provided' : `${Number(value)} ${unit}`; }
function openRoadReview(id) {
  const e = roadReviews.find(item => item.id === id); if (!e) return;
  selectedRoadReviewId = id;
  const clip = e.clipType ? `<video class="road-review-video" controls preload="metadata" src="/api/road-reviews/${encodeURIComponent(e.id)}/clip">Your browser cannot play this video.</video>` : '<p class="road-review-no-video">No video clip was provided for this event.</p>';
  $('#road-review-detail').innerHTML = `${clip}<div class="detail-grid"><div><span>Source</span><strong>${escapeHtml(e.source || 'Manually added')}</strong></div><div><span>Truck</span><strong>${escapeHtml(e.truckPlate)}</strong></div><div><span>Driver</span><strong>${escapeHtml(e.driver)}</strong></div><div><span>Time (local)</span><strong>${escapeHtml(e.eventTime.replace('T',' '))}</strong></div><div><span>Location</span><strong>${escapeHtml(e.location || 'Not provided')}</strong></div><div><span>Vertical acceleration</span><strong>${reading(e.acceleration, 'm/s²')}</strong></div><div><span>Gyroscope X / Y / Z</span><strong>${reading(e.gyroX, '°/s')} / ${reading(e.gyroY, '°/s')} / ${reading(e.gyroZ, '°/s')}</strong></div></div><p class="road-review-explain">Manually supplied evidence. Sensor readings alone do not establish driver fault.</p>`;
  $('#road-review-outcome').value = e.outcome; $('#road-review-note').value = e.notes || ''; $('#road-review-outcome-message').textContent = '';
  $('#road-review-dialog').showModal();
}
function closeRoadReview() { $('#road-review-dialog').close(); }
async function saveRoadOutcome(event) {
  event.preventDefault(); const button = $('#road-review-outcome-save'), message = $('#road-review-outcome-message'); button.disabled = true;
  try {
    const response = await authenticatedMutation(`/api/road-reviews/${encodeURIComponent(selectedRoadReviewId)}`, 'PUT', {outcome:$('#road-review-outcome').value, notes:$('#road-review-note').value.trim()});
    if (!response.ok) throw new Error('Could not save the review.');
    const updated = await response.json(), index = roadReviews.findIndex(e => e.id === updated.id);
    if (index >= 0) roadReviews[index] = updated;
    renderRoadReviews(); message.textContent = 'Review saved.';
  } catch (error) { message.textContent = error.message || 'Could not save the review.'; }
  finally { button.disabled = false; }
}
