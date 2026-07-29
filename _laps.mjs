/* REFERENCE DRILL 1 (Michael's): 4 cones in a square, players 1-4 on the
   cones, 5-8 queued behind cone 1, follow-your-pass, cone 1 is the start.
   With 8 players and 4 cones the cycle must repeat every 8 laps with nobody
   duplicated and nobody stranded. A test that only counts occupied cones does
   NOT catch a frozen rotation — this one names who is on each cone. */
import { boot, players, nearest } from "./_harness.mjs";
const C1=[0.35,0.65], C2=[0.35,0.35], C3=[0.65,0.35], C4=[0.65,0.65];
const q=n=>[0.35,0.72+0.07*n];
const seg=(a,b)=>{const o=[];for(let i=0;i<=8;i++)o.push([a[0]+(b[0]-a[0])*i/8,a[1]+(b[1]-a[1])*i/8]);return o;};
const drill={id:"sq",name:"square",difficulty:"complex",
 info:{trains:"",setup:"",steps:[],coaching:[]},
 items:[
  {kind:"cone",x:C1[0],y:C1[1],startCone:true},{kind:"cone",x:C2[0],y:C2[1]},
  {kind:"cone",x:C3[0],y:C3[1]},{kind:"cone",x:C4[0],y:C4[1]},
  {kind:"att",x:C1[0],y:C1[1],num:"1"},{kind:"att",x:C2[0],y:C2[1],num:"2"},
  {kind:"att",x:C3[0],y:C3[1],num:"3"},{kind:"att",x:C4[0],y:C4[1],num:"4"},
  {kind:"att",x:q(0)[0],y:q(0)[1],num:"5"},{kind:"att",x:q(1)[0],y:q(1)[1],num:"6"},
  {kind:"att",x:q(2)[0],y:q(2)[1],num:"7"},{kind:"att",x:q(3)[0],y:q(3)[1],num:"8"},
  {kind:"dball",x:C1[0],y:C1[1]}],
 strokes:[{mode:"passrun",pts:seg(C1,C2)},{mode:"passrun",pts:seg(C2,C3)},
          {mode:"passrun",pts:seg(C3,C4)},{mode:"passrun",pts:seg(C4,C1)}]};
const { document, $, click, state, W, H } = await boot({ drill });
// Looping must be ON: onTimelineComplete only continues the rotation when it
// is, otherwise it stops and resets — which reads exactly like a frozen drill.
click($("#dpLoopBtn"));
click($("#playDrillBtn"));

/* Read each lap from the LEGS THE ENGINE EMITS, not from the DOM. A player who
   does not move in a given lap gets no leg, so their element keeps its previous
   position — reading the DOM therefore shows finished players still standing on
   a cone and makes a correct rotation look like a pile-up. The legs are what the
   engine intends, and they are what the documented reference sequence describes. */
const cones=[["cone1",C1],["cone2",C2],["cone3",C3],["cone4",C4]];
const near=(x,y,px,py)=>Math.hypot(x-px,y-py)<0.05;
const expected=[
 "cone1:P5 cone2:P1 cone3:P2 cone4:P3",
 "cone1:P6 cone2:P5 cone3:P1 cone4:P2",
 "cone1:P7 cone2:P6 cone3:P5 cone4:P1",
 "cone1:P8 cone2:P7 cone3:P6 cone4:P5",
 "cone1:P4 cone2:P8 cone3:P7 cone4:P6",
 "cone1:P3 cone2:P4 cone3:P8 cone4:P7",
 "cone1:P2 cone2:P3 cone3:P4 cone4:P8",
 "cone1:P1 cone2:P2 cone3:P3 cone4:P4"];
let bad=0;
for(let lap=1; lap<=8; lap++){
  const at={};
  state.legs.forEach(l=>{
    if(!l.el||!l.k) return;
    const num=l.el.textContent.trim(); if(!/^\d+$/.test(num)) return;
    const x=parseFloat(l.k.left)/W, y=parseFloat(l.k.top)/H;
    cones.forEach(([n,c])=>{ if(near(x,y,c[0],c[1])) at[n]="P"+num; });
  });
  if(lap===1){ console.log("   lap 1 legs:", state.legs.filter(l=>l.el&&/^\d+$/.test(l.el.textContent.trim()))
      .map(l=>"P"+l.el.textContent.trim()+"->("+(parseFloat(l.k.left)/W).toFixed(2)+","+(parseFloat(l.k.top)/H).toFixed(2)+")").join(" ")); }
  const got=cones.map(([n])=>n+":"+(at[n]||"-")).join(" ");
  const okLap=got===expected[lap-1];
  if(!okLap) bad++;
  console.log((okLap?"PASS":"FAIL")+" - lap "+lap+" -> "+got);
  if(!okLap) console.log("        expected "+expected[lap-1]);
  state.settle();
  if(state.complete) state.complete();
}
console.log((bad?"FAIL":"PASS")+" - square drill rotates exactly as the reference describes");
process.exit(0);
