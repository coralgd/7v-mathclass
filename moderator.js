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
import { checkPageAccess } from './auth-guard.js';

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

const modUserModal = document.getElementById('modUserModal');
const modModalName = document.getElementById('modModalName');
const modModalInfo = document.getElementById('modModalInfo');
const modModalClose = document.getElementById('modModalClose');
const modVerifyToggleBtn = document.getElementById('modVerifyToggleBtn');

let viewerId = null;
let viewerEmail = null;
let recordsCache = [];
let selectedRecord = null;

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
  modUserModal.classList.add('hidden');
  selectedRecord = null;
};

const openModal = (record) => {
  selectedRecord = record;
  modModalName.textContent = record.name || record.email || 'Игрок';
  modModalInfo.innerHTML = `
    <p><strong>Email:</strong> ${record.email || '—'}</p>
    <p><strong>Роль:</strong> ${record.role || 'user'}</p>
    <p><strong>Верификация:</strong> ${record.verified ? 'Да' : 'Нет'}</p>
    <p><strong>IP:</strong> ${record.lastIp || record.createdIp || 'unknown'}</p>
    <p><strong>UID:</strong> ${record.id}</p>
  `;
  modVerifyToggleBtn.textContent = record.verified ? 'Снять верификацию' : 'Поставить верификацию';
  modVerifyToggleBtn.classList.toggle('danger', record.verified);
  modUserModal.classList.remove('hidden');
};

const ensureLiveAccess = async () => {
  const live = await checkPageAccess(auth.currentUser, 'moderator');
  if (!live.ok) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
};

const createRow = (record) => {
  const li = document.createElement('li');
  li.className = 'row-item';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'row-button';
  button.textContent = record.name || record.email || `Игрок ${record.id.slice(0, 6)}`;

  const tag = document.createElement('span');
  tag.className = `row-tag ${record.verified ? 'ok' : 'warn'}`;
  tag.textContent = record.verified ? 'верифицирован' : 'ждёт верификацию';

  button.addEventListener('click', () => openModal(record));
  li.append(button, tag);
  return li;
};

const fillList = (target, items) => {
  target.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'row-empty';
    empty.textContent = 'Список пуст.';
    target.append(empty);
    return;
  }

  items
    .sort((a, b) => String(a.name || a.email || '').localeCompare(String(b.name || b.email || '')))
    .forEach((item) => target.append(createRow(item)));
};

tabUnverified.addEventListener('click', () => activateTab('unverified'));
tabVerified.addEventListener('click', () => activateTab('verified'));
goMainBtn.addEventListener('click', () => (window.location.href = 'main.html'));
goMainDeniedBtn.addEventListener('click', () => (window.location.href = 'main.html'));
modModalClose.addEventListener('click', closeModal);
modUserModal.addEventListener('click', (event) => {
  if (event.target === modUserModal) closeModal();
});

modVerifyToggleBtn.addEventListener('click', async () => {
  if (!selectedRecord) return;
  if (!(await ensureLiveAccess())) return;

  try {
    await updateDoc(doc(db, 'users', selectedRecord.id), {
      verified: !selectedRecord.verified,
      verifiedAt: !selectedRecord.verified ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    });

    await createAuditRecord(selectedRecord.verified ? 'unverify_user' : 'verify_user', {
      id: selectedRecord.id,
      email: selectedRecord.email,
      ip: selectedRecord.lastIp || selectedRecord.createdIp || null,
    });

    setStatus(!selectedRecord.verified ? 'Верификация установлена.' : 'Верификация снята.');
    closeModal();
  } catch (error) {
    setStatus(error.code === 'permission-denied' ? 'Нет прав на изменение верификации.' : error.message, true);
  }
});

onAuthStateChanged(auth, async (user) => {
  const access = await checkPageAccess(user, 'moderator');

  if (access.reason === 'ip_unresolved' || access.reason === 'blocked_ip' || access.reason === 'blocked_account') {
    window.location.href = 'index.html';
    return;
  }

  if (access.reason === 'no_auth' || access.reason === 'no_profile') {
    window.location.href = 'index.html';
    return;
  }

  if (access.reason === 'need_verification') {
    showDenied('Нет доступа: аккаунт не верифицирован.');
    return;
  }

  if (access.reason === 'role_denied') {
    const role = access.userData?.role || 'user';
    showDenied(`Нет доступа. Ваша роль: ${role}.`);
    return;
  }

  if (!access.ok) {
    showDenied('Ошибка доступа.');
    return;
  }

  viewerId = user.uid;
  viewerEmail = user.email || null;
  showPanel();
  activateTab('unverified');
  setStatus('Открой игрока из списка для детальной модерации.');

  onSnapshot(
    query(collection(db, 'users')),
    (snapshot) => {
      recordsCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      fillList(unverifiedList, recordsCache.filter((r) => !r.verified));
      fillList(verifiedList, recordsCache.filter((r) => r.verified));
    },
    (error) => {
      setStatus(error.code === 'permission-denied' ? 'Missing or insufficient permissions.' : error.message, true);
    },
  );
});
