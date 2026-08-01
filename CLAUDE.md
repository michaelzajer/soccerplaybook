# Soccer Play Book — project context

Mobile-first PWA for soccer coaches: set up a squad, arrange formations on a tactics
board, plan drills, run game days with timers. Built for phones/tablets used pitch-side.
Owner: Michael Zajer (michael.zajer@gmail.com). Team in testing: "Pumas".

Live at https://soccerplaybook-d2506.web.app (Firebase project `soccerplaybook-d2506`).
Local dev: `python3 -m http.server 8000` in this folder. GitHub repo: soccerboard.

## Stack — deliberate choices, do not "upgrade" without asking

- Vanilla JS, no framework. React was considered and rejected (pointer/canvas code
  gains nothing from it).
- **Tailwind v4 was added later** (`npm run build:css`, `src/tailwind.css` → `tailwind.css`)
  and now sits alongside the hand-rolled `styles.css`. This is a genuine tension:
  `styles.css` is unlayered so it wins over Tailwind's `@layer utilities`, but
  INLINE arbitrary values in the markup still beat both. Two sizing systems,
  and the wrong one kept winning — see the warning below.
- Firebase: Auth (email/password), Firestore (offline persistence enabled), Hosting.
- PWA: manifest.json + sw.js, installable, works offline.
- Capacitor wrap exists (`ios/`, `android/`) for native timer alerts.

### NEVER SIZE THE APP WITH `sm:` (v147 — this cost real usability)

Tailwind's `sm:` is **640px**. A phone is 390-430px, so it NEVER fires. Every
`class="text-[10px] sm:text-sm"` pair therefore hands the PHONE the small value
and the DESKTOP the large one — the exact inverse of mobile-first, in an app
used pitch-side in the rain. It read fine in a desktop browser and was unusable
on the device.

The damage at v146: nav tabs at 10px, team row at 11px, the two match clocks at
9px, and the score `+`/`−` buttons at **20px squares** — under half the 44px
minimum touch target. Those inline classes also overrode `--fs-sm`/`--sz-ctl`,
the clamp() scale in `styles.css` that was already correct.

The rule: **the chrome rows carry NO sizing classes in the markup.** Sizing lives
in `styles.css` on the clamp() tokens, where the base value is the phone value
and the clamp grows it upward. `_chrome.mjs` fails the build if `sm:` or
sub-12px type reappears in those rows.

## Files

- `app.html` — THE APP. Single page, all views/sheets. Versioned asset URLs (`?v=NN`).
- `index.html` — the marketing landing page, NOT the app. Has its own hand-rolled
  hero drill animation (covered by `_landing.mjs`).
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

The app is **`app.html`**, not index.html (index.html is the marketing landing page).
Bump ALL of these to the SAME number, every time — they had drifted to six
different values (sw 146, tailwind 148, styles 146 *and* 173, drills 147,
drill-text 162, app 172), which makes a deploy non-deterministic:

1. In `app.html`: `tailwind.css?v=NN`, `styles.css?v=NN` (in `<head>` — it must be
   linked ONCE; a second link at the bottom of `<body>` cost a whole extra 50KB
   download and parse), `js/drills.js?v=NN`, `js/drill-text.js?v=NN`,
   `js/app.js?v=NN`.
2. In `js/app.js`: `firebase-config.js?v=NN`, `board.js?v=NN`.
3. In `sw.js`: `CACHE = "spb-vNN"`. Currently at **v151**.
4. `node --check js/*.js sw.js` before declaring done, then the `_*.mjs` suite.
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
  unavailable:[id...],                     // injured/unavailable roster ids (team-wide, ongoing)
  board:{squad:"11"|"9", formation, showOpp, showNames, placed:{id:{x,y}}},
  gameday:{id?, date, time, opp, notes, score:{us,them}, lineup:{formation,squad,placed,at}|null,
           subs:[{inId,outId,min,period,batch}],  // `batch` groups one confirm so Undo
                                          //         takes the whole change back
           completed?, finishedAt?, minutes?:{id:mins}},  // set by Finish game;
                                          // minutes are FROZEN there, see below
  games:[gameday...],                      // saved games library
  drills:[{id,name,items:[{kind,x,y,color?}], strokes:[{mode,pts:FLAT,color?}]}],
                                     // color (hex) optional: cones/markers/players + lines
  updatedAt }
