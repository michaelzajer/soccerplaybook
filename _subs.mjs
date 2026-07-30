/* Game-day substitutions modal: two columns, pick one from each, confirm.
   Must stay open for a double change, and must never lose a player. */
import { boot } from "./_harness.mjs";
const roster=[
  {id:1,name:"Sam Diaz",pos:"GK"},{id:2,name:"Tom Blake",pos:"CB"},
  {id:3,name:"Jack Reed",pos:"CB"},{id:4,name:"Ali Khan",pos:"CM"},
  {id:5,name:"Mo Farah",pos:"CM"},{id:6,name:"Leo Diaz",pos:"ST"},
  {id:7,name:"Ben Wu",pos:"ST"},{id:8,name:"Cal Ryan",pos:"LB"},
  {id:9,name:"Dan Ives",pos:"RB"}];
const placed={1:{x:.5,y:.9},2:{x:.3,y:.7},3:{x:.7,y:.7},4:{x:.5,y:.5},5:{x:.3,y:.4},6:{x:.5,y:.2}};
/* applySubs rewrites a player's position in place, so keep a pristine copy to
   reset from — deep-copying the live array between sections carries the drift
   forward and makes correct behaviour look wrong. */
const ROSTER0 = JSON.parse(JSON.stringify(roster));
const { window, document, $, click, store, seg } = await boot({});
store.data.roster = JSON.parse(JSON.stringify(ROSTER0)); store.data.nextId = 10;
store.data.board = { squad:"11", formation:"4-3-3", showOpp:false, placed:{...placed} };
store.data.unavailable = [9];                       // one injured, must not appear
store.data.gameday = { date:"2026-08-01", opp:"Rovers", score:{us:0,them:0}, lineup:null };
store.listeners.forEach(f=>f(store.data));
const ok=(c,m)=>console.log((c?"PASS":"FAIL")+" - "+m);
click(seg("game"));

ok(!!document.getElementById("openSubsBtn"), "a Subs button exists on game day");
click(document.getElementById("openSubsBtn"));
ok(document.getElementById("subsModal").classList.contains("open"), "it opens the substitutions modal");

const onRows=()=>[...document.querySelectorAll("#subsOnList .subsRow")];
const benchRows=()=>[...document.querySelectorAll("#subsBenchList .subsRow")];
const names=rs=>rs.map(r=>r.querySelector(".who").textContent);
console.log("   on the pitch:", names(onRows()).join(", "));
console.log("   bench       :", names(benchRows()).join(", "));
ok(onRows().length===6, "6 players listed as on the pitch ("+onRows().length+")");
ok(benchRows().length===2, "2 on the bench — the injured player is excluded ("+benchRows().length+")");
ok(!names(benchRows()).includes("Dan Ives"), "the unavailable player is not offered as a sub");

console.log("\n--- picking one from each side ---");
ok(document.getElementById("subsGoBtn").disabled, "the swap button starts disabled");
click(onRows().find(r=>r.querySelector(".who").textContent==="Leo Diaz"));
ok(document.getElementById("subsGoBtn").disabled, "still disabled with only one side chosen");
ok(onRows().find(r=>r.classList.contains("sel")), "the outgoing player is highlighted");
ok(document.querySelectorAll("#subsPairs .subsPairRow.part").length===1,
   "a player picked with no partner yet shows as an incomplete pair");
click(benchRows()[0]);
const inName=names(benchRows().filter(r=>r.classList.contains("sel")))[0];
ok(!document.getElementById("subsGoBtn").disabled, "both chosen -> the swap is enabled");
const pp=document.querySelector("#subsPairs .subsPairRow input.pp");
console.log("   pair row position pre-filled with:", pp&&pp.value);
ok(pp&&pp.value==="ST", "position defaults to the spot being vacated");
console.log("   button reads:", document.getElementById("subsGoBtn").textContent);

console.log("\n--- making the swap ---");
const before=Object.keys(store.data.board.placed).length;
click(document.getElementById("subsGoBtn"));
ok(!document.getElementById("subsModal").classList.contains("open"),
   "the modal closes and returns you to the pitch");
