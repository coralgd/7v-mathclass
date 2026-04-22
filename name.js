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

const lockSubmittedState = (name, verified = false) => {
  nameInput.value = name;
  nameInput.disabled = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Отправлено, жди верификации';
  showStatus(verified ? 'Имя подтверждено.' : 'Имя уже отправлено, статус: не верифицирован.');
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);

  if (snapshot.exists()) {
    const data = snapshot.data();
    if (data.nameSubmitted && data.name) {
      lockSubmittedState(data.name, Boolean(data.verified));
    }
  } else {
    await setDoc(
      userRef,
      {
        email: user.email,
        verified: false,
        name: null,
        nameSubmitted: false,
        createdAt: new Date().toISOString(),
      },
      { merge: true },
    );
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
          nameSubmitted: true,
          submittedAt: new Date().toISOString(),
          verified: false,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      lockSubmittedState(name, false);
    } catch (error) {
      showStatus(error.message, true);
    }
  });
});
