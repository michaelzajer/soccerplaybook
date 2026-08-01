/* Game-day substitutions (v150): MULTI-SELECT who is coming off, then the sheet
   walks through them one at a time asking who replaces each.

   Two earlier models are being guarded against here.
   v143 paired by tap order — nth off with nth on across two columns — which
   asked the coach to hold two parallel orders in their head mid-game.
   v148 fixed that by locking a pair on the second tap, but only let ONE player
   be picked at a time, which read as "you can only sub one player".
   v150 keeps the v148 guarantee (every replacement is chosen against a NAMED
   player, so nothing can be mismatched) while letting the coach tick off the
   three names they called in one breath. */
import { boot } from "./_harness.mjs";

const roster = [
  { id: 1, name: "Sam Diaz",  pos: "GK" }, { id: 2, name: "Tom Blake", pos: "CB" },
  { id: 3, name: "Jack Reed", pos: "CB" }, { id: 4, name: "Ali Khan",  pos: "CM" },
  { id: 5, name: "Mo Farah",  pos: "CM" }, { id: 6, name: "Leo Diaz",  pos: "ST" },
  { id: 7, name: "Ben Wu",    pos: "ST" }, { id: 8, name: "Cal Ryan",  pos: "LB" },
  { id: 9, name: "Dan Ives",  pos: "RB" }, { id:10, name: "Kai Moss",  pos: "LM" },
  { id:11, name: "Rio Vega",  pos: "RM" }];
const placed = { 1:{x:.5,y:.9}, 2:{x:.3,y:.7}, 3:{x:.7,y:.7},
                 4:{x:.5,y:.5}, 5:{x:.3,y:.4}, 6:{x:.5,y:.2} };
/* applySubs rewrites a player's position in place, so reset from a PRISTINE
   copy between sections — deep-copying the live array carries the drift forward
   and makes correct behaviour look broken. */
const ROSTER0 = JSON.parse(JSON.stringify(roster));

const { window, document, click, store, seg } = await boot({});
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? "PASS" : "FAIL") + " - " + m); };

function reset(extra) {
  store.data.roster = JSON.parse(JSON.stringify(ROSTER0));
  store.data.nextId = 12;
  store.data.board = { squad:"11", formation:"4-3-3", showOpp:false, placed:{ ...placed } };
  store.data.unavailable = [9];                    // injured: must never be offered
  store.data.gameday = { date:"2026-08-01", opp:"Rovers",
                         score:{us:0,them:0}, lineup:null, subs:[], ...(extra || {}) };
  store.listeners.forEach(f => f(store.data));
}
reset();
click(seg("game"));

const $  = s => document.getElementById(s);
const rows      = () => [...document.querySelectorAll("#subsList .subsRow")];
const names     = () => rows().map(r => r.querySelector(".who").textContent);
const pairRows  = () => [...document.querySelectorAll(".subsPairRow")];
const partRows  = () => [...document.querySelectorAll(".subsPairRow.part")];
const tap       = name => click(rows().find(r => r.querySelector(".who").textContent === name));
const next      = () => click($("subsNextBtn"));
/* the whole gesture for one change: tick, go, choose */
const swap      = (off, on) => { tap(off); next(); tap(on); };
const onPitch   = () => Object.keys(store.data.board.placed).map(Number).sort((a,b)=>a-b);
const step      = () => $("subsStepLbl").textContent;
const open      = () => click($("openSubsBtn"));

/* ---------------------------------------------------------------- 1. basics */
console.log("\n-- opening --");
ok(!!$("openSubsBtn"), "a Subs button exists on game day");
open();
ok($("subsModal").classList.contains("open"), "it opens the substitutions sheet");
ok(/coming off/i.test(step()), "it starts by asking who is coming off");
ok(names().length === 6, "the list shows the six players on the pitch");
ok(!names().includes("Dan Ives"), "an unavailable player is never offered");
ok($("subsGoBtn").disabled, "the confirm button starts disabled");

/* ----------------------------------------------------- 2. a single change */
console.log("\n-- a single change --");
tap("Ali Khan");
ok(rows().find(r => r.querySelector(".who").textContent === "Ali Khan")
     .classList.contains("ticked"), "tapping a player TICKS them, it does not jump lists");
