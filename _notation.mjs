/* END-TO-END: text notation -> drill JSON -> the real playback engine.
   This is the point of the notation. If a drill written as text does not rotate
   the way the same drill drawn by hand does, the notation is worthless. */
import fs from "fs";
import { parseDrill } from "./tools/drill-from-text.mjs";
import { boot } from "./_harness.mjs";

const drill = parseDrill(fs.readFileSync("./tools/examples/square.txt","utf8"));
const ok=(c,m)=>console.log((c?"PASS":"FAIL")+" - "+m);
console.log(drill.name+": "+drill.items.length+" pieces, "+drill.strokes.length+" lines");
ok(drill.items.filter(i=>i.kind==="cone").length===4, "4 cones parsed");
ok(drill.items.filter(i=>i.kind==="att").length===8, "8 players parsed");
ok(drill.items.filter(i=>i.kind==="dball").length===1, "1 ball parsed");
ok(drill.items.some(i=>i.startCone), "the entry cone was marked");
ok(drill.strokes.every(s=>s.pts.length===34), "lines emitted as 17 flattened points");

// stack check: the cone and player 1 must be on the SAME square
const c1=drill.items.find(i=>i.kind==="cone"&&i.startCone);
const p1=drill.items.find(i=>i.num==="1");
ok(Math.hypot(c1.x-p1.x,c1.y-p1.y)<0.001, "\"o!+1\" put the cone and player 1 on one square");

// now play it
const un=st=>{const o=[];for(let i=0;i+1<st.pts.length;i+=2)o.push([st.pts[i],st.pts[i+1]]);return o;};
const preset=Object.assign({},drill,{difficulty:"complex",info:{trains:"",setup:"",steps:[],coaching:[]},
  strokes:drill.strokes.map(s=>({mode:s.mode,pts:un(s)}))});
const { document, $, click, state, W, H } = await boot({ drill:preset });
ok(document.querySelectorAll(".ditem").length===13, "loaded onto the pitch ("+document.querySelectorAll(".ditem").length+" pieces)");
click($("#dpLoopBtn")); click($("#playDrillBtn"));

const cones=drill.items.filter(i=>i.kind==="cone");
const near=(x,y,p)=>Math.hypot(x-p[0],y-p[1])<0.05;
const seq=[];
for(let lap=1; lap<=4; lap++){
  const at={};
  state.legs.forEach(l=>{
    if(!l.el||!l.k) return;
    const n=l.el.textContent.trim(); if(!/^\d+$/.test(n)) return;
    const x=parseFloat(l.k.left)/W, y=parseFloat(l.k.top)/H;
    cones.forEach((c,ci)=>{ if(near(x,y,[c.x,c.y])) at[ci]="P"+n; });
  });
  seq.push(cones.map((c,ci)=>at[ci]||"-").join(" "));
  console.log("   lap "+lap+": "+seq[lap-1]);
  state.settle(); if(state.complete) state.complete();
}
ok(seq.every(r=>!r.includes("-")), "every cone is manned on every lap — the queue recycles");
ok(new Set(seq).size===4, "the rotation advances every lap ("+new Set(seq).size+" distinct states)");
ok(!seq.some(r=>{const a=r.split(" ");return new Set(a).size!==a.length;}), "no two players share a cone");

// ---- and the app must be able to import the same text ----
console.log("\n--- import in the app ---");
const { boot:boot2 } = await import("./_harness.mjs");
const app = await boot2({});
const w = app.window, doc = app.document;
// the shared parser is loaded by app.html as a plain script; feed it in the same way
new Function("window", fs.readFileSync("./js/drill-text.js","utf8"))(w);
const seg2 = v => [...doc.querySelectorAll("#viewSeg button")].find(b=>b.dataset.view===v);
app.click(seg2("drills")); app.click(seg2("drills"));
app.click(doc.getElementById("importDrillBtn"));
ok(doc.getElementById("importPanel").classList.contains("open"), "import sheet opens");
doc.getElementById("impText").value = fs.readFileSync("./tools/examples/square.txt","utf8");
app.click(doc.getElementById("impGoBtn"));
const err = doc.getElementById("impError").textContent;
ok(!err, "notation imported without error" + (err ? " -> "+err : ""));
ok(app.store.data.drills.length===1, "saved into the drill library");
ok(doc.querySelectorAll("#board .ditem").length===13, "and loaded onto the pitch ("+doc.querySelectorAll("#board .ditem").length+")");
const saved = app.store.data.drills[0];
ok(saved.strokes.every(st=>!Array.isArray(st.pts[0])), "strokes stored FLAT (Firestore rejects nested arrays)");
// bad input must not throw
doc.getElementById("impText").value = "GRID\n. . q . .";
app.click(doc.getElementById("impGoBtn"));
ok(/unknown grid symbol/i.test(doc.getElementById("impError").textContent), "a bad symbol reports a clear error");