```

- Coordinates are normalised 0..1 relative to the board.
- **Stroke points are FLATTENED for Firestore** (no nested arrays allowed) — see
  flatStroke/unflatStroke in board.js.
- Timers are device-local in localStorage (`spbGameTimer`, `spbSubsTimer`), not synced.

## Drill playback model (rewritten v121 — do not reintroduce heuristics)

A drill is a **circuit plus a queue**, not a cloud of pieces to be guessed at.

- **A LEG BELONGS TO A SLOT, NOT A PLAYER (v123 — this is the crux).** Whoever
  is standing on a leg's start position performs it. After one rotation player 5
  is on cone 1, so player 5 runs the cone1->cone2 leg. Binding legs to a piece id
  looked right on lap 1 and then froze the drill on lap 2 — `stroke.from` is
  still recorded but is NEVER used to choose the actor.
- Player-moving legs (run/dribble/passrun) only ever consider PLAYERS, so a cone
  sitting on the same spot cannot be picked up and animated instead.
- **START CONE (v122).** Tap a cone/disc in drills to mark it as the entry slot
  (`item.startCone`, saved with the drill, blue ring in the UI). It defines the
  slot the queue feeds into AND the slot a runner reaches to complete a lap, so
  the rotation no longer assumes "the first stroke was drawn from the entry".
  Without a marker it falls back to that old convention.
- **Stroke binding prefers PLAYERS.** A cone sits under the player standing on
  it; binding to the cone would animate the cone and strand the player.
- **STATIONS (v125) — the whole rotation, one rule.** Every cone/disc is a
  STATION with its own queue: the players who started nearest it, ordered by
  distance from it. Each leg says "front of station A travels to station B";
  the arriving player joins the BACK of B's queue. After the legs, each station
  re-lays its queue along its own original slot positions — survivors shuffle
  forward, arrivals take the back.
    square circuit — 4 stations with a queue of one each, plus the long feeding
                     queue at the start cone
    facing lines   — 2 stations with long queues, players shuttling and joining
                     the opposite back
  MULTIPLE LANES NEED NO SPECIAL HANDLING: stations and legs are local, so two
  drills side by side never reference each other. Duplicate shirt numbers across
  lanes are fine — nothing keys off the number. (The previous single-queue model
  ordered ONE queue by distance from ONE start cone, which merged both lanes and
  threw right-hand players onto the left-hand line.)
  Every player inherits an EXISTING slot, so layout is preserved exactly over
  repeated loops (no outward drift) and looping is stable.
- This replaced ~190 lines of geometric inference (`injectQueueStrokes`,
  `detectQueues`, `findVacancy`, `rotateFinishedToBack`) with about ten tuned
  magic numbers. If a drill misbehaves, fix the MODEL, do not add a threshold.
- Reference drill (Michael's): 4 cones in a square, players 1-4 on the cones,
  5-8 queued behind cone 1, follow-your-pass, cone 1 marked as start. Lap 1 —
  1->cone2, 2->cone3, 3->cone4, 5->cone1, 6/7/8 shuffle up, 4 to the back.
  It must keep cycling: L2 c1:P6 c2:P5 c3:P1 c4:P2 ... and after 8 laps with
  8 players everyone is back on their original cone. /tmp/laps.mjs pattern
  (stub the timeline, capture `onComplete`, call it to advance a lap) tests this —
  a test that only counts occupied slots will NOT catch a frozen rotation.
- Second reference drill ("medium"): TWO lanes side by side, each a shuttle
  between a top line and a bottom line of 3. Front of each line travels to the
  opposite station and joins its back; no player ever changes lane.

### Sequencing: WHAT TRIGGERS THE NEXT MOVE (v129)

Playback is built in TWO passes, and the split matters:

- **Pass A — who does what, and where it ends.** Walked in draw order, because
  resolving the actor depends on where everything has got to. NO timing is
  decided here: a leg's start can depend on a leg drawn LATER.
- **Pass B — when each leg runs.** The trigger is the END of the lines a leg
  depends on, not merely something sitting on its start:
    1. the actor (and any ball it carries) has finished its previous leg;
    2. whoever must be standing on my START has arrived (the old rule, kept);
    3. the RECEIVING END is ready — three cases the start-only rule could not
       express, and which a combination drill is entirely made of:
       - **3a pass to a moving target** — "player 2 passes to wherever player 1
         is", player 1 having run off first. Player 1 never touches the pass's
         start, so rule 2 is blind and the ball was launched at empty grass. A
         pass waits for any earlier leg ENDING where it ends.
       - **3b running onto a pass** — "player 1 passes half way, player 2 runs
         and gets the ball". Both legs were free at t=0, so each finished on its
         own length and the runner beat or missed the ball. A run ending where a
         pass ends is timed to ARRIVE WITH IT (never starting before rules 1-2).
       - **3c pass before you go** — "player 1 passes through the cones, then
         runs to the back of the queue". Nothing in the run said it must follow
         the pass, so the player sprinted off and the ball left from an empty
         spot. A player leaving a point waits for any pass STRUCK from that
         point (struck, not received — you go as the ball leaves your foot).
  Rules 3a-3c only look BACKWARDS through the draw order, which matches how a
  coach describes a drill ("A passes, then B runs"). Draw the receiving run
  before its pass and you lose the arrive-together sync, not the ordering.
  `DEP_TOL` 0.08 = "same place", `LEG_GAP` 150ms = breath between legs.
  **`LOOSE_TOL` 0.15 for rule 3c specifically (v131).** A pass is already allowed
  to be struck by a ball up to 0.15 away, because nobody draws the line exactly
  on the ball — so "pass before you go" has to be equally forgiving or the
  engine binds the pass to a player and then lets that player run off before
  playing it. In complex3 the third left-lane pass was drawn 0.11 from where the
  ball had come to rest: player 6 left for the queue at 950ms and the ball was
  struck from empty grass at 2185ms. Matching tolerances fixed it.
- **NEVER TELEPORT (v131).** The actor is bound from up to 0.15 away, so the
  drawn start is rarely exactly under the piece — animating from the drawn point
  made the piece flick sideways before travelling. Every leg now starts from the
  piece's REAL position: `pathPts = [[closest.x, closest.y], ...rest]`.
- **Third reference drill (Michael's "complex3"): two mirrored lanes, four
  queues.** Top/bottom/left/right queues, cones down the centre. Each lane:
  queue player passes in, receiver runs onto it, passer runs on, receiver
  returns it to where the passer went, then a cross-field pass and a pass+run
  into the next queue — so all four queues rotate. It exercises 3a, 3b and 3c
  simultaneously in both lanes, and the lanes must not reference each other.
- Pass lines have NO arrowhead (v129): the dashes read as a pass, playback shows
  direction, and the marker cluttered short passes. Removed in both `redraw()`
  and the PNG renderer. Pass+Run keeps its arrow.
- **Getting a drill off a device:** drills live only in `teams/{uid}`, so the
  drill edit sheet (Drills → library → the ⓘ on a drill row) has "Copy drill
  data" → JSON (strokes unflattened) on the clipboard. Use it rather than guessing at a drill's geometry.

### A pass beats its passer (v136)

Ball and player used to share one duration, so on a pass+run the passer escorted
his own pass the whole way and the ball never reached the receiver first.

- `RUN_MS_PER_UNIT` 3500 vs `BALL_MS_PER_UNIT` 1900 — a struck ball covers the
  same ground about 1.8x quicker. A leg's actor uses whichever applies to its own
  kind; `ballDur` is the pass speed EXCEPT for `dribble`, where the ball is at the
  player's feet and moves at his pace.
- The ball's arrival is tracked separately (`p.ballEnd`), because a following leg
  waiting on the ball must wait for the BALL, not for the runner still jogging in.
- **Rule 2 had to be narrowed at the same time.** It waited for everything
  arriving at a leg's start point, so the moment the ball started arriving first,
  a receiver still could not play on until the passer finished jogging over —
  the delay just moved. It now waits only for the pieces the leg NEEDS: the actor
  and its ball. A ball arriving still counts (you cannot pass what you have not
  received); another player running in behind you does not.
- Knock-on for rule 3b: a pass into space now lands and WAITS to be collected
  rather than arriving with the runner, because `passEnd - runDur` goes negative
  and clamps to the runner's own earliest start. That is correct for an underhit
  pass into space, and `_seq129.mjs` asserts the ball lands first rather than
  the old "arrive together".

### Pace, and why a leg's length is aspect-weighted (v141)

- `RUN_MS_PER_UNIT` 9000 / `BALL_MS_PER_UNIT` 5000, minimums 1200 / 700, all
  multiplied by `drillSpeed` (transport bar, cycles 1.7x / 1x / 0.6x / 0.4x,
  remembered in `localStorage` as `spbDrillSpeed`; bigger constant = slower).
  The old 3500/1900 with an 800ms floor meant every leg of a small drill hit the
  floor, so all passes took the same 800ms and it read as a blur.
- **A leg's length must be measured in REAL distance.** `len` used an unweighted
  hypot of normalised coordinates, so on a 68x105 pitch a 21 m pass ACROSS
  measured 0.31 and the same 21 m pass UP measured 0.20 — the horizontal one
  animated 1.5x slower. `dy` is now weighted by `PITCH_LEN / PITCH_WID`, so a
  square drill's four legs take the same time. Units are pitch WIDTHS of real
  distance.
- `localStorage` is read at init for the speed, so it goes through `lsGet/lsSet`:
  it THROWS (not just returns null) in Safari private browsing, which would have
  taken the whole board down. The two timer reads were switched to it as well.

### Playback library: GSAP 3.12.5 (migrated from anime.js)

`drillTimeline = gsap.timeline({ defaults:{ease:'none'}, onComplete })`, and each
leg is `drillTimeline.to(el, {keyframes, duration: ms/1000}, startMs/1000)`.
GSAP works in SECONDS, so the engine keeps all its own arithmetic in ms and
divides at the call site only. The test harness stub mirrors that: it implements
`to(target, vars, position)` and multiplies back up by 1000, and reads
`cfg.onComplete` (not `cfg.complete`).

The notes below were written against anime.js. They still apply, because the code
still seeds positions and animates in PIXELS for the same reasons.

### Animation gotchas (px keyframes and seeding)
- **Animate `left`/`top` in PIXELS, never `%`.** anime converts a % keyframe to
  px using `offsetWidth` for BOTH axes, so on a 68:105 pitch vertical motion was
  scaled by ~0.65 and drills played back squashed.
- The element's INLINE style is anime's start value, so seed positions with
  `setPosPx()` before building the timeline — mixing a `%` start with `px`
  keyframes made pieces jump to the origin before animating.
- Reading a final keyframe back to normalised coords must divide by the board
  rect, not by 100 (that bug stopped the ball after one pass).

## CRITICAL bug lessons (do not regress)

0. **A control must live where the task is.** `#colorBtn` sat inside `<footer>`,
   which became the LINES pane — so while placing cones in the Drill Setup pane
   the colour palette was simply not on screen. It now lives on `#drillDock`
   (no `data-pane`, and the dock click handler returns early for buttons without
   one) so it is reachable from every pane. `body.paneOpen` lifts `#drillColors`
   clear of an open pane; without a pane it sits just above the dock.
