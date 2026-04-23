import { auth, onAuthStateChanged, signOut } from './firebase.js';
import { checkPageAccess } from './auth-guard.js';

const allowedBlock = document.getElementById('allowedBlock');
const blockedBlock = document.getElementById('blockedBlock');
const welcome = document.getElementById('welcome');
const checkModBtn = document.getElementById('checkModBtn');
const logoutBtn = document.getElementById('logoutBtn');
const modStatus = document.getElementById('modStatus');
const goIndexBtn = document.getElementById('goIndexBtn');

let role = 'user';

const showAllowed = (name) => {
  allowedBlock.classList.remove('hidden');
  blockedBlock.classList.add('hidden');
  welcome.textContent = name ? `Добро пожаловать, ${name}` : 'Добро пожаловать';
};

const showBlocked = (text = 'Нет верификации') => {
  allowedBlock.classList.add('hidden');
  blockedBlock.classList.remove('hidden');
  const blockedText = blockedBlock.querySelector('.status');
  if (blockedText) blockedText.textContent = text;
};

const showModStatus = (text, isError = false) => {
  modStatus.textContent = text;
  modStatus.className = `status ${isError ? 'error' : ''}`;
};

const isModerator = (value) => value === 'moderator' || value === 'elder';

goIndexBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});

logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'index.html';
});

checkModBtn.addEventListener('click', async () => {
  const liveAccess = await checkPageAccess(auth.currentUser, 'main');
  if (!liveAccess.ok) {
    await signOut(auth);
    window.location.href = 'index.html';
    return;
  }

  if (!isModerator(role)) {
    showModStatus('У вас нет прав модератора.', true);
    return;
  }

  window.location.href = role === 'elder' ? 'elder.html' : 'moderator.html';
});

onAuthStateChanged(auth, async (user) => {
  const access = await checkPageAccess(user, 'main');

  if (access.reason === 'ip_unresolved' || access.reason === 'blocked_ip' || access.reason === 'blocked_account') {
    window.location.href = 'index.html';
    return;
  }

  if (access.reason === 'no_auth' || access.reason === 'no_profile') {
    window.location.href = 'index.html';
    return;
  }

  if (access.reason === 'need_verification') {
    showBlocked('Нет верификации');
    return;
  }

  if (!access.ok) {
    showBlocked('Доступ закрыт');
    return;
  }

  role = access.userData.role || 'user';
  showAllowed(access.userData.name);
});
