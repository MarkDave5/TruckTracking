// Firebase Authentication only. Analytics is not loaded.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import {
  getAuth, setPersistence, inMemoryPersistence, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup,
  sendEmailVerification, sendPasswordResetEmail, updateProfile, reload, signOut
} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';

const response = await fetch('/api/auth/config', { cache: 'no-store' });
if (!response.ok) throw new Error('Cannot load authentication configuration.');
export const auth = getAuth(initializeApp(await response.json()));
// Tokens are only needed to establish a short-lived C# HttpOnly session.
await setPersistence(auth, inMemoryPersistence);
export { createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider,
  signInWithPopup, sendEmailVerification, sendPasswordResetEmail, updateProfile, reload, signOut };