0a. **A SHEET MUST SCROLL.** `.sheet` was `max-height:92dvh` with no overflow
   rule, and `.tlab{flex:1}` lets a textarea eat the space — so the LAST control
   in a tall sheet was pushed off the bottom of the phone with no way to reach
   it. "Copy drill data" was invisible under the drill notes box and read as
   never having shipped. `.sheet` is now `overflow-y:auto`, `.sheet > button` is
   `flex:0 0 auto` so a button can never shrink away, and `.grip` is
   `position:sticky` (with a solid backdrop layer) so drag-to-dismiss survives
   scrolling. Add a control to a sheet and CHECK IT ON A PHONE.
0b. **`position:absolute` + `getBoundingClientRect()` is a bug.** The number
   selector was placed from viewport coordinates but positioned absolutely, so
   it was offset by however far `#boardView` sat from the viewport origin, and
   `translate(-50%,-100%)` forced it ABOVE the piece — a player near the top of
   the pitch pushed it off-screen, where its buttons were unreachable and it read
   as "frozen". It is now `position:fixed`, z-index 500 (over dock 120 / panes
   130-140), flips to `.below` when there is no room above, and is clamped
   horizontally. The piece's own click handler calls `stopPropagation()` so the
   document-level dismiss does not close the popup it is opening.

