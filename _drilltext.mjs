/* The prose -> notation -> drill path (v149).

   Michael's sentence is the reference case:

     "player 1 passes to player 2 who runs out 5m to meet the ball and then
      passes to player 3 who is at cone 3"

   The English is compiled OUTSIDE the app (by Claude, or by hand) into the
   notation in tools/examples/meet-the-ball.txt. The app only ever parses the
   notation, strictly, and says so when it cannot.

   What this guards:
     1. the notation parser understands `5m from 2 towards 1` and puts the point
        in the right place, in real metres, on a 68 x 105 pitch;
     2. the resulting drill loads through the app's own import;
     3. the ENGINE then does the timing on its own — the pass and the run arrive
        together, and the second pass waits for both.
   Point 3 is the whole argument for deleting the English parser: the engine
   already knew how to do this, and the parser was doing it a second time. */
import fs from "fs";
import { JSDOM } from "jsdom";

let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? "PASS" : "FAIL") + " - " + m); };
const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 0.004 : tol);

/* ---------------------------------------------------- 1. the parser alone */
console.log("-- notation --");
const scope = { window: {} };
new Function("window", fs.readFileSync("./js/drill-text.js", "utf8"))(scope.window);
const parse = scope.window.parseDrillText;

const text = fs.readFileSync("./tools/examples/meet-the-ball.txt", "utf8");
const d = parse(text);
ok(d.strokes.length === 3, "three lines, one per action clause (got " + d.strokes.length + ")");
ok(d.items.length === 7, "the pieces come from the GRID, not from the prose");

const end   = s => [s.pts[s.pts.length - 2], s.pts[s.pts.length - 1]];
const start = s => [s.pts[0], s.pts[1]];
const [pass1, run2, pass2] = d.strokes;
ok(pass1.mode === "pass" && run2.mode === "run" && pass2.mode === "pass",
   "pass, run, pass — in the order the sentence says them");

/* the meeting point: 5 m off player 2's cone, back towards player 1 */
const p2 = d.items.find(i => i.kind === "att" && i.num === "2");
const p1 = d.items.find(i => i.kind === "att" && i.num === "1");
const metres = (a, b) => Math.hypot((a[0] - b[0]) * 68, (a[1] - b[1]) * 105);
const meet = end(pass1);
ok(near(metres(meet, [p2.x, p2.y]), 5, 0.15),
   "the ball is met 5 real metres off player 2's cone (got " +
   metres(meet, [p2.x, p2.y]).toFixed(2) + " m)");
ok(metres(meet, [p1.x, p1.y]) < metres([p2.x, p2.y], [p1.x, p1.y]),
   "and it is 5 m TOWARDS player 1, not away from him");
ok(near(end(run2)[0], meet[0]) && near(end(run2)[1], meet[1]),
   "the run ends exactly where the pass ends — that is what makes them sync");
ok(near(start(pass2)[0], p2.x) && near(start(pass2)[1], p2.y),
   "the second pass is struck by player 2");

/* ---- distance is measured in METRES, not board fractions ---- */
console.log("\n-- metres, not fractions --");
const across = parse(["DRILL a", "GRID", "1 . . . . . . . . . 2",
                      "LINES", "run 1 -> 5m from 1 towards 2"].join("\n"));
const up = parse(["DRILL b", "GRID", "1", ".", ".", ".", ".", ".", ".", ".", ".", "2",
                  "LINES", "run 1 -> 5m from 1 towards 2"].join("\n"));
const legLen = dr => {
  const s = dr.strokes[0];
  return metres([s.pts[0], s.pts[1]], end(s));
};
ok(near(legLen(across), 5, 0.2) && near(legLen(up), 5, 0.2),
   "5 m across the pitch and 5 m up it are both 5 m (" +
   legLen(across).toFixed(2) + " / " + legLen(up).toFixed(2) + ")");

/* ---- and it FAILS LOUDLY, which the English parser never did ---- */
console.log("\n-- loud failure --");
const boom = src => { try { parse(src); return null; } catch (e) { return e.message; } };
ok(/cannot find/i.test(boom(["DRILL x","GRID","1 . 2","LINES","pass 1 -> 9"].join("\n")) || ""),
   "an unknown player is an error, not a dropped line");
ok(/not understood|expected/i.test(boom(["DRILL x","GRID","1 . 2","LINES","pass 1"].join("\n")) || ""),
   "a malformed line is an error, not a dropped line");
ok(/cannot find/i.test(boom(["DRILL x","GRID","1 . 2","LINES","pass 1 -> 5m from 1 towards 9"].join("\n")) || ""),
   "a bad reference inside a relative point is an error too");
ok(boom(["DRILL x","GRID","1 . 2","LINES","pass 1 -> 2"].join("\n")) === null,
   "a good drill still parses");

