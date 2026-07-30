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
window.Element.prototype.getBoundingClientRect=()=>({left:0,top:0,right:340,bottom:525,width:340,height:525});
const sched=[];
global.gsap=window.gsap=Object.assign(()=>({}),{timeline:()=>{const tl={to(t,v,off){sched.push({el:t,kf:v.keyframes,dur:(v.duration||0)*1000,at:(off||0)*1000});return tl;},play(){},pause(){},restart(){},seek(){},finished:Promise.resolve()};return tl;},set(){}});
eval(fs.readFileSync(R+"js/drills.js","utf8"));

// Michael's complex3: true endpoints from the exported drill.
const S=[["pass",[.797,.407],[.648,.265]],["pass",[.184,.444],[.301,.614]],
["run",[.528,.155],[.645,.261]],["run",[.469,.770],[.322,.633]],
["run",[.819,.399],[.776,.254]],["run",[.170,.454],[.211,.635]],
["pass",[.300,.621],[.227,.637]],["pass",[.663,.265],[.764,.257]],
["run",[.647,.266],[.387,.316]],["run",[.324,.632],[.626,.562]],
["pass",[.763,.268],[.399,.322]],["pass",[.316,.619],[.619,.559]],
["passrun",[.626,.558],[.802,.431]],["passrun",[.374,.325],[.197,.436]],
["run",[.211,.646],[.488,.799]],["run",[.775,.254],[.525,.127]]];
const seg=(a,b)=>{const o=[];for(let i=0;i<=12;i++)o.push([a[0]+(b[0]-a[0])*i/12, a[1]+(b[1]-a[1])*i/12]);return o;};
const drill={id:"c3",name:"complex3",difficulty:"complex",info:{trains:"",setup:"",steps:[],coaching:[]},
 items:[{kind:"disc",x:.498,y:.167},{kind:"disc",x:.496,y:.299},{kind:"disc",x:.498,y:.361},
  {kind:"disc",x:.494,y:.536},{kind:"disc",x:.491,y:.597},{kind:"disc",x:.238,y:.439},
  {kind:"disc",x:.498,y:.744},{kind:"disc",x:.743,y:.436},
  {kind:"att",x:.511,y:.114,num:"4"},{kind:"att",x:.517,y:.144,num:"3"},
  {kind:"att",x:.800,y:.440,num:"3"},{kind:"att",x:.821,y:.413,num:"1"},
  {kind:"att",x:.485,y:.781,num:"7"},{kind:"att",x:.478,y:.816,num:"8"},
  {kind:"att",x:.175,y:.437,num:"6"},{kind:"att",x:.114,y:.439,num:"5"},
  {kind:"dball",x:.760,y:.384},{kind:"dball",x:.258,y:.485}],
 strokes:S.map(([m,a,b])=>({mode:m,pts:seg(a,b)}))};
window.PRESET_DRILLS=[drill];
const $=s=>document.querySelector(s);
const click=el=>el&&el.dispatchEvent(new window.Event("click",{bubbles:true}));
const store={data:{teamName:"P",roster:[],nextId:1,colors:{team:"#2563eb",opp:"#ff453a"},
 board:{squad:"11",formation:"4-3-3",showOpp:false,placed:{}},drills:[],games:[]},
 listeners:new Set(),subscribe(f){this.listeners.add(f)},emit(){},save(){},flush(){}};
const mod=await import(R+"js/board.js?"+Date.now());
mod.initBoard(store);
const vseg=v=>[...document.querySelectorAll("#viewSeg button")].find(b=>b.dataset.view===v);
click(vseg("drills")); click(vseg("drills")); click(vseg("drills"));
const tab=[...document.querySelectorAll(".drillTab")].find(b=>/complex/i.test(b.dataset.diff||""));
if(tab) click(tab);
const pi=document.querySelector("#presetList .presetItem"); if(pi) click(pi);
const useBtn=document.querySelector("#drillInfoPanel .primary"); if(useBtn) click(useBtn);
console.log("pieces:", document.querySelectorAll(".ditem").length);
sched.length=0;
click($("#playDrillBtn"));
const name=el=>{ if(!el) return "?"; const s=el.querySelector(".att,.def,.dball,.cone,.disc");
  const cls=s?s.className:""; const n=el.textContent.trim();
  if(/dball/.test(cls)) return "BALL"; if(/att|def/.test(cls)) return "P"+(n||"?"); return cls||"piece"; };
const px=v=>parseFloat(v);
const rows=sched.map((s,i)=>{const k=s.kf||[]; const a=k[0]||{},b=k[k.length-1]||{};
  return {i,who:name(s.el),from:[px(a.left)/340,px(a.top)/525],to:[px(b.left)/340,px(b.top)/525],at:s.at,end:s.at+s.dur};});
rows.sort((x,y)=>x.at-y.at);
console.log("\n  start   end   who    from        to");
for(const r of rows) console.log(`  ${String(Math.round(r.at)).padStart(5)} ${String(Math.round(r.end)).padStart(5)}   ${r.who.padEnd(5)}  (${r.from[0].toFixed(2)},${r.from[1].toFixed(2)}) -> (${r.to[0].toFixed(2)},${r.to[1].toFixed(2)})`);
process.exit(0);
