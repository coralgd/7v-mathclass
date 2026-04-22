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
  showStatus(verified ? 'Имя подтверждено. Перенаправляем...' : 'Имя уже отправлено, статус: не верифицирован.');
};

const ensureUserDoc = async (userRef, userEmail) => {
  const snapshot = await getDoc(userRef);

  if (snapshot.exists()) {
    return snapshot.data();
  }

  const baseData = {
    email: userEmail,
    verified: false,
    name: null,
    nameSubmitted: false,
    createdAt: new Date().toISOString(),
  };

  await setDoc(userRef, baseData, { merge: true });
  return baseData;
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  const userRef = doc(db, 'users', user.uid);

  try {
    const data = await ensureUserDoc(userRef, user.email);

    if (data.verified) {
      window.location.href = 'main.html';
      return;
    }

    if (data.nameSubmitted && data.name) {
      lockSubmittedState(data.name, false);
    }
  } catch (error) {
    showStatus(error.message || 'Не удалось загрузить профиль.', true);
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
      showStatus(error.message || 'Ошибка сохранения.', true);
    }
  });
});
