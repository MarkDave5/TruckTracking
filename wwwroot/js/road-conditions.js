function renderRoadConditions() {
  const list = $('#road-condition-list'), filter = $('#road-condition-filter');
  if (!list || !filter) return;
  fillRoadTruckSelect(filter, true);
  if (roadReviewsState !== 'ready') {
    list.innerHTML = `<div class="empty">${roadReviewsState === 'loading' ? 'Loading saved readings…' : 'Could not load saved readings. Refresh and try again.'}</div>`;
    return;
  }
  const records = roadReviews.filter(e => (filter.value === 'all' || e.truckId === filter.value) && [e.acceleration, e.gyroX, e.gyroY, e.gyroZ].some(value => value != null));
  const value = (number, unit) => number == null ? 'Not provided' : `${escapeHtml(number)} ${unit}`;
  list.innerHTML = records.length ? `<div class="table-wrap"><table><thead><tr><th>Truck</th><th>Event time (local)</th><th>Vertical acceleration</th><th>Gyro X</th><th>Gyro Y</th><th>Gyro Z</th><th>Source</th><th></th></tr></thead><tbody>${records.map(e => `<tr><td><strong>${escapeHtml(e.truckPlate)}</strong></td><td>${escapeHtml(e.eventTime.replace('T',' '))}</td><td>${value(e.acceleration, 'm/s²')}</td><td>${value(e.gyroX, '°/s')}</td><td>${value(e.gyroY, '°/s')}</td><td>${value(e.gyroZ, '°/s')}</td><td>Manually entered</td><td><button type="button" class="detail-button" data-condition-review="${escapeHtml(e.id)}">Review event</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No sensor readings available for this view yet.</div>';
}
