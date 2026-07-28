import { JSDOM } from "jsdom";
import fs from "fs";
const R="/sessions/exciting-relaxed-meitner/mnt/soccerboard/";
const dom=new JSDOM(fs.readFileSync(R+"app.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true});
const {window}=dom;
global.window=window; global.document=window.document;
Object.defineProperty(global,"navigator",{value:window.navigator,writable:true,configurable:true});
global.Event=window.Event; global.requestAnimationFrame=fn=>setTimeout(()=>fn(Date.now()),0);
window.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>({width:10}),set:()=>true});
window.HTMLElement.prototype.setPointerCapture=()=>{}; window.HTMLElement.prototype.releasePointerCapture=()=>{};
window.Element.prototype.getBoundingClientRect=()=>({left:0,top:0,right:340,bottom:525,width:340,height:525});
// capture what gets scheduled, and when
const sched=[];
global.anime=window.anime=Object.assign(()=>({}),{ timeline:(cfg)=>{ const tl={ add(a,off){ sched.push({el:a.targets,dur:a.duration,at:off}); return tl; }, play(){}, pause(){}, restart(){}, seek(){}, finished:Promise.resolve() }; tl._cfg=cfg; return tl; }, remove(){}, set(){} });
eval(fs.readFileSync(R+"js/drills.js","utf8"));
const store={data:{teamName:"P",roster:[],nextId:1,colors:{team:"#2563eb",opp:"#ff453a"},
 board:{squad:"11",formation:"4-3-3",showOpp:false,placed:{}},drills:[],games:[]},
 listeners:new Set(),subscribe(f){this.listeners.add(f)},emit(){},save(){},flush(){}};
const mod=await import(R+"js/board.js?"+Date.now());
mod.initBoard(store);
const $=s=>document.querySelector(s);
const click=el=>el&&el.dispatchEvent(new window.Event("click",{bubbles:true}));
const seg=v=>[...document.querySelectorAll("#viewSeg button")].find(b=>b.dataset.view===v);
click(seg("drills"));

// ---- Michael's complex2 shape, laid out to test the SEQUENCING only ----
const P1=[0.25,0.85], P2=[0.25,0.20], MID=[0.25,0.52];   // pass stops half way
const P1B=[0.62,0.80];                                    // P1's "different spot"
const GATE_L=[0.40,0.50], GATE_R=[0.60,0.50];             // the two middle cones
const QUEUE=[0.25,0.20];                                  // back of P2's queue
const LEFT_MID=[0.10,0.50];
const drill={ id:"seqtest", name:"seqtest", items:[
  {kind:"att",x:P1[0],y:P1[1],num:1},{kind:"att",x:P2[0],y:P2[1],num:2},
  {kind:"dball",x:P1[0],y:P1[1]},
  {kind:"cone",x:GATE_L[0],y:GATE_L[1]},{kind:"cone",x:GATE_R[0],y:GATE_R[1]},
  {kind:"cone",x:LEFT_MID[0],y:LEFT_MID[1]},
 ], strokes:[
  {mode:"pass",pts:[P1,MID]},        // 0  P1 passes half way
  {mode:"run", pts:[P2,MID]},        // 1  P2 runs onto it
  {mode:"run", pts:[P1,P1B]},        // 2  P1 moves to a different spot
  {mode:"pass",pts:[MID,P1B]},       // 3  P2 passes to where P1 now is
  {mode:"run", pts:[MID,GATE_L]},    // 4  P2 runs to the left of the gate
  {mode:"pass",pts:[P1B,GATE_L]},    // 5  P1 passes through the cones
  {mode:"run", pts:[P1B,QUEUE]},     // 6  P1 to the back of the queue
 ]};
// load it through the preset path (known-good in the other tests)
window.PRESET_DRILLS=[{...drill, difficulty:"complex", info:{trains:"",setup:"",steps:[],coaching:[]}}];
click(seg("drills")); click(seg("drills"));
const tab=[...document.querySelectorAll(".drillTab")].find(b=>/complex/i.test(b.dataset.diff||""));
if(tab) click(tab);
const pi=document.querySelector("#presetList .presetItem"); if(pi) click(pi);
const useBtn=document.querySelector("#drillInfoPanel .primary"); if(useBtn) click(useBtn);
console.log("pieces on pitch:", document.querySelectorAll(".ditem").length);
sched.length=0;
click($("#playDrillBtn"));
console.log("legs scheduled:", sched.length);
const t=sched.map(s=>({at:s.at,dur:s.dur,end:s.at+s.dur}));
t.forEach((x,i)=>console.log(`  leg ${i}: start ${Math.round(x.at)}  dur ${Math.round(x.dur)}  end ${Math.round(x.end)}`));
const ok=(c,m)=>console.log((c?"PASS":"FAIL")+" - "+m);
if(t.length>=4){
  // stroke 0 (pass) schedules ball; stroke 1 (run) schedules P2 -> must ARRIVE together
  const pass0=t[0], run1=t[1];
  ok(Math.abs(pass0.end-run1.end)<60, `P2 arrives with the ball (pass ends ${Math.round(pass0.end)}, run ends ${Math.round(run1.end)})`);
  ok(run1.at>=0, "the receiving run never starts before zero");
}
console.log("\\n(raw schedule above: each 'end' should gate the next dependent leg)");
process.exit(0);
