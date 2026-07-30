/* The builder must be a FRONT END to the notation, never a second model.
   These checks assert exactly that: the controls write notation, the notation
   loads onto the real pitch, and saving persists what is already on screen. */
import fs from "fs";
import { boot } from "./_harness.mjs";
const { window, document, $, click, store, state } = await boot({});
new Function("window", fs.readFileSync("./js/drill-text.js","utf8"))(window);
const ok=(c,m)=>console.log((c?"PASS":"FAIL")+" - "+m);
const seg=v=>[...document.querySelectorAll("#viewSeg button")].find(b=>b.dataset.view===v);
/* The builder debounces the reload by 70ms, because a slider fires a burst of
   input events. Wait for it rather than pretending it is synchronous. */
const settle=()=>new Promise(r=>setTimeout(r,130));
const set=async(id,v)=>{const n=document.getElementById(id); n.value=String(v);
  n.dispatchEvent(new window.Event("input",{bubbles:true}));
  n.dispatchEvent(new window.Event("change",{bubbles:true}));
  await settle();};
const chip=(grp,v)=>click(document.querySelector('#'+grp+' .bchip[data-v="'+v+'"]'));
const pieces=()=>[...document.querySelectorAll("#board .ditem")];
const cones=()=>pieces().filter(e=>e.querySelector(".cone,.disc"));
const players=()=>pieces().filter(e=>e.querySelector(".att,.def"));
const pos=e=>[parseFloat(e.style.left)/100, parseFloat(e.style.top)/100];
const PW=68, PH=105;
const metres=(a,b)=>Math.hypot((a[0]-b[0])*PW,(a[1]-b[1])*PH);

click(seg("drills")); click(seg("drills"));
ok(!!document.getElementById("buildDrillBtn"), "the drills sheet offers 'Build from a shape…'");
click(document.getElementById("buildDrillBtn"));
ok(document.getElementById("builderPanel").classList.contains("open"), "builder sheet opens");
ok(document.getElementById("bError").textContent==="", "no error on open");

console.log("\n--- it loads onto the REAL pitch, not a mock preview ---");
console.log("   pieces on the pitch:", pieces().length, "| cones:", cones().length, "| players:", players().length);
ok(cones().length===4, "a square gives 4 markers");
ok(players().length===12, "12 players by default");
const cs=cones().map(pos);
console.log("   sides: "+[metres(cs[0],cs[1]),metres(cs[1],cs[2]),metres(cs[2],cs[3]),metres(cs[3],cs[0])].map(v=>v.toFixed(1)+"m").join("  "));
ok([metres(cs[0],cs[1]),metres(cs[1],cs[2])].every(v=>Math.abs(v-14)<1.2), "14 m slider really is ~14 m on the pitch");

console.log("\n--- the controls drive it ---");
await set("bSize", 22);
const cs2=cones().map(pos);
console.log("   size 22 -> sides "+metres(cs2[0],cs2[1]).toFixed(1)+"m");
ok(Math.abs(metres(cs2[0],cs2[1])-22)<1.5, "dragging Size resizes the shape in metres");
await set("bShape","triangle");
ok(cones().length===3, "switching to Triangle gives 3 markers ("+cones().length+")");
ok(document.getElementById("bStart").options.length===3, "the Start selector follows the marker count");
await set("bShape","line"); await set("bCount",5);
ok(cones().length===5, "Line with 5 markers ("+cones().length+")");
ok(!document.getElementById("bCountRow").hidden, "the Markers slider only shows for Line");
await set("bPlayers", 6);
ok(players().length===6, "Players slider changes the squad ("+players().length+")");

console.log("\n--- guard rails ---");
await set("bShape","pair");
const shBtn=document.querySelector('#bSeq .bchip[data-v="shuttle"]');
ok(!shBtn.disabled && shBtn.classList.contains("on"), "two markers auto-selects Shuttle");
await set("bShape","square");
ok(shBtn.disabled, "Shuttle is disabled when there are not exactly 2 markers");
ok(document.querySelector('#bSeq .bchip[data-v="follow"]').classList.contains("on"), "and it falls back to Pass & follow");
ok(document.getElementById("bError").textContent==="", "no parser error is ever surfaced to the coach");

