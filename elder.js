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
const actionSearchInput = document.getElementById('actionSearch');
const userSearchInput = document.getElementById('userSearch');
const auditList = document.getElementById('auditList');

let viewerId = null;
let viewerEmail = null;
let recordsCache = [];
let auditCache = [];

const setStatus = (text, isError = false) => {
  elderStatus.textContent = text;
  elderStatus.className = `status ${isError ? 'error' : ''}`;
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
  elderPanelBlock.classList.add('hidden');
  elderDeniedBlock.classList.remove('hidden');
  elderDeniedText.textContent = text;
};

const showPanel = () => {
  elderDeniedBlock.classList.add('hidden');
  elderPanelBlock.classList.remove('hidden');
};

const isElder = (value) => value === 'elder';

const getRecordIp = (record) => record.lastIp || record.createdIp || 'unknown';

const renderAuditList = () => {
  const actionQuery = actionSearchInput.value.trim().toLowerCase();
  const userQuery = userSearchInput.value.trim().toLowerCase();

  const filtered = auditCache
    .filter((item) => {
      const actionText = String(item.action || '').toLowerCase();
      const userText = `${item.actorEmail || ''} ${item.actorId || ''} ${item.targetEmail || ''} ${item.targetId || ''}`.toLowerCase();
      const actionOk = !actionQuery || actionText.includes(actionQuery);
      const userOk = !userQuery || userText.includes(userQuery);
      return actionOk && userOk;
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  auditList.innerHTML = '';
  if (!filtered.length) {
    const empty = document.createElement('li');
    empty.className = 'item item-card';
    empty.textContent = 'Ничего не найдено.';
    auditList.append(empty);
    return;
  }

  filtered.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'item item-card';

    const action = document.createElement('p');
    action.innerHTML = `<strong>Действие:</strong> ${item.action || '—'}`;

    const actor = document.createElement('p');
    actor.innerHTML = `<strong>Кто:</strong> ${item.actorEmail || item.actorId || '—'}`;

    const target = document.createElement('p');
    target.innerHTML = `<strong>Кого:</strong> ${item.targetEmail || item.targetId || '—'}`;

    const ip = document.createElement('p');
    ip.innerHTML = `<strong>IP:</strong> ${item.targetIp || '—'}`;

    const when = document.createElement('p');
    when.innerHTML = `<strong>Когда:</strong> ${item.createdAt || '—'}`;

    li.append(action, actor, target, ip, when);
    auditList.append(li);
  });
};

const createRoleManager = (record) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'role-manager';

  const roleSelect = document.createElement('select');
  roleSelect.className = 'role-select';

  ['user', 'moderator', 'elder'].forEach((roleValue) => {
    const option = document.createElement('option');
    option.value = roleValue;
    option.textContent = roleValue;
    if ((record.role || 'user') === roleValue) option.selected = true;
    roleSelect.append(option);
  });

  const applyRoleBtn = document.createElement('button');
  applyRoleBtn.textContent = 'Применить роль';
  applyRoleBtn.className = 'ghost';

  const isSelf = record.id === viewerId;
  if (isSelf) {
    roleSelect.disabled = true;
    applyRoleBtn.disabled = true;
    applyRoleBtn.textContent = 'Свою роль менять нельзя';
  }

  applyRoleBtn.addEventListener('click', async () => {
    try {
      const nextRole = roleSelect.value;
      if (nextRole === (record.role || 'user')) {
        setStatus('Роль уже установлена.');
        return;
      }

      await updateDoc(doc(db, 'users', record.id), {
        role: nextRole,
        updatedAt: new Date().toISOString(),
      });
      await createAuditRecord('change_role', {
        id: record.id,
        email: record.email,
        ip: getRecordIp(record),
        details: `role=${nextRole}`,
      });
      setStatus(`Роль пользователя ${record.email || record.id} обновлена: ${nextRole}.`);
    } catch (error) {
      setStatus(error.code === 'permission-denied' ? 'Нет прав на изменение роли.' : error.message, true);
    }
  });

  wrapper.append(roleSelect, applyRoleBtn);
  return wrapper;
};

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
  role.innerHTML = `<strong>Текущая роль:</strong> ${record.role || 'user'}`;

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
      await createAuditRecord(record.verified ? 'unverify_user' : 'verify_user', {
        id: record.id,
        email: record.email,
        ip: ipValue,
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

  viewIpAccountsButton.addEventListener('click', async () => {
    const matches = recordsCache.filter((item) => getRecordIp(item) === ipValue);
    const emails = matches.map((item) => item.email || item.id).join(', ');
    setStatus(`IP ${ipValue}: найдено ${matches.length} аккаунтов — ${emails || 'без почт'}.`);
    await createAuditRecord('search_accounts_by_ip', {
      id: record.id,
      email: record.email,
      ip: ipValue,
      details: `count=${matches.length}`,
    });
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
      await createAuditRecord('block_ip_forever', {
        id: record.id,
        email: record.email,
        ip: ipValue,
      });
      setStatus(`IP ${ipValue} заблокирован навсегда.`);
    } catch (error) {
      setStatus(error.code === 'permission-denied' ? 'Нет прав на блокировку IP.' : error.message, true);
    }
  });

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
      await createAuditRecord('block_account_forever', {
        id: record.id,
        email: record.email,
        ip: ipValue,
      });
      setStatus(`Аккаунт ${record.email || record.id} заблокирован навсегда.`);
    } catch (error) {
      setStatus(error.code === 'permission-denied' ? 'Нет прав на блокировку аккаунта.' : error.message, true);
    }
  });

  actions.append(createRoleManager(record), verifyButton, viewIpAccountsButton, blockIpButton, banAccountButton);

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

actionSearchInput.addEventListener('input', renderAuditList);
userSearchInput.addEventListener('input', renderAuditList);

tabUnverified.addEventListener('click', () => activateTab('unverified'));
tabVerified.addEventListener('click', () => activateTab('verified'));

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

    const usersQ = query(collection(db, 'users'));
    onSnapshot(
      usersQ,
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

    const auditQ = query(collection(db, 'audit_logs'));
    onSnapshot(
      auditQ,
      (snapshot) => {
        auditCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderAuditList();
      },
      (error) => {
        setStatus(error.code === 'permission-denied' ? 'Нет доступа к архиву действий.' : error.message, true);
      },
    );
  } catch (error) {
    showDenied(error.message || 'Ошибка доступа к панели elder.');
  }
});