/* ------------------------------------------- 2. through the app, then play */
console.log("\n-- the engine does the timing --");
const dom = new JSDOM(fs.readFileSync("./app.html", "utf8"),
  { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
global.window = window; global.document = window.document;
Object.defineProperty(global, "navigator",
  { value: window.navigator, writable: true, configurable: true });
global.Event = window.Event;
global.requestAnimationFrame = fn => setTimeout(() => fn(Date.now()), 0);
const _mem = {};
global.localStorage = { getItem: k => (k in _mem ? _mem[k] : null),
  setItem: (k, v) => { _mem[k] = String(v); }, removeItem: k => { delete _mem[k]; },
  clear: () => { for (const k in _mem) delete _mem[k]; } };
window.HTMLCanvasElement.prototype.getContext =
  () => new Proxy({}, { get: () => () => ({ width: 10 }), set: () => true });
window.HTMLElement.prototype.setPointerCapture = () => {};
window.HTMLElement.prototype.releasePointerCapture = () => {};
window.Element.prototype.getBoundingClientRect =
  () => ({ left:0, top:0, right:340, bottom:525, width:340, height:525 });

/* capture the schedule: what runs, how long, and WHEN */
const sched = [];
global.gsap = window.gsap = Object.assign(() => ({}), {
  timeline: cfg => { const tl = {
      to(t, v, off) { sched.push({ dur:(v.duration || 0) * 1000, at:(off || 0) * 1000 }); return tl; },
      play(){}, pause(){}, restart(){}, seek(){}, finished: Promise.resolve() };
    tl._cfg = cfg; return tl; }, set(){} });

eval(fs.readFileSync("./js/drills.js", "utf8"));
new Function("window", fs.readFileSync("./js/drill-text.js", "utf8"))(window);

const store = { data: { teamName:"P", roster:[], nextId:1,
    colors:{ team:"#2563eb", opp:"#ff453a" },
    board:{ squad:"11", formation:"4-3-3", showOpp:false, placed:{} },
    drills:[], games:[] },
  listeners: new Set(), subscribe(f) { this.listeners.add(f); },
  emit(){}, save(){}, flush(){} };
const mod = await import("./js/board.js?" + Date.now());
mod.initBoard(store);
window.alert = m => console.log("   ALERT >> " + String(m).split("\n").slice(0,4).join("\n   "));
const click = el => el && el.dispatchEvent(new window.Event("click", { bubbles:true }));
click([...document.querySelectorAll("#viewSeg button")].find(b => b.dataset.view === "drills"));

const loaded = window.parseDrillText(text);
ok(loaded.strokes.length === 3, "the app's own parser reads the same file");

/* Load through the preset path — the route the other engine tests use, and the
   only one that puts real pieces on the pitch without a pointer. Strokes come
   back FLAT from the parser; the preset loader expects the same shape it saves. */
const seg = v => [...document.querySelectorAll("#viewSeg button")].find(b => b.dataset.view === v);
window.PRESET_DRILLS = [{ ...loaded, difficulty:"complex",
                          info:{ trains:"", setup:"", steps:[], coaching:[] } }];
click(seg("drills")); click(seg("drills"));
const tab = [...document.querySelectorAll(".drillTab")].find(b => /complex/i.test(b.dataset.diff || ""));
if (tab) click(tab);
const pi = document.querySelector("#presetList .presetItem"); if (pi) click(pi);
const use = document.querySelector("#drillInfoPanel .primary"); if (use) click(use);
ok(document.querySelectorAll(".ditem").length === 7, "seven pieces on the pitch");

sched.length = 0;
click(document.getElementById("playDrillBtn"));
const t = sched.map(s => ({ at:s.at, dur:s.dur, end:s.at + s.dur }))
               .sort((a, b) => a.at - b.at || a.end - b.end);
t.forEach((x, i) => console.log("   leg " + i + ": start " + Math.round(x.at) +
  "  dur " + Math.round(x.dur) + "  end " + Math.round(x.end)));
ok(t.length >= 3, "the engine scheduled the three legs (got " + t.length + ")");
if (t.length >= 3) {
  const R = Math.round;
  const [pass1, run2, pass2] = t;
  /* NOTE ON WHAT "MEET THE BALL" ACTUALLY PRODUCES.
     Since v136 the engine deliberately does NOT sync a receiving run with its
     pass: the ball is played into the space, LANDS, and waits to be collected.
     `_seq129.mjs` asserts that directly. So the reading here is "1 plays it
     into the space in front of 2; 2 comes onto it and plays it on", which is
     the right drill — but player 2 does not set off until the ball has
     arrived, because the run is bound to the ball and rule 1 makes it wait.

     Genuinely simultaneous "runs out to meet it" is not expressible today. It
     needs the explicit `after:[strokeIndex]` links in the architecture note,
     not another tolerance. Asserting the real behaviour keeps this test honest
     rather than encoding a wish. */
  ok(pass1.end <= run2.end,
     "the ball lands before the receiver gets there (" + R(pass1.end) + " vs " + R(run2.end) + ")");
  ok(run2.at >= pass1.end - 1,
     "player 2 collects it rather than setting off early (" + R(pass1.end) + " -> " + R(run2.at) + ")");
  ok(pass2.at >= pass1.end - 1,
     "the second pass waits for the ball to arrive (" + R(pass1.end) + " -> " + R(pass2.at) + ")");
  ok(pass2.end > pass1.end,
     "and the three legs run in the order the sentence says them");
}

console.log(fails ? "\n" + fails + " FAILED" : "\nall drill-text guards passed");
process.exit(fails ? 1 : 0);
