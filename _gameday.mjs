/* Game-day capture (v150): notes taken during the game, and the full-time
   summary that files it away.

   The two things worth guarding here are both about not losing work:
     - a note typed mid-game is saved as it is typed, and is the SAME field the
       full-time screen and the saved game read;
     - Finish is a REVIEW step. Nothing is written until Save is tapped, so
       backing out must leave the game exactly as it was. */
import { boot } from "./_harness.mjs";

const roster = [
  { id: 1, name: "Sam Diaz",  pos: "GK" }, { id: 2, name: "Tom Blake", pos: "CB" },
  { id: 3, name: "Jack Reed", pos: "CB" }, { id: 4, name: "Ali Khan",  pos: "CM" },
  { id: 5, name: "Mo Farah",  pos: "CM" }, { id: 6, name: "Leo Diaz",  pos: "ST" },
  { id: 7, name: "Ben Wu",    pos: "ST" }, { id: 8, name: "Cal Ryan",  pos: "LB" }];
const placed = { 1:{x:.5,y:.9}, 2:{x:.3,y:.7}, 3:{x:.7,y:.7},
                 4:{x:.5,y:.5}, 5:{x:.3,y:.4}, 6:{x:.5,y:.2} };
const ROSTER0 = JSON.parse(JSON.stringify(roster));

const { window, document, click, store, seg } = await boot({});
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? "PASS" : "FAIL") + " - " + m); };
const $ = s => document.getElementById(s);
const type = (el, v) => { el.value = v; el.dispatchEvent(new window.Event("input", { bubbles:true })); };

function reset(extra) {
  store.data.roster = JSON.parse(JSON.stringify(ROSTER0));
  store.data.nextId = 9;
  store.data.board = { squad:"11", formation:"4-3-3", showOpp:false, placed:{ ...placed } };
  store.data.unavailable = [];
  store.data.games = [];
  store.data.gameday = { id: 101, date:"2026-08-01", opp:"Rovers",
                         score:{ us:2, them:1 }, lineup:null, notes:"", subs:[], ...(extra || {}) };
  store.listeners.forEach(f => f(store.data));
}
reset();
click(seg("game"));

/* ------------------------------------------------------------ notes pill */
console.log("-- match notes --");
ok(!!$("notesPill"), "there is a notes pill");
ok(!$("notesPill").hidden, "it is showing once a game exists");
ok($("notesPane").hidden, "the pane starts closed");
ok($("notesPill").querySelector(".npDot").hidden, "no dot while there are no notes");

click($("notesPill"));
ok(!$("notesPane").hidden, "tapping the pill opens the pane");
ok(!!$("npClose"), "with an × to close it");

type($("npText"), "back four sitting too deep");
ok(store.data.gameday.notes === "back four sitting too deep",
   "typing saves straight onto the game, not on close");
ok($("gNotes").value === "back four sitting too deep",
   "and the game-details notes box shows the same text — one field, two windows");

/* the minute stamp */
$("npText").setSelectionRange($("npText").value.length, $("npText").value.length);
click($("npStamp"));
ok(/\n\d+' $/.test($("npText").value),
   "the stamp starts a new line and inserts the match minute: " +
   JSON.stringify($("npText").value));
type($("npText"), $("npText").value + "pressed higher, better");

click($("npClose"));
ok($("notesPane").hidden, "the × closes it");
ok(!$("notesPill").querySelector(".npDot").hidden, "and the pill now shows a dot");
ok(/back four/.test(store.data.gameday.notes) && /pressed higher/.test(store.data.gameday.notes),
   "both notes survived the close");

/* ------------------------------------------------------------- full time */
console.log("\n-- full time --");
reset({ notes:"scrappy first half", subs:[
  { outId:4, inId:7, min:20, period:1, batch:1 },
  { outId:6, inId:8, min:35, period:2, batch:2 }
] });
/* the two subs above have already been applied to the board in a real game */
store.data.board.placed = { 1:placed[1], 2:placed[2], 3:placed[3],
                            5:placed[5], 7:placed[4], 8:placed[6] };
store.listeners.forEach(f => f(store.data));

click($("gameChip"));            // the game-details sheet
click($("gameCfgChip"));
click(seg("game"));
click($("gameChip"));
$("gamesPanel") && $("gamesPanel").classList.add("open");
click($("finishGameBtn"));
ok($("finishPanel").classList.contains("open"), "Finish this game opens the summary");
ok(/Rovers/.test($("ftTitle").textContent), "headed with the opponent");
ok(/2/.test($("ftScore").textContent) && /1/.test($("ftScore").textContent),
   "the score is on it");
ok($("ftSubs").children.length === 2, "both substitutions are listed");
ok(/20'/.test($("ftSubs").textContent) && /Ali/.test($("ftSubs").textContent),
   "with the minute and who went off: " + $("ftSubs").textContent.replace(/\s+/g, " ").trim());
ok($("ftMins").children.length > 0, "minutes played are listed");
ok($("ftNotes").value === "scrappy first half", "the notes taken during the game are shown");

/* backing out must change nothing */
click($("ftCancel"));
ok(!$("finishPanel").classList.contains("open"), "Not yet closes it");
ok(!store.data.gameday.completed, "and the game is NOT marked completed");
ok(store.data.games.length === 0, "nothing was filed");

/* ---- adding a last thought, then saving ---- */
click($("finishGameBtn"));
type($("ftNotes"), "scrappy first half\nmuch better after the double change");
click($("ftConfirm"));
ok(store.data.gameday.completed === true, "Save marks it completed");
ok(!!store.data.gameday.finishedAt, "and stamps when");
ok(/double change/.test(store.data.gameday.notes), "the last thought was kept");

const filed = store.data.games.filter(g => g.id === 101);
ok(filed.length === 1, "it is filed exactly once");
ok(filed[0].completed === true, "as a completed game");
ok(filed[0].subs.length === 2, "with its substitutions");
ok(/scrappy first half/.test(filed[0].notes), "and its notes");

/* Minutes are FROZEN at full time. Reconstructing from the log is right while a
   game is running, but the log cannot know when it ended — without freezing,
   a finished game's minutes would keep growing with the clock. */
ok(filed[0].minutes && Object.keys(filed[0].minutes).length > 0,
   "minutes played are frozen onto the completed game");

/* ---- the list separates finished from upcoming ---- */
console.log("\n-- the games list --");
ok(!$("doneLabel").hidden, "a Completed section appears");
ok($("doneList").children.length === 1, "the finished game is in it");
ok($("gamesList").children.length === 0 ||
   ![...$("gamesList").children].some(r => /Rovers/.test(r.textContent)),
   "and not also in the in-progress list");
ok(/2–1/.test($("doneList").textContent), "the result is the label you scan for");
ok(!!$("doneList").querySelector(".shareGame"), "with a share button on the row");
ok($("finishGameBtn").hidden, "Finish is no longer offered for a finished game");

console.log(fails ? "\n" + fails + " FAILED" : "\nall game-day guards passed");
process.exit(fails ? 1 : 0);
