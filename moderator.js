import {
  auth,
  db,
  onAuthStateChanged,
  doc,
  setDoc,
  collection,
  query,
  onSnapshot,
  updateDoc,
} from './firebase.js';
import { enforcePageAccess } from './guards.js';

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
const playerModal = document.getElementById('playerModal');
const playerModalBody = document.getElementById('playerModalBody');
const closePlayerModalBtn = document.getElementById('closePlayerModalBtn');

let viewerId = null;
let viewerEmail = null;

const setStatus = (text, isError = false) => {
  modStatus.textContent = text;
  modStatus.className = `status ${isError ? 'error' : ''}`;
};

const createAuditRecord = async (action, target = {}) => {
  if (!viewerId) return;
  const logRef = doc(collection(db, 'audit_logs'));
  await setDoc(logRef, {
    action,
    actorId: viewerId,
    actorEmail: viewerEmail || null,
    targetId: target.id || null,
    targetEmail: target.email || null,
    targetIp: target.ip || null,
    details: target.details || null,
    createdAt: new Date().toISOString(),
  });
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

const closeModal = () => {
  playerModal.classList.add('hidden');
};

const openPlayerModal = (record) => {
  playerModalBody.innerHTML = '';

  const name = document.createElement('p');
  name.innerHTML = `<strong>Имя:</strong> ${record.name || '—'}`;

  const email = document.createElement('p');
  email.innerHTML = `<strong>Email:</strong> ${record.email || '—'}`;

  const role = document.createElement('p');
  role.innerHTML = `<strong>Роль:</strong> ${record.role || 'user'}`;

  const verified = document.createElement('p');
  verified.innerHTML = `<strong>Верификация:</strong> ${record.verified ? 'да' : 'нет'}`;

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
      await createAuditRecord(record.verified ? 'unverify_user' : 'verify_user', {
        id: record.id,
        email: record.email,
        ip: record.lastIp || record.createdIp || null,
      });
      setStatus(!record.verified ? 'Пользователь верифицирован.' : 'Верификация снята.');
      closeModal();
    } catch (error) {
      setStatus(error.code === 'permission-denied' ? 'Нет прав на изменение верификации.' : error.message, true);
    }
  });

  playerModalBody.append(name, email, role, verified, ip, verifyButton);
  playerModal.classList.remove('hidden');
};

const createItem = (record) => {
  const li = document.createElement('li');
  li.className = 'item item-card clickable';
  li.tabIndex = 0;

  const name = document.createElement('p');
  name.innerHTML = `<strong>${record.name || record.email || record.id}</strong>${record.id === viewerId ? ' (Вы)' : ''}`;

  li.append(name);
  li.addEventListener('click', () => openPlayerModal(record));
  li.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPlayerModal(record);
    }
  });
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

tabUnverified.addEventListener('click', () => activateTab('unverified'));
tabVerified.addEventListener('click', () => activateTab('verified'));
closePlayerModalBtn.addEventListener('click', closeModal);

goMainBtn.addEventListener('click', () => {
  window.location.href = 'main.html';
});

goMainDeniedBtn.addEventListener('click', () => {
  window.location.href = 'main.html';
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  try {
    viewerId = user.uid;
    viewerEmail = user.email || null;

    const access = await enforcePageAccess(user, {
      requireVerified: true,
      allowedRoles: ['moderator'],
    });

    if (!access.ok) {
      if (access.reason === 'blocked_forever') {
        window.location.href = 'index.html';
        return;
      }
      showDenied('Доступ запрещён: нужна верификация и роль moderator.');
      return;
    }

    showPanel();
    activateTab('unverified');
    setStatus('Роль подтверждена: moderator.');

    onSnapshot(doc(db, 'users', user.uid), (meSnap) => {
      if (!meSnap.exists()) {
        showDenied('Профиль не найден.');
        return;
      }

      const me = meSnap.data();
      if (me.blockedForever) {
        window.location.href = 'index.html';
        return;
      }

      if (!me.verified || (me.role || 'user') !== 'moderator') {
        showDenied('Доступ отозван: нужна верификация и роль moderator.');
      }
    });

    const q = query(collection(db, 'users'));
    onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        const activeRecords = records.filter((r) => !r.blockedForever);
        fillList(
          unverifiedList,
          activeRecords.filter((r) => !r.verified),
        );
        fillList(
          verifiedList,
          activeRecords.filter((r) => r.verified),
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
