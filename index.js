import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  doc,
  getDoc,
  setDoc,
} from './firebase.js';

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const registerBtn = document.getElementById('registerBtn');
const loginBtn = document.getElementById('loginBtn');
const statusEl = document.getElementById('status');

const routes = {
  index: 'index.html',
  name: 'name.html',
  main: 'main.html',
};

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

const upsertUserDoc = async (user, email) => {
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

  return userRef;
};

const getNextPage = async (userRef) => {
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) return routes.name;

  return snapshot.data().verified ? routes.main : routes.name;
};

const handleAuth = async (authAction, progressText) => {
  const credentials = getCredentials();
  if (!credentials) return;

  try {
    showStatus(progressText);
    const result = await authAction(auth, credentials.email, credentials.password);
    const userRef = await upsertUserDoc(result.user, credentials.email);
    const nextPage = await getNextPage(userRef);
    window.location.href = nextPage;
  } catch (error) {
    showStatus(error.message || 'Ошибка авторизации', true);
  }
};

registerBtn.addEventListener('click', () => handleAuth(createUserWithEmailAndPassword, 'Регистрируем...'));
loginBtn.addEventListener('click', () => handleAuth(signInWithEmailAndPassword, 'Входим...'));