console.log("\n--- saving persists what is on screen ---");
await set("bShape","square"); await set("bSize",14); await set("bPlayers",12);
const before=cones().map(pos).concat(players().map(pos));
click(document.getElementById("bSaveBtn"));
ok(!document.getElementById("builderPanel").classList.contains("open"), "sheet closes on save");
ok(store.data.drills.length===1, "saved to the drill library");
const saved=store.data.drills[0];
ok(saved.strokes.every(st=>!Array.isArray(st.pts[0])), "strokes stored FLAT for Firestore");
ok(saved.items.length===17, "17 pieces saved (4 cones + 12 players + ball)");
const after=cones().map(pos).concat(players().map(pos));
ok(JSON.stringify(before)===JSON.stringify(after), "what was previewed is exactly what was saved");

console.log("\n--- players stand behind their cones, and it reads at a watchable pace ---");
const cs3=cones().map(pos), ps3=players().map(pos);
let closest=1e9; cs3.forEach(c=>ps3.forEach(q=>{const d=metres(c,q); if(d<closest)closest=d;}));
console.log("   closest player to any cone: "+closest.toFixed(1)+"m");
ok(closest>3.5, "nobody is standing on a cone any more");
const runs=state.legs.filter(l=>l.el&&!l.el.querySelector(".dball")&&l.el.querySelector(".att"));
const balls=state.legs.filter(l=>l.el&&l.el.querySelector(".dball"));
if(runs.length&&balls.length){
  console.log("   a leg: ball "+Math.round(balls[0].dur)+"ms, runner "+Math.round(runs[0].dur)+"ms");
  ok(runs[0].dur>1800, "a pass leg is slow enough to follow");
  ok(balls[0].dur<runs[0].dur, "and the ball still gets there first");
}
console.log("\n--- and it plays ---");
click($("#dpLoopBtn")); click($("#playDrillBtn"));
ok(state.legs.length>0, "the saved drill animates ("+state.legs.length+" legs)");

console.log("\n--- pace ---");
{
  const runs=state.legs.filter(l=>l.el&&l.el.querySelector(".att"));
  const balls=state.legs.filter(l=>l.el&&l.el.querySelector(".dball"));
  if(runs.length&&balls.length){
    console.log("   one leg: ball "+Math.round(balls[0].dur)+"ms, runner "+Math.round(runs[0].dur)+"ms");
    ok(runs[0].dur>1800, "a pass leg is slow enough to follow (was ~800ms)");
    ok(balls[0].dur<runs[0].dur, "and the ball still gets there first");
  }
}
console.log("\n--- same real distance, same duration whichever way it points ---");
// a 14m square's legs are equal in metres, so they must be equal in ms
const ballLegs=state.legs.filter(l=>l.el&&l.el.querySelector(".dball")&&l.kf&&l.kf.length>1);
const dirs=ballLegs.map(l=>{
  const a=l.kf[0], b=l.kf[l.kf.length-1];
  const dx=Math.abs(parseFloat(b.left)-parseFloat(a.left)),
        dy=Math.abs(parseFloat(b.top)-parseFloat(a.top));
  return {dur:Math.round(l.dur), across:dx>dy};}).filter(l=>l.dur>0);
const A=dirs.filter(d=>d.across), U=dirs.filter(d=>!d.across);
if(A.length&&U.length){
  console.log("   across the pitch: "+A[0].dur+"ms   up the pitch: "+U[0].dur+"ms");
  ok(Math.abs(A[0].dur-U[0].dur)<120,
     "equal legs of a square take equal time in both directions");
} else console.log("   (needed both a horizontal and a vertical leg to compare)");
process.exit(0);
