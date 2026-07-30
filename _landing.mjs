/* The hero drill must actually rotate — a landing page showing a frozen or
   piled-up drill would be worse than a screenshot. Runs the real inline script. */
import { JSDOM } from "jsdom";
import fs from "fs";
const html=fs.readFileSync("./index.html","utf8");
let now=0; const cbs=[];
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:false,
  beforeParse(w){
    w.requestAnimationFrame=fn=>{cbs.push(fn);return cbs.length;};
    w.cancelAnimationFrame=()=>{};
    w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});
    w.IntersectionObserver=class{constructor(f){this.f=f;}observe(){this.f([{isIntersecting:true}]);}disconnect(){}};
  }});
const {window}=dom, doc=window.document;
const ok=(c,m)=>console.log((c?"PASS":"FAIL")+" - "+m);
const step=ms=>{now+=ms; const q=cbs.splice(0,cbs.length); q.forEach(f=>f(now));};
ok(!!doc.getElementById("pitch"), "hero pitch svg present");
const dots=doc.getElementById("drillDots");
ok(dots.children.length===3, "three drills offered");

const cones=()=>[...doc.querySelectorAll("#pieces polygon")].map(c=>{
  const n=c.getAttribute("points").split(" ").map(q=>q.split(",").map(Number));
  return {x:n[1][0], y:(n[0][1]+n[1][1])/2};});
const plyrs=()=>[...doc.querySelectorAll("#pieces g")].filter(g=>g.querySelector("text")).map(g=>{
  const m=/translate\(([-\d.]+),([-\d.]+)\)/.exec(g.getAttribute("transform")||"translate(0,0)");
  return {n:g.textContent.trim(), x:+m[1], y:+m[2]};});
const tag=()=>doc.getElementById("drillTag").textContent;
const settle=ms=>{for(let i=0;i<Math.round(ms/100);i++) step(100);};
const pick=i=>{dots.children[i].dispatchEvent(new window.MouseEvent("click",{bubbles:true})); step(16);};
const gap=()=>{let w=1e9;cones().forEach(c=>plyrs().forEach(p=>{const d=Math.hypot(p.x-c.x,p.y-c.y);if(d<w)w=d;}));return w;};
const onC=()=>cones().map(c=>{const h=plyrs().find(p=>Math.hypot(p.x-c.x,p.y-c.y)<24);return h?h.n:"-";});

step(16);
// ---- each drill: players beside the cones, correct piece counts ----
[[0,"Passing square",4,8],[1,"Shuttle lines",2,6],[2,"Passing triangle",3,7]].forEach(([i,name,nc,np])=>{
  pick(i);
  console.log("\n--- "+tag()+" ---  cones "+cones().length+"  players "+plyrs().length
              +"  closest gap "+gap().toFixed(1)+"px");
  ok(tag()===name, "dot "+(i+1)+" loads "+name);
  ok(cones().length===nc && plyrs().length===np, "right pieces ("+nc+" cones, "+np+" players)");
  ok(gap()>11, "players stand BESIDE the cones, never on them");
});

// ---- the square must rotate like the app's reference drill ----
pick(0); settle(100);
console.log("\n--- square rotation ---");
console.log("   start : "+onC().join(" "));
const seq=[];
for(let l=1;l<=2;l++){ settle(3600); seq.push(onC().join(" "));
  console.log("   lap "+l+": "+seq[l-1]); settle(700); }   // 9s airtime = 2 square laps
ok(seq[0]==="5 1 2 3", "lap 1 = 5 1 2 3 (queue front steps on, everyone follows their pass)");
ok(new Set(seq).size===2, "keeps advancing, no repeats");
ok(!seq.some(r=>{const a=r.split(" ").filter(x=>x!=="-");return new Set(a).size!==a.length;}),
   "no two players ever share a cone");

// ---- the shuttle: players swap ends and nobody is left standing on a cone ----
pick(1); settle(100);
console.log("\n--- shuttle ---");
console.log("   start : "+onC().join(" "));
const s1=onC().join(" "); settle(1750);   // one shuttle lap
console.log("   lap 1 : "+onC().join(" "));
ok(onC().join(" ")!==s1, "fronts have swapped ends");
ok(gap()>11, "still beside the cones after crossing");
ok(!onC().includes("-"), "both stations still manned");
ok(doc.querySelectorAll("#lines line").length>0, "pass lines drawn");

// ---- the hero must show the ball beating its passer ----
pick(0); step(16);
console.log("\n--- pass vs passer ---");
const ballPos=()=>{const g=[...doc.querySelectorAll("#pieces g")].find(x=>!x.querySelector("text"));
  const m=/translate\(([-\d.]+),([-\d.]+)\)/.exec(g.getAttribute("transform")||"translate(0,0)");
  return {x:+m[1],y:+m[2]};};
const p1=()=>plyrs().find(p=>p.n==="1");
const cs=cones(), target=cs[1];                    // the ball's first destination
let ballThere=null, manThere=null, tt=0;
for(let i=0;i<20;i++){
  step(60); tt+=60;
  if(ballThere===null && Math.hypot(ballPos().x-target.x, ballPos().y-target.y)<22) ballThere=tt;
  if(manThere===null && Math.hypot(p1().x-target.x, p1().y-target.y)<22) manThere=tt;
}
console.log("   ball reaches cone 2 at ~"+ballThere+"ms, the passer at ~"+manThere+"ms");
ok(ballThere!==null && manThere!==null && ballThere < manThere,
   "the ball arrives BEFORE the player who passed it");

// ---- equal airtime: every drill gets a fair turn ----
console.log("\n--- airtime ---");
pick(0); let seen=[], last=tag(), t=0;
while(seen.length<4 && t<60000){ settle(500); t+=500; if(tag()!==last){seen.push([last,t]); last=tag(); t=0;} }
seen.forEach(([n,ms])=>console.log("   "+n+" held for ~"+(ms/1000).toFixed(1)+"s"));
ok(seen.every(([,ms])=>ms>=8000&&ms<=15000), "each drill holds the screen for a comparable time");
ok(seen.map(([n])=>n).join("|").includes("Shuttle lines"), "the shuttle is not skipped");
process.exit(0);
