# Tactics Board

A mobile-first soccer tactics board. Coaches sign up, set up their team and squad, then drag players into formations, sketch runs and passes, and everything syncs to their account — with offline support on the pitch.

Built as a static web app (no build step) with Firebase Auth + Firestore. Deployable free on GitHub Pages.

## Features

- Email/password accounts with a guided team setup on first sign-in
- Squad roster: player names with position abbreviations (GK, CB, CDM, CAM, ST, ...)
- 11v11 and 9v9 formations with position-aware auto-placement
- Drag players from the bench onto the pitch; drag off the bottom to bench them
- Opposition tokens with mirrored position labels
- Run / pass / freehand drawing tools
- Cloud sync via Firestore, with offline persistence so it works with no signal
- Installable PWA (add to home screen, standalone display)

## Setup

### 1. Create a Firebase project

1. Go to <https://console.firebase.google.com> and add a project (free Spark plan is fine).
2. **Build → Authentication → Get started → Sign-in method** → enable **Email/Password**.
3. **Build → Firestore Database → Create database** → production mode, pick a nearby region (e.g. `australia-southeast1`).
4. **Firestore → Rules** → replace with:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /teams/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

5. **Project settings → Your apps → Add app → Web**. Register it (no hosting needed) and copy the `firebaseConfig` object.
6. Paste your config into `js/firebase-config.js`.

### 2. Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/soccerboard.git
git push -u origin main
```

### 3. Enable GitHub Pages

1. Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main`, folder `/ (root)` → Save.
2. Your app will be at `https://YOUR_USERNAME.github.io/soccerboard/`.

### 4. Authorise the domain in Firebase

**Authentication → Settings → Authorized domains → Add domain** → `YOUR_USERNAME.github.io`. Without this, login will fail on the published site.

## Local development

Modules and service workers need a server (opening `index.html` directly will not work):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

`localhost` is pre-authorised in Firebase, so login works locally out of the box.

## Notes

- All team data lives in one Firestore document per account: `teams/{uid}`.
- Writes are debounced (~600 ms) so dragging does not hammer Firestore. The free tier is far more than enough for personal use.
- After changing files, bump `CACHE` in `sw.js` (e.g. `tactics-v2`) so installed devices pick up the new version.