ok(Object.keys(store.data.board.placed).length===before, "the same number of players are on the pitch");
ok(!store.data.board.placed[6], "Leo Diaz has come off");
console.log("   on the pitch now:", names(onRows()).join(", "));
console.log("   bench now       :", names(benchRows()).join(", "));
ok(names(onRows()).includes(inName), inName+" is now on the pitch");
ok(names(benchRows()).includes("Leo Diaz"), "Leo Diaz is now on the bench");
ok(document.getElementById("subsGoBtn").disabled, "the selection cleared, ready for the next swap");

console.log("\n--- it is recorded with the match minute ---");
const subs=store.data.gameday.subs||[];
console.log("   log:", JSON.stringify(subs));
ok(subs.length===1, "the swap was logged against the game");
ok(subs[0].outId===6, "logged the right player coming off");
ok(typeof subs[0].min==="number", "stamped with a match minute");
ok(document.querySelectorAll("#subsLog .subsLogRow").length===1, "and shown in the modal's log");

console.log("\n--- a second change, reopening the sheet ---");
click(document.getElementById("openSubsBtn"));
ok(document.getElementById("subsModal").classList.contains("open"), "reopens cleanly");
click(onRows()[0]); click(benchRows()[0]);
click(document.getElementById("subsGoBtn"));
ok((store.data.gameday.subs||[]).length===2, "two swaps logged");
ok(Object.keys(store.data.board.placed).length===before, "still the right number on the pitch");
const all=names(onRows()).concat(names(benchRows()));
ok(new Set(all).size===all.length, "nobody has been duplicated or lost");

console.log("\n=== DOUBLE / TRIPLE CHANGE IN ONE MOVE ===");
// reset the board so there are enough bodies for a triple
store.data.board.placed={...placed};
store.data.unavailable=[];
store.data.gameday.subs=[];
store.listeners.forEach(f=>f(store.data));
click(document.getElementById("openSubsBtn"));
console.log("   on the pitch:", names(onRows()).join(", "));
console.log("   bench       :", names(benchRows()).join(", "));

const offNames=["Leo Diaz","Mo Farah","Ali Khan"];
offNames.forEach(n=>click(onRows().find(r=>r.querySelector(".who").textContent===n)));
ok(onRows().filter(r=>r.classList.contains("sel")).length===3, "three players selected to come off");
const ords=onRows().filter(r=>r.classList.contains("sel")).map(r=>r.querySelector(".ord").textContent);
console.log("   order badges on the pitch column:", ords.join(","));
ok(ords.join(",")==="3,2,1"||new Set(ords).size===3, "each shows its place in the change");
ok(document.querySelectorAll("#subsPairs .subsPairRow.part").length===3, "three incomplete pairs so far");
ok(document.getElementById("subsGoBtn").disabled, "cannot apply until they have partners");

const benchNames=names(benchRows()).slice(0,3);
benchNames.forEach(n=>click(benchRows().find(r=>r.querySelector(".who").textContent===n)));
console.log("   button reads:", document.getElementById("subsGoBtn").textContent);
ok(/Make 3 changes/.test(document.getElementById("subsGoBtn").textContent), "the button offers all three");
ok(document.querySelectorAll("#subsPairs .subsPairRow.part").length===0, "all three pairs complete");
const pairText=[...document.querySelectorAll("#subsPairs .subsPairRow")].map(r=>r.textContent.replace(/\s+/g," ").trim());
pairText.forEach((t,i)=>console.log("   pair "+(i+1)+": "+t));

const beforeCount=Object.keys(store.data.board.placed).length;
click(document.getElementById("subsGoBtn"));
console.log("   on the pitch now:", names(onRows()).join(", "));
ok(Object.keys(store.data.board.placed).length===beforeCount, "still "+beforeCount+" players on the pitch");
offNames.forEach(n=>ok(names(benchRows()).includes(n), n+" came off"));
benchNames.forEach(n=>ok(names(onRows()).includes(n), n+" came on"));
const all2=names(onRows()).concat(names(benchRows()));
ok(new Set(all2).size===all2.length, "nobody duplicated or lost across a triple change");

