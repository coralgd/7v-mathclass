import {
  auth,
  db,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
} from './firebase.js';

const nameInput = document.getElementById('name');
const submitBtn = document.getElementById('submitNameBtn');
const statusEl = document.getElementById('status');

const showStatus = (text, isError = false) => {
  statusEl.textContent = text;
  statusEl.className = `status ${isError ? 'error' : 'success'}`;
};

const lockSubmittedState = (name) => {
  nameInput.value = name;
  nameInput.disabled = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Отправлено, жди верификации';
  showStatus('Имя уже отправлено.');
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);

  if (snapshot.exists() && snapshot.data().name) {
    lockSubmittedState(snapshot.data().name);
  }

  submitBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();

    if (!name) {
      showStatus('Введи имя перед отправкой.', true);
      return;
    }

    try {
      await setDoc(
        userRef,
        {
          email: user.email,
          name,
          createdAt: new Date().toISOString(),
          verified: false,
        },
        { merge: true },
      );
      lockSubmittedState(name);
    } catch (error) {
      showStatus(error.message, true);
    }
  });
});
