import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  doc,
  getDoc,
  setDoc,
  collection,
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

const createAuditRecord = async (action, payload = {}) => {
  try {
    const ref = doc(collection(db, 'audit_logs'));
    await setDoc(ref, {
      action,
      actorId: payload.actorId || null,
      actorEmail: payload.actorEmail || null,
      targetId: payload.targetId || null,
      targetEmail: payload.targetEmail || null,
      targetIp: payload.targetIp || clientIp,
      details: payload.details || null,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Логирование не должно ломать вход/регистрацию.
  }
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
  try {
    const snap = await getDoc(doc(db, 'blocked_ips', ip));
    return snap.exists() && snap.data().blocked === true;
  } catch {
    return false;
  }
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
    await createAuditRecord('login_blocked_forever_account', {
      actorId: snap.id,
      actorEmail: data.email,
      targetId: snap.id,
      targetEmail: data.email,
      targetIp: data.lastIp || clientIp,
    });
    await signOut(auth);
    lockForever();
    return true;
  }

  if (await isIpBlocked(data.lastIp || clientIp)) {
    await createAuditRecord('login_blocked_forever_ip', {
      actorId: snap.id,
      actorEmail: data.email,
      targetId: snap.id,
      targetEmail: data.email,
      targetIp: data.lastIp || clientIp,
    });
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

    await createAuditRecord(isRegistration ? 'register_success' : 'login_success', {
      actorId: result.user.uid,
      actorEmail: creds.email,
      targetId: result.user.uid,
      targetEmail: creds.email,
      targetIp: clientIp,
    });

    window.location.href = await nextPage(userRef);
  } catch (error) {
    await createAuditRecord(isRegistration ? 'register_failed' : 'login_failed', {
      actorEmail: creds.email,
      targetEmail: creds.email,
      targetIp: clientIp,
      details: error.message || 'auth error',
    });
    showStatus(error.message || 'Ошибка входа', true);
  }
};

const boot = async () => {
  clientIp = await getClientIp();
  if (await isIpBlocked(clientIp)) {
    await createAuditRecord('visit_blocked_forever_ip', {
      targetIp: clientIp,
      details: 'blocked on site open',
    });
    lockForever();
    return;
  }

  registerBtn.addEventListener('click', () => authFlow(createUserWithEmailAndPassword, 'Регистрируем...', true));
  loginBtn.addEventListener('click', () => authFlow(signInWithEmailAndPassword, 'Входим...', false));
};

boot();
