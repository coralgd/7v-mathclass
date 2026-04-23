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
const metricTotal = document.getElementById('metricTotal');
const metricBanned = document.getElementById('metricBanned');
const metricRiskIps = document.getElementById('metricRiskIps');
const riskIpList = document.getElementById('riskIpList');

const elderUserModal = document.getElementById('elderUserModal');
const elderModalName = document.getElementById('elderModalName');
const elderModalInfo = document.getElementById('elderModalInfo');
const elderModalClose = document.getElementById('elderModalClose');
const elderVerifyToggleBtn = document.getElementById('elderVerifyToggleBtn');
const elderBanAccountBtn = document.getElementById('elderBanAccountBtn');
const elderBlockIpBtn = document.getElementById('elderBlockIpBtn');
const elderFindIpAccountsBtn = document.getElementById('elderFindIpAccountsBtn');
const elderBanAllByIpBtn = document.getElementById('elderBanAllByIpBtn');
const roleSelectTrigger = document.getElementById('roleSelectTrigger');
const roleSelectMenu = document.getElementById('roleSelectMenu');
const applyRoleBtn = document.getElementById('applyRoleBtn');

let viewerId = null;
let viewerEmail = null;
let recordsCache = [];
let auditCache = [];
let selectedRecord = null;
let selectedRole = 'user';

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

const getRecordIp = (record) => record.lastIp || record.createdIp || 'unknown';

const ensureLiveAccess = async () => {
  const live = await checkPageAccess(auth.currentUser, 'elder');
  if (!live.ok) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
};

const closeModal = () => {
  elderUserModal.classList.add('hidden');
  roleSelectMenu.classList.add('hidden');
  selectedRecord = null;
};

const openModal = (record) => {
  selectedRecord = record;
  selectedRole = record.role || 'user';
  elderModalName.textContent = record.name || record.email || 'Игрок';
  elderModalInfo.innerHTML = `
    <p><strong>Email:</strong> ${record.email || '—'}</p>
    <p><strong>UID:</strong> ${record.id}</p>
    <p><strong>Текущая роль:</strong> ${record.role || 'user'}</p>
    <p><strong>Верификация:</strong> ${record.verified ? 'Да' : 'Нет'}</p>
    <p><strong>IP:</strong> ${getRecordIp(record)}</p>
    <p><strong>Заблокирован:</strong> ${record.blockedForever ? 'Да' : 'Нет'}</p>
  `;
  elderVerifyToggleBtn.textContent = record.verified ? 'Снять верификацию' : 'Поставить верификацию';
  roleSelectTrigger.textContent = `Роль: ${selectedRole}`;
  elderBanAccountBtn.disabled = record.blockedForever || record.id === viewerId;
  elderBlockIpBtn.disabled = getRecordIp(record) === 'unknown';
  elderFindIpAccountsBtn.disabled = getRecordIp(record) === 'unknown';
  elderBanAllByIpBtn.disabled = getRecordIp(record) === 'unknown';
  elderUserModal.classList.remove('hidden');
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
  tag.textContent = record.verified ? record.role || 'user' : 'требует проверки';

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

const renderPreventionBoard = () => {
  metricTotal.textContent = String(recordsCache.length);
  metricBanned.textContent = String(recordsCache.filter((r) => r.blockedForever).length);

  const ipMap = recordsCache.reduce((acc, record) => {
    const ip = getRecordIp(record);
    if (ip === 'unknown') return acc;
    acc[ip] = (acc[ip] || 0) + 1;
    return acc;
  }, {});

  const riskIps = Object.entries(ipMap)
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);

  metricRiskIps.textContent = String(riskIps.length);

  riskIpList.innerHTML = '';
  if (!riskIps.length) {
    const empty = document.createElement('li');
    empty.className = 'row-empty';
    empty.textContent = 'Подозрительных IP пока нет.';
    riskIpList.append(empty);
    return;
  }

  riskIps.forEach(([ip, count]) => {
    const li = document.createElement('li');
    li.className = 'risk-item';

    const text = document.createElement('span');
    text.textContent = `${ip} — ${count} аккаунтов`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ghost slim';
    btn.textContent = 'Показать';
    btn.addEventListener('click', () => {
      const emails = recordsCache
        .filter((r) => getRecordIp(r) === ip)
        .map((r) => r.email || r.id)
        .join(', ');
      setStatus(`IP ${ip}: ${emails || 'без почт'}`);
    });

    li.append(text, btn);
    riskIpList.append(li);
  });
};

