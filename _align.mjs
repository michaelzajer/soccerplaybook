import { JSDOM } from "jsdom";
import fs from "fs";
const R="./";
const dom=new JSDOM(fs.readFileSync(R+"app.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true});
const {window}=dom;
global.window=window; global.document=window.document;
Object.defineProperty(global,"navigator",{value:window.navigator,writable:true,configurable:true});
global.Event=window.Event; global.requestAnimationFrame=fn=>setTimeout(()=>fn(Date.now()),0);
window.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>({width:10}),set:()=>true});
window.HTMLElement.prototype.setPointerCapture=()=>{}; window.HTMLElement.prototype.releasePointerCapture=()=>{};
const W=360,H=556;  // a phone: 68:105 board
window.Element.prototype.getBoundingClientRect=function(){
  return this.id==="board"?{left:0,top:0,right:W,bottom:H,width:W,height:H}
                          :{left:0,top:0,right:W,bottom:H,width:W,height:H}; };
global.gsap=window.gsap=Object.assign(()=>({}),{timeline:()=>{const t={to(){return t},play(){},pause(){},restart(){},seek(){},finished:Promise.resolve()};return t;},set(){}});
eval(fs.readFileSync(R+"js/drills.js","utf8"));
const store={data:{teamName:"P",roster:[],nextId:1,colors:{team:"#2563eb",opp:"#ff453a"},
 board:{squad:"11",formation:"4-3-3",showOpp:false,placed:{}},drills:[],games:[]},
 listeners:new Set(),subscribe(f){this.listeners.add(f)},emit(){},save(){},flush(){}};
const mod=await import(R+"js/board.js?"+Date.now());
mod.initBoard(store);
const $=s=>document.querySelector(s);
const ok=(c,m)=>console.log((c?"PASS":"FAIL")+" - "+m);
const seg=v=>[...document.querySelectorAll("#viewSeg button")].find(b=>b.dataset.view===v);
const click=el=>el&&el.dispatchEvent(new window.Event("click",{bubbles:true}));
click(seg("drills"));
const board=$("#board");

// drive real pointer events at the board so the app's own handlers run
const pd=(t,x,y)=>t.dispatchEvent(new window.PointerEvent("pointerdown",{bubbles:true,clientX:x,clientY:y,pointerId:1}));
const pm=(t,x,y)=>t.dispatchEvent(new window.PointerEvent("pointermove",{bubbles:true,clientX:x,clientY:y,pointerId:1}));
const pu=(t,x,y)=>t.dispatchEvent(new window.PointerEvent("pointerup",{bubbles:true,clientX:x,clientY:y,pointerId:1}));

const cell=Math.min(40,Math.max(22,0.075*W));
console.log("board "+W+"x"+H+"  ->  grid cell "+cell.toFixed(1)+"px");
ok(Math.abs(cell-27)<2, "cell is about one piece wide ("+cell.toFixed(1)+"px)");

// --- draw a deliberately wobbly "pass" and check it is tidied ---
const setMode=m=>{const b=[...document.querySelectorAll("[data-mode]")].find(x=>x.dataset.mode===m); if(b) click(b); return !!b;};
ok(setMode("pass"), "pass tool selected");
const A=[70,120], B=[290,300];
pd(board,A[0],A[1]);
for(let i=1;i<=40;i++){                       // a shaky hand: +/- 7px of wobble
  const t=i/40, x=A[0]+(B[0]-A[0])*t, y=A[1]+(B[1]-A[1])*t;
  pm(board, x+Math.sin(i*1.7)*7, y+Math.cos(i*2.3)*7);
}
pu(board,B[0],B[1]);
const strokes=store.data.drills; // not saved yet; read the live buffer via a redraw side effect
const paths=[...document.querySelectorAll("#tacticalLayer path")];
console.log("rendered stroke paths:", paths.length);

