import { JSDOM } from "jsdom";
import fs from "fs";
const R="./";
const dom=new JSDOM(fs.readFileSync(R+"app.html","utf8"),{runScripts:"outside-only",pretendToBeVisual:true});
const {window}=dom;
global.window=window; global.document=window.document;
Object.defineProperty(global,"navigator",{value:window.navigator,writable:true,configurable:true});
global.Event=window.Event; global.requestAnimationFrame=fn=>setTimeout(()=>fn(Date.now()),0);
window.HTMLCanvasElement.prototype.getContext=()=>({setTransform(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fill(){},arc(){},fillRect(){},strokeRect(){},setLineDash(){},save(){},restore(){},translate(){},fillText(){},closePath(){},measureText:()=>({width:10}),set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set font(v){},set textAlign(v){},set textBaseline(v){},set lineCap(v){},set lineJoin(v){},set shadowColor(v){},set shadowBlur(v){}});
window.HTMLElement.prototype.setPointerCapture=()=>{};
window.HTMLElement.prototype.releasePointerCapture=()=>{};
// board occupies a 340x525 area starting 120px down the viewport
const BOARD={left:0,top:120,right:340,bottom:645,width:340,height:525};
window.Element.prototype.getBoundingClientRect=function(){ return this.id==="board"?BOARD:{left:0,top:0,right:340,bottom:525,width:340,height:525}; };
Object.defineProperty(window,"innerWidth",{value:340,configurable:true});
Object.defineProperty(window,"innerHeight",{value:740,configurable:true});
const store={data:{teamName:"Pumas",roster:[{id:1,name:"Sam",pos:"ST"}],nextId:2,colors:{team:"#2563eb",opp:"#ff453a"},
 board:{squad:"11",formation:"4-3-3",showOpp:false,placed:{1:{x:.5,y:.4}}},drills:[],games:[]},
 listeners:new Set(),subscribe(f){this.listeners.add(f)},emit(){},save(){},flush(){}};
eval(fs.readFileSync(R+"js/drills.js","utf8"));
const mod=await import(R+"js/board.js?"+Date.now());
mod.initBoard(store);
const $=s=>document.querySelector(s);
const click=(el,x,y)=>el&&el.dispatchEvent(new window.MouseEvent("click",{bubbles:true,clientX:x||0,clientY:y||0}));
const seg=v=>[...document.querySelectorAll("#viewSeg button")].find(b=>b.dataset.view===v);
const dbtn=n=>$('#drillDock button[data-pane="'+n+'"]');
const ok=(c,m)=>console.log((c?"PASS":"FAIL")+" - "+m);

console.log("=== BUG 1: colours reachable while placing markers ===");
ok($("#drillDock").contains($("#colorBtn")), "colour button lives on the dock, not inside a pane");
ok(!$("#boardView > footer").contains($("#colorBtn")), "colour button no longer trapped in the Lines pane");
click(seg("drills"));
click(dbtn("kit"));                                    // in Drill Setup, placing kit
ok($("#drillTray").classList.contains("open"), "Drill Setup pane is open");
click($("#colorBtn"));
ok($("#drillColors").classList.contains("open"), "palette opens WHILE Drill Setup is open (the reported bug)");
ok(document.body.classList.contains("paneOpen"), "body.paneOpen set so palette clears the pane");
ok($("#drillTray").classList.contains("open"), "opening colours did not close the Drill Setup pane");
ok(document.querySelectorAll("#drillColors .palRow").length===3, "all three palette rows present (Players/Opp/Item)");
click($("#colorBtn"));
ok(!$("#drillColors").classList.contains("open"), "colour button toggles the palette shut again");

console.log("\n=== BUG 2: number selector stays on screen ===");
const pop=$("#numSelectorPopup");
Object.defineProperty(pop,"offsetWidth",{value:240,configurable:true});
Object.defineProperty(pop,"offsetHeight",{value:130,configurable:true});
function tapPieceAt(top,left){
  // simulate a drill player whose element sits at the given viewport position
  const el=players[0];
  el.getBoundingClientRect=()=>({left:left,top:top,right:left+30,bottom:top+30,width:30,height:30});
  click(el);
  return {top:parseFloat(pop.style.top),left:parseFloat(pop.style.left),below:pop.classList.contains("below"),hidden:pop.hidden};
}
// load a preset so real drill pieces (with their real click handlers) exist
click(seg("drills")); click(seg("drills"));   // second tap opens the drills sheet
const tab=[...document.querySelectorAll(".drillTab")].find(b=>b.dataset.diff==="Complex");
if(tab) click(tab);
const pi=document.querySelector("#presetList .presetItem"); if(pi) click(pi);
const useBtn=document.querySelector("#drillInfoPanel .primary"); if(useBtn) click(useBtn);
const players=[...document.querySelectorAll(".ditem")].filter(e=>e.querySelector(".att,.def"));
ok(players.length>0, "drill players on the pitch ("+players.length+")");

const cssTxt=fs.readFileSync(R+"styles.css","utf8");
const glass=cssTxt.split(".glass-popup {")[1].split("}")[0];
ok(/position:\s*fixed/.test(glass), "popup is position:fixed (matches the viewport coords it is given)");
const z=+(glass.match(/z-index:\s*(\d+)/)||[])[1];
ok(z>140, "popup z-index "+z+" clears the dock (120) and panes (130/140)");
ok(/\.glass-popup\.below\{/.test(cssTxt.replace(/\s/g,"")), ".below flip rule exists");

const top=tapPieceAt(130,160);   // player near the TOP of the pitch -> must flip below
ok(!top.hidden, "popup shown for a top-of-pitch player");
ok(top.below===true, "flips BELOW the player when there is no room above");
ok(top.top>=0, "popup top ("+top.top+") is on screen, not negative");
const mid=tapPieceAt(400,160);   // mid pitch -> normal, above
ok(mid.below===false, "sits above the player when there is room");
const edgeL=tapPieceAt(400,2);   // hard against the left edge
ok(edgeL.left>=128, "clamped off the left edge (left="+edgeL.left+", half-width 128)");
const edgeR=tapPieceAt(400,330); // hard against the right edge
ok(edgeR.left<=212, "clamped off the right edge (left="+edgeR.left+")");

console.log("\n=== BUG 2b: not frozen - dismisses and retargets ===");
const el2=players[0];
el2.getBoundingClientRect=()=>({left:160,top:400,right:190,bottom:430,width:30,height:30});
click(el2);
ok(!pop.hidden, "popup open on a piece");
click($("#board"));
ok(pop.hidden, "tapping the pitch closes it (no stuck popup)");
click(el2);
ok(!pop.hidden, "reopens on the piece afterwards - not frozen");
process.exit(0);
