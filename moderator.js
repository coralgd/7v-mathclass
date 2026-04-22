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
const submissionsEl = document.getElementById('submissions');
const goMainBtn = document.getElementById('goMainBtn');

const setStatus = (text, isError = false) => {
  modStatus.textContent = text;
  modStatus.className = `status ${isError ? 'error' : 'success'}`;
};

const hasModeratorRights = (role) => role === 'moderator' || role === 'senior_moderator';

goMainBtn.addEventListener('click', () => {
  window.location.href = 'main.html';
});

const renderSubmissions = (docs) => {
  if (!docs.length) {
    submissionsEl.innerHTML = '<p class="hint">Отправок пока нет.</p>';
    return;
  }

  submissionsEl.innerHTML = docs
    .map((userDoc) => {
      const data = userDoc.data();
      const disabled = data.verified ? 'disabled' : '';
      const buttonText = data.verified ? 'Уже верифицирован' : 'Верифицировать';

      return `
        <article class="submission-item">
          <p><strong>Email:</strong> ${data.email || '—'}</p>
          <p><strong>Имя:</strong> ${data.name || '—'}</p>
          <p><strong>Статус:</strong> ${data.verified ? 'верифицирован' : 'не верифицирован'}</p>
          <button data-id="${userDoc.id}" class="verify-btn" ${disabled}>${buttonText}</button>
        </article>
      `;
    })
    .join('');

  submissionsEl.querySelectorAll('.verify-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.id;
      try {
        await updateDoc(doc(db, 'users', userId), {
          verified: true,
          verifiedAt: new Date().toISOString(),
        });
        setStatus('Пользователь верифицирован.');
      } catch (error) {
        setStatus(error.message || 'Ошибка при верификации.', true);
      }
    });
  });
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  const currentUserRef = doc(db, 'users', user.uid);

  try {
    const currentUserSnapshot = await getDoc(currentUserRef);
    if (!currentUserSnapshot.exists()) {
      setStatus('Профиль не найден.', true);
      return;
    }

    const role = currentUserSnapshot.data().role || 'user';
    if (!hasModeratorRights(role)) {
      setStatus('Нет доступа: нужны права модератора.', true);
      submissionsEl.innerHTML = '';
      return;
    }

    setStatus('Доступ модератора подтвержден.');

    const submissionsQuery = query(collection(db, 'users'), where('nameSubmitted', '==', true));
    onSnapshot(
      submissionsQuery,
      (snapshot) => {
        renderSubmissions(snapshot.docs);
      },
      (error) => {
        setStatus(error.message || 'Ошибка загрузки отправок.', true);
      },
    );
  } catch (error) {
    setStatus(error.message || 'Ошибка проверки прав.', true);
  }
});