// pull the stroke back out of the module by re-drawing into the DOM
const d=paths.length?paths[paths.length-1].getAttribute("d"):"";
const nums=(d.match(/-?\d+\.?\d*/g)||[]).map(Number);
const pts=[]; for(let i=0;i+1<nums.length;i+=2) pts.push([nums[i],nums[i+1]]);
console.log("points kept:", pts.length, "(captured ~41)");
ok(pts.length<=17 && pts.length>=2, "wobble collapsed to a short clean path");
if(pts.length>2){
  const a=pts[0], b=pts[pts.length-1];
  const L=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const nx=-(b[1]-a[1])/L, ny=(b[0]-a[0])/L;
  let dev=0; pts.forEach(p=>{const v=(p[0]-a[0])*nx+(p[1]-a[1])*ny; if(Math.abs(v)>Math.abs(dev))dev=v;});
  console.log("max bow off the chord:", dev.toFixed(1)+"px  (drawn wobble was ~7px)");
  ok(Math.abs(dev)<6, "shaky line came out straight");
}

// --- a DELIBERATE arc must survive, just shallower ---
const lastPath=()=>{const q=[...document.querySelectorAll("#tacticalLayer path")];
  const d=q.length?q[q.length-1].getAttribute("d"):""; const n=(d.match(/-?\d+\.?\d*/g)||[]).map(Number);
  const o=[]; for(let i=0;i+1<n.length;i+=2) o.push([n[i],n[i+1]]); return o;};
const bowOf=p=>{const a=p[0],b=p[p.length-1];const L=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
  const nx=-(b[1]-a[1])/L, ny=(b[0]-a[0])/L; let d=0;
  p.forEach(q=>{const v=(q[0]-a[0])*nx+(q[1]-a[1])*ny; if(Math.abs(v)>Math.abs(d))d=v;}); return d;};
const C=[60,400], D=[300,430];
pd(board,C[0],C[1]);
for(let i=1;i<=40;i++){ const t=i/40;
  pm(board, C[0]+(D[0]-C[0])*t, C[1]+(D[1]-C[1])*t - Math.sin(Math.PI*t)*45); }  // 45px arc
pu(board,D[0],D[1]);
const arc=bowOf(lastPath());
console.log("\ndeliberate 45px arc came out as:", Math.abs(arc).toFixed(1)+"px");
ok(Math.abs(arc)>10 && Math.abs(arc)<35, "a real curve is kept, but flattened");

// --- an endpoint near a piece snaps ONTO the piece ---
click([...document.querySelectorAll("#drillDock button")].find(b=>b.dataset.pane==="kit"));
const tItem=document.querySelector('.titem[data-kind="cone"]')||document.querySelector(".titem");
pd(tItem,10,10); pm(tItem,150,200); pu(tItem,150,200);
const items=[...document.querySelectorAll("#board .ditem")];
console.log("pieces placed:", items.length);
if(items.length){
  const st=items[items.length-1].style;
  const gx=parseFloat(st.left)/100*W, gy=parseFloat(st.top)/100*H;
  console.log("dropped at (150,200) -> landed (" + gx.toFixed(0) + "," + gy.toFixed(0) + ")");
  ok(Math.abs(gx%cell)<1.5||Math.abs(gx%cell-cell)<1.5, "dropped piece sits on a lattice line horizontally");
  ok(Math.abs(gy%cell)<1.5||Math.abs(gy%cell-cell)<1.5, "and vertically (square cell in PIXELS)");
  setMode("pass");
  pd(board,gx+9,gy+9);                          // start a line a thumb off the cone
  for(let i=1;i<=20;i++) pm(board,gx+9+i*6,gy+9+i*3);
  pu(board,gx+9+120,gy+9+60);
  const p2=lastPath();
  const dx=Math.abs(p2[0][0]-gx), dy=Math.abs(p2[0][1]-gy);
  console.log("line begun 12.7px off the cone -> starts (" + dx.toFixed(1) + "," + dy.toFixed(1) + ") from it");
  ok(dx<1 && dy<1, "line endpoint snapped exactly onto the piece");
}

