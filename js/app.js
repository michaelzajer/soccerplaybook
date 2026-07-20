import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, setDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=20";
import { initBoard } from "./board.js?v=20";

// Demo mode: no Firebase config yet -> skip accounts, keep data on this device.
const DEMO = firebaseConfig.apiKey.startsWith("PASTE");
const DEMO_KEY = "tacticsDemoTeam";
// Guest mode: user chose "try without an account" -> same device-only storage.
let guest = false;
const isLocal = () => DEMO || guest;

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
      // ignore echoes of our own pending writes, and any snapshot that
      // arrives while local changes are still waiting to be written —
      // otherwise a stale server copy can undo a drag mid-flight
      if (snap.metadata.hasPendingWrites || this.dirty) return;
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
    this.dirty = true;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      if (isLocal()) {
        try { localStorage.setItem(DEMO_KEY, JSON.stringify(this.data)); } catch (e) {}
        this.dirty = false;
        return;
      }
      if (!this.uid) return;
      setDoc(doc(db, "teams", this.uid),
        { ...this.data, updatedAt: serverTimestamp() }, { merge: true })
        .then(() => { this.dirty = false; })
        .catch(() => { this.dirty = false; setSyncStatus("Offline — changes saved on this device"); });
    }, 600);
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
    guest ? "Guest — data saved on this device only"
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
function loadLocalTeam() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (e) { return null; }
}
function enterGuest() {
  guest = true;
  setSyncStatus("Guest mode — data stays on this device");
  const saved = loadLocalTeam();
  if (saved && saved.roster && saved.roster.length) {
    store.data = saved;
    enterBoard();
  } else {
    setupRoster = []; setupNextId = 1;
    renderSetupRoster();
    show("setup");
  }
  // show the guest nudges in the squad and drills sheets
  document.querySelectorAll(".guestNote").forEach(el => el.hidden = false);
}
const guestBtn = document.getElementById("guestBtn");
if (guestBtn) guestBtn.addEventListener("click", enterGuest);

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
      if (!guest) show("auth");
      return;
    }
    guest = false;
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
      // brand-new account: migrate any guest team saved on this device
      const local = loadLocalTeam();
      if (local && local.roster && local.roster.length) {
        store.data = local;
        store.save({});                       // now writes to Firestore
        try { localStorage.removeItem(DEMO_KEY); } catch (e) {}
        enterBoard();
        return;
      }
      setupRoster = []; setupNextId = 1;
      renderSetupRoster();
      show("setup");
    }
  });
}

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
