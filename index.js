import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
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

const goToNamePage = () => {
  window.location.href = 'name.html';
};

registerBtn.addEventListener('click', async () => {
  const credentials = getCredentials();
  if (!credentials) return;

  try {
    showStatus('Регистрируем...');
    await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
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
    await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
    goToNamePage();
  } catch (error) {
    showStatus(error.message, true);
  }
});
