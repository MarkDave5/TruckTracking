let editingDriverId = null;
function renderDrivers() {
  const drivers = state.drivers || [];
  $('#nav-drivers').textContent = drivers.length;
  $('#driver-table').innerHTML = drivers.length ? `<div class="table-wrap"><table><thead><tr><th>Driver</th><th>Current trip assignment</th><th>Action</th></tr></thead><tbody>${drivers.map(driver => {
    const assignments = (state.assignments || []).filter(a => a.driver === driver.name);
    const labels = assignments.map(a => { const truck = state.trucks.find(t => t.id === a.truckId); return truck ? `${truck.plate} · ${a.status} (owner-set)` : ''; }).filter(Boolean);
    return `<tr><td><strong>${escapeHtml(driver.name)}</strong></td><td><span class="driver-assignments">${labels.length ? labels.map(escapeHtml).join('<br>') : 'No current assignment'}</span></td><td><button type="button" class="detail-button" data-edit-driver="${escapeHtml(driver.id)}">Edit</button> <button type="button" class="detail-button" data-remove-driver="${escapeHtml(driver.id)}">Remove</button></td></tr>`;
  }).join('')}</tbody></table></div>` : '<div class="empty">No drivers registered yet. Select + Add driver to get started.</div>';
  ['#assignment-driver','#road-review-driver','#auto-capture-driver'].forEach(selector => syncDriverSelect($(selector), selector === '#assignment-driver'));
}
function syncDriverSelect(selector, keepPrevious) {
  const names = (state.drivers || []).map(driver => driver.name);
  const previous = selector.value;
  const existing = Array.from(selector.options).slice(1).filter(option => !option.dataset.legacy).map(option => option.value);
  if (names.length !== existing.length || names.some((name,i) => name !== existing[i])) {
    selector.options.length = 1;
    names.forEach(name => selector.add(new Option(name,name)));
    if (previous && !names.includes(previous) && keepPrevious) { const option = new Option(`${previous} · previous record`,previous); option.dataset.legacy='true'; selector.add(option); }
    selector.value = names.includes(previous) || (keepPrevious && previous) ? previous : '';
  }
}
function setAssignmentDriver(name) {
  const selector = $('#assignment-driver');
  Array.from(selector.options).filter(option => option.dataset.legacy).forEach(option => option.remove());
  if (name && !(state.drivers || []).some(driver => driver.name === name)) { const option = new Option(`${name} · previous record`,name); option.dataset.legacy='true'; selector.add(option); }
  selector.value = name || '';
}
function openDriverForm(id = null) {
  const driver = id ? (state.drivers || []).find(item => item.id === id) : null;
  if (id && !driver) return;
  editingDriverId = driver?.id || null; $('#driver-form').reset(); $('#driver-name').value = driver?.name || '';
  $('#driver-message').textContent = ''; $('#driver-dialog-title').textContent = driver ? 'Edit driver' : 'Add driver'; $('#driver-dialog').showModal();
}
async function saveDriver(event) {
  event.preventDefault(); const name = $('#driver-name').value.trim(), message = $('#driver-message'), button = $('#driver-save');
  if (!name) { message.textContent = 'Enter the driver name.'; return; }
  button.disabled = true; message.textContent = 'Saving…';
  try {
    const response = await authenticatedMutation(editingDriverId ? `/api/drivers/${encodeURIComponent(editingDriverId)}` : '/api/drivers', editingDriverId ? 'PUT' : 'POST', {name});
    if (!response.ok) { let data={}; try { data=await response.json(); } catch {} throw new Error(data.error || 'Could not save driver. Restart the app and try again.'); }
    const saved=await response.json(); state.drivers = (state.drivers || []).filter(d=>d.id!==saved.id); state.drivers.push(saved); state.drivers.sort((a,b)=>a.name.localeCompare(b.name));
    render(); $('#driver-dialog').close(); const toast=$('#toast'); toast.textContent='Driver saved.'; toast.classList.add('visible'); setTimeout(()=>toast.classList.remove('visible'),3500);
  } catch(error) { message.textContent=error.message || 'Could not save driver.'; } finally { button.disabled=false; }
}
async function removeDriver(id, button) {
  const driver=(state.drivers||[]).find(d=>d.id===id); if(!driver || !window.confirm(`Remove ${driver.name} from the driver list? Existing trips and reviews will keep the saved name.`))return;
  button.disabled=true;
  try { const response=await authenticatedMutation(`/api/drivers/${encodeURIComponent(id)}`,'DELETE'); if(!response.ok)throw new Error(); state.drivers=state.drivers.filter(d=>d.id!==id); render(); const toast=$('#toast'); toast.textContent='Driver removed from the list.'; toast.classList.add('visible'); setTimeout(()=>toast.classList.remove('visible'),3500); }
  catch { button.disabled=false; const toast=$('#toast'); toast.textContent='Could not remove driver. Please try again.'; toast.classList.add('visible'); setTimeout(()=>toast.classList.remove('visible'),3500); }
}
