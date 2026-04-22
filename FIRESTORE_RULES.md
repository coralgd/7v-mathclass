# Firestore Rules (corrected)

Вставь эти правила в **Firebase Console -> Firestore Database -> Rules** и нажми **Publish**.

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isSelf(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function isModerator() {
      return isSignedIn()
        && exists(/databases/$(database)/documents/users/$(request.auth.uid))
        && (
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'moderator'
          || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'elder'
        );
    }

    match /users/{userId} {
      // Читать свой документ может сам пользователь, а модераторы - все документы.
      allow read: if isSelf(userId) || isModerator();

      // Создание только своего документа и только с безопасными дефолтами.
      allow create: if isSelf(userId)
        && request.resource.data.verified == false
        && request.resource.data.role == 'user';

      // Обычный пользователь не может менять verified/role.
      // Модератор/elder может.
      allow update: if (
          isSelf(userId)
          && request.resource.data.verified == resource.data.verified
          && request.resource.data.role == resource.data.role
        )
        || isModerator();

      allow delete: if false;
    }
  }
}
```

## Что обязательно проверить
1. В документе модератора `users/{uid}` поле `role` = `moderator` или `elder`.
2. Пользователь реально залогинен под этим `uid`.
3. После обновления правил дождись публикации (обычно несколько секунд).
