/* A PASS MUST BEAT ITS PASSER. On a pass+run the ball is struck and the player
   follows, so the ball has to reach the receiver first — they used to travel
   over the same duration and arrive together, which read as the passer
   escorting his own pass. Dribbling is the exception: the ball is at his feet
   and moves at his pace. */
import { boot } from "./_harness.mjs";
const A=[0.30,0.80], B=[0.30,0.25], C=[0.70,0.25];
const seg=(a,b)=>{const o=[];for(let i=0;i<=8;i++)o.push([a[0]+(b[0]-a[0])*i/8,a[1]+(b[1]-a[1])*i/8]);return o;};
const drill={id:"sp",name:"speed",difficulty:"complex",
 info:{trains:"",setup:"",steps:[],coaching:[]},
 items:[{kind:"cone",x:A[0],y:A[1],startCone:true},{kind:"cone",x:B[0],y:B[1]},{kind:"cone",x:C[0],y:C[1]},
   {kind:"att",x:A[0],y:A[1],num:"1"},{kind:"att",x:B[0],y:B[1],num:"2"},{kind:"att",x:C[0],y:C[1],num:"3"},
   {kind:"dball",x:A[0],y:A[1]}],
 strokes:[{mode:"passrun",pts:seg(A,B)},          // 1 passes to 2 and follows
          {mode:"dribble",pts:seg(B,C)}]};        // 2 dribbles across
const { $, click, state, W, H } = await boot({ drill });
click($("#playDrillBtn"));
const ok=(c,m)=>console.log((c?"PASS":"FAIL")+" - "+m);
const legs=state.legs.map(l=>({
  who:(l.el&&l.el.querySelector&&l.el.querySelector(".dball"))?"BALL":
      "P"+((l.el&&l.el.textContent.trim())||"?"),
  at:Math.round(l.at), end:Math.round(l.at+l.dur), dur:Math.round(l.dur)}));
legs.forEach(l=>console.log(`   ${l.who.padEnd(5)} start ${String(l.at).padStart(5)}  dur ${String(l.dur).padStart(5)}  arrives ${String(l.end).padStart(5)}`));
const ball=legs.filter(l=>l.who==="BALL");
const p1=legs.find(l=>l.who==="P1"), p2=legs.find(l=>l.who==="P2");
ok(ball.length>0 && p1, "a pass+run produced both a ball leg and a runner leg");
if(ball.length&&p1){
  console.log(`\n   pass arrives ${ball[0].end}ms, passer arrives ${p1.end}ms  ->  ball is ${p1.end-ball[0].end}ms ahead`);
  ok(ball[0].end < p1.end - 200, "THE BALL REACHES THE RECEIVER BEFORE THE PASSER DOES");
  ok(ball[0].at === p1.at || Math.abs(ball[0].at-p1.at)<150, "both set off together — it is the speed that differs");
}
if(ball.length>1&&p2){
  console.log(`   dribble: ball ${ball[1].dur}ms vs player ${p2.dur}ms`);
  ok(Math.abs(ball[1].dur-p2.dur)<40, "a DRIBBLED ball stays at the player's pace (not launched ahead)");
}

console.log("\n--- pace ---");
const legDur = legs.filter(l=>l.who!=="BALL")[0].dur;
console.log("   a 14 m-ish run now takes "+legDur+"ms (was 800ms on the old minimum clamp)");
ok(legDur > 1200, "playback is no longer a blur");

// the transport speed control must actually change it, and stick
const sp = $("#dpSpeedBtn");
ok(!!sp, "the transport bar has a speed control, showing "+(sp?sp.textContent:"-"));
const before = sp.textContent;
click(sp);
console.log("   tapped speed: "+before+" -> "+sp.textContent);
ok(sp.textContent!==before, "tapping it changes the pace");
state.legs.length=0;
click($("#playDrillBtn")); click($("#playDrillBtn"));
const after = state.legs.filter(l=>l.el&&!l.el.querySelector(".dball"))[0];
if(after) console.log("   same leg at the new setting: "+Math.round(after.dur)+"ms");
ok(!after || Math.abs(after.dur-legDur)>100, "the new pace is applied to playback");
process.exit(0);
