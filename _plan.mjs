/* THE PLANNED DRILL MODEL (v151).

   Michael's drill is the reference case, because it is the first one that
   breaks every part of the old geometric inference at once:

     "P1 on c1, P2 on c2, P3 on c3, P4 on c4, P5,6,7 queued behind P1.
      P2 runs 5m towards P1. P1 passes to P2. P2 runs back around cone 2 with
      the ball and passes to P3 and runs to cone 3. P3 passes to P4 and runs to
      cone 4. P4 passes to P5, now in the vacant spot at cone 1. P5 passes to
      P1 who is at cone 2, and the cycle continues."

   What this guards, in the order the sentence says it:
     1. a 5 m check is SMALLER than DEP_TOL (5.4m), so the old engine could not
        see it. `after` states the order instead of inferring it from distance.
     2. "passes to 3 AND runs to c3" is two legs that must go together — `with`.
        There was previously no way to say it at all.
     3. "back around cone 2" survives tidyStroke, which otherwise clamps a bow
        to 0.22 of the chord (commented "never let it loop").
     4. the rotation happens at the END of the lap, not at 100ms. On the
        inference path this drill shuffled the queue forward before the ball had
        been passed, and left player 1 at the back of the queue.
     5. and it LOOPS: on lap two the roles rebind, so player 5 plays player 1's
        part. That is the whole reason an actor is a SLOT and not a piece id. */
import fs from "fs"; import { JSDOM } from "jsdom";

let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? "PASS" : "FAIL") + " - " + m); };

