const mode = document.body.dataset.mode;
const form = document.getElementById('auth-form');
const errorBox = document.getElementById('auth-error');
const statusBox = document.getElementById('auth-status');
let firebase;
let resendUntil = 0;
const controls = () => document.querySelectorAll('#submit-auth, #google-auth, #resend-verification, #check-verification');
function busy(value) { controls().forEach(button => button.disabled = value); }
function message(text, error = false) {
 errorBox.hidden = true; statusBox.hidden = true;
 const box = error ? errorBox : statusBox; box.textContent = text; box.hidden = false;
}
function friendly(error) {
 const messages = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'Unable to create this account. Try signing in or resetting your password.',
  'auth/weak-password': 'Use a stronger password that meets the project password policy.',
  'auth/password-does-not-meet-requirements': 'Your password does not meet the project password policy.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase. Enable Email/Password and Google in Authentication → Sign-in method.',
  'auth/unauthorized-domain': 'This address is not authorized for Google sign-in. Add this hostname to Firebase Authentication → Settings → Authorized domains.',
  'auth/popup-blocked': 'The browser blocked Google sign-in. Allow popups for this site and try again.',
  'auth/popup-closed-by-user': 'Google sign-in was closed. You can try again.',
  'auth/cancelled-popup-request': 'A sign-in window is already open. Complete it or try again.',
  'auth/network-request-failed': 'Could not reach Firebase. Check your internet connection.',
  'auth/too-many-requests': 'Too many attempts. Please wait before trying again.',
  'auth/user-disabled': 'This account is disabled. Contact your project administrator.',
  'auth/account-exists-with-different-credential': 'An account already uses this email. Sign in using its original method.',
  'auth/invalid-api-key': 'The Firebase web configuration could not be validated.',
  'auth/configuration-not-found': 'Enable Authentication in the Firebase console first.'
 };
 return messages[error.code] || (error.code ? 'Authentication could not be completed. Please try again.' : error.message);
}
async function establishSession(user) {
 await firebase.reload(user);
 if (!user.emailVerified) { showVerification(); return; }
 const idToken = await user.getIdToken(true);
 const tokenResponse = await fetch('/api/auth/token', { cache: 'no-store' });
 if (!tokenResponse.ok) throw new Error('Could not start a server session. Try again.');
 const { token } = await tokenResponse.json();
 const result = await fetch('/api/auth/session', { method:'POST', headers:{Authorization:`Bearer ${idToken}`, 'X-CSRF-TOKEN':token} });
 if (!result.ok) throw new Error(result.status === 429 ? 'Too many sign-in attempts. Please wait one minute.' : 'The server could not verify your Firebase account. Check your verification status and try again.');
 await firebase.signOut(firebase.auth);
 location.replace('/#overview');
}
function showVerification() {
 document.getElementById('verification-panel').hidden = false;
 message('Verify your email before entering the dashboard. Open the email link, then return here and select “I verified my email”.');
}
async function sendVerification() {
 const user = firebase.auth.currentUser;
 if (!user) throw new Error('Sign in again to request a verification email.');
 if (Date.now() < resendUntil) throw new Error('Please wait one minute before requesting another email.');
 await firebase.sendEmailVerification(user);
 resendUntil = Date.now() + 60000;
 message('Verification email sent. Check your inbox and spam folder, then return here to continue.');
}
document.getElementById('toggle-password')?.addEventListener('click', event => {
 const input = document.getElementById('password'); const show = input.type === 'password';
 input.type = show ? 'text' : 'password'; event.currentTarget.textContent = show ? 'Hide' : 'Show';
 event.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});
form.addEventListener('submit', async event => {
 event.preventDefault(); if (!firebase) return;
 busy(true); errorBox.hidden = true; statusBox.hidden = true;
 try {
  const email = document.getElementById('email').value.trim();
  if (mode === 'reset') {
   await firebase.sendPasswordResetEmail(firebase.auth, email);
   message('If this email is eligible for password reset, a reset link will arrive shortly. Check your inbox and spam folder.');
   return;
  }
  const password = document.getElementById('password').value;
  if (mode === 'register') {
   if (password !== document.getElementById('confirm').value) throw new Error('Passwords do not match.');
   const { user } = await firebase.createUserWithEmailAndPassword(firebase.auth, email, password);
   showVerification();
   try { await firebase.updateProfile(user, { displayName:document.getElementById('name').value.trim() }); }
   catch { /* The account exists even if the optional display name update failed. */ }
   await sendVerification();
  } else {
   const { user } = await firebase.signInWithEmailAndPassword(firebase.auth, email, password);
   await establishSession(user);
  }
 } catch (error) {
  if (mode === 'reset' && error.code === 'auth/user-not-found') message('If this email is eligible for password reset, a reset link will arrive shortly.');
  else message(friendly(error), true);
 } finally { busy(false); }
});
document.getElementById('google-auth')?.addEventListener('click', async () => {
 if (!firebase) return;
 busy(true);
 try {
  const provider = new firebase.GoogleAuthProvider(); provider.setCustomParameters({prompt:'select_account'});
  const { user } = await firebase.signInWithPopup(firebase.auth, provider);
  await establishSession(user);
 } catch(error) { message(friendly(error), true); } finally { busy(false); }
});
document.getElementById('resend-verification')?.addEventListener('click', async () => {
 busy(true); try { await sendVerification(); } catch(error) { message(friendly(error),true); } finally { busy(false); }
});
document.getElementById('check-verification')?.addEventListener('click', async () => {
 busy(true);
 try { if(!firebase.auth.currentUser) throw new Error('Sign in again to check email verification.'); await establishSession(firebase.auth.currentUser); }
 catch(error) { message(friendly(error),true); } finally { busy(false); }
});
busy(true);
import('/js/firebase-client.js').then(module => { firebase = module; busy(false); }).catch(() => {
 message('Unable to load Firebase Authentication. Check your connection, then refresh this page.', true);
});
