async function loadAccount() {
 const response = await fetch('/api/auth/me', { cache:'no-store' });
 if(response.status === 401) { location.replace('/login.html'); return; }
 if(!response.ok) throw new Error('Unable to load account.');
 const account = await response.json();
 showAccountName(account.name || account.email || 'Account');
 $('#display-name').value = account.name || ''; $('#settings-email').textContent = account.email || 'Unavailable';
}
function showAccountName(name) {
 document.querySelectorAll('[data-account-name]').forEach(el => el.textContent = name);
 const initials = name.split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase();
 document.querySelectorAll('.avatar').forEach(el => el.textContent = initials);
}
async function saveDisplayName(event) {
 event.preventDefault(); const button=$('#display-name-save'), message=$('#display-name-message'), name=$('#display-name').value.trim();
 if(!name) { message.textContent='Enter a display name.'; return; }
 button.disabled=true; message.textContent='Saving…';
 try { const response=await authenticatedMutation('/api/account/display-name','PUT',{name}); if(!response.ok){let body={};try{body=await response.json();}catch{}throw new Error(body.error || 'Could not save display name.');} const saved=await response.json(); showAccountName(saved.name); $('#display-name').value=saved.name; message.textContent='Display name saved.'; }
 catch(error) { message.textContent=error.message || 'Could not save display name.'; } finally { button.disabled=false; }
}
async function authenticatedMutation(url, method, body) {
 const tokenResponse = await fetch('/api/auth/token',{ cache:'no-store' });
 if(!tokenResponse.ok) throw new Error('Unable to refresh session.');
 const { token } = await tokenResponse.json();
 const headers = {'X-CSRF-TOKEN':token};
 if (body !== undefined) headers['Content-Type'] = 'application/json';
 const response = await fetch(url, { method, headers, ...(body !== undefined ? {body:JSON.stringify(body)} : {}) });
 if(response.status === 401) { location.replace('/login.html'); throw new Error('Session expired'); }
 return response;
}
async function logout() {
 const button = document.getElementById('logout'); button.disabled = true;
 try { const response = await authenticatedMutation('/api/auth/logout','POST'); if(!response.ok) throw new Error(); location.replace('/login.html'); }
 catch { button.disabled = false; document.getElementById('toast').textContent = 'Could not sign out. Please try again.'; document.getElementById('toast').classList.add('visible'); }
}