const renderAuditList = () => {
  const actionQuery = actionSearchInput.value.trim().toLowerCase();
  const userQuery = userSearchInput.value.trim().toLowerCase();

  const filtered = auditCache
    .filter((item) => {
      const actionText = String(item.action || '').toLowerCase();
      const userText = `${item.actorEmail || ''} ${item.actorId || ''} ${item.targetEmail || ''} ${item.targetId || ''} ${item.targetIp || ''}`.toLowerCase();
      return (!actionQuery || actionText.includes(actionQuery)) && (!userQuery || userText.includes(userQuery));
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  auditList.innerHTML = '';
  if (!filtered.length) {
    const empty = document.createElement('li');
    empty.className = 'row-empty';
    empty.textContent = 'По этим параметрам ничего не найдено.';
    auditList.append(empty);
    return;
  }

  filtered.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'audit-row';
    li.innerHTML = `
      <p><strong>${item.action || '—'}</strong></p>
      <p>Кто: ${item.actorEmail || item.actorId || '—'}</p>
      <p>Кого: ${item.targetEmail || item.targetId || '—'}</p>
      <p>IP: ${item.targetIp || '—'}</p>
      <p>Когда: ${item.createdAt || '—'}</p>
    `;
    auditList.append(li);
  });
};

const withSelected = async (callback) => {
  if (!selectedRecord) return;
  if (!(await ensureLiveAccess())) return;
  await callback();
};

tabUnverified.addEventListener('click', () => activateTab('unverified'));
tabVerified.addEventListener('click', () => activateTab('verified'));
actionSearchInput.addEventListener('input', renderAuditList);
userSearchInput.addEventListener('input', renderAuditList);
goMainBtn.addEventListener('click', () => (window.location.href = 'main.html'));
goMainDeniedBtn.addEventListener('click', () => (window.location.href = 'main.html'));
elderModalClose.addEventListener('click', closeModal);
elderUserModal.addEventListener('click', (event) => {
  if (event.target === elderUserModal) closeModal();
});

roleSelectTrigger.addEventListener('click', () => {
  roleSelectMenu.classList.toggle('hidden');
});

roleSelectMenu.querySelectorAll('.role-option').forEach((option) => {
  option.addEventListener('click', () => {
    selectedRole = option.dataset.role || 'user';
    roleSelectTrigger.textContent = `Роль: ${selectedRole}`;
    roleSelectMenu.classList.add('hidden');
  });
});

applyRoleBtn.addEventListener('click', async () => {
  await withSelected(async () => {
    if (!selectedRecord || selectedRecord.id === viewerId) {
      setStatus('Свою роль изменять нельзя.', true);
      return;
    }

    try {
      await updateDoc(doc(db, 'users', selectedRecord.id), {
        role: selectedRole,
        updatedAt: new Date().toISOString(),
      });
      await createAuditRecord('change_role', {
        id: selectedRecord.id,
        email: selectedRecord.email,
        ip: getRecordIp(selectedRecord),
        details: `role=${selectedRole}`,
      });
      setStatus(`Роль обновлена: ${selectedRole}.`);
      closeModal();
    } catch (error) {
      setStatus(error.code === 'permission-denied' ? 'Нет прав на изменение роли.' : error.message, true);
    }
  });
});

elderVerifyToggleBtn.addEventListener('click', async () => {
  await withSelected(async () => {
    try {
      await updateDoc(doc(db, 'users', selectedRecord.id), {
        verified: !selectedRecord.verified,
        verifiedAt: !selectedRecord.verified ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      });
      await createAuditRecord(selectedRecord.verified ? 'unverify_user' : 'verify_user', {
        id: selectedRecord.id,
        email: selectedRecord.email,
        ip: getRecordIp(selectedRecord),
      });
      setStatus(!selectedRecord.verified ? 'Верификация включена.' : 'Верификация снята.');
      closeModal();
    } catch (error) {
      setStatus(error.code === 'permission-denied' ? 'Нет прав на изменение верификации.' : error.message, true);
    }
  });
});

