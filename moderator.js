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
      await createAuditRecord(record.verified ? 'unverify_user' : 'verify_user', {
        id: record.id,
        email: record.email,
        ip: record.lastIp || record.createdIp || null,
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
  const access = await checkPageAccess(user, { requireVerified: true, allowedRoles: ['moderator'] });

  if (access.reason === 'blocked_ip' || access.reason === 'blocked_account') {
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

  try {
    viewerId = user.uid;
    viewerEmail = user.email || null;

    showPanel();
    activateTab('unverified');
    setStatus('Доступ подтверждён: moderator.');

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
