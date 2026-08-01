/* Guards for the Game Day chrome: touch-target sizing, the merged header, and
   the press-and-hold pause.

   The sizing assertions read the STYLESHEET, not the DOM, because jsdom does no
   layout — but the failure being guarded against is a source-level one. The
   rows were sized with Tailwind `base / sm:` pairs, and `sm:` is 640px, so a
   phone always got the base (small) value while the review happened on a
   desktop where `sm:` applied. Asserting on the markup catches a reintroduction
   of that pattern; asserting on rendered pixels would not, without a browser. */
import fs from "fs";
import { boot } from "./_harness.mjs";

const { window, document, click } = await boot({});
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? "PASS" : "FAIL") + " - " + m); };

const html = fs.readFileSync("./app.html", "utf8");
const css  = fs.readFileSync("./styles.css", "utf8");

/* ---- 1. the sm:-inversion must not come back in the chrome rows ---- */
const chrome = html.slice(html.indexOf('<div id="controls"'), html.indexOf("<main"));
ok(!/\bsm:/.test(chrome),
   "no `sm:` breakpoint classes in the chrome rows (640px never fires on a phone)");
ok(!/text-\[(9|10|11)px\]/.test(chrome),
   "no sub-12px hardcoded type in the chrome rows");
ok(!/\bw-5\b|\bh-5\b/.test(chrome),
   "score buttons are not 20px squares any more");

/* ---- 2. touch targets are on the token scale and above the 36px floor ---- */
const token = n => {
  const m = css.match(new RegExp("--" + n + ":clamp\\((\\d+)px"));
  return m ? +m[1] : null;
};
ok(token("sz-score") >= 36, "--sz-score floor is at least 36px (is " + token("sz-score") + ")");
ok(token("sz-nav")   >= 42, "--sz-nav floor is at least 42px (is "   + token("sz-nav")   + ")");
ok(token("h-timer")  >= 44, "--h-timer floor is at least 44px (is "  + token("h-timer")  + ")");
ok(token("fs-timer") >= 15, "--fs-timer floor is at least 15px (is " + token("fs-timer") + ")");

/* ---- 3. the duplicated header row is gone in the game view ---- */
ok(/body\.gameView header\{display:none\}/.test(css),
   "the team-name row is hidden in the game view (the score bar names both sides)");
ok(/<link rel="stylesheet" href="styles\.css/.test(html) &&
   html.split('href="styles.css').length - 1 === 1,
   "styles.css is linked exactly once");

/* ---- 4. both clocks live in the dedicated row, not squeezed into the score bar ---- */
const timerRow = document.getElementById("timerRow");
ok(!!timerRow, "#timerRow exists");
ok(!!timerRow.querySelector("#timerChip") && !!timerRow.querySelector("#subsChip"),
   "both clocks are in #timerRow");
ok(document.getElementById("scoreBar").contains(document.getElementById("gameCfgChip")),
   "the game settings button moved into the score bar and is still reachable");

/* ---- 5. press-and-hold: a brush of the thumb must not stop the match clock ---- */
const chip = document.getElementById("timerChip");
const down = () => chip.dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
const up   = () => chip.dispatchEvent(new window.Event("pointerup",   { bubbles: true }));
const tap  = () => { down(); up(); click(chip); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const running = () => chip.classList.contains("live");

ok(!running(), "the match clock starts stopped");
tap();
ok(running(), "a single tap STARTS the clock");

tap();
ok(running(), "a single tap does NOT stop a running clock");

/* a hold that is released early must also not stop it */
down(); await wait(200); up(); click(chip);
ok(running(), "a 200ms press is too short to pause");

/* the full hold pauses */
down(); await wait(700); up(); click(chip);
ok(!running(), "a 600ms press-and-hold pauses the clock");
ok(!chip.classList.contains("holding"), "the .holding press state is cleared afterwards");

console.log(fails ? "\n" + fails + " FAILED" : "\nall chrome guards passed");
process.exit(fails ? 1 : 0);
