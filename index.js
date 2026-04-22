import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  doc,
  setDoc,
} from './firebase.js';

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const registerBtn = document.getElementById('registerBtn');
const loginBtn = document.getElementById('loginBtn');
const statusEl = document.getElementById('status');

const showStatus = (text, isError = false) => {
  statusEl.textContent = text;
  statusEl.className = `status ${isError ? 'error' : 'success'}`;
};

const getCredentials = () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    showStatus('сначала введи данные', true);
    return null;
  }

  return { email, password };
};

const ensureUserAccountDoc = async (user, email) => {
  const userRef = doc(db, 'users', user.uid);

  await setDoc(
    userRef,
    {
      email,
      verified: false,
      name: null,
      nameSubmitted: false,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
};

const goToNamePage = () => {
  window.location.href = 'name.html';
};

registerBtn.addEventListener('click', async () => {
  const credentials = getCredentials();
  if (!credentials) return;

  try {
    showStatus('Регистрируем...');
    const result = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
    await ensureUserAccountDoc(result.user, credentials.email);
    goToNamePage();
  } catch (error) {
    showStatus(error.message, true);
  }
});

loginBtn.addEventListener('click', async () => {
  const credentials = getCredentials();
  if (!credentials) return;

  try {
    showStatus('Входим...');
    const result = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
    await ensureUserAccountDoc(result.user, credentials.email);
    goToNamePage();
  } catch (error) {
    showStatus(error.message, true);
  }
});
