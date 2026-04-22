import { auth, db, onAuthStateChanged, doc, onSnapshot } from './firebase.js';

const verifiedSection = document.getElementById('verifiedSection');
const blockedSection = document.getElementById('blockedSection');
const welcomeText = document.getElementById('welcomeText');
const goIndexBtn = document.getElementById('goIndexBtn');
const checkModeratorBtn = document.getElementById('checkModeratorBtn');
const goModeratorBtn = document.getElementById('goModeratorBtn');
const moderatorStatus = document.getElementById('moderatorStatus');

let currentRole = 'user';

const showVerified = (name) => {
  verifiedSection.classList.remove('hidden');
  blockedSection.classList.add('hidden');
  welcomeText.textContent = name ? `Добро пожаловать, ${name}!` : 'Добро пожаловать!';
};

const showBlocked = () => {
  verifiedSection.classList.add('hidden');
  blockedSection.classList.remove('hidden');
};

const hasModeratorRights = (role) => role === 'moderator' || role === 'senior_moderator';

const setModeratorStatus = (text, isError = false) => {
  moderatorStatus.textContent = text;
  moderatorStatus.className = `status ${isError ? 'error' : 'success'}`;
};

goIndexBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});

checkModeratorBtn.addEventListener('click', () => {
  if (hasModeratorRights(currentRole)) {
    goModeratorBtn.classList.remove('hidden');
    setModeratorStatus('Права подтверждены. Можно перейти на страницу модератора.');
  } else {
    goModeratorBtn.classList.add('hidden');
    setModeratorStatus('У вас нет прав модератора.', true);
  }
});

goModeratorBtn.addEventListener('click', () => {
  window.location.href = 'moderator.html';
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showBlocked();
    return;
  }

  const userRef = doc(db, 'users', user.uid);

  onSnapshot(
    userRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        showBlocked();
        return;
      }

      const data = snapshot.data();
      currentRole = data.role || 'user';

      if (data.verified) {
        showVerified(data.name);
        return;
      }

      showBlocked();
    },
    () => showBlocked(),
  );
});
