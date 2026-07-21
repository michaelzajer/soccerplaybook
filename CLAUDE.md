# Soccer Play Book — project context

Mobile-first PWA for soccer coaches: set up a squad, arrange formations on a tactics
board, plan drills, run game days with timers. Built for phones/tablets used pitch-side.
Owner: Michael Zajer (michael.zajer@gmail.com). Team in testing: "Pumas".

Live at https://soccerplaybook-d2506.web.app (Firebase project `soccerplaybook-d2506`).
Local dev: `python3 -m http.server 8000` in this folder. GitHub repo: soccerboard.

## Stack — deliberate choices, do not "upgrade" without asking

- Vanilla JS, no framework, no build step. React/Tailwind were considered and rejected
  (pointer/canvas code gains nothing; build step unwanted; load speed matters pitch-side).
- Firebase: Auth (email/password), Firestore (offline persistence enabled), Hosting.
- PWA: manifest.json + sw.js, installable, works offline.
- Future path if native features needed (background timer alerts, store presence): Capacitor wrap. Not before.

## Files

- `index.html` — single page, all views/sheets. Versioned asset URLs (`?v=NN`).
- `styles.css` — hand-rolled theme, CSS variables in `:root`.
- `js/app.js` — Firebase init, auth flow, store (sync engine), guest mode, SW registration.
- `js/board.js` — everything else: board, drills, game day, timers, sharing. One big
  `initBoard(store)` closure.
- `js/firebase-config.js` — real config, committed (web keys are public by design).
- `firebase.json` / `.firebaserc` / `firestore.rules` — hosting + rules
  (`teams/{uid}` readable/writable only by that uid).
- `tactics-board.html` — original single-file prototype, kept as fallback, ignored by hosting.
- `icons/` — app icons, still old yellow/green palette (retheme pending).

## RELEASE RITUAL (every change)

1. Bump version in FOUR places: `styles.css?v=NN` and `js/app.js?v=NN` in index.html,
   both imports inside app.js (`firebase-config.js?v=NN`, `board.js?v=NN`),
   and `CACHE = "spb-vNN"` in sw.js. Currently at **v41**.
2. `node --check js/*.js` before declaring done.
3. Always give Michael this block at the end (his standing request):

```bash
cd ~/app/soccerboard
rm -f .git/*.lock
git add -A && git commit -m "<message>"
git push
firebase deploy
```

The `rm -f .git/*.lock` is needed because the sandbox cannot delete lock files on the
mounted folder. Deploys self-update on user devices (no-cache headers on index/sw,
controllerchange → reload).

## Data model (Firestore: one doc per user, `teams/{uid}`)

```
{ teamName, roster:[{id,name,pos}], nextId,
  colors:{team,opp},                       // hex; defaults #2563eb / #ff453a
  board:{squad:"11"|"9", formation, showOpp, showNames, placed:{id:{x,y}}},
  gameday:{id?, date, time, opp, notes, lineup:{formation,squad,placed,at}|null},
  games:[gameday...],                      // saved games library
  drills:[{id,name,items:[{kind,x,y}], strokes:[{mode,pts:FLAT}]}],
  updatedAt }
```

- Coordinates are normalised 0..1 relative to the board.
- **Stroke points are FLATTENED for Firestore** (no nested arrays allowed) — see
  flatStroke/unflatStroke in board.js.
- Timers are device-local in localStorage (`spbGameTimer`, `spbSubsTimer`), not synced.

## CRITICAL bug lessons (do not regress)

1. **Never use `setDoc(..., {merge:true})` for this doc.** Deep merge resurrects deleted
   map keys (benched players kept reappearing on the pitch for days). Saves are full
   document replaces.
2. Sync echo guard: `store.dirty` + `dirtySince` (5s expiry) prevents snapshot echoes
   undoing drags; visibilitychange refetch prevents stale backgrounded tabs overwriting.
3. Browser caches module JS aggressively → that is what the `?v=` bumps are for. "It
   works local but not deployed" almost always = not deployed or old SW; hard refresh.

## Architecture notes

- `store` (app.js): holds `data`, debounced save (600ms), onSnapshot subscribe,
  localStorage backend when DEMO (placeholder config) or guest mode. Guest data migrates
  into a newly created account automatically (DEMO_KEY localStorage).
- Views in board.js: `currentView` = team | game | drills via `setView()`.
  - Team = the standard board (store.data.board).
  - Game = separate pitch: entering stashes the team board (`teamStash`), loads
    `gameday.lineup` onto board; leaving writes board back to lineup and restores stash.
  - Drills = kit items (cones/discs/poles/balls/players/goals/mini goals), own items array.
  - One sketch buffer per view (`strokeBufs`), `strokes` points at the active one.
- Navigation (settled after several iterations — Michael is picky here, ask before changing):
  header = team name (dot = team colour swatch) + ⋯ account menu;
  full-width Team/Gameday/Drills segmented tabs (tap active Team/Drills = options sheet,
  tap Game day ALWAYS = saved-games dropdown: "Set up new game" + list);
  match bar (game view only) = vs-label + game timer + subs timer + … (opens config sheet);
  formation select + ⟳ float over the pitch top-right; bottom pill toolbar =
  Move/Run/Pass/Dribble/Draw + Undo/Clear.
- Game config is a SHEET over the pitch (not a view): details, line-up card with tappable
  pitch preview (canvas), game timer (per-period clocks, tap H1/H2 chips to switch),
  independent subs countdown (rolls over automatically). Save game upserts by id into
  `games` and returns to the pitch.
- Timers are wall-clock anchored (correct after lock/background) but alerts only fire
  with app open — beeps (WebAudio), vibration (Android only). Wake Lock discussed, not
  yet implemented. Capacitor is the real fix if needed.
- Sharing: canvas-rendered PNG (team sheet incl. opp/date header; drills via ↗ in
  library) through `navigator.share` files, download fallback on desktop.
- Colours: `colors()`/`applyColors()` set `--team/--opp` + auto ink (YIQ) from
  `data.colors`; PNG renderers use `colors()` too. UI accent (`--accent` #3b82f6 blue,
  `--accent-ink` white) is INDEPENDENT of team colour. Michael disliked the old yellow.
- Touch: tokens/drill pieces have invisible enlarged hit areas (::before inset -11px).
  Tray drag is direction-aware (horizontal = scroll with edge fades, vertical = place).

## Testing without a browser

jsdom smoke tests work (see /tmp/t4.mjs pattern from the build session): stub
canvas getContext, setPointerCapture, getBoundingClientRect; set
`global.Event = window.Event` and `global.requestAnimationFrame`; add `process.exit(0)`
(the timer setInterval keeps node alive). node --check for syntax always.

## Michael's working preferences (observed)

- Australian English, no contractions, concise, direct. Lead with the answer.
- Always end changes with the combined git+deploy block (above).
- He tests on a real phone and reports UX friction plainly ("looks rubbish") — respond
  with a design rethink, not defensiveness. Screenshots from him pinpoint issues fast.
- Prefers working first drafts he can react to over option lists.
- Wants honest analysis of bugs including my own misdiagnoses.

## Backlog (agreed, not built)

- Wake Lock while a timer runs (recommended next, ~15 lines).
- Sub suggestions: position groups (GK / defenders / mids / attackers interchangeable
  within group) — Michael chose this model; minutes-played tracking for fair rotation.
- Public shareable team-sheet links (needs public read routes; images cover it for now).
- Password reset ("Forgot password?" via Firebase email) + account management.
- Retheme app icons to blue palette.
- Demo/guest polish; game history is covered by saved games library.
- Possible tablet layout use of side space; Capacitor wrap eventually.
