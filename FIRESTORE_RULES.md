# Firestore Rules (extended)

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

    function isElder() {
      return isSignedIn()
        && exists(/databases/$(database)/documents/users/$(request.auth.uid))
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'elder';
    }

    match /users/{userId} {
      allow read: if isSelf(userId) || isModerator();

      allow create: if isSelf(userId)
        && request.resource.data.verified == false
        && request.resource.data.role == 'user';

      allow update: if (
          isSelf(userId)
          && request.resource.data.verified == resource.data.verified
          && request.resource.data.role == resource.data.role
          && request.resource.data.blockedForever == resource.data.blockedForever
        )
        || isModerator();

      allow delete: if false;
    }

    match /blocked_ips/{ip} {
      allow read: if isSignedIn();
      allow create, update: if isElder();
      allow delete: if false;
    }
  }
}
```

## Что обязательно проверить
1. В документе модератора `users/{uid}` поле `role` = `moderator` или `elder`.
2. У elder есть право записи в `blocked_ips/{ip}`.
3. Пользователь с `blockedForever: true` и/или IP из `blocked_ips` должен видеть вечный бан на странице входа.
