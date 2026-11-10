let state = { trucks: [], drivers: [], events: [] };
let selectedId = null;
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const two = n => String(n).padStart(2, '0');
const statusClass = s => s.toLowerCase().replaceAll(' ', '-');
function navigate() {
  const page = ["overview","vehicles","drivers","settings","trips","camera","road-conditions","detections","safety","sync","devices","reports"].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
  if (page !== 'camera' && typeof stopCamera === 'function') stopCamera();
  if (page === 'overview' && typeof refreshOverviewMapSize === 'function') requestAnimationFrame(refreshOverviewMapSize);
  document.querySelectorAll('.page').forEach(el => el.classList.toggle('active-page', el.id === page));
  document.querySelectorAll('.nav-link').forEach(el => { el.classList.toggle('active', el.dataset.page === page); if(el.dataset.page === page) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current'); });
  $('#crumb').textContent = {"overview":"Overview","vehicles":"Fleet tracking","drivers":"Drivers","settings":"Settings","trips":"Trips & fuel","camera":"Camera monitoring","road-conditions":"Road conditions","detections":"Driver event review","safety":"Safety alerts","sync":"Offline sync","devices":"Devices & power","reports":"Reports"}[page];
  document.title = `RoadWatch — ${$('#crumb').textContent}`;
  $('#sidebar').classList.remove('open');
}
function eventTable(items) {
  if (!items.length) return '<div class="empty">No detections match your search.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Detection</th><th>Vehicle</th><th>Location</th><th>Date & time</th><th>Confidence</th><th>Status</th><th></th></tr></thead><tbody>${items.map(e => `<tr><td><span class="event-icon">◎</span><strong>${escapeHtml(e.type)}</strong><br><span style="padding-left:40px">#RW-${e.id}</span></td><td><strong>${escapeHtml(e.truck)}</strong></td><td>${escapeHtml(e.location)}</td><td>${escapeHtml(e.date)}<br><span class="muted">${escapeHtml(e.time)}</span></td><td><strong>${e.confidence}%</strong></td><td><span class="badge ${statusClass(e.status)}">${escapeHtml(e.status)}</span></td><td><button class="detail-button" data-event="${e.id}">Details ↗</button></td></tr>`).join('')}</tbody></table></div>`;
}
