import { auth, db, onAuthStateChanged, doc, onSnapshot } from './firebase.js';

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

const isModerator = (value) => value === 'moderator' || value === 'senior_moderator';

goIndexBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});

checkModBtn.addEventListener('click', () => {
  if (isModerator(role)) {
    window.location.href = 'moderator.html';
  } else {
    showModStatus('У вас нет прав модератора.', true);
  }
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
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

    if (data.verified) {
      showAllowed(data.name);
      return;
    }

    showBlocked();
  });
});
