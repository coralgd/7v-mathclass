import { auth, db, onAuthStateChanged, doc, onSnapshot } from './firebase.js';
import { enforcePageAccess } from './guards.js';

const allowedBlock = document.getElementById('allowedBlock');
const blockedBlock = document.getElementById('blockedBlock');
const welcome = document.getElementById('welcome');
const checkModBtn = document.getElementById('checkModBtn');
const modStatus = document.getElementById('modStatus');
const goIndexBtn = document.getElementById('goIndexBtn');

let role = 'user';

const showAllowed = (name) => {
  allowedBlock.classList.remove('hidden');
  blockedBlock.classList.add('hidden');
  welcome.textContent = name ? `Добро пожаловать, ${name}` : 'Добро пожаловать';
};

const showBlocked = () => {
  allowedBlock.classList.add('hidden');
  blockedBlock.classList.remove('hidden');
};

const showModStatus = (text, isError = false) => {
  modStatus.textContent = text;
  modStatus.className = `status ${isError ? 'error' : ''}`;
};

const isModerator = (value) => value === 'moderator' || value === 'elder';

goIndexBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});

checkModBtn.addEventListener('click', () => {
  if (!isModerator(role)) {
    showModStatus('У вас нет прав модератора.', true);
    return;
  }

  window.location.href = role === 'elder' ? 'elder.html' : 'moderator.html';
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  const access = await enforcePageAccess(user, {
    requireVerified: true,
    allowedRoles: ['user', 'moderator', 'elder'],
  });

  if (!access.ok) {
    if (access.reason === 'blocked_forever') {
      window.location.href = 'index.html';
      return;
    }
    showBlocked();
    return;
  }

  onSnapshot(doc(db, 'users', user.uid), (snap) => {
    if (!snap.exists()) {
      showBlocked();
      return;
    }

    const data = snap.data();
    role = data.role || 'user';

    if (data.blockedForever) {
      window.location.href = 'index.html';
      return;
    }

    if (data.verified) {
      showAllowed(data.name);
      return;
    }

    showBlocked();
  });
});