ok(partRows().length === 1, "and shows a line waiting for a replacement");
ok(names().includes("Jack Reed"), "the pitch list is still on screen so more can be ticked");
ok($("subsGoBtn").hidden || $("subsGoBtn").disabled, "nothing can be confirmed yet");
ok(!$("subsNextBtn").hidden, "'Choose a replacement' is the way on");

next();
ok(/comes on for Ali/i.test(step()), "which asks who comes on for the ticked player");
ok(names().includes("Ben Wu") && !names().includes("Ali Khan"),
   "the bench list is the bench, and does not include the player coming off");
ok(!names().includes("Dan Ives"), "the injured player is not offered as a sub either");

tap("Ben Wu");
ok(pairRows().length === 1 && partRows().length === 0, "the pair locked in");
ok(/coming off|else coming off/i.test(step()), "the list went back to the pitch");
ok(!$("subsGoBtn").disabled && !$("subsGoBtn").hidden,
   "a complete pair enables the confirm button");

const box = document.querySelector(".subsPairRow input.pp");
ok(box.value === "CM", "the incoming player inherits the vacated position by default");
click($("subsGoBtn"));
ok(onPitch().join() === "1,2,3,5,6,7", "Ben is on, Ali is off");
ok(store.data.roster.find(p => p.id === 7).pos === "CM",
   "the position is APPLIED, not just displayed (the v143 bug)");
ok(!$("subsModal").classList.contains("open"), "the sheet closes and shows the new shape");
ok(store.data.gameday.subs.length === 1, "the change is on the game's record");

/* ------------------------------------------- 3. an overridden position sticks */
console.log("\n-- overriding the position --");
reset();
open();
swap("Ali Khan", "Ben Wu");
const box2 = document.querySelector(".subsPairRow input.pp");
box2.value = "LW";
box2.dispatchEvent(new window.Event("input", { bubbles: true }));
click($("subsGoBtn"));
ok(store.data.roster.find(p => p.id === 7).pos === "LW", "a typed position wins over the default");

/* ----------------------------------------------------- 4. a triple change */
console.log("\n-- a triple change in one action --");
reset();
open();
/* THE POINT OF v150: three names ticked in one go, the way a coach calls them. */
tap("Jack Reed"); tap("Ali Khan"); tap("Leo Diaz");
ok(rows().filter(r => r.classList.contains("ticked")).length === 3,
   "three players ticked at once — no confirming in between");
ok(partRows().length === 3, "all three show as waiting for a replacement");
ok(/Choose 3 replacements/.test($("subsNextBtn").textContent),
   "the button says how many are still to assign");
next();
ok(/comes on for/i.test(step()) && /2 more after this/.test(step()),
   "it walks them one at a time and says how many are left: " + step());
tap("Ben Wu");
ok(/comes on for/i.test(step()), "and moves straight on to the next: " + step());
tap("Cal Ryan");
tap("Kai Moss");
ok(pairRows().length === 3, "three pairs lined up");
ok(/Make 3 changes/.test($("subsGoBtn").textContent), "the button offers all three");
const shown = pairRows().map(r => r.textContent.replace(/[×\s]+/g, " ").trim());
ok(/Jack.*Ben/.test(shown[0]) && /Ali.*Cal/.test(shown[1]) && /Leo.*Kai/.test(shown[2]),
   "each pair reads as the coach called it: " + JSON.stringify(shown));
click($("subsGoBtn"));
ok(onPitch().join() === "1,2,5,7,8,10",
   "all three swapped together: " + onPitch().join());
ok(store.data.gameday.subs.length === 3, "all three are logged");
const mins = store.data.gameday.subs.map(s => s.min);
ok(new Set(mins).size === 1, "they share one match minute — it was one action");
ok(new Set(store.data.gameday.subs.map(s => s.batch)).size === 1,
   "they share one batch id, so Undo takes back the whole change");

