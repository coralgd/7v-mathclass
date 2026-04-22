import {
  auth,
  db,
  onAuthStateChanged,
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
} from './firebase.js';

const elderStatus = document.getElementById('elderStatus');
const unverifiedList = document.getElementById('unverifiedList');
const verifiedList = document.getElementById('verifiedList');
const goMainBtn = document.getElementById('goMainBtn');
const goMainDeniedBtn = document.getElementById('goMainDeniedBtn');
const elderPanelBlock = document.getElementById('elderPanelBlock');
const elderDeniedBlock = document.getElementById('elderDeniedBlock');
const elderDeniedText = document.getElementById('elderDeniedText');

let viewerId = null;

const setStatus = (text, isError = false) => {
  elderStatus.textContent = text;
  elderStatus.className = `status ${isError ? 'error' : ''}`;
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

goMainBtn.addEventListener('click', () => {
  window.location.href = 'main.html';
});

goMainDeniedBtn.addEventListener('click', () => {
  window.location.href = 'main.html';
});

const createItem = (record) => {
  const li = document.createElement('li');
  li.className = 'item';

  const badge = document.createElement('span');
  badge.className = `badge ${record.verified ? 'ok' : 'warn'}`;
  badge.textContent = record.verified ? 'Верифицирован' : 'Ожидает верификацию';

  const email = document.createElement('p');
  email.innerHTML = `<strong>Email:</strong> ${record.email || '—'}`;

  const name = document.createElement('p');
  name.innerHTML = `<strong>Имя:</strong> ${record.name || '—'}`;

  const role = document.createElement('p');
  role.innerHTML = `<strong>Роль:</strong> ${record.role || 'user'}`;

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

  actions.append(verifyButton);

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

  li.append(badge, email, name, role, actions);
  return li;
};

const fillList = (target, items) => {
  target.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'item';
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
    setStatus('Роль подтверждена: elder.');

    const q = query(collection(db, 'users'), where('nameSubmitted', '==', true));
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
    showDenied(error.message || 'Ошибка доступа к панели elder.');
  }
});
