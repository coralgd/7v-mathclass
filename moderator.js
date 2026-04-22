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

const modStatus = document.getElementById('modStatus');
const unverifiedList = document.getElementById('unverifiedList');
const verifiedList = document.getElementById('verifiedList');
const goMainBtn = document.getElementById('goMainBtn');

const setStatus = (text, isError = false) => {
  modStatus.textContent = text;
  modStatus.className = `status ${isError ? 'error' : ''}`;
};

const isModerator = (value) => value === 'moderator' || value === 'senior_moderator';

goMainBtn.addEventListener('click', () => {
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

  const button = document.createElement('button');
  button.textContent = record.verified ? 'Снять верификацию' : 'Верифицировать';
  if (record.verified) button.classList.add('danger');

  button.addEventListener('click', async () => {
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

  li.append(badge, email, name, button);
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
    const meSnap = await getDoc(doc(db, 'users', user.uid));
    if (!meSnap.exists()) {
      setStatus('Профиль не найден.', true);
      return;
    }

    const role = meSnap.data().role || 'user';
    if (!isModerator(role)) {
      setStatus(`Нет доступа. Ваша роль: ${role}.`, true);
      return;
    }

    setStatus(`Роль подтверждена: ${role}.`);

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
    setStatus(error.message || 'Ошибка доступа к панели.', true);
  }
});
