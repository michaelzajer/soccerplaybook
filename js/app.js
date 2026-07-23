import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, setDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=51";
import { initBoard } from "./board.js?v=51";

// Demo mode: no Firebase config yet -> skip accounts, keep data on this device.
const DEMO = firebaseConfig.apiKey.startsWith("PASTE");
const DEMO_KEY = "tacticsDemoTeam";
// Guest mode: user chose "try without an account" -> same device-only storage.
let guest = false;

let auth = null, db = null;
if (!DEMO) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
}

/* ---------------- view routing ---------------- */
const views = {
  auth: document.getElementById("authView"),
  setup: document.getElementById("setupView"),
  board: document.getElementById("boardView")
};
function show(name) {
  Object.values(views).forEach(v => v.classList.remove("active"));
  views[name].classList.add("active");
  if (name === "board") window.dispatchEvent(new Event("resize")); // size canvas
}

/* ---------------- store ---------------- */
// Team doc: teams/{uid} = { teamName, roster:[{id,name,pos}], nextId,
//                           board:{squad, formation, showOpp, placed}, updatedAt }
const store = {
  uid: null,
  data: null,
  listeners: new Set(),
  unsubscribe: null,
  saveTimer: null,

  subscribe(fn) { this.listeners.add(fn); },
  emit() { this.listeners.forEach(fn => fn(this.data)); },

  attach(uid) {
    this.uid = uid;
    if (this.unsubscribe) this.unsubscribe();
    this.unsubscribe = onSnapshot(doc(db, "teams", uid), snap => {
      if (!snap.exists()) return;
      // Never let an incoming copy overwrite a local edit that is still
      // queued (`pending`) or mid-write (`writing`) — otherwise a stale
      // server copy repaints the board and a drag jumps back to its previous
      // spot. This holds only while a write is actually outstanding (bounded
      // by the 600ms debounce + the network round-trip, both of which always
      // resolve), so a tab can never wedge itself on stale data.
      if (snap.metadata.hasPendingWrites || this.pending || this.writing) return;
      this.data = snap.data();
      this.emit();
      setSyncStatus(snap.metadata.fromCache ? "Offline — changes saved on this device" : "Synced");
    }, () => setSyncStatus("Offline — changes saved on this device"));
  },
  detach() {
    if (this.unsubscribe) this.unsubscribe();
    this.unsubscribe = null; this.uid = null; this.data = null;
  },

  save(partial) {
    this.data = { ...(this.data || {}), ...partial };
    this.pending = true;                 // a change is waiting to be written
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 600);
  },
  // Write the queued change now. Called by the debounce, and directly when
  // the app is backgrounded so a move made just before switching away is
  // never lost. `pending`/`writing` gate the snapshot guard above.
  flush() {
    clearTimeout(this.saveTimer);
    if (!this.pending) return;
    if (guest) { this.pending = false; return; }   // guest: in-memory only, nothing is saved
    if (DEMO) {
      try { localStorage.setItem(DEMO_KEY, JSON.stringify(this.data)); } catch (e) {}
      this.pending = false;
      return;
    }
    if (!this.uid) { this.pending = false; return; }
    this.pending = false;
    this.writing = true;
    // full replace, NOT merge: merge deep-combines nested maps, so removed
    // players (benched / reset) were never deleted server-side and kept
    // resurrecting on the next sync echo
    setDoc(doc(db, "teams", this.uid),
      { ...this.data, updatedAt: serverTimestamp() })
      .then(() => { this.writing = false; })
      .catch(() => { this.writing = false; setSyncStatus("Offline — changes saved on this device"); });
  }
};

function setSyncStatus(msg) {
  const el = document.getElementById("syncStatus");
  if (el) el.textContent = msg;
}