1. **Never use `setDoc(..., {merge:true})` for this doc.** Deep merge resurrects deleted
   map keys (benched players kept reappearing on the pitch for days). Saves are full
   document replaces.
2. Sync echo guard: incoming snapshots are ignored while a local write is
   `pending` (queued in the 600ms debounce) or `writing` (setDoc in flight) — this
   held on a time basis before (`dirty` + 5s `dirtySince`), but the 5s window let a
   slow write's stale echo snap a drag back to its previous spot, so it is now keyed
   on write confirmation instead. `store.flush()` writes immediately and is called on
   visibilitychange-hidden + pagehide so a move made just before backgrounding is not
   lost. visibilitychange-visible refetch (guarded by !pending && !writing) prevents
   stale backgrounded tabs overwriting.
3. Browser caches module JS aggressively → that is what the `?v=` bumps are for. "It
   works local but not deployed" almost always = not deployed or old SW; hard refresh.

## Architecture notes

- `store` (app.js): holds `data`, debounced save (600ms), onSnapshot subscribe.
  Persistence by mode: signed-in = Firestore; DEMO (placeholder config) = localStorage
  (DEMO_KEY); GUEST = nothing (in-memory only — `flush()` no-ops for guests). Guest is
  a deliberate try-only mode: not saved, and sharing is blocked (store.guestMode →
  guestShareBlocked alert). If a guest creates an account, the in-memory team is carried
  into Firestore on first auth (onAuthStateChanged new-account branch saves store.data).
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
  In DRILLS the formation select is hidden so top-right ⟳ shows alone and means
  "clear the pitch" (clearDrillBoard). The toolbar #colorBtn (rainbow dot, all board
  views) pops #drillColors up out of the toolbar. That pop-up has rows: "Players" and
  "Opp" set the team/opp KIT colours (data.colors, global, live via applyColors — same
  4 swatches shown in My Squad's full hex pickers, kept in sync) in EVERY view; a
  drills-only "Item" row sets `drillColor` for the next cone/marker/line placed.
  refreshColorPalette() highlights the active swatch per row on open. COLOURED_KINDS =
  cone/disc/att/def; for drill players white on the Item row means "use the default kit"
  (effectiveColor strips it) so Player=team/Opp=opp defaults are preserved; drill lines
  only coloured while in drills. Piece colour is inline style over the CSS class
  (paintPiece/shade). e.g. 3v3v3 preset uses three Item colours to show three teams.
- Entry screen (authView) = landing (intro list + "Try as guest" + "Log in/register")
  that reveals the email/password panel on demand (#authLanding / #authPanel toggle,
  resetAuthView() returns to landing on sign-out).
- Subs bar (#benchZone, team+game views): left "Subs" (available, unplaced) + right "Out"
  (#outZone, unavailable). A sub token (enableSubDrag) does both: TAP = select (subSel) then
  tap an on-pitch player to swap; DRAG onto empty pitch = place, DRAG onto a player = open
  #subPanel for that swap, DRAG onto #outZone = mark unavailable. #subPanel edits the incoming
  player's position (default = the slot being filled), then swaps (incoming takes the spot,
  pos updated on roster, outgoing to subs). Tap an empty pitch spot with a sub selected also
  places them. On-pitch players: drag onto #outZone marks unavailable; tap an Out token to
  restore. applyFormation skips unavailable.
- Game scoreboard (#scoreBar, gameView only): gameday.score {us,them}, +/- buttons, green
  LED-style numbers; renderScore() on renderGameday + setView('game'); saved with the game.
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

## Alignment: grid snap + line tidying (v132)

Precision on a phone is the constraint, so the board is forgiving rather than
asking the coach to be accurate.

- **Pieces are bigger.** `.ditem` went from `clamp(16px,5.5%,30px)` to
  `clamp(22px,7.5%,40px)`, hit area `inset:-13px`, tray icons up to
  `clamp(30px,8.2vw,38px)`.
- **Lattice snap, drills only.** Cell = ONE PIECE WIDE and SQUARE IN PIXELS —
  the pitch is 68:105, so snapping in normalised units gives stretched cells and
  cones that align across but not down. `GRID_FRAC/GRID_MIN/GRID_MAX` in
  board.js mirror `.ditem`'s clamp: change both together. The grid is hidden and
  fades in only while a piece is dragged or a line drawn (`#board.showGrid`,
  cell fed in via `--grid-cell`).
- **Line endpoints snap to a PIECE and to nothing else.** This is the highest
  value part: the dependency rules match a leg's ends against pieces, so an end
  dropped a thumb-width off the ball is what let complex3 launch a pass from
  empty grass. It deliberately does NOT fall back to the lattice — a pass into
  space must stay where the coach put it.
- **`tidyStroke()` fits a drawn line to a chord with at most a gentle bow.**
  Bow = the drawn path's largest sideways departure, damped 0.55, zeroed under
  7px, capped at 0.22 of the chord; resampled to 17 points (from ~150, which
  also keeps drills inside Firestore's document limit). `mode:"draw"` is exempt.
  **Measure the bow against the chord the coach DREW, not the snapped one** —
  measuring against the snapped chord conflates "how much did they curve it"
  with "how far did the ends move", so snapping an end to a cone bends an
  otherwise straight line.

### The ball must stay visible (v133)

Every `.ditem` shares `z-index:20`, so a ball and a player on the same cone
stacked by DOM order and the ball lost whenever it was added first. `.d-dball`
is now `z-index:26` with a dark ring (reads on a light shirt as well as a dark
one) — but on top AND centred it just hid the shirt number instead, so it is
drawn IN FRONT of the player, in the direction that player is about to move
(v135): `orientBalls()` finds the line departing each ball, takes its bearing a
few points in (so a wobbly first pixel cannot set the angle) and writes
`--bx/--by`. Ties go to the FIRST line drawn — that is the one played first.
Magnitude `BALL_VIS_OFF` 0.85 of a piece is where the player's 0.5 radius and
the ball's 0.35 stop overlapping; anything less sat on the shirt. Running the
offset ALONG the line rather than across it also makes the ball lead correctly
during playback instead of drifting sideways off its own pass.
The offset is VISUAL ONLY — `item.x/y` is still the centre — so `snapEndpoint`
matches a ball at BOTH its true and its drawn position (`BALL_VIS_OFF`, keep it
in step with the CSS) and returns the true one. Without that, aiming a pass at
the ball you can see bound it to the player standing beside it. The PNG renderer mirrors both the offset and the ring, and draws
balls after all other pieces for the same reason.

### Retro-fitting old drills (v137)

Drills saved before the snapping existed have cones off the lattice and line ends
a thumb-width off the ball. `tidyDrillData(d)` brings a saved drill up to the
current rules and is exposed on the drill edit sheet as **Tidy lines & cones**
(Drills → library → ⓘ). It works on drill DATA, so it does not need the drill
loaded, and it reports the point count before/after.

- **Resolve which piece an end BELONGS to against where that piece WAS, then move
  the end to where the piece now IS.** Snapping the pieces first and then matching
  ends against the moved pieces let a cone shift out of reach of its own line end:
  ends that were 12px off finished 19px off, so tidying made alignment worse. Get
  this order wrong and the migration is actively harmful.
- On Michael's real complex3 the effect is 2416 points → 272 (17 per line), all 18
  pieces on the lattice, worst end-to-piece gap 11.8px → 0, worst bow → 0.
- It CANNOT fix a pass struck from where a ball comes to rest *during playback* —
  that is a runtime position, not a stored one. `LOOSE_TOL` handles that case.

## Substitutions (v142, rebuilt v148)

Game day → **⇄ Subs** on the bench bar (or tap the "Subs" label). Broadcast
language throughout — red down-arrow off, green up-arrow on.

**TICK EVERYONE COMING OFF, THEN ASSIGN THEM ONE AT A TIME (v150).** Tapping a
player on the pitch list TICKS them; several can be ticked, because a coach calls
"Cooper, Jaylan and Tom off" in one breath. "Choose 3 replacements" then walks
through them one at a time — "who comes on for Cooper?" — and each pair locks as
it is answered. One confirm applies them all at the same match minute.

Three models have been tried here; the constraints are worth keeping straight.
- v143 paired by TAP ORDER, nth-off with nth-on across two columns. Fewest taps,
  and wrong: it asked a coach to hold two parallel orders in their head *while a
  game was running*, and a mis-ordered tap could only be fixed by rebuilding the
  column.
- v148 locked a pair on the second tap. Unmistakable, but only one player could
  be picked at a time, so it READ as "you can only sub one player" — which is
  exactly what Michael reported.
- v150 keeps the v148 guarantee (every replacement is chosen against a NAMED
  player, so nothing can be mismatched) and multi-selects the way off.

`picking` is `"off"` or `"on"`; `subsOff` is the tick list, `assignIdx` walks it,
`subsPending` is the completed pairs. **Back from the bench list keeps the ticks**
— losing three names the coach just chose is the thing that made v143 painful.

**ONE full-width list, not two columns.** On a 430px phone each column was ~195px
and had to carry a position disc, a name, an order badge and an editable
position, so names truncated and every target was under 44px. You never need both
lists at once, so the single list switches: pitch while choosing who comes off,
bench while choosing who comes on. That buys 56px rows and readable names. There
is also **no nested scroll** any more — the sheet scrolls, the list does not, so
reaching the confirm button never means scrolling inside a box first.

- **Minutes played, reconstructed not stored.** Rewind the CURRENT line-up
  backwards through `gameday.subs` to recover the starting XI, then walk forward
  accumulating intervals. Reconstructing means the figure is always consistent
  with the log and an undo cannot strand a stale counter. Only CLOSED intervals
  count when the clock is not running, which is why `_subs.mjs` can assert exact
  numbers without a running clock.
- **The lists are ordered by minutes**: bench fewest-first (who is owed a run),
  pitch most-first (who has been out there longest). Fair rotation is the whole
  reason a junior coach subs at all, so the decision input belongs on the screen
  where the decision is made.
- **Undo takes back the whole batch.** Every swap in one confirm shares a
  `batch` id. Undo reverses the batch and DELETES it from the log rather than
  recording a counter-swap — a mis-tap is not a tactical decision and should not
  appear in the game's record as one. Entries saved before v148 have no `batch`,
  so undo falls back to matching on `min`.
- **Keeper guard.** Taking the GK off with no GK coming on warns and does not
  block: it is usually a mistake and occasionally deliberate.
- **Position is edited in ONE place**, the pair row. It used to be editable both
  on the list row and on the pair row — two overlapping sub-44px targets inside
  a 195px row, which is a mis-tap generator. The incoming player inherits the
  vacated position by default (a striker on for a centre mid plays centre mid);
  typing overrides it. Note this rewrites the player's squad position, which is
  what makes the pitch token read correctly; a per-game override would be bigger.
- `applySubs(pairs)` snapshots every vacated spot BEFORE mutating anything, so a
  batch stays correct regardless of ordering. `applySub` is a one-pair wrapper
  for the drag-and-drop `#subPanel` path, so the two cannot diverge.
- The unavailable list is respected: an injured player is never offered.
- The sheet **closes and returns to the pitch** after a change (v145) — several
  changes can be queued in one visit, and the new shape is what the coach wants
  to see next.

## Match notes and Finish game (v150)

- **Notes pill, top LEFT of the pitch, game view only.** Deliberately the
  opposite corner from the formation controls, and reachable with a left thumb
  while the right hand holds the phone. It writes `gameday.notes` — the field the
  data model already had — so the note taken at 20', the one in the game-details
  sheet and the one at full time are all the SAME text. A dot on the pill shows
  there is something written.
- Saving happens **on every keystroke** through the store's debounce, not on
  close. A coach who locks the phone mid-note must not lose it; `store.flush()`
  on pagehide already covers backgrounding.
- `⏱ 34'` inserts the match minute at the cursor on a new line. The box stays
  free-form — coaches write in their own shorthand — but the timeline is
  recoverable afterwards, which is most of the value of notes taken live.
- **Finish game is a REVIEW step, not a save button.** Game day → Finish this
  game shows the score, every substitution with its minute, minutes played
  (most first — the question at full time is who got short-changed) and the
  notes. Nothing is written until Save, so backing out leaves the game untouched.
  `_gameday.mjs` asserts that explicitly.
- **Minutes are FROZEN onto a completed game** (`g.minutes`). They are
  reconstructed from the log everywhere else, but the log cannot know when the
  game ENDED — without freezing, a finished game's minutes would keep counting up
  with the clock.
- The games list splits **In progress / Completed**. A finished row is labelled
  with the result rather than the fixture, because that is what you scan for
  afterwards, and carries a ↗ that shares a full-time PNG (score, subs, minutes,
  notes) through the existing `shareCanvas`. An image, not text: it goes to a
  team WhatsApp group.
- `_subs.mjs` must reset the roster from a PRISTINE deep copy between sections —
  `applySubs` mutates player objects in place, so re-copying the live array
  carries the drift forward and makes correct behaviour look broken.

## NO ENGLISH PARSER IN THE APP (v149 — do not add one back)

`parseSequenceLines` was a ~260-line regex parser for prose ("player 1 passes to
player 2 who runs out 5m to meet the ball…"). It has been deleted. Three reasons,
all of which apply to any replacement:

1. **It was wired to the drill NOTES box** (`#drillNotes` / `#liveNotes` /
   `#deNotes`) and recompiled on every keystroke, doing `drillSteps = [strokes]`
   then `pushState()`. Typing a coaching point onto a hand-drawn drill silently
   destroyed the drill. Notes are notes now; the boxes only mirror each other.
2. **It failed silently by design** — a `catch` that ignored errors "so the user
   can type freely", plus early returns on unresolved references. There was no
   way to tell "understood you" from "ignored you". On Michael's reference
   sentence it emitted two passes both struck by player 1, dropped the run, and
   attached `then passes…` to the wrong subject, with no error.
3. **It duplicated the engine.** Rules 3a-3c already express "running onto a
   pass"; the parser had its own "intercept logic" rewriting the previous pass's
   endpoint. Two inference systems for one job, from different data.

The replacement is the workflow, not more code: **prose → Claude → notation →
Import from text…**, with the import panel showing a numbered readback of what
was parsed before anything is saved. See DRILL-NOTATION.md section 0.

- New notation form, and the only multi-word endpoint: **`5m from 2 towards 1`**
  — a point a real distance off one reference along the line to another. Shared
  by both the metric and grid parsers via `stepTowards`. An arrow (`->`) is
  required when either end uses it, since `A to B` cannot be split safely.
- `tools/examples/meet-the-ball.txt` is the worked prose→notation example and
  `_drilltext.mjs` drives it end to end.

**Known limit, stated plainly:** `DEP_TOL` is 0.08 pitch widths ≈ 5.4 m, so a
movement shorter than that is invisible to the dependency rules. "Runs out 5m to
meet the ball" therefore plays as *ball into space, lands, player collects it*
rather than the two moving together. That reads fine as a drill. Genuine
simultaneity needs the explicit `after:[strokeIndex]` links from the
architecture section, NOT a smaller tolerance.

### Two engine bugs found while testing this (v149)

- **`loadPreset` did not unflatten strokes.** It did
  `s.pts.map(pt => [pt[0], pt[1]])`, which assumes NESTED points — true of the
  built-in drills in `js/drills.js`, false for anything from the notation parser
  or Firestore, both of which are FLAT. Indexing a number gives `undefined`, so
  such a drill loaded its pieces and then animated nothing at all. It now goes
  through `unflatStroke`, exactly as `loadDrill` does.
- **`buildTimeline` alerted a raw stack trace** on any failure — useless to a
  coach on a phone, and it covered the pitch. Now `console.error` plus resetting
  the Play button.
- **`nearPt` is now aspect-weighted.** It compared normalised coordinates with an
  unweighted hypot, so "same place" was 5.4 m across the pitch but 8.4 m up it.
  Same bug class as the leg-length fix in v141, same fix: weight `dy` by
  `PITCH_LEN / PITCH_WID` so `DEP_TOL` means one real distance in every
  direction. All three reference drills still pass.

## Drill notation (v138)

A text format for describing a drill precisely: a GRID picture of the layout plus
LINES in draw order. Full spec and examples in **DRILL-NOTATION.md**.

- TWO input styles, same parser. **Metric** (`CONES` / `PLAYERS` / `SEQUENCE`) is
  the natural one: a shape and its size in METRES, how the players are spread,
  then what happens. **Grid** (`GRID` / `LINES`) is for irregular layouts.
  Metres convert exactly because the board is a real pitch, 68 x 105 m; the
  snapping square is ~5 m, and `QUEUE_GAP` is one square for that reason — a
  literal 2 m queue gap collapses two players onto one lattice point.
  Players stand one snapping square BEHIND their cone, never on it (v141), and
  the generated `pass and follow` / `shuttle` legs run between those FRONT
  positions rather than the cone centres — the pass leaves the man behind one
  cone and arrives at the man behind the next. An explicit `cN` reference still
  means the cone itself.
  Cones are numbered from the BOTTOM-LEFT clockwise; player numbering is
  depth-major (1..N one per cone, then N+1.. the second in each queue) so
  "1 passes to 2" always means "to the next cone round".
  `pass and follow` emits a CLOSED circuit — N passes for N cones.
- Parser: `js/drill-text.js`, exposing `window.parseDrillText`. It is the SINGLE
  source — `tools/drill-from-text.mjs` evals the same file (handing it a stand-in
  `window`) so the CLI and the app cannot drift apart.
- App import: Drills → **Import from text…** accepts the notation OR the JSON that
  Copy drill data emits, normalises strokes to FLAT points, saves and loads it.
- `o+1` stacks two things on one square (a cone with a player on it) — without
  that a grid cannot express the reference square at all.
- DRAW ORDER IS SEMANTICS. The LINES order is what the sequencing rules read
  backwards through; it is not presentation.
- `_notation.mjs` takes the example file all the way from text through the engine
  and asserts the rotation, then imports the same text through the app's own UI.

## Drill builder (v140)

Drills → **Build from a shape…**. A form over the notation, deliberately NOT a
second model: each control writes one line of CONES/PLAYERS/SEQUENCE, the shared
parser builds it, and `loadDrill()` puts it on the REAL pitch on every change.
The sheet is short (`.sheet.builder`) so the pitch shows above it — the preview
IS the drill, so the two cannot disagree, and Save just persists what is already
on screen.

- Reload is debounced 70ms: a range input fires a burst of events, and each one
  rebuilds every piece. `_builder.mjs` has to await that; a synchronous test
  reads the previous state and looks like the controls do nothing.
- "Shuttle" is disabled unless there are exactly 2 markers, and the pattern falls
  back to pass-and-follow. Guard the CONTROL rather than letting the parser throw
  an error at the coach.

## THE PLANNED DRILL MODEL (v151) — the migration, done

The architecture review below said the model was right and the STORAGE was
wrong: playback re-derived intent from geometry on every run, so precision
problems became behaviour problems. That migration is now built. Michael's
check-away rotation drill is the reference case, because it breaks every part of
the old inference at once.

**A stroke may now carry INTENT, all fields optional:**

```
{ mode, pts,
  actor:{slot:[x,y]} | {piece:id},   // WHO — a slot, not a player
  after:[strokeIdx...],              // start once these have finished
  with:[strokeIdx...],               // start on the same beat as these
  arriveWith:strokeIdx,              // finish on the same beat as this
  via:true }                         // pts are a real path; do not tidy
drill.rotate = { cycle:[[x,y]...] }  // the net effect of one lap
```

`buildTimeline` checks whether any stroke carries intent. If so it takes the
PLANNED path — resolve the actor from its slot, time the leg from the declared
graph — and the inference rules are not consulted at all. If not, everything
behaves exactly as before. Every drill saved before v151 is on the legacy path,
which is why all three reference drills still pass unchanged.

**Three things that had to be got right, each of which looked like a bug first:**

- **A slot resolves against LAP-START positions, not live ones.** Matching live
  positions let a player who merely ran through a slot inherit that slot's
  remaining legs — player 2 ended up performing player 3's and player 4's steps
  as well as his own. Within one lap a role is one person; across laps the slot
  rebinds to whoever has rotated into it. The ball is the exception: it is
  wherever it has been played to.
- **A declared rotation is scheduled at the END of the lap, once.** The inferred
  version schedules each piece at its own last-moved time, which is zero for
  anyone who has not moved — so a standing queue shuffled forward at 100ms,
  before the ball had been passed.
- **Loop mode must wait for the rotation.** `loopTriggerTime` was the ball's
  finish; with a declared rotation the next lap has to start after the queue has
  finished shuffling, or the new lap's slots resolve to the wrong people.

**Notation:** `after N` / `with N` / `meets N` / `around X` / `via A,B` / `by X`
on a line, plus a `ROTATE a -> b -> c -> queue` block. `by` names the actor when
a line does not start where its actor lives (a check-away point), which without
it would store a slot nobody occupies and stall the rotation.

`_plan.mjs` drives the whole thing: parser → app → two laps, asserting the
ordering, the preserved loop, the end-of-lap rotation and the rebinding.

## ARCHITECTURE: is the inference engine the right approach? (reviewed v140, MIGRATED v151)

Verdict: the model is right, the STORAGE is wrong. Playback re-derives intent
from geometry on every run, so precision problems become behaviour problems.

Evidence: ~10 tuned tolerances in the playback path (`DEP_TOL` 0.08, `LOOSE_TOL`
0.15, actor `threshold` 0.15/0.05, `minDBall` 0.15, `hitD` 0.07, snap `reach`
0.7/1.3 cell, `BALL_VIS_OFF` 0.85), ~310 lines of inference (pass A/B + stations),
and every bug logged above was an inference failure, not a rendering one: a pass
bound to a player instead of the ball, a passer leaving before playing, a ball
teleporting to a drawn start, a queue draining.

The smell: `current.from = hit.id` (line ~776) records the piece the coach's
finger was on AT DRAW TIME, and the engine deliberately ignores it (see the note
at ~2689) because pinning a leg to a PLAYER froze the rotation. That was the
right diagnosis but the wrong conclusion — the fix is to store the SLOT intent
("whoever is standing at cone 1"), not to throw the information away and re-guess
it from pixels.

Recommended migration (incremental, no rewrite):
1. At draw time, persist a resolved `actorRef` per stroke: `{slot:[x,y]}` for a
   circuit leg, `{piece:id}` for a one-off, `{ball:id}` for a pass.
2. Persist explicit `after:[strokeIndex...]` when the coach draws a line whose end
   depends on another, instead of rediscovering it with rules 3a-3c.
3. Playback then reads the graph and only INTERPOLATES. Tolerances shrink to one
   snap radius used at draw time.
4. Keep the inference path as a legacy fallback for drills saved before the
   migration (`tidyDrillData` already retro-fits geometry).
Payoff: deterministic playback, an editable step list, per-step timing, and no
class of bug where redrawing a line 10px away changes what the drill does.

Alternatives considered and rejected: pure keyframe/scene storage (authoring too
laborious, rotation needs re-authoring per lap); agent simulation with per-player
behaviours (non-deterministic, hard to author); templates only (fast but cannot
express complex3). The notation + builder IS the template layer, and it now sits
on top of the same engine rather than beside it.

## Testing without a browser

Tests live IN THE REPO as `_*.mjs` (they used to live in /tmp and were lost when
the scratch dir was cleared, taking the rotation guards with them). `_harness.mjs`
does the jsdom boot: stubs canvas getContext, pointer capture and
getBoundingClientRect, sets `global.Event` / `requestAnimationFrame`, and stubs
the timeline with one that buffers every `.to()` and can `settle()` them.
`node --check js/*.js sw.js` first, always. Run: `for t in _laps _shuttle _align
_c3 _copybtn _fixes128 _seq129 _speed _tidy _notation _landing _subs _chrome _drilltext _gameday _plan
_smoke _smoke_app; do node $t.mjs; done`
(`_landing.mjs` covers the marketing page's hero drill demos, which are a
separate hand-rolled animation in index.html, not the app engine.)

**`_builder.mjs` is currently FAILING and is not in that list.** It asserts on
`#builderPanel` / "Build from a shape…", and neither exists anywhere in the
codebase — the drill builder (v140) was lost in the migration from index.html to
app.html and nobody noticed, because the test was never run again after the
migration. Either restore the builder UI in app.html or delete the test; do not
leave it as a permanently red check that trains everyone to ignore the suite.

**Two traps that cost a session each:**

- **The stub must respect the scheduling OFFSET** (GSAP's third `.to()` argument).
  Legs are added in draw order
  but run at computed times, and the rotation re-lay is added last yet can
  finish first. "Last added wins" stacked five players on one cone.
- **Read a lap from the LEGS THE ENGINE EMITS, not from the DOM.** A player who
  does not move in a lap gets no leg, so their element keeps its previous
  position; reading the DOM shows finished players still standing on a cone and
  makes a correct rotation look like a pile-up. The old DOM-reading test gave a
  false PASS for laps 5-8 for exactly this reason.
- **A follow-your-pass square is a CLOSED circuit — four passes, not three.**
  Omitting the closing `cone4 -> cone1` stroke drains the queue after four laps
  (nothing is ever recycled to the back) and looks precisely like an engine bug.
  It is not: with the fourth stroke, all 8 laps match the reference and everyone
  ends on their original cone.

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
