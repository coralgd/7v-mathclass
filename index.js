import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  doc,
  getDoc,
  setDoc,
} from './firebase.js';

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const registerBtn = document.getElementById('registerBtn');
const loginBtn = document.getElementById('loginBtn');
const statusEl = document.getElementById('status');
const authPanel = document.getElementById('authPanel');
const foreverPanel = document.getElementById('foreverPanel');

let clientIp = 'unknown';
let accessLockedForever = false;

const showStatus = (text, isError = false) => {
  statusEl.textContent = text;
  statusEl.className = `status ${isError ? 'error' : ''}`;
};

const lockForever = () => {
  accessLockedForever = true;
  authPanel.classList.add('hidden');
  foreverPanel.classList.remove('hidden');
};

const getClientIp = async () => {
  try {
    const resp = await fetch('https://api.ipify.org?format=json');
    const data = await resp.json();
    return data.ip || 'unknown';
  } catch {
    return 'unknown';
  }
};

const isIpBlocked = async (ip) => {
  if (!ip || ip === 'unknown') return false;
  const snap = await getDoc(doc(db, 'blocked_ips', ip));
  return snap.exists() && snap.data().blocked === true;
};

const getCredentials = () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) {
    showStatus('Сначала введи данные.', true);
    return null;
  }
  return { email, password };
};

const ensureUserDoc = async (user, email, ip, isRegistration) => {
  const ref = doc(db, 'users', user.uid);
  const update = {
    email,
    role: 'user',
    name: null,
    nameSubmitted: false,
    verified: false,
    blockedForever: false,
    lastIp: ip,
    updatedAt: new Date().toISOString(),
  };

  if (isRegistration) {
    update.createdIp = ip;
    update.createdAt = new Date().toISOString();
  }

  await setDoc(ref, update, { merge: true });
  return ref;
};

const nextPage = async (userRef) => {
  const snap = await getDoc(userRef);
  if (!snap.exists()) return 'name.html';
  return snap.data().verified ? 'main.html' : 'name.html';
};

const validateBanAfterLogin = async (userRef) => {
  const snap = await getDoc(userRef);
  if (!snap.exists()) return false;

  const data = snap.data();
  if (data.blockedForever) {
    await signOut(auth);
    lockForever();
    return true;
  }

  if (await isIpBlocked(data.lastIp || clientIp)) {
    await signOut(auth);
    lockForever();
    return true;
  }

  return false;
};

const authFlow = async (action, progressText, isRegistration) => {
  if (accessLockedForever) return;

  const creds = getCredentials();
  if (!creds) return;

  try {
    showStatus(progressText);
    const result = await action(auth, creds.email, creds.password);
    const userRef = await ensureUserDoc(result.user, creds.email, clientIp, isRegistration);

    if (await validateBanAfterLogin(userRef)) return;

    window.location.href = await nextPage(userRef);
  } catch (error) {
    showStatus(error.message || 'Ошибка входа', true);
  }
};

const boot = async () => {
  clientIp = await getClientIp();
  if (await isIpBlocked(clientIp)) {
    lockForever();
    return;
  }

  registerBtn.addEventListener('click', () => authFlow(createUserWithEmailAndPassword, 'Регистрируем...', true));
  loginBtn.addEventListener('click', () => authFlow(signInWithEmailAndPassword, 'Входим...', false));
};

boot();