// ================= METRIC STYLE =================
console.log("\n=== described in metres, not drawn ===");
const md = parseDrill(fs.readFileSync("./tools/examples/square-metric.txt","utf8"));
const PW=68, PH=105;
const mc = md.items.filter(i=>i.kind==="cone");
const side=(a,b)=>Math.hypot((a.x-b.x)*PW,(a.y-b.y)*PH);
console.log("   sides: "+[side(mc[0],mc[1]),side(mc[1],mc[2]),side(mc[2],mc[3]),side(mc[3],mc[0])]
  .map(v=>v.toFixed(2)+"m").join("  "));
ok([side(mc[0],mc[1]),side(mc[1],mc[2]),side(mc[2],mc[3]),side(mc[3],mc[0])]
   .every(v=>Math.abs(v-14)<0.1), "a 14 m square really is 14 m on every side, both axes");
ok(mc[0].startCone, "the bottom-left cone is the entry");
ok(md.items.filter(i=>i.kind==="att").length===12, "12 players placed");
ok(md.strokes.length===4, "\"pass and follow\" produced a CLOSED circuit of 4 passes");
// player 1 on the start cone, player 2 at the next cone round
const pl=n=>md.items.find(i=>i.num===String(n));
/* Players stand BEHIND their cone, not on it (v141) — the cone marks the spot,
   the player waits behind it, one snapping square back so a later Tidy cannot
   merge them onto the same lattice point. */
console.log("   player 1 stands "+side(pl(1),mc[0]).toFixed(1)+"m behind cone 1");
ok(side(pl(1),mc[0])>4 && side(pl(1),mc[0])<6, "player 1 waits BEHIND the start cone, not on it");
ok(side(pl(2),mc[1])>4 && side(pl(2),mc[1])<6, "player 2 waits behind the NEXT cone, so \"1 passes to 2\" reads correctly");
const nearestCone=q=>mc.map((c,i)=>[i,side(q,c)]).sort((a,b)=>a[1]-b[1])[0][0];
ok(nearestCone(pl(1))===0 && nearestCone(pl(2))===1, "each is closest to its own cone");
console.log("   player 5 stands "+side(pl(5),mc[0]).toFixed(1)+"m behind cone 1 (second in the queue)");
ok(side(pl(5),mc[0])>9 && side(pl(5),mc[0])<11,
   "player 5 queues a further square back, so snapping cannot merge the queue");

// ...and it must play
const un2=st=>{const o=[];for(let i=0;i+1<st.pts.length;i+=2)o.push([st.pts[i],st.pts[i+1]]);return o;};
const mp=Object.assign({},md,{difficulty:"complex",info:{trains:"",setup:"",steps:[],coaching:[]},
  strokes:md.strokes.map(s=>({mode:s.mode,pts:un2(s)}))});
const m2 = await (await import("./_harness.mjs")).boot({ drill:mp });
m2.click(m2.$("#dpLoopBtn")); m2.click(m2.$("#playDrillBtn"));
/* the front slot of each queue, derived the same way the parser does it */
const mcx=mc.reduce((a,c)=>a+c.x,0)/mc.length, mcy=mc.reduce((a,c)=>a+c.y,0)/mc.length;
const fronts=mc.map(c=>{const ux=(c.x-mcx)*PW, uy=(c.y-mcy)*PH, L=Math.hypot(ux,uy)||1;
  return {x:c.x+(ux/L)*5/PW, y:c.y+(uy/L)*5/PH};});
const mseq=[];
/* Read the SETTLED positions here, not every leg's endpoint. In this drill
   everyone moves, and a player's passrun leg ends on a cone before the rotation
   re-lay moves them on to the back of that cone's queue — so collecting leg
   endpoints reports them on the cone when they finish behind it. */
const pos=()=>[...m2.document.querySelectorAll("#board .ditem")]
  .filter(e=>e.querySelector(".att,.def"))
  .map(e=>({n:e.textContent.trim(),
            x:parseFloat(e.style.left)/(e.style.left.includes("%")?100:m2.W),
            y:parseFloat(e.style.top)/(e.style.top.includes("%")?100:m2.H)}));
for(let lap=1; lap<=4; lap++){
  m2.state.settle();
  const ps=pos();
  /* Read the FRONT slot of each queue — one step behind its cone — because that
     is where the player waiting to pass now stands. */
  mseq.push(mc.map((c,ci)=>{
    const f=fronts[ci];
    const hit=ps.map(q=>[q,Math.hypot(q.x-f.x,q.y-f.y)]).sort((a,b)=>a[1]-b[1])[0];
    return hit && hit[1]<0.04 ? "P"+hit[0].n : "-";
  }).join(" "));
  console.log("   lap "+lap+": "+mseq[lap-1]);
  if(m2.state.complete) m2.state.complete();
}
ok(/^P5 P6 P7 P8$/.test(mseq[0]),
   "lap 1: every cone's front has gone, the next in each queue steps up");
ok(mseq.every(r=>!r.includes("-")), "every cone stays manned — the 12 recycle properly");
ok(new Set(mseq).size===4, "the rotation advances every lap");
process.exit(0);