const lg=store.data.gameday.subs;
console.log("   logged:", JSON.stringify(lg));
ok(lg.length===3, "all three logged");
ok(new Set(lg.map(x=>x.min)).size===1, "all three share ONE match minute — it was one change");
click(document.getElementById("openSubsBtn"));
ok(document.getElementById("subsGoBtn").disabled, "reopening starts with a clean selection");

console.log("\n--- tapping again takes a player back out of the change ---");
const first=onRows()[0], nm=first.querySelector(".who").textContent;
click(first); ok(onRows().find(r=>r.querySelector(".who").textContent===nm).classList.contains("sel"), nm+" selected");
click(onRows().find(r=>r.querySelector(".who").textContent===nm));
ok(!onRows().find(r=>r.querySelector(".who").textContent===nm).classList.contains("sel"), "and de-selected on a second tap");

console.log("\n=== THE SUB INHERITS THE POSITION THEY COME INTO ===");
store.data.roster = JSON.parse(JSON.stringify(ROSTER0));
store.data.board.placed = {...placed};
store.data.unavailable = [];
store.data.gameday.subs = [];
store.listeners.forEach(f=>f(store.data));
click(document.getElementById("openSubsBtn"));
const posOfName=n=>{const p=store.data.roster.find(x=>x.name===n);return p&&p.pos;};
// Ben Wu is a striker on the bench; Ali Khan is a centre mid on the pitch
console.log("   before: Ali Khan is "+posOfName("Ali Khan")+" on the pitch, Ben Wu is "+posOfName("Ben Wu")+" on the bench");
ok(posOfName("Ali Khan")==="CM" && posOfName("Ben Wu")==="ST", "they start with different positions");
click(onRows().find(r=>r.querySelector(".who").textContent==="Ali Khan"));
click(benchRows().find(r=>r.querySelector(".who").textContent==="Ben Wu"));
const shown=document.querySelector("#subsPairs input.pp").value;
console.log("   the pair row offers:", shown);
click(document.getElementById("subsGoBtn"));      // WITHOUT touching the position box
console.log("   after : Ben Wu is "+posOfName("Ben Wu"));
ok(posOfName("Ben Wu")==="CM", "Ben Wu took over Ali Khan's position without any extra typing");
const benTok=[...document.querySelectorAll("#board .tok")].find(t=>/CM/.test(t.textContent));
ok(!!benTok, "and the pitch shows a CM in that spot");

console.log("\n--- but an explicit position still wins ---");
store.data.roster = JSON.parse(JSON.stringify(ROSTER0));
store.data.board.placed = {...placed};
store.listeners.forEach(f=>f(store.data));
click(document.getElementById("openSubsBtn"));
click(onRows().find(r=>r.querySelector(".who").textContent==="Leo Diaz"));   // ST
click(benchRows().find(r=>r.querySelector(".who").textContent==="Ben Wu"));
const box=document.querySelector("#subsPairs input.pp");
box.value="LW"; box.dispatchEvent(new window.Event("input",{bubbles:true}));
click(document.getElementById("subsGoBtn"));
console.log("   typed LW -> Ben Wu is "+posOfName("Ben Wu"));
ok(posOfName("Ben Wu")==="LW", "typing a position overrides the inherited one");

console.log("\n--- a triple change inherits three positions ---");
store.data.roster = JSON.parse(JSON.stringify(ROSTER0));
store.data.board.placed = {...placed};
store.listeners.forEach(f=>f(store.data));
click(document.getElementById("openSubsBtn"));
["Leo Diaz","Mo Farah","Sam Diaz"].forEach(n=>click(onRows().find(r=>r.querySelector(".who").textContent===n)));
["Ben Wu","Cal Ryan","Dan Ives"].forEach(n=>click(benchRows().find(r=>r.querySelector(".who").textContent===n)));
click(document.getElementById("subsGoBtn"));
console.log("   Ben Wu -> "+posOfName("Ben Wu")+"  (was ST, replaced Leo ST)");
console.log("   Cal Ryan -> "+posOfName("Cal Ryan")+"  (was LB, replaced Mo CM)");
console.log("   Dan Ives -> "+posOfName("Dan Ives")+"  (was RB, replaced Sam GK)");
ok(posOfName("Cal Ryan")==="CM", "Cal Ryan inherited CM");
ok(posOfName("Dan Ives")==="GK", "Dan Ives inherited GK");

