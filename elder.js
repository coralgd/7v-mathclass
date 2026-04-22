import {
  auth,
  db,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  onSnapshot,
  updateDoc,
} from './firebase.js';

const elderStatus = document.getElementById('elderStatus');
const unverifiedList = document.getElementById('unverifiedList');
const verifiedList = document.getElementById('verifiedList');
const unverifiedSection = document.getElementById('unverifiedSection');
const verifiedSection = document.getElementById('verifiedSection');
const tabUnverified = document.getElementById('tabUnverified');
const tabVerified = document.getElementById('tabVerified');
const goMainBtn = document.getElementById('goMainBtn');
const goMainDeniedBtn = document.getElementById('goMainDeniedBtn');
const elderPanelBlock = document.getElementById('elderPanelBlock');
const elderDeniedBlock = document.getElementById('elderDeniedBlock');
const elderDeniedText = document.getElementById('elderDeniedText');

let viewerId = null;
let recordsCache = [];

const setStatus = (text, isError = false) => {
  elderStatus.textContent = text;
  elderStatus.className = `status ${isError ? 'error' : ''}`;
};

const activateTab = (tab) => {
  const showUnverified = tab === 'unverified';
  unverifiedSection.classList.toggle('hidden', !showUnverified);
  verifiedSection.classList.toggle('hidden', showUnverified);
  tabUnverified.classList.toggle('ghost', !showUnverified);
  tabVerified.classList.toggle('ghost', showUnverified);
};

const showDenied = (text) => {
  elderPanelBlock.classList.add('hidden');
  elderDeniedBlock.classList.remove('hidden');
  elderDeniedText.textContent = text;
};

const showPanel = () => {
  elderDeniedBlock.classList.add('hidden');
  elderPanelBlock.classList.remove('hidden');
};

const isElder = (value) => value === 'elder';

tabUnverified.addEventListener('click', () => activateTab('unverified'));
tabVerified.addEventListener('click', () => activateTab('verified'));

goMainBtn.addEventListener('click', () => {
  window.location.href = 'main.html';
});

goMainDeniedBtn.addEventListener('click', () => {
  window.location.href = 'main.html';
});

const getRecordIp = (record) => record.lastIp || record.createdIp || 'unknown';

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

  const role = document.createElement('p');
  role.innerHTML = `<strong>Роль:</strong> ${record.role || 'user'}`;

  const ipValue = getRecordIp(record);
  const ip = document.createElement('p');
  ip.innerHTML = `<strong>IP:</strong> ${ipValue}`;

  const actions = document.createElement('div');
  actions.className = 'actions';

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

  const viewIpAccountsButton = document.createElement('button');
  viewIpAccountsButton.textContent = 'Аккаунты по IP';
  viewIpAccountsButton.className = 'ghost';
  viewIpAccountsButton.disabled = ipValue === 'unknown';

  viewIpAccountsButton.addEventListener('click', () => {
    const matches = recordsCache.filter((item) => getRecordIp(item) === ipValue);
    const emails = matches.map((item) => item.email || item.id).join(', ');
    setStatus(`IP ${ipValue}: найдено ${matches.length} аккаунтов — ${emails || 'без почт'}.`);
  });

  const blockIpButton = document.createElement('button');
  blockIpButton.textContent = 'Заблокировать IP навсегда';
  blockIpButton.className = 'danger';
  blockIpButton.disabled = ipValue === 'unknown';

  blockIpButton.addEventListener('click', async () => {
    try {
      await setDoc(
        doc(db, 'blocked_ips', ipValue),
        {
          blocked: true,
          reason: 'forever',
          blockedAt: new Date().toISOString(),
          blockedBy: viewerId,
        },
        { merge: true },
      );
      setStatus(`IP ${ipValue} заблокирован навсегда.`);
    } catch (error) {
      setStatus(error.code === 'permission-denied' ? 'Нет прав на блокировку IP.' : error.message, true);
    }
  });

  const canEditRole = record.id !== viewerId && !isElder(record.role);
  if (canEditRole) {
    const roleButton = document.createElement('button');
    const willBeModerator = record.role !== 'moderator';
    roleButton.textContent = willBeModerator ? 'Назначить модером' : 'Снять модерку';
    roleButton.className = willBeModerator ? 'ghost' : 'danger';

    roleButton.addEventListener('click', async () => {
      try {
        await updateDoc(doc(db, 'users', record.id), {
          role: willBeModerator ? 'moderator' : 'user',
          updatedAt: new Date().toISOString(),
        });
        setStatus(willBeModerator ? 'Пользователь назначен модератором.' : 'Роль модератора снята.');
      } catch (error) {
        setStatus(error.code === 'permission-denied' ? 'Нет прав на изменение роли.' : error.message, true);
      }
    });

    actions.append(roleButton);
  }

  const banAccountButton = document.createElement('button');
  banAccountButton.textContent = record.blockedForever ? 'Аккаунт заблокирован навсегда' : 'Заблокировать аккаунт навсегда';
  banAccountButton.className = 'danger';
  banAccountButton.disabled = isSelf || record.blockedForever;

  banAccountButton.addEventListener('click', async () => {
    try {
      await updateDoc(doc(db, 'users', record.id), {
        blockedForever: true,
        blockedAt: new Date().toISOString(),
        blockedBy: viewerId,
        updatedAt: new Date().toISOString(),
      });
      setStatus(`Аккаунт ${record.email || record.id} заблокирован навсегда.`);
    } catch (error) {
      setStatus(error.code === 'permission-denied' ? 'Нет прав на блокировку аккаунта.' : error.message, true);
    }
  });

  actions.append(verifyButton, viewIpAccountsButton, blockIpButton, banAccountButton);

  li.append(badge, email, name, role, ip, actions);
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
    if (!isElder(role)) {
      showDenied(`Нет доступа. Ваша роль: ${role}.`);
      return;
    }

    showPanel();
    activateTab('unverified');
    setStatus('Роль подтверждена: elder.');

    const q = query(collection(db, 'users'));
    onSnapshot(
      q,
      (snapshot) => {
        recordsCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        fillList(
          unverifiedList,
          recordsCache.filter((r) => !r.verified),
        );
        fillList(
          verifiedList,
          recordsCache.filter((r) => r.verified),
        );
      },
      (error) => {
        setStatus(error.code === 'permission-denied' ? 'Missing or insufficient permissions.' : error.message, true);
      },
    );
  } catch (error) {
    showDenied(error.message || 'Ошибка доступа к панели elder.');
  }
});
