function openEvent(id) {
  const e = state.events.find(item => item.id === id); if (!e) return;
  selectedId = id;
  $('#dialog-content').innerHTML = `<div class="detail-grid"><div><span>Event ID</span><strong>#RW-${e.id}</strong></div><div><span>Review status</span><strong>${escapeHtml(e.status)}</strong></div><div><span>Vehicle</span><strong>${escapeHtml(e.truck)}</strong></div><div><span>Model confidence</span><strong>${e.confidence}%</strong></div><div><span>Approximate location</span><strong>${escapeHtml(e.location)}</strong></div><div><span>Recorded</span><strong>${escapeHtml(e.date)}, ${escapeHtml(e.time)}</strong></div></div><div class="dialog-note">This is a sample detection. No camera image is attached. Confidence is not confirmation of a pothole, and the displayed location is illustrative.</div>`;
  $('#review-button').disabled = e.status === 'Reviewed'; $('#review-button').textContent = e.status === 'Reviewed' ? 'Reviewed' : 'Mark as reviewed'; $('#event-dialog').showModal();
}
