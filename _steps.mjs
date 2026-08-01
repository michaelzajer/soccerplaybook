/* THE DRILL STEP LIST (v152).

   The step model went in at v151; this is the window onto it. The list is the
   drill's SOURCE, not a view of it — draw order is semantics, because the
   engine reads dependencies backwards through it.

   The dangerous operations are reorder and delete, because every after/with/
   meets reference is an INDEX into that order. Getting the remap wrong does not
   throw; it silently rewires the drill. So most of this file is about that. */
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
let legsOut = [];
global.gsap = window.gsap = Object.assign(() => ({}), {
  timeline: cfg => { legsOut = []; const t = {
      to(el, v, off) { legsOut.push({ at:(off||0)*1000, dur:(v.duration||0)*1000 }); return t; },
      call() { return t; }, play(){}, pause(){}, restart(){}, seek(){},
      finished: Promise.resolve() }; return t; }, set(){} });

eval(fs.readFileSync("./js/drills.js", "utf8"));
new Function("window", fs.readFileSync("./js/drill-text.js", "utf8"))(window);
const store = { data: { teamName:"P", roster:[], nextId:1,
    colors:{ team:"#2563eb", opp:"#ff453a" },
    board:{ squad:"11", formation:"4-3-3", showOpp:false, placed:{} }, drills:[], games:[] },
  listeners: new Set(), subscribe(f) { this.listeners.add(f); }, emit(){}, save(){}, flush(){} };
const mod = await import("./js/board.js?" + Date.now());
mod.initBoard(store);
const click = e => e && e.dispatchEvent(new window.Event("click", { bubbles:true }));
const $ = s => document.getElementById(s);
const seg = v => [...document.querySelectorAll("#viewSeg button")].find(b => b.dataset.view === v);

function load(txt, name) {
  const d = window.parseDrillText(txt);
  window.PRESET_DRILLS = [{ ...d, name: name || d.name, difficulty:"complex",
                            info:{ trains:"", setup:"", steps:[], coaching:[] } }];
  click(seg("drills")); click(seg("drills"));
  const tab = [...document.querySelectorAll(".drillTab")].find(b => /complex/i.test(b.dataset.diff || ""));
  if (tab) click(tab);
  const pi = document.querySelector("#presetList .presetItem"); if (pi) click(pi);
  const use = document.querySelector("#drillInfoPanel .primary"); if (use) click(use);
  return d;
}
const rows  = () => [...document.querySelectorAll("#stepList .stepRow")];
const whats = () => rows().map(r => r.querySelector(".stepWhat").textContent);
const metas = () => rows().map(r => r.querySelector(".stepMeta").textContent);
const tapRow  = i => click(rows()[i].querySelector(".stepMain"));
const moveRow = (i, d) => click(rows()[i].querySelector('[data-move="' + d + '"]'));
const delRow  = i => click(rows()[i].querySelector("[data-del]"));

/* ---------------------------------------------------------- 1. it reads */
console.log("-- the list reads as the drill --");
load(fs.readFileSync("./tools/examples/check-away-rotation.txt", "utf8"));
click($("dpStepsBtn"));
ok($("stepsPanel").classList.contains("open"), "the transport bar opens the step list");
ok(rows().length === 10, "all ten steps are listed (" + rows().length + ")");
ok(/^10 steps$/.test($("stepsCount").textContent), "with a count: " + $("stepsCount").textContent);

const w = whats();
console.log("   " + w.slice(0, 4).map((s, i) => (i+1) + ". " + s).join("\n   "));
ok(/player 1/i.test(w[0]), "step 1 names where it goes in English: " + w[0]);
ok(/round the outside/i.test(w[2]), "the dribble round the cone says so: " + w[2]);
ok(/cone/i.test(w[4]), "a run to a cone names the cone: " + w[4]);
ok(/\d+ m/.test(metas()[0]), "each step shows its length in metres: " + metas()[0]);
ok(/after 1/.test(metas()[1]), "and its timing: " + metas()[1]);
ok(/with 4/.test(metas()[4]), "including 'with': " + metas()[4]);

