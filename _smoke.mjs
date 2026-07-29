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
window.Element.prototype.getBoundingClientRect=()=>({left:0,top:0,right:340,bottom:525,width:340,height:525});
const store={data:{teamName:"Pumas",roster:[{id:1,name:"Sam",pos:"ST"}],nextId:2,colors:{team:"#2563eb",opp:"#ff453a"},
 board:{squad:"11",formation:"4-3-3",showOpp:false,placed:{1:{x:.5,y:.4}}},drills:[],games:[]},
 listeners:new Set(),subscribe(f){this.listeners.add(f)},emit(){},save(){},flush(){}};
const mod=await import(R+"js/board.js?"+Date.now());
mod.initBoard(store);
const $=s=>document.querySelector(s);
const click=el=>el&&el.dispatchEvent(new window.Event("click",{bubbles:true}));

// 1. containment: nothing structural trapped inside #drillTray any more
const tray=$("#drillTray");
console.log("footer inside drillTray? ", tray.contains($("footer")));
console.log("palette inside drillTray?", tray.contains($("#drillColors")));
console.log("sheets inside drillTray? ", tray.contains($("#ctlMenuPanel")));
console.log("tray children (should be 1 - trayItems):", tray.children.length);

// 2. dropdowns
const seg=v=>[...document.querySelectorAll("#viewSeg button")].find(b=>b.dataset.view===v);
click(seg("team"));
console.log("Team options sheet opens:", $("#ctlMenuPanel").classList.contains("open"));
click($("#closeCtlMenu"));
click(seg("game"));
console.log("Game day dropdown opens: ", $("#gamesPanel").classList.contains("open"));
click($("#closeGames"));
click(seg("drills")); click(seg("drills"));
console.log("Drills options sheet opens:", $("#ctlMenuPanel").classList.contains("open"));
click($("#closeCtlMenu"));

// 3. palette
click($("#colorBtn"));
console.log("Palette opens:", $("#drillColors").classList.contains("open"),
            "| rows:", document.querySelectorAll("#drillColors .palRow").length);

const bar=()=>$("#boardView footer"), kt=$("#drillTray"), pb=$("#drillPlayerBar"), dock=$("#drillDock");
const dbtn=n=>$('#drillDock button[data-pane="'+n+'"]');
console.log("--- per-view ---");
click(seg("team"));  console.log("TEAM   dock drillOnly:", dock.classList.contains("drillOnly"), "| lines:", bar().classList.contains("open"));
click(seg("drills"));
console.log("DRILLS start clean -> kit:", kt.classList.contains("open"), "lines:", bar().classList.contains("open"), "play hidden:", pb.classList.contains("hidden"));
console.log("--- dock panes (one tap each) ---");
click(dbtn("kit"));
console.log("Kit   -> kit:", kt.classList.contains("open"), "| seg active:", dbtn("kit").classList.contains("on"));
click(dbtn("lines"));
console.log("Lines -> kit:", kt.classList.contains("open"), "lines:", bar().classList.contains("open"));
click(dbtn("play"));
console.log("Play  -> lines:", bar().classList.contains("open"), "play visible:", !pb.classList.contains("hidden"));
click(dbtn("play"));
console.log("tap active closes:", pb.classList.contains("hidden"));
console.log("--- new drill entry ---");
click(seg("drills"));
console.log("Drills tab opens list:", $("#drillPanel").classList.contains("open"), "| has New drill:", !!$("#newDrillBtn"));
click($("#newDrillBtn"));
console.log("New drill -> panel closed:", !$("#drillPanel").classList.contains("open"), "| kit pane opened:", kt.classList.contains("open"));
console.log("--- leaving drills ---");
click(seg("team"));
console.log("TEAM -> kit:", kt.classList.contains("open"), "lines:", bar().classList.contains("open"), "drawing:", document.body.classList.contains("drawing"));

click(seg("drills"));
console.log("--- labels ---");
console.log("dock Kit segment reads:", $('#drillDock button[data-pane="kit"] span').textContent);
click($('#drillDock button[data-pane="lines"]'));
const labels=[...document.querySelectorAll("#boardView footer .mode .toolLbl, #boardView footer .act .toolLbl")].map(s=>s.textContent);
console.log("line tool labels:", labels.join(" / "));
console.log("count:", labels.length, "(expect 8: 6 modes + undo + clear)");
console.log("DONE"); process.exit(0);
