/* Shared jsdom harness for the drill-engine regressions.
   Kept IN THE REPO deliberately: these lived in /tmp and were lost when the
   scratch dir was cleared, taking the rotation guards with them. */
import { JSDOM } from "jsdom";
import fs from "fs";
export const R = new URL(".", import.meta.url).pathname;

export async function boot({ W = 360, H = 556, drill } = {}) {
  const dom = new JSDOM(fs.readFileSync(R + "app.html", "utf8"),
    { runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  global.window = window; global.document = window.document;
  Object.defineProperty(global, "navigator",
    { value: window.navigator, writable: true, configurable: true });
  global.Event = window.Event;
  global.requestAnimationFrame = fn => setTimeout(() => fn(Date.now()), 0);
  window.HTMLCanvasElement.prototype.getContext =
    () => new Proxy({}, { get: () => () => ({ width: 10 }), set: () => true });
  window.HTMLElement.prototype.setPointerCapture = () => {};
  window.HTMLElement.prototype.releasePointerCapture = () => {};
  window.Element.prototype.getBoundingClientRect =
    () => ({ left: 0, top: 0, right: W, bottom: H, width: W, height: H });

  /* Stub anime. It must RESPECT THE SCHEDULING OFFSET: legs are added in draw
     order but run at computed times, and the rotation re-lay is added last yet
     may finish before another leg. Applying "last added wins" stacked five
     players on one cone and looked like a broken rotation when the engine was
     fine. Buffer every add, then settle them in finish-time order. */
  const state = { complete: null, added: 0, legs: [] };
  const settle = () => {
    state.legs.slice().sort((a, b) => (a.at + a.dur) - (b.at + b.dur)).forEach(l => {
      if (l.el && l.k) { l.el.style.left = l.k.left; l.el.style.top = l.k.top; }
    });
    state.legs.length = 0;
  };
  state.settle = settle;
  global.anime = window.anime = Object.assign(() => ({}), {
    timeline: cfg => {
      state.complete = cfg && cfg.complete; state.added = 0; state.legs.length = 0;
      const tl = {
        add(a, off) {
          state.added++;
          const k = a.keyframes && a.keyframes[a.keyframes.length - 1];
          const els = Array.isArray(a.targets) ? a.targets : [a.targets];
          els.forEach(el => state.legs.push({ el, k, at: off || 0, dur: a.duration || 0 }));
          return tl;
        },
        play() {}, pause() {}, restart() {}, seek() {}, finished: Promise.resolve()
      };
      return tl;
    },
    remove() {}, set() {}
  });
  eval(fs.readFileSync(R + "js/drills.js", "utf8"));
  if (drill) window.PRESET_DRILLS = [drill];

  const store = { data: { teamName: "P", roster: [], nextId: 1,
      colors: { team: "#2563eb", opp: "#ff453a" },
      board: { squad: "11", formation: "4-3-3", showOpp: false, placed: {} },
      drills: [], games: [] },
    listeners: new Set(), subscribe(f) { this.listeners.add(f); },
    emit() {}, save() {}, flush() {} };
  const mod = await import(R + "js/board.js?" + Date.now());
  mod.initBoard(store);

  const $ = s => document.querySelector(s);
  const click = el => el && el.dispatchEvent(new window.Event("click", { bubbles: true }));
  const seg = v => [...document.querySelectorAll("#viewSeg button")]
                     .find(b => b.dataset.view === v);
  click(seg("drills")); click(seg("drills")); click(seg("drills"));
  if (drill) {
    const tab = [...document.querySelectorAll(".drillTab")]
                  .find(b => /complex/i.test(b.dataset.diff || ""));
    if (tab) click(tab);
    const pi = document.querySelector("#presetList .presetItem"); if (pi) click(pi);
    const use = document.querySelector("#drillInfoPanel .primary"); if (use) click(use);
  }
  return { window, document, $, click, seg, store, state, W, H };
}

// where each numbered player currently stands, in board fractions
export function players(document, W, H) {
  return [...document.querySelectorAll("#board .ditem")]
    .filter(e => e.querySelector(".att,.def"))
    .map(e => ({ num: e.textContent.trim(),
                 x: parseFloat(e.style.left) / (e.style.left.includes("%") ? 100 : W),
                 y: parseFloat(e.style.top)  / (e.style.top.includes("%")  ? 100 : H) }));
}
export const nearest = (ps, x, y) => ps.reduce((b, p) =>
  (!b || Math.hypot(p.x - x, p.y - y) < Math.hypot(b.x - x, b.y - y)) ? p : b, null);