const dom = new JSDOM(fs.readFileSync("./app.html", "utf8"),
  { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
global.window = window; global.document = window.document;
Object.defineProperty(global, "navigator",
  { value: window.navigator, writable: true, configurable: true });
global.Event = window.Event;
global.requestAnimationFrame = f => setTimeout(() => f(Date.now()), 0);
const mem = {};
global.localStorage = { getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; }, clear() {} };
window.HTMLCanvasElement.prototype.getContext =
  () => new Proxy({}, { get: () => () => ({ width: 10 }), set: () => true });
window.HTMLElement.prototype.setPointerCapture = () => {};
window.HTMLElement.prototype.releasePointerCapture = () => {};
const W = 340, H = 525;
window.Element.prototype.getBoundingClientRect =
  () => ({ left:0, top:0, right:W, bottom:H, width:W, height:H });

/* The stub must respect the scheduling OFFSET and settle in FINISH order:
   legs are added in draw order but run at computed times, and the rotation is
   added last yet can finish first. "Last added wins" stacks everyone on one
   cone and makes a correct rotation look broken. */
let legs = [], onDone = null;
global.gsap = window.gsap = Object.assign(() => ({}), {
  timeline: cfg => { onDone = cfg && cfg.onComplete; legs = []; const t = {
      to(el, v, off) {
        legs.push({ el, k: v.keyframes && v.keyframes[v.keyframes.length - 1],
                    at:(off || 0) * 1000, dur:(v.duration || 0) * 1000 });
        return t; },
      /* Loop mode schedules the next lap with .call(), not .to() — a stub that
         only implements .to() silently never loops, which looks exactly like a
         rotation that has stalled. */
      call(fn, args, off) { nextLap = fn; return t; },
      play(){}, pause(){}, restart(){}, seek(){}, finished: Promise.resolve() };
    return t; }, set(){} });
let nextLap = null;
const settle = () => legs.slice().sort((a, b) => (a.at + a.dur) - (b.at + b.dur))
  .forEach(l => { if (l.el && l.k) { l.el.style.left = l.k.left; l.el.style.top = l.k.top; } });

eval(fs.readFileSync("./js/drills.js", "utf8"));
new Function("window", fs.readFileSync("./js/drill-text.js", "utf8"))(window);
const store = { data: { teamName:"P", roster:[], nextId:1,
    colors:{ team:"#2563eb", opp:"#ff453a" },
    board:{ squad:"11", formation:"4-3-3", showOpp:false, placed:{} }, drills:[], games:[] },
  listeners: new Set(), subscribe(f) { this.listeners.add(f); }, emit(){}, save(){}, flush(){} };
const mod = await import("./js/board.js?" + Date.now());
mod.initBoard(store);
const click = e => e && e.dispatchEvent(new window.Event("click", { bubbles:true }));
const seg = v => [...document.querySelectorAll("#viewSeg button")].find(b => b.dataset.view === v);

const text = fs.readFileSync("./tools/examples/check-away-rotation.txt", "utf8");
const drill = window.parseDrillText(text);

/* ------------------------------------------------- 1. the notation carries it */
console.log("-- intent survives the parser --");
ok(drill.strokes.every(s => s.actor && s.actor.slot),
   "every leg names WHO does it, as a slot rather than a piece id");
ok(drill.strokes[1].after && drill.strokes[1].after[0] === 0,
   "'after 1' became an explicit dependency, not a guess from distance");
ok(drill.strokes[4].with && drill.strokes[4].with[0] === 3,
   "'with 4' made the run and the pass one moment");
ok(drill.strokes[2].via === true, "the dribble round the cone is marked as a real path");
ok(drill.rotate && drill.rotate.cycle.length === 4,
   "ROTATE became a declared 4-station cycle");

/* ---- the loop is preserved, not straightened ---- */
const d3 = drill.strokes[2];
const pts = []; for (let i = 0; i + 1 < d3.pts.length; i += 2) pts.push([d3.pts[i], d3.pts[i+1]]);
const A = pts[0], B = pts[pts.length - 1];
const chord = Math.hypot(B[0]-A[0], (B[1]-A[1]) * 105/68);
let bow = 0;
pts.forEach(p => { const nx = -(B[1]-A[1]) * 105/68, ny = (B[0]-A[0]);
  const L = Math.hypot(nx, ny) || 1;
  bow = Math.max(bow, Math.abs(((p[0]-A[0]) * nx + (p[1]-A[1]) * 105/68 * ny) / L)); });
ok(bow > chord * 0.22,
   "the path bows further than tidyStroke's 0.22 cap allows — it is a loop, not a line " +
   "(bow " + bow.toFixed(3) + " vs cap " + (chord * 0.22).toFixed(3) + ")");

/* --------------------------------------------------- 2. one lap, in order */
console.log("\n-- the lap runs in the order the sentence says --");
window.PRESET_DRILLS = [{ ...drill, difficulty:"complex",
                          info:{ trains:"", setup:"", steps:[], coaching:[] } }];
click(seg("drills")); click(seg("drills"));
const tab = [...document.querySelectorAll(".drillTab")].find(b => /complex/i.test(b.dataset.diff || ""));
if (tab) click(tab);
const pi = document.querySelector("#presetList .presetItem"); if (pi) click(pi);
const use = document.querySelector("#drillInfoPanel .primary"); if (use) click(use);
click(document.getElementById("dpLoopBtn"));         // the drill is meant to cycle

const items = () => [...document.querySelectorAll("#board .ditem")];
const pos = el => [parseFloat(el.style.left) / (el.style.left.includes("%") ? 100 : W),
                   parseFloat(el.style.top)  / (el.style.top.includes("%")  ? 100 : H)];
const num = el => (el.textContent || "").trim();
const players = () => items().filter(e => e.querySelector(".att,.def"));
const whoAt = (x, y) => {
  let best = null, bd = Infinity;
  players().forEach(e => { const p = pos(e);
    const d = Math.hypot(p[0] - x, (p[1] - y) * 105/68);
    if (d < bd) { bd = d; best = num(e); } });
  return bd < 0.06 ? best : null;
};
const C1 = [0.25, 0.44], C2 = [0.25, 0.06], C3 = [0.75, 0.06], C4 = [0.75, 0.44];

ok(whoAt(...C1) === "1" && whoAt(...C2) === "2" && whoAt(...C3) === "3" && whoAt(...C4) === "4",
   "the drill starts with 1,2,3,4 on their cones");

click(document.getElementById("playDrillBtn"));
const t = legs.map(l => ({ at:l.at, dur:l.dur, end:l.at + l.dur })).sort((a, b) => a.at - b.at);
ok(t.length >= 14, "the whole lap was scheduled (" + t.length + " legs)");
const R = Math.round;
console.log("   first leg " + R(t[0].at) + "ms, last leg starts " + R(t[t.length-1].at) + "ms");
ok(t[0].at === 0, "the check-away run goes first");
ok(t[1].at >= t[0].end, "the pass waits for it (" + R(t[0].end) + " -> " + R(t[1].at) + ")");

/* the pass and the run that share a moment */
const together = t.filter((x, i) => i > 0 && Math.abs(x.at - t[i-1].at) < 2).length;
ok(together >= 3, "three pairs of legs start on the same beat — 'passes and runs' (" + together + ")");

/* the rotation is the LAST thing, not the first */
const rot = t.filter(x => Math.abs(x.dur - 700) < 1);
ok(rot.length === 3, "three queue members shuffle up");
ok(rot[0].at > t[t.length - 4].at,
   "and they do it at the END of the lap, not at 100ms (" + R(rot[0].at) + "ms)");

/* --------------------------------------------------------- 3. it LOOPS */
console.log("\n-- lap two: the roles rebind --");
settle();
ok(whoAt(...C1) === "5", "player 5 has taken the vacant spot at cone 1");
ok(whoAt(...C2) === "1", "player 1 is now at cone 2, exactly as Michael describes it");
ok(whoAt(...C3) === "2", "player 2 has moved round to cone 3");
ok(whoAt(...C4) === "3", "player 3 to cone 4");
ok(whoAt(0.25, 0.94) === "4", "and player 4 is at the back of the queue");

ok(typeof nextLap === "function", "loop mode scheduled the next lap");
if (typeof nextLap === "function") nextLap();        // run it
const t2 = legs.map(l => ({ at:l.at, dur:l.dur, end:l.at + l.dur })).sort((a, b) => a.at - b.at);
ok(t2.length >= 14, "lap two schedules the same shape of lap (" + t2.length + " legs)");
settle();
ok(whoAt(...C1) === "6" && whoAt(...C2) === "5" && whoAt(...C3) === "1",
   "and everyone advances one more place: c1=" + whoAt(...C1) +
   " c2=" + whoAt(...C2) + " c3=" + whoAt(...C3));

console.log(fails ? "\n" + fails + " FAILED" : "\nall planned-drill guards passed");
process.exit(fails ? 1 : 0);
