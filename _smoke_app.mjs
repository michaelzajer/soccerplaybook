import { JSDOM } from "jsdom";
import fs from "fs";
const html = fs.readFileSync("app.html","utf8");
const dom = new JSDOM(html, { runScripts:"outside-only", pretendToBeVisual:true });
const { window } = dom;
global.window = window; global.document = window.document;
Object.defineProperty(global, "navigator", { value: window.navigator, writable: true, configurable: true }); global.Event = window.Event;
global.requestAnimationFrame = fn => setTimeout(()=>fn(Date.now()),0);
// stub canvas + pointer APIs board.js touches
window.HTMLCanvasElement.prototype.getContext = () => ({
  setTransform(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},
  fill(){},arc(){},fillRect(){},strokeRect(){},setLineDash(){},save(){},restore(){},
  translate(){},fillText(){},measureText:()=>({width:10}),
  set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set font(v){},
  set textAlign(v){},set textBaseline(v){},set lineCap(v){},set lineJoin(v){},
  set shadowColor(v){},set shadowBlur(v){}
});
window.HTMLElement.prototype.setPointerCapture = ()=>{};
window.HTMLElement.prototype.releasePointerCapture = ()=>{};
window.Element.prototype.getBoundingClientRect = () => ({left:0,top:0,right:340,bottom:525,width:340,height:525});
// minimal store
const store = { data:{ teamName:"Pumas", roster:[{id:1,name:"Sam",pos:"ST"}], nextId:2,
  board:{squad:"11",formation:"4-3-3",showOpp:false,placed:{1:{x:.5,y:.4}}}, drills:[] },
  listeners:new Set(), subscribe(f){this.listeners.add(f);}, emit(){this.listeners.forEach(f=>f(this.data));},
  save(){}, flush(){} };
const mod = await import("./js/board.js?" + Date.now());
mod.initBoard(store);
// exercise the palette + a drill piece placement path
const swatches = document.querySelectorAll("#drillColors .swatch");
console.log("swatches:", swatches.length);
swatches[1].dispatchEvent(new window.Event("click",{bubbles:true})); // red
console.log("drillColors present:", !!document.getElementById("drillColors"));
console.log("reformBtn present:", !!document.getElementById("reformBtn"));
console.log("SMOKE_OK");
process.exit(0);