/* ---------------- auth screen ---------------- */
let isSignup = false;
const authError = document.getElementById("authError");
document.getElementById("authSwap").addEventListener("click", () => {
  isSignup = !isSignup;
  document.getElementById("authSubmit").textContent = isSignup ? "Create account" : "Log in";
  document.getElementById("authSwap").textContent =
    isSignup ? "Already have an account? Log in" : "New here? Create an account";
  document.getElementById("authHeading").textContent =
    isSignup ? "Create your free account" : "Log in to your account";
  authError.textContent = "";
});
document.getElementById("authForm").addEventListener("submit", async e => {
  e.preventDefault();
  authError.textContent = "";
  const email = document.getElementById("authEmail").value.trim();
  const pass = document.getElementById("authPass").value;
  const btn = document.getElementById("authSubmit");
  btn.disabled = true;
  try {
    if (isSignup) await createUserWithEmailAndPassword(auth, email, pass);
    else await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    authError.textContent = friendlyAuthError(err.code);
  } finally {
    btn.disabled = false;
  }
});
function friendlyAuthError(code) {
  const map = {
    "auth/invalid-credential": "Wrong email or password.",
    "auth/user-not-found": "No account with that email.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/email-already-in-use": "That email already has an account. Try logging in.",
    "auth/invalid-email": "That email address does not look right.",
    "auth/weak-password": "Password needs at least 6 characters.",
    "auth/network-request-failed": "No connection. Check your network and try again."
  };
  return map[code] || "Something went wrong. Please try again.";
}

/* ---------------- team setup screen ---------------- */
let setupRoster = [];
let setupNextId = 1;
function renderSetupRoster() {
  const list = document.getElementById("suList");
  list.innerHTML = "";
  for (const p of setupRoster) {
    const row = document.createElement("div");
    row.className = "rrow";
    row.innerHTML = `<div class="rpos"></div><div class="rname"></div><button class="del" aria-label="Remove">✕</button>`;
    row.querySelector(".rpos").textContent = p.pos;
    row.querySelector(".rname").textContent = p.name;
    row.querySelector(".del").addEventListener("click", () => {
      setupRoster = setupRoster.filter(x => x.id !== p.id);
      renderSetupRoster();
    });
    list.appendChild(row);
  }
}
document.getElementById("suAdd").addEventListener("click", () => {
  const name = document.getElementById("suName").value.trim();
  const pos = (document.getElementById("suPos").value.trim() || "?").toUpperCase();
  if (!name) return;
  setupRoster.push({ id: setupNextId++, name, pos });
  document.getElementById("suName").value = "";
  document.getElementById("suPos").value = "";
  document.getElementById("suName").focus();
  renderSetupRoster();
});
document.getElementById("suName").addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); document.getElementById("suPos").focus(); }
});
document.getElementById("suPos").addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); document.getElementById("suAdd").click(); }
});
document.getElementById("setupDone").addEventListener("click", async () => {
  const teamName = document.getElementById("teamName").value.trim();
  const err = document.getElementById("setupError");
  if (!teamName) { err.textContent = "Give your team a name."; return; }
  if (!setupRoster.length) { err.textContent = "Add at least one player."; return; }
  err.textContent = "";
  store.data = {
    teamName,
    roster: setupRoster,
    nextId: setupNextId,
    board: { squad: "11", formation: "4-3-3", showOpp: false, placed: {} }
  };
  store.save({});
  enterBoard();
});
document.getElementById("setupSignOut").addEventListener("click", () => doSignOut());

function doSignOut() {
  if (guest) {
    // back to the front door; guest data stays on the device
    guest = false;
    store.data = null;
    resetAuthView();
    show("auth");
    return;
  }
  if (DEMO) {
    if (confirm("Demo mode: signing out clears the team saved on this device. Continue?")) {
      localStorage.removeItem(DEMO_KEY);
      location.reload();
    }
    return;
  }
  signOut(auth);
}

/* ---------------- board wiring ---------------- */
let boardStarted = false;
function enterBoard() {
  document.getElementById("hdrTeam").textContent = store.data.teamName || "Soccer Play Book";
  show("board");
  if (!boardStarted) { initBoard(store); boardStarted = true; }
  else store.emit();
}

