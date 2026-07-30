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
let copied=null;
Object.defineProperty(window.navigator,"clipboard",{value:{writeText:async t=>{copied=t;}},configurable:true});
eval(fs.readFileSync(R+"js/drills.js","utf8"));
const drill={id:"c2",name:"complex2",items:[{kind:"att",x:.25,y:.85,num:1},{kind:"cone",x:.4,y:.5,startCone:true}],
  strokes:[{mode:"pass",pts:[0.25,0.85,0.25,0.52]}]};   // flattened, as Firestore stores it
const store={data:{teamName:"P",roster:[],nextId:1,colors:{team:"#2563eb",opp:"#ff453a"},
 board:{squad:"11",formation:"4-3-3",showOpp:false,placed:{}},drills:[drill],games:[]},
 listeners:new Set(),subscribe(f){this.listeners.add(f)},emit(){},save(){},flush(){}};
const mod=await import(R+"js/board.js?"+Date.now());
mod.initBoard(store);
const $=s=>document.querySelector(s);
const click=el=>el&&el.dispatchEvent(new window.Event("click",{bubbles:true}));
const ok=(c,m)=>console.log((c?"PASS":"FAIL")+" - "+m);
const seg=v=>[...document.querySelectorAll("#viewSeg button")].find(b=>b.dataset.view===v);

ok(!!$("#deCopyBtn"), "Copy drill data button exists in the markup");
click(seg("drills")); click(seg("drills"));            // open the drills library
click($("#drillLibBtn"));
const rows=[...document.querySelectorAll("#drillList .rrow")];
ok(rows.length===1, "saved drill row rendered ("+rows.length+")");
const inf=rows[0] && rows[0].querySelector(".inf");
ok(!!inf, "row has the info button (the only way in to the edit sheet)");
console.log("   row buttons:", rows[0]?[...rows[0].querySelectorAll("button")].map(b=>b.className+":"+b.textContent).join("  "):"-");
click(inf);
ok($("#drillEditPanel").classList.contains("open"), "info button opens the edit sheet");
const btns=[...document.querySelectorAll("#drillEditPanel .sheet button")].map(b=>b.textContent.trim());
console.log("   edit sheet buttons:", JSON.stringify(btns));
ok(btns.includes("Copy drill data"), "Copy drill data is present on the open edit sheet");
click($("#deCopyBtn"));
await new Promise(r=>setTimeout(r,30));
ok(!!copied, "clicking it copies");
if(copied){ const j=JSON.parse(copied);
  ok(j.name==="complex2", "copied JSON names the drill");
  ok(Array.isArray(j.strokes[0].pts[0]), "stroke points unflattened to [x,y] pairs");
  console.log("   sample:", JSON.stringify(j).slice(0,150)+"...");
}
process.exit(0);