elderBanAccountBtn.addEventListener('click', async () => {
  await withSelected(async () => {
    try {
      await updateDoc(doc(db, 'users', selectedRecord.id), {
        blockedForever: true,
        blockedAt: new Date().toISOString(),
        blockedBy: viewerId,
        updatedAt: new Date().toISOString(),
      });
      await createAuditRecord('block_account_forever', {
        id: selectedRecord.id,
        email: selectedRecord.email,
        ip: getRecordIp(selectedRecord),
      });
      setStatus('Аккаунт заблокирован.');
      closeModal();
    } catch (error) {
      setStatus(error.code === 'permission-denied' ? 'Нет прав на блокировку аккаунта.' : error.message, true);
    }
  });
});

elderBlockIpBtn.addEventListener('click', async () => {
  await withSelected(async () => {
    const ip = getRecordIp(selectedRecord);
    if (ip === 'unknown') {
      setStatus('IP не определён.', true);
      return;
    }
    try {
      await setDoc(doc(db, 'blocked_ips', ip), {
        blocked: true,
        reason: 'forever',
        blockedAt: new Date().toISOString(),
        blockedBy: viewerId,
      });
      await createAuditRecord('block_ip_forever', {
        id: selectedRecord.id,
        email: selectedRecord.email,
        ip,
      });
      setStatus(`IP ${ip} заблокирован.`);
    } catch (error) {
      setStatus(error.code === 'permission-denied' ? 'Нет прав на блокировку IP.' : error.message, true);
    }
  });
});

elderFindIpAccountsBtn.addEventListener('click', async () => {
  await withSelected(async () => {
    const ip = getRecordIp(selectedRecord);
    const matches = recordsCache.filter((r) => getRecordIp(r) === ip);
    const details = matches.map((r) => r.email || r.id).join(', ');
    setStatus(`На IP ${ip} найдено ${matches.length} аккаунтов: ${details || 'нет данных'}`);
    await createAuditRecord('search_accounts_by_ip', {
      id: selectedRecord.id,
      email: selectedRecord.email,
      ip,
      details: `count=${matches.length}`,
    });
  });
});

elderBanAllByIpBtn.addEventListener('click', async () => {
  await withSelected(async () => {
    const ip = getRecordIp(selectedRecord);
    const targets = recordsCache.filter((r) => getRecordIp(r) === ip && r.id !== viewerId && !r.blockedForever);
    if (!targets.length) {
      setStatus('Нет доступных аккаунтов для массовой блокировки.');
      return;
    }

    for (const target of targets) {
      await updateDoc(doc(db, 'users', target.id), {
        blockedForever: true,
        blockedAt: new Date().toISOString(),
        blockedBy: viewerId,
        updatedAt: new Date().toISOString(),
      });
    }

    await createAuditRecord('mass_block_accounts_by_ip', {
      id: selectedRecord.id,
      email: selectedRecord.email,
      ip,
      details: `count=${targets.length}`,
    });

    setStatus(`Заблокировано ${targets.length} аккаунтов с IP ${ip}.`);
    closeModal();
  });
});

onAuthStateChanged(auth, async (user) => {
  const access = await checkPageAccess(user, 'elder');

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
  setStatus('Выбери игрока из списка: откроется окно с полным управлением профилем.');

  onSnapshot(
    query(collection(db, 'users')),
    (snapshot) => {
      recordsCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      fillList(unverifiedList, recordsCache.filter((r) => !r.verified));
      fillList(verifiedList, recordsCache.filter((r) => r.verified));
      renderPreventionBoard();
    },
    (error) => {
      setStatus(error.code === 'permission-denied' ? 'Missing or insufficient permissions.' : error.message, true);
    },
  );

  onSnapshot(
    query(collection(db, 'audit_logs')),
    (snapshot) => {
      auditCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderAuditList();
    },
    (error) => {
      setStatus(error.code === 'permission-denied' ? 'Нет доступа к архиву действий.' : error.message, true);
    },
  );
});
