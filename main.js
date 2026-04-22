import { auth, db, onAuthStateChanged, doc, getDoc } from './firebase.js';

const verifiedSection = document.getElementById('verifiedSection');
const blockedSection = document.getElementById('blockedSection');
const welcomeText = document.getElementById('welcomeText');
const goIndexBtn = document.getElementById('goIndexBtn');

goIndexBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});

const showVerified = (name) => {
  verifiedSection.classList.remove('hidden');
  blockedSection.classList.add('hidden');
  welcomeText.textContent = name ? `Добро пожаловать, ${name}!` : 'Добро пожаловать!';
};

const showBlocked = () => {
  verifiedSection.classList.add('hidden');
  blockedSection.classList.remove('hidden');
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showBlocked();
    return;
  }

  try {
    const userRef = doc(db, 'users', user.uid);
    const snapshot = await getDoc(userRef);

    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data.verified) {
        showVerified(data.name);
        return;
      }
    }

    showBlocked();
  } catch (error) {
    console.error(error);
    showBlocked();
  }
});
