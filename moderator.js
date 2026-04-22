import {
  auth,
  db,
  onAuthStateChanged,
  doc,
  getDoc,
  collection,
  query,
  onSnapshot,
  updateDoc,
} from './firebase.js';

const modStatus = document.getElementById('modStatus');
const unverifiedList = document.getElementById('unverifiedList');
const verifiedList = document.getElementById('verifiedList');
const unverifiedSection = document.getElementById('unverifiedSection');
const verifiedSection = document.getElementById('verifiedSection');
const tabUnverified = document.getElementById('tabUnverified');
const tabVerified = document.getElementById('tabVerified');
const goMainBtn = document.getElementById('goMainBtn');
const goMainDeniedBtn = document.getElementById('goMainDeniedBtn');
const modPanelBlock = document.getElementById('modPanelBlock');
const modDeniedBlock = document.getElementById('modDeniedBlock');
const modDeniedText = document.getElementById('modDeniedText');

let viewerId = null;

const setStatus = (text, isError = false) => {
  modStatus.textContent = text;
  modStatus.className = `status ${isError ? 'error' : ''}`;
};

const activateTab = (tab) => {
  const showUnverified = tab === 'unverified';
  unverifiedSection.classList.toggle('hidden', !showUnverified);
  verifiedSection.classList.toggle('hidden', showUnverified);
  tabUnverified.classList.toggle('ghost', !showUnverified);
  tabVerified.classList.toggle('ghost', showUnverified);
};

const showDenied = (text) => {
  modPanelBlock.classList.add('hidden');
  modDeniedBlock.classList.remove('hidden');
  modDeniedText.textContent = text;
};

const showPanel = () => {
  modDeniedBlock.classList.add('hidden');
  modPanelBlock.classList.remove('hidden');
};

tabUnverified.addEventListener('click', () => activateTab('unverified'));
tabVerified.addEventListener('click', () => activateTab('verified'));

goMainBtn.addEventListener('click', () => {
  window.location.href = 'main.html';
});

goMainDeniedBtn.addEventListener('click', () => {
  window.location.href = 'main.html';
});

const createItem = (record) => {
  const li = document.createElement('li');
  li.className = 'item item-card';

  const badge = document.createElement('span');
  badge.className = `badge ${record.verified ? 'ok' : 'warn'}`;
  badge.textContent = record.verified ? 'Верифицирован' : 'Ожидает верификацию';

  const email = document.createElement('p');
  email.innerHTML = `<strong>Email:</strong> ${record.email || '—'}`;

  const isSelf = record.id === viewerId;

  const name = document.createElement('p');
  name.innerHTML = `<strong>Имя:</strong> ${record.name || '—'}${isSelf ? ' (Вы)' : ''}`;

  const ip = document.createElement('p');
  ip.innerHTML = `<strong>IP:</strong> ${record.lastIp || record.createdIp || '—'}`;

  const verifyButton = document.createElement('button');
  verifyButton.textContent = record.verified ? 'Снять верификацию' : 'Верифицировать';
  if (record.verified) verifyButton.classList.add('danger');

  verifyButton.addEventListener('click', async () => {
    try {
      await updateDoc(doc(db, 'users', record.id), {
        verified: !record.verified,
        verifiedAt: !record.verified ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      });
      setStatus(!record.verified ? 'Пользователь верифицирован.' : 'Верификация снята.');
    } catch (error) {
      setStatus(error.code === 'permission-denied' ? 'Нет прав на изменение верификации.' : error.message, true);
    }
  });

  li.append(badge, email, name, ip, verifyButton);
  return li;
};

const fillList = (target, items) => {
  target.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'item item-card';
    empty.textContent = 'Список пуст.';
    target.append(empty);
    return;
  }

  items.forEach((item) => target.append(createItem(item)));
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  try {
    viewerId = user.uid;
    const meSnap = await getDoc(doc(db, 'users', user.uid));
    if (!meSnap.exists()) {
      showDenied('Профиль не найден.');
      return;
    }

    const role = meSnap.data().role || 'user';
    if (role !== 'moderator') {
      showDenied(`Нет доступа. Ваша роль: ${role}.`);
      return;
    }

    showPanel();
    activateTab('unverified');
    setStatus('Роль подтверждена: moderator.');

    const q = query(collection(db, 'users'));
    onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        fillList(
          unverifiedList,
          records.filter((r) => !r.verified),
        );
        fillList(
          verifiedList,
          records.filter((r) => r.verified),
        );
      },
      (error) => {
        setStatus(error.code === 'permission-denied' ? 'Missing or insufficient permissions.' : error.message, true);
      },
    );
  } catch (error) {
    showDenied(error.message || 'Ошибка доступа к панели.');
  }
});
