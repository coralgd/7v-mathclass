import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  doc,
  getDoc,
  setDoc,
} from './firebase.js';

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const registerBtn = document.getElementById('registerBtn');
const loginBtn = document.getElementById('loginBtn');
const statusEl = document.getElementById('status');

const showStatus = (text, isError = false) => {
  statusEl.textContent = text;
  statusEl.className = `status ${isError ? 'error' : ''}`;
};

const getCredentials = () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) {
    showStatus('сначала введи данные', true);
    return null;
  }
  return { email, password };
};

const ensureUserDoc = async (user, email) => {
  const ref = doc(db, 'users', user.uid);
  await setDoc(
    ref,
    {
      email,
      role: 'user',
      name: null,
      nameSubmitted: false,
      verified: false,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  return ref;
};

const nextPage = async (userRef) => {
  const snap = await getDoc(userRef);
  if (!snap.exists()) return 'name.html';
  return snap.data().verified ? 'main.html' : 'name.html';
};

const authFlow = async (action, progressText) => {
  const creds = getCredentials();
  if (!creds) return;

  try {
    showStatus(progressText);
    const result = await action(auth, creds.email, creds.password);
    const userRef = await ensureUserDoc(result.user, creds.email);
    window.location.href = await nextPage(userRef);
  } catch (error) {
    showStatus(error.message || 'Ошибка входа', true);
  }
};

registerBtn.addEventListener('click', () => authFlow(createUserWithEmailAndPassword, 'Регистрируем...'));
loginBtn.addEventListener('click', () => authFlow(signInWithEmailAndPassword, 'Входим...'));
