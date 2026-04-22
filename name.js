import {
  auth,
  db,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from './firebase.js';

const nameInput = document.getElementById('name');
const submitBtn = document.getElementById('submitNameBtn');
const statusEl = document.getElementById('status');

let isSubmitted = false;

const showStatus = (text, isError = false) => {
  statusEl.textContent = text;
  statusEl.className = `status ${isError ? 'error' : 'success'}`;
};

const lockSubmittedState = (name) => {
  isSubmitted = true;
  nameInput.value = name || 'Имя отправлено';
  nameInput.disabled = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Отправлено, жди верификации';
  showStatus('Отправка уже выполнена. Ожидай верификацию.');
};

const unlockForm = () => {
  isSubmitted = false;
  nameInput.disabled = false;
  submitBtn.disabled = false;
  submitBtn.textContent = 'Отправить';
};

const ensureUserDoc = async (userRef, userEmail) => {
  const snapshot = await getDoc(userRef);
  if (snapshot.exists()) return;

  await setDoc(
    userRef,
    {
      email: userEmail,
      verified: false,
      role: 'user',
      name: null,
      nameSubmitted: false,
      createdAt: new Date().toISOString(),
    },
    { merge: true },
  );
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  const userRef = doc(db, 'users', user.uid);

  try {
    await ensureUserDoc(userRef, user.email);
  } catch (error) {
    showStatus(error.message || 'Не удалось загрузить профиль.', true);
  }

  onSnapshot(
    userRef,
    (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();

      if (data.verified) {
        window.location.href = 'main.html';
        return;
      }

      if (data.nameSubmitted || data.name) {
        lockSubmittedState(data.name);
      } else {
        unlockForm();
      }
    },
    (error) => {
      showStatus(error.message || 'Ошибка синхронизации профиля.', true);
    },
  );

  submitBtn.addEventListener('click', async () => {
    if (isSubmitted) return;

    const name = nameInput.value.trim();
    if (!name) {
      showStatus('Введи имя перед отправкой.', true);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправляем...';

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
    } catch (error) {
      showStatus(error.message || 'Ошибка сохранения.', true);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Отправить';
    }
  });
});