console.log("\n=== EDIT A POSITION FROM THE SUBS SCREEN ===");
store.data.roster = JSON.parse(JSON.stringify(ROSTER0));
store.data.board.placed = {...placed};
store.data.unavailable = [];
store.listeners.forEach(f=>f(store.data));
click(document.getElementById("openSubsBtn"));
const rowFor=n=>[...document.querySelectorAll("#subsOnList .subsRow,#subsBenchList .subsRow")]
  .find(r=>r.querySelector(".who").textContent===n);
const posSpan=n=>rowFor(n).querySelector(".pos");
const type=(inp,v)=>{inp.value=v; inp.dispatchEvent(new window.Event("input",{bubbles:true}));};
const enter=inp=>inp.dispatchEvent(new window.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));

console.log("   Tom Blake shows as:", posSpan("Tom Blake").textContent);
ok(posSpan("Tom Blake").classList.contains("edit"), "the position label is marked as editable");
ok(posSpan("Tom Blake").getAttribute("role")==="button", "and is reachable as a button");

// tapping it must NOT select the row for a swap
const selBefore=document.querySelectorAll("#subsOnList .subsRow.sel").length;
click(posSpan("Tom Blake"));
ok(document.querySelectorAll("#subsOnList .subsRow.sel").length===selBefore,
   "tapping the position does not select the player for a swap");
const inp=document.querySelector("input.posEdit");
ok(!!inp, "it turns into an input");
console.log("   pre-filled with:", inp&&inp.value);
ok(inp.value==="CB", "pre-filled with the current position");
type(inp,"lb"); enter(inp);
console.log("   after typing 'lb':", posOfName("Tom Blake"));
ok(posOfName("Tom Blake")==="LB", "saved to the squad, upper-cased");
ok(posSpan("Tom Blake").textContent==="LB", "and the row now reads LB");
ok(!document.querySelector("input.posEdit"), "the input is gone again");

console.log("\n--- the pitch token follows ---");
const lbTok=[...document.querySelectorAll("#board .tok")].filter(t=>/LB/.test(t.textContent));
ok(lbTok.length>0, "a token on the pitch now reads LB");

console.log("\n--- escape abandons the edit ---");
click(posSpan("Jack Reed"));
const inp2=document.querySelector("input.posEdit");
type(inp2,"ZZ");
inp2.dispatchEvent(new window.KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
console.log("   Jack Reed is still:", posOfName("Jack Reed"));
ok(posOfName("Jack Reed")==="CB", "Escape leaves the position alone");

console.log("\n--- it works on the bench too ---");
click(posSpan("Ben Wu"));
const inp3=document.querySelector("input.posEdit");
type(inp3,"RW"); enter(inp3);
console.log("   Ben Wu (bench) is now:", posOfName("Ben Wu"));
ok(posOfName("Ben Wu")==="RW", "a bench player's position can be fixed too");

console.log("\n--- and a blank entry keeps the old one ---");
click(posSpan("Ben Wu"));
const inp4=document.querySelector("input.posEdit");
type(inp4,"   "); enter(inp4);
ok(posOfName("Ben Wu")==="RW", "an empty box does not wipe the position");

console.log("\n--- swapping still works after an edit ---");
click(rowFor("Ali Khan")); click(rowFor("Cal Ryan"));
ok(!document.getElementById("subsGoBtn").disabled, "a swap can still be set up");
click(document.getElementById("subsGoBtn"));
ok(posOfName("Cal Ryan")==="CM", "and the incoming player still inherits the position");
process.exit(0);
