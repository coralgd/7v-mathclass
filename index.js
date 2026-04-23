import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  doc,
  setDoc,
  collection,
} from './firebase.js';
import { checkPageAccess, getClientIp, redirectByRole } from './auth-guard.js';

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

const routeAfterLogin = (userData) => {
  if (!userData?.verified) return 'name.html';
  return redirectByRole(userData.role || 'user');
};

const validateAccessAfterLogin = async (user) => {
  const access = await checkPageAccess(user, 'index');

  if (access.reason === 'ip_unresolved' || access.reason === 'blocked_ip' || access.reason === 'blocked_account') {
    await createAuditRecord(access.reason === 'blocked_account' ? 'login_blocked_forever_account' : 'login_blocked_forever_ip', {
      actorId: user.uid,
      actorEmail: user.email || null,
      targetId: user.uid,
      targetEmail: user.email || null,
      targetIp: access.ip,
    });
    await signOut(auth);
    lockForever();
    return null;
  }

  if (!access.ok) return null;

  return access.userData;
};

const authFlow = async (action, progressText, isRegistration) => {
  if (accessLockedForever) return;

  const creds = getCredentials();
  if (!creds) return;

  const preAccess = await checkPageAccess(null, 'index');
  if (preAccess.reason === 'blocked_ip' || preAccess.reason === 'ip_unresolved') {
    lockForever();
    return;
  }

  try {
    showStatus(progressText);
    const result = await action(auth, creds.email, creds.password);
    await ensureUserDoc(result.user, creds.email, clientIp, isRegistration);

    const userData = await validateAccessAfterLogin(result.user);
    if (!userData) return;

    await createAuditRecord(isRegistration ? 'register_success' : 'login_success', {
      actorId: result.user.uid,
      actorEmail: creds.email,
      targetId: result.user.uid,
      targetEmail: creds.email,
      targetIp: clientIp,
    });

    window.location.href = routeAfterLogin(userData);
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

  const guestAccess = await checkPageAccess(null, 'index');
  if (guestAccess.reason === 'blocked_ip' || guestAccess.reason === 'ip_unresolved') {
    await createAuditRecord('visit_blocked_forever_ip', {
      targetIp: clientIp,
      details: 'blocked on site open',
    });
    lockForever();
    return;
  }

  // На странице входа не делаем автоматический редирект без явного действия по кнопке.

  registerBtn.addEventListener('click', () => authFlow(createUserWithEmailAndPassword, 'Регистрируем...', true));
  loginBtn.addEventListener('click', () => authFlow(signInWithEmailAndPassword, 'Входим...', false));
};

boot();
