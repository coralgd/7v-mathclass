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
const tabUnverifiedBtn = document.getElementById('tabUnverifiedBtn');
const tabVerifiedBtn = document.getElementById('tabVerifiedBtn');

let currentTab = 'unverified';
let allSubmissions = [];

const setStatus = (text, isError = false) => {
  modStatus.textContent = text;
  modStatus.className = `status ${isError ? 'error' : 'success'}`;
};

const hasModeratorRights = (role) => role === 'moderator' || role === 'senior_moderator';

const setTab = (tab) => {
  currentTab = tab;
  tabUnverifiedBtn.className = tab === 'unverified' ? '' : 'secondary';
  tabVerifiedBtn.className = tab === 'verified' ? '' : 'secondary';
  renderSubmissions();
};

const permissionHelp =
  'Нет прав к списку. Проверь Firestore Rules и поле role (moderator/senior_moderator) в users/{uid}.';

goMainBtn.addEventListener('click', () => {
  window.location.href = 'main.html';
});

tabUnverifiedBtn.addEventListener('click', () => setTab('unverified'));
tabVerifiedBtn.addEventListener('click', () => setTab('verified'));

const renderSubmissions = () => {
  const filtered = allSubmissions.filter((item) => (currentTab === 'verified' ? item.verified : !item.verified));

  if (!filtered.length) {
    submissionsEl.innerHTML = '<p class="hint">Здесь пока пусто.</p>';
    return;
  }

  submissionsEl.innerHTML = filtered
    .map((data) => {
      const isVerified = Boolean(data.verified);
      const buttonText = isVerified ? 'Снять верификацию' : 'Верифицировать';
      const buttonClass = isVerified ? 'danger' : '';
      const badgeClass = isVerified ? 'ok' : 'warn';
      const badgeText = isVerified ? 'Верифицирован' : 'Ожидает верификацию';

      return `
        <article class="submission-item">
          <span class="badge ${badgeClass}">${badgeText}</span>
          <p><strong>Email:</strong> ${data.email || '—'}</p>
          <p><strong>Имя:</strong> ${data.name || '—'}</p>
          <button data-id="${data.id}" data-verified="${isVerified}" class="toggle-verify-btn ${buttonClass}">${buttonText}</button>
        </article>
      `;
    })
    .join('');

  submissionsEl.querySelectorAll('.toggle-verify-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.id;
      const currentVerified = btn.dataset.verified === 'true';

      try {
        await updateDoc(doc(db, 'users', userId), {
          verified: !currentVerified,
          verifiedAt: !currentVerified ? new Date().toISOString() : null,
          updatedAt: new Date().toISOString(),
        });
        setStatus(!currentVerified ? 'Пользователь верифицирован.' : 'Верификация снята.');
      } catch (error) {
        if (error?.code === 'permission-denied') {
          setStatus(permissionHelp, true);
        } else {
          setStatus(error.message || 'Ошибка изменения статуса.', true);
        }
      }
    });
  });
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  try {
    const currentUserSnapshot = await getDoc(doc(db, 'users', user.uid));
    if (!currentUserSnapshot.exists()) {
      setStatus('Профиль не найден.', true);
      return;
    }

    const role = currentUserSnapshot.data().role || 'user';
    if (!hasModeratorRights(role)) {
      setStatus(`Нет доступа: роль ${role}. Нужны moderator или senior_moderator.`, true);
      submissionsEl.innerHTML = '';
      return;
    }

    setStatus(`Доступ подтверждён. Твоя роль: ${role}.`);

    const submissionsQuery = query(collection(db, 'users'), where('nameSubmitted', '==', true));
    onSnapshot(
      submissionsQuery,
      (snapshot) => {
        allSubmissions = snapshot.docs.map((userDoc) => ({ id: userDoc.id, ...userDoc.data() }));
        renderSubmissions();
      },
      (error) => {
        if (error?.code === 'permission-denied') {
          setStatus(permissionHelp, true);
        } else {
          setStatus(error.message || 'Ошибка загрузки отправок.', true);
        }
      },
    );
  } catch (error) {
    if (error?.code === 'permission-denied') {
      setStatus(permissionHelp, true);
    } else {
      setStatus(error.message || 'Ошибка проверки прав.', true);
    }
  }
});
