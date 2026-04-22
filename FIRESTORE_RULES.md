# Firestore Rules (for this app)

Use these rules in **Firebase Console -> Firestore Database -> Rules**.

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function myUserDoc() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid));
    }

    function isModerator() {
      return isSignedIn()
        && myUserDoc().exists()
        && (myUserDoc().data.role == 'moderator' || myUserDoc().data.role == 'senior_moderator');
    }

    function isSelf(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    match /users/{userId} {
      // Users can read own doc; moderators can read all users (needed for moderator list).
      allow read: if isSelf(userId) || isModerator();

      // Create own profile document with safe defaults.
      allow create: if isSelf(userId)
        && request.resource.data.verified == false
        && request.resource.data.role == 'user';

      // User edits only own name-related fields and cannot self-verify or change role.
      allow update: if isSelf(userId)
        && request.resource.data.verified == resource.data.verified
        && request.resource.data.role == resource.data.role
        || isModerator();

      // Delete disabled by default.
      allow delete: if false;
    }
  }
}
```

## Notes
- Moderator page requires moderator read access to all `users` documents.
- `role` must be one of: `user`, `moderator`, `senior_moderator`.
- If you need stricter field validation, add allowlisted keys checks.
