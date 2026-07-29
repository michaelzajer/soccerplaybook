/* REFERENCE DRILL 2 ("medium"): TWO lanes side by side, each a shuttle between
   a top line and a bottom line of three. The front of each line travels to the
   opposite station and joins its back. THE LANES MUST NOT REFERENCE EACH OTHER
   — the bug this guards against ordered ONE queue by distance from ONE cone,
   which merged both lanes and threw right-hand players onto the left line. */
import { boot } from "./_harness.mjs";
const LT=[0.30,0.28], LB=[0.30,0.72], RT=[0.70,0.28], RB=[0.70,0.72];
const seg=(a,b)=>{const o=[];for(let i=0;i<=8;i++)o.push([a[0]+(b[0]-a[0])*i/8,a[1]+(b[1]-a[1])*i/8]);return o;};
const back=(c,n,dir)=>[c[0], c[1]+dir*0.075*n];
const drill={id:"sh",name:"shuttle",difficulty:"complex",
 info:{trains:"",setup:"",steps:[],coaching:[]},
 items:[
  {kind:"cone",x:LT[0],y:LT[1],startCone:true},{kind:"cone",x:LB[0],y:LB[1]},
  {kind:"cone",x:RT[0],y:RT[1]},{kind:"cone",x:RB[0],y:RB[1]},
  // left lane: 1,2,3 on top; 4,5,6 on bottom
  {kind:"att",x:LT[0],y:LT[1],num:"1"},
  {kind:"att",x:back(LT,1,-1)[0],y:back(LT,1,-1)[1],num:"2"},
  {kind:"att",x:back(LT,2,-1)[0],y:back(LT,2,-1)[1],num:"3"},
  {kind:"att",x:LB[0],y:LB[1],num:"4"},
  {kind:"att",x:back(LB,1,1)[0],y:back(LB,1,1)[1],num:"5"},
  {kind:"att",x:back(LB,2,1)[0],y:back(LB,2,1)[1],num:"6"},
  // right lane: 7,8,9 on top; 10,11,12 on bottom
  {kind:"att",x:RT[0],y:RT[1],num:"7"},
  {kind:"att",x:back(RT,1,-1)[0],y:back(RT,1,-1)[1],num:"8"},
  {kind:"att",x:back(RT,2,-1)[0],y:back(RT,2,-1)[1],num:"9"},
  {kind:"att",x:RB[0],y:RB[1],num:"10"},
  {kind:"att",x:back(RB,1,1)[0],y:back(RB,1,1)[1],num:"11"},
  {kind:"att",x:back(RB,2,1)[0],y:back(RB,2,1)[1],num:"12"}],
 strokes:[{mode:"run",pts:seg(LT,LB)},{mode:"run",pts:seg(LB,LT)},
          {mode:"run",pts:seg(RT,RB)},{mode:"run",pts:seg(RB,RT)}]};
const { $, click, state, W, H } = await boot({ drill });
click($("#dpLoopBtn")); click($("#playDrillBtn"));
const LEFT=new Set(["1","2","3","4","5","6"]), RIGHT=new Set(["7","8","9","10","11","12"]);
let crossed=[], moved=0;
for(let lap=1; lap<=4; lap++){
  const seen=[];
  state.legs.forEach(l=>{
    if(!l.el||!l.k) return;
    const num=l.el.textContent.trim(); if(!/^\d+$/.test(num)) return;
    const x=parseFloat(l.k.left)/W;
    const lane = x<0.5 ? "L" : "R";
    const owns = LEFT.has(num) ? "L" : (RIGHT.has(num) ? "R" : "?");
    seen.push(num+lane);
    moved++;
    if(owns!=="?" && lane!==owns) crossed.push("lap"+lap+" P"+num+" ("+owns+") ended in "+lane);
  });
  console.log("lap "+lap+": "+seen.join(" "));
  state.settle(); if(state.complete) state.complete();
}
console.log((moved>0?"PASS":"FAIL")+" - the drill actually animates ("+moved+" legs over 4 laps)");
console.log((crossed.length===0?"PASS":"FAIL")+" - no player ever crosses to the other lane");
crossed.forEach(c=>console.log("        "+c));
process.exit(0);
