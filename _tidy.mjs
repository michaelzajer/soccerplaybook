/* Retro-fitting drills saved under the older, looser rules.
   Uses Michael's real complex3 export: the defect that broke its left lane was
   the third pass being drawn 0.11 of the pitch from where the ball came to rest,
   so the engine bound the pass to a player instead of the ball. After tidying,
   every line end that belongs to a piece must sit exactly on it. */
import { boot } from "./_harness.mjs";
const { window, document, $, click } = await boot({});
const ok=(c,m)=>console.log((c?"PASS":"FAIL")+" - "+m);

// real complex3 geometry (endpoints of each stroke, as exported from the app)
const S=[["pass",[.797,.407],[.648,.265]],["pass",[.184,.444],[.301,.614]],
["run",[.528,.155],[.645,.261]],["run",[.469,.770],[.322,.633]],
["run",[.819,.399],[.776,.254]],["run",[.170,.454],[.211,.635]],
["pass",[.300,.621],[.227,.637]],["pass",[.663,.265],[.764,.257]],
["run",[.647,.266],[.387,.316]],["run",[.324,.632],[.626,.562]],
["pass",[.763,.268],[.399,.322]],["pass",[.316,.619],[.619,.559]],
["passrun",[.626,.558],[.802,.431]],["passrun",[.374,.325],[.197,.436]],
["run",[.211,.646],[.488,.799]],["run",[.775,.254],[.525,.127]]];
// a wobbly ~150-point path between the two ends, as a finger would draw it
const wob=(a,b)=>{const o=[];for(let i=0;i<=150;i++){const t=i/150;
  o.push([a[0]+(b[0]-a[0])*t+Math.sin(i*.7)*0.004, a[1]+(b[1]-a[1])*t+Math.cos(i*.9)*0.004]);}return o;};
const flat=p=>p.flat();
const complex3={ id:"c3", name:"complex3",
  items:[{kind:"disc",x:.498,y:.167},{kind:"disc",x:.496,y:.299},{kind:"disc",x:.498,y:.361},
    {kind:"disc",x:.494,y:.536},{kind:"disc",x:.491,y:.597},{kind:"disc",x:.238,y:.439},
    {kind:"disc",x:.498,y:.744},{kind:"disc",x:.743,y:.436},
    {kind:"att",x:.511,y:.114,num:"4"},{kind:"att",x:.517,y:.144,num:"3"},
    {kind:"att",x:.800,y:.440,num:"3"},{kind:"att",x:.821,y:.413,num:"1"},
    {kind:"att",x:.485,y:.781,num:"7"},{kind:"att",x:.478,y:.816,num:"8"},
    {kind:"att",x:.175,y:.437,num:"6"},{kind:"att",x:.114,y:.439,num:"5"},
    {kind:"dball",x:.760,y:.384},{kind:"dball",x:.258,y:.485}],
  strokes:S.map(([m,a,b])=>({mode:m,pts:flat(wob(a,b))})) };

const W=360,H=556, cell=Math.min(40,Math.max(22,0.075*W));
const un=st=>{const o=[];for(let i=0;i+1<st.pts.length;i+=2)o.push([st.pts[i],st.pts[i+1]]);return o;};
const px=(a,b)=>Math.hypot((a[0]-b[0])*W,(a[1]-b[1])*H);
const nearestPiece=(items,p)=>items.reduce((best,it)=>{
  const d=px([it.x,it.y],p); return (!best||d<best.d)?{it,d}:best;},null);

const before=complex3, after=window.__tidyDrillData(complex3);
const bPts=before.strokes.reduce((n,s)=>n+un(s).length,0);
const aPts=after.strokes.reduce((n,s)=>n+un(s).length,0);
console.log("points: "+bPts+" -> "+aPts+"   (Firestore rejects nested arrays and has a 1MB doc cap)");
ok(aPts < bPts/6, "line data collapsed dramatically ("+bPts+" -> "+aPts+")");
ok(after.strokes.every(s=>un(s).length===17), "every line resampled to 17 points");

console.log("\n--- cones onto the lattice ---");
const offGrid=after.items.filter(i=>{
  const mx=(i.x*W)%cell, my=(i.y*H)%cell;
  return Math.min(mx,cell-mx)>1.5 || Math.min(my,cell-my)>1.5;});
ok(offGrid.length===0, "all "+after.items.length+" pieces sit on the lattice ("+offGrid.length+" stragglers)");

console.log("\n--- line ends onto pieces ---");
let fixed=0, worstBefore=0, worstAfter=0;
after.strokes.forEach((st,i)=>{
  const b=un(before.strokes[i]), a=un(st);
  [[b[0],a[0],"start"],[b[b.length-1],a[a.length-1],"end"]].forEach(([bp,ap])=>{
    const nb=nearestPiece(before.items,bp), na=nearestPiece(after.items,ap);
    if(nb.d < cell*0.9){                       // this end belonged to a piece
      worstBefore=Math.max(worstBefore,nb.d);
      worstAfter=Math.max(worstAfter,na.d);
      if(nb.d>1 && na.d<1) fixed++;
    }
  });
});
console.log("worst gap between a line end and its piece: "+worstBefore.toFixed(1)+"px -> "+worstAfter.toFixed(1)+"px");
ok(worstAfter<1, "every line end that belongs to a piece now sits exactly on it");
ok(fixed>0, fixed+" line ends were snapped onto their piece");

console.log("\n--- what tidying can and cannot fix ---");
/* The defect that broke complex3's left lane was the third pass being struck
   0.11 from where the ball came to REST DURING PLAYBACK. That is a runtime
   position, not a stored one, so no amount of static tidying reaches it —
   LOOSE_TOL in the engine is what handles that. What tidying does fix is the
   stored geometry: ends on pieces, pieces on the lattice, lines clean. */
const ends = after.strokes.map(st=>{const a=un(st);return [a[0],a[a.length-1]];});
const onPiece = ends.flat().filter(p=>nearestPiece(after.items,p).d<1).length;
console.log("line ends now sitting exactly on a piece: "+onPiece+" of "+ends.flat().length);
ok(onPiece>=9, "the ends that belong to pieces are locked to them");
const bows = after.strokes.map(st=>{const a=un(st),A=a[0],B=a[a.length-1];
  const L=Math.hypot((B[0]-A[0])*W,(B[1]-A[1])*H)||1;
  const nx=-((B[1]-A[1])*H)/L, ny=((B[0]-A[0])*W)/L;
  let d=0; a.forEach(q=>{const v=((q[0]-A[0])*W)*nx+((q[1]-A[1])*H)*ny; if(Math.abs(v)>Math.abs(d))d=v;});
  return Math.abs(d);});
console.log("worst remaining bow across 16 lines: "+Math.max(...bows).toFixed(1)+"px");
ok(Math.max(...bows) < 14, "the finger wobble is gone — lines read as straight passes");
process.exit(0);