document.getElementById("menuBtn").addEventListener("click", () => {
  document.getElementById("menuEmail").textContent =
    guest ? "Guest — nothing is saved. Create an account to keep your team."
    : DEMO ? "Demo mode — no account yet"
    : (auth.currentUser ? auth.currentUser.email : "");
  document.getElementById("signOutBtn").textContent = guest ? "Sign up / Log in" : "Sign out";
  document.getElementById("menuPanel").classList.add("open");
});
document.getElementById("closeMenu").addEventListener("click", () =>
  document.getElementById("menuPanel").classList.remove("open"));
document.getElementById("menuPanel").addEventListener("click", e => {
  if (e.target === document.getElementById("menuPanel"))
    document.getElementById("menuPanel").classList.remove("open");
});
document.getElementById("signOutBtn").addEventListener("click", () => {
  document.getElementById("menuPanel").classList.remove("open");
  doSignOut();
});

/* ---------------- guest mode ---------------- */
function enterGuest() {
  guest = true;
  store.guestMode = true;            // board.js gates saving/sharing on this
  store.data = null;                 // start fresh; guest work is never saved
  setSyncStatus("Guest mode — nothing is saved");
  setupRoster = []; setupNextId = 1;
  renderSetupRoster();
  show("setup");
  // show the guest nudges in the squad and drills sheets
  document.querySelectorAll(".guestNote").forEach(el => el.hidden = false);
}
document.getElementById("landingGuest").addEventListener("click", enterGuest);

// entry screen: landing (intro + choices) <-> auth form
const authLanding = document.getElementById("authLanding");
const authPanel = document.getElementById("authPanel");
function showAuthPanel(on) {
  authLanding.hidden = on;
  authPanel.hidden = !on;
  if (on) document.getElementById("authEmail").focus();
}
function resetAuthView() { showAuthPanel(false); authError.textContent = ""; }
document.getElementById("landingAuth").addEventListener("click", () => showAuthPanel(true));
document.getElementById("authBack").addEventListener("click", () => showAuthPanel(false));

/* ---------------- boot ---------------- */
if (DEMO) {
  setSyncStatus("Demo mode — data stays on this device");
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (e) {}
  if (saved && saved.roster && saved.roster.length) {
    store.data = saved;
    enterBoard();
  } else {
    setupRoster = []; setupNextId = 1;
    renderSetupRoster();
    show("setup");
  }
} else {
  onAuthStateChanged(auth, async user => {
    if (!user) {
      store.detach();
      if (!guest) { resetAuthView(); show("auth"); }
      return;
    }
    guest = false;
    store.guestMode = false;
    document.querySelectorAll(".guestNote").forEach(el => el.hidden = true);
    // load or create team doc
    let snap;
    try { snap = await getDoc(doc(db, "teams", user.uid)); }
    catch (e) { snap = null; }
    store.attach(user.uid);
    if (snap && snap.exists()) {
      store.data = snap.data();
      enterBoard();
    } else {
      // brand-new account: carry over whatever the guest built this session,
      // now that there is an account to save it to
      if (store.data && store.data.roster && store.data.roster.length) {
        store.save({});                       // persist the in-memory team to Firestore
        enterBoard();
        return;
      }
      setupRoster = []; setupNextId = 1;
      renderSetupRoster();
      show("setup");
    }
  });
}

// returning to the foreground: pull the latest server state before any
// further saves, so a backgrounded tab cannot overwrite newer data
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible") { store.flush(); return; } // leaving: save now
  if (DEMO || guest || !store.uid || store.pending || store.writing) return;
  try {
    const snap = await getDoc(doc(db, "teams", store.uid));
    if (snap.exists() && !store.pending && !store.writing) {
      store.data = snap.data();
      store.emit();
    }
  } catch (e) {}
});
window.addEventListener("pagehide", () => store.flush());

// keep header in sync with remote team-name changes
store.subscribe(d => {
  if (d && d.teamName) {
    const h = document.getElementById("hdrTeam");
    if (h.textContent !== d.teamName) h.textContent = d.teamName;
  }
});

/* ---------------- service worker + self-update ---------------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").then(reg => {
      reg.update();
      // re-check whenever the app comes back to the foreground
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update();
      });
    }).catch(() => {});
  });
  // when a new service worker takes over, reload once to pick up new code
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}