// --- a ball drawn clear of its player must still be what a line snaps to ---
click([...document.querySelectorAll("#drillDock button")].find(b=>b.dataset.pane==="kit"));
const tBall=document.querySelector('.titem[data-kind="dball"]');
if(tBall){
  pd(tBall,10,10); pm(tBall,200,320); pu(tBall,200,320);
  const balls=[...document.querySelectorAll("#board .ditem.d-dball")];
  ok(balls.length>0, "a ball was placed");
  const b=balls[balls.length-1];
  const bx=parseFloat(b.style.left)/100*W, by=parseFloat(b.style.top)/100*H;
  const off=cell*0.62;                       // where it is DRAWN, per the CSS transform
  console.log("ball model (" + bx.toFixed(0) + "," + by.toFixed(0) + ")  drawn at ("
              + (bx+off).toFixed(0) + "," + (by+off).toFixed(0) + ")");
  setMode("pass");
  pd(board,60,60);                            // draw a pass INTO the visible ball
  for(let i=1;i<=20;i++) pm(board,60+(bx+off-60)*i/20, 60+(by+off-60)*i/20);
  pu(board,bx+off,by+off);
  const p3=lastPath(), e=p3[p3.length-1];
  const dTrue=Math.hypot(e[0]-bx,e[1]-by), dDrawn=Math.hypot(e[0]-(bx+off),e[1]-(by+off));
  console.log("line ended " + dTrue.toFixed(1) + "px from the ball's true centre");
  ok(dTrue<1.5, "aiming at the ball you can SEE binds to the ball's real position");
  ok(dTrue<dDrawn, "and not to the drawn offset");
}

// --- the ball points down the line it is about to travel ---
const dirOf=el=>[el.style.getPropertyValue("--bx"), el.style.getPropertyValue("--by")].map(v=>parseFloat(v)||0);
{
  const balls=[...document.querySelectorAll("#board .ditem.d-dball")];
  const b1=balls[balls.length-1];
  const bx=parseFloat(b1.style.left)/100*W, by=parseFloat(b1.style.top)/100*H;
  setMode("pass");
  pd(board,bx,by); for(let i=1;i<=20;i++) pm(board,bx-i*6,by); pu(board,bx-120,by);
  let [dx,dy]=dirOf(b1);
  console.log("ball A, pass LEFT      -> offset ("+dx.toFixed(0)+"%,"+dy.toFixed(0)+"%)");
  ok(dx<-40 && Math.abs(dy)<30, "ball A sits LEFT of its player, in front of the pass");
  ok(Math.abs(Math.hypot(dx,dy)-85)<6, "offset is 85% of a piece — the circles just clear");

  // a SECOND ball elsewhere, with its own pass going straight down
  click([...document.querySelectorAll("#drillDock button")].find(q=>q.dataset.pane==="kit"));
  const tB=document.querySelector('.titem[data-kind="dball"]');
  pd(tB,10,10); pm(tB,120,120); pu(tB,120,120);
  const bs=[...document.querySelectorAll("#board .ditem.d-dball")];
  ok(bs.length===2, "second ball placed ("+bs.length+")");
  const b2=bs[bs.length-1];
  const cx=parseFloat(b2.style.left)/100*W, cy=parseFloat(b2.style.top)/100*H;
  setMode("pass");
  pd(board,cx,cy); for(let i=1;i<=20;i++) pm(board,cx,cy+i*6); pu(board,cx,cy+120);
  const [ex,ey]=dirOf(b2);
  console.log("ball B, pass DOWNWARD  -> offset ("+ex.toFixed(0)+"%,"+ey.toFixed(0)+"%)");
  ok(ey>40 && Math.abs(ex)<30, "ball B sits BELOW its player, in front of that pass");
  const [ax,ay]=dirOf(b1);
  ok(ax<-40, "and ball A still faces its own line — the two are independent");
}
process.exit(0);
