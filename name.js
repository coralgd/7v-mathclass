import { auth, db, onAuthStateChanged, doc, getDoc, setDoc, onSnapshot } from './firebase.js';
import { checkPageAccess } from './auth-guard.js';

const nameInput = document.getElementById('name');
const submitBtn = document.getElementById('submitNameBtn');
const statusEl = document.getElementById('status');

let locked = false;

const showStatus = (text, isError = false) => {
  statusEl.textContent = text;
  statusEl.className = `status ${isError ? 'error' : ''}`;
};

const lockForm = (name) => {
  locked = true;
  nameInput.value = name || 'Имя отправлено';
  nameInput.disabled = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Отправлено, жди верификации';
  showStatus('Заявка уже отправлена.');
};

const unlockForm = () => {
  locked = false;
  nameInput.disabled = false;
  submitBtn.disabled = false;
  submitBtn.textContent = 'Отправить';
};

const ensureUserDoc = async (userRef, email) => {
  const snap = await getDoc(userRef);
  if (snap.exists()) return;

  await setDoc(
    userRef,
    {
      email,
      role: 'user',
      verified: false,
      name: null,
      nameSubmitted: false,
      createdAt: new Date().toISOString(),
    },
    { merge: true },
  );
};

onAuthStateChanged(auth, async (user) => {
  const access = await checkPageAccess(user, { allowUnverifiedOnly: true });

  if (access.reason === 'blocked_ip' || access.reason === 'blocked_account') {
    window.location.href = 'index.html';
    return;
  }

  if (access.reason === 'no_auth' || access.reason === 'no_profile') {
    window.location.href = 'index.html';
    return;
  }

  if (access.reason === 'already_verified') {
    window.location.href = 'main.html';
    return;
  }

  if (!access.ok) {
    window.location.href = 'index.html';
    return;
  }

  const userRef = doc(db, 'users', user.uid);
  await ensureUserDoc(userRef, user.email);

  onSnapshot(userRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();

    if (data.verified) {
      window.location.href = 'main.html';
      return;
    }

    if (data.nameSubmitted || data.name) {
      lockForm(data.name);
    } else {
      unlockForm();
    }
  });

  submitBtn.addEventListener('click', async () => {
    if (locked) return;

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
          verified: false,
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    } catch (error) {
      showStatus(error.message || 'Ошибка сохранения', true);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Отправить';
    }
  });
});