/* ---------------------------------------------- 5. taking a pair back out */
console.log("\n-- changing your mind --");
reset();
open();
swap("Jack Reed", "Ben Wu");
swap("Ali Khan", "Cal Ryan");
ok(pairRows().length === 2, "two pairs lined up");
click(document.querySelectorAll(".subsPairRow .subsDrop")[0]);
ok(pairRows().length === 1, "tapping the × drops that pair");
ok(/Ali.*Cal/.test(pairRows()[0].textContent), "the RIGHT pair was dropped");
ok(names().includes("Jack Reed"), "the player it freed is back in the list");
click($("subsGoBtn"));
ok(onPitch().includes(3), "Jack stayed on the pitch");
ok(!onPitch().includes(4), "Ali still came off");

/* ------------------------------------------------------- 6. Back cancels */
console.log("\n-- backing out of a half-made pair --");
reset();
open();
tap("Ali Khan"); tap("Leo Diaz"); next();
ok(!$("subsBackBtn").hidden, "Back appears while choosing a replacement");
click($("subsBackBtn"));
ok(/coming off/i.test(step()), "Back returns to the pitch list");
ok(rows().filter(r => r.classList.contains("ticked")).length === 2,
   "and the two ticks SURVIVE — the coach has not lost the names they just chose");
ok($("subsGoBtn").disabled, "nothing is queued yet");

/* ------------------------------------------------------ 7. keeper guard */
console.log("\n-- the keeper guard --");
reset();
open();
swap("Sam Diaz", "Ben Wu");   // the GK off, an ST on
ok(!$("subsWarn").hidden, "taking the keeper off with no keeper on warns the coach");
ok(!$("subsGoBtn").disabled, "but it does not block the change — the coach decides");
click(document.querySelector(".subsPairRow .subsDrop"));
ok($("subsWarn").hidden, "the warning clears when the pair is dropped");

/* -------------------------------------------------- 8. minutes played */
console.log("\n-- minutes played --");
reset({ subs: [
  { outId: 4, inId: 7, min: 20, period: 1, batch: 1 },   // Ali off, Ben on at 20'
  { outId: 7, inId: 4, min: 35, period: 1, batch: 2 }    // and straight back at 35'
] });
/* Rewinding the CURRENT line-up through those two entries puts Ali back in the
   starting XI and Ben on the bench, which is what makes the sums below right.

   The match clock is not running in the harness, so `now` is 0 and only CLOSED
   intervals contribute. That is the honest answer — with no clock there are no
   live minutes to add — and it is what makes these numbers checkable at all. */
open();
const minOf = name => {
  const r = rows().find(x => x.querySelector(".who").textContent === name);
  return r ? parseInt(r.querySelector(".mins").textContent, 10) : null;
};
ok(minOf("Ali Khan") === 20, "Ali's closed 0'-20' spell counts (got " + minOf("Ali Khan") + ")");
tap("Tom Blake"); next();
ok(minOf("Ben Wu") === 15, "Ben's closed 20'-35' spell counts on the bench list (got " + minOf("Ben Wu") + ")");
const benchOrder = names();
ok(minOf(benchOrder[0]) === 0 && benchOrder[benchOrder.length - 1] === "Ben Wu",
   "the bench is ordered fewest minutes first: " + benchOrder.join(", "));

/* ------------------------------------------------------------- 9. undo */
console.log("\n-- undo --");
reset();
open();
tap("Jack Reed"); tap("Ali Khan"); next();
tap("Ben Wu"); tap("Cal Ryan");
click($("subsGoBtn"));
ok(onPitch().join() === "1,2,5,6,7,8", "the double change went on");
open();
ok(!$("subsLogHead").hidden, "the log and its Undo are shown once there is a change");
click($("subsUndoBtn"));
ok(onPitch().join() === "1,2,3,4,5,6", "Undo restored the whole batch, both players");
ok(store.data.gameday.subs.length === 0,
   "and removed it from the record — a mis-tap is not a tactical decision");
ok($("subsLogHead").hidden, "the log header hides again when there is nothing logged");

console.log(fails ? "\n" + fails + " FAILED" : "\nall substitution guards passed");
process.exit(fails ? 1 : 0);