/* ------------------------------------------------ 2. selecting a step */
console.log("\n-- selecting --");
tapRow(2);
ok(rows()[2].classList.contains("sel"), "tapping a step selects it");
ok(!$("stepEdit").hidden, "and opens the timing editor");
ok(/Step 3/.test($("stepEditHead").textContent), "headed with which step: " + $("stepEditHead").textContent);
ok(document.querySelectorAll("#stepRefs button").length === 2,
   "only EARLIER steps can be referenced (2 offered for step 3)");
ok([...document.querySelectorAll("#stepWhen button")].find(b => b.classList.contains("on"))
     .dataset.when === "after", "the current mode is shown as selected");
tapRow(2);
ok($("stepEdit").hidden, "tapping again deselects");

/* ------------------------------------------------------- 3. reordering */
console.log("\n-- reordering remaps every reference --");
/* Step 6 is "run 1 -> o1 after 5". Moving it later must keep it pointing at the
   SAME step, whose index has not changed; moving step 5 must follow it. */
const before = metas();
moveRow(6, 1);                       // swap steps 7 and 8 (both depend on 4/7)
const after = metas();
ok(before.length === after.length, "nothing was lost in the move");
ok(!$("stepsErr").textContent, "a legal move is allowed: " + JSON.stringify($("stepsErr").textContent));
/* every reference must still point BACKWARDS */
const refsOk = () => rows().every((r, i) => {
  const m = /(?:after|with|meets) ([\d &]+)/.exec(r.querySelector(".stepMeta").textContent);
  if (!m) return true;
  return m[1].split(/[^\d]+/).filter(Boolean).every(n => +n - 1 < i);
});
ok(refsOk(), "every dependency still points at an earlier step");

/* the illegal one: dragging a step above something it depends on */
console.log("\n-- an illegal move is refused, not silently fixed --");
tapRow(1);                            // step 2 is "after 1"
moveRow(1, -1);                       // try to put it before step 1
ok(!!$("stepsErr").textContent, "it is refused with a reason: " + $("stepsErr").textContent);
ok(/waiting for a later step/i.test($("stepsErr").textContent), "and the reason names the problem");
ok(/after 1/.test(metas()[1]), "the drill is untouched — step 2 still waits for step 1");

/* ---------------------------------------------------------- 4. deleting */
console.log("\n-- deleting fixes up the references --");
const n0 = rows().length;
delRow(0);                            // step 1 — steps 2 and 3 depend on it
ok(rows().length === n0 - 1, "the step is gone");
ok(refsOk(), "and every surviving dependency still points backwards");
const m2 = metas();
ok(!/after 1\b/.test(m2[0]), "the step that depended on the deleted one lost that link, " +
   "rather than pointing at the wrong step: " + m2[0]);

/* --------------------------------------------------- 5. editing timing */
console.log("\n-- editing the timing --");
load(fs.readFileSync("./tools/examples/check-away-rotation.txt", "utf8"));
click($("dpStepsBtn"));
tapRow(3);
click([...document.querySelectorAll("#stepWhen button")].find(b => b.dataset.when === "with"));
ok(/with 3/.test(metas()[3]), "switching to 'with' defaults to the step before: " + metas()[3]);
click([...document.querySelectorAll("#stepRefs button")].find(b => b.dataset.ref === "1"));
ok(/with 2 & 3|with 2/.test(metas()[3]), "and a reference can be added: " + metas()[3]);
click([...document.querySelectorAll("#stepWhen button")].find(b => (b.dataset.when || "") === ""));
ok(!/after|with|meets/.test(metas()[3]), "'On its own' clears it: " + metas()[3]);

/* ------------------------------------------- 6. capturing a drawn drill */
console.log("\n-- capturing a hand-drawn drill --");
load(fs.readFileSync("./tools/examples/square.txt", "utf8"), "Square");
click($("dpStepsBtn"));
ok(!$("stepsCapture").hidden,
   "a drill with no stated timing offers to capture the timing it is playing");
ok(!/after|with|meets/.test(metas().join(" ")), "and shows no timing yet");
click($("stepsCapture"));
ok($("stepsCapture").hidden, "after capturing, there is nothing left to capture");
ok(/after|with/.test(metas().join(" ")),
   "the inferred order became explicit steps: " + JSON.stringify(metas()));
ok(refsOk(), "and all of them point backwards");

console.log(fails ? "\n" + fails + " FAILED" : "\nall step-list guards passed");
process.exit(fails ? 1 : 0);
