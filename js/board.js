/* Tactics board view. All state lives in store.data:
   { teamName, roster:[{id,name,pos}], nextId,
     board:{ squad, formation, showOpp, placed:{id:{x,y}} } } */

export function initBoard(store) {

  /* ---------------- sheets: native top layer ----------------
     Every .overlay sheet is registered as a popover. A popover renders in the
     browser's TOP LAYER, which is above all content regardless of z-index and
     is NOT captured by transformed ancestors — the two things that previously
     made sheets open invisibly behind the toolbar / inside the drill tray.
     The existing `.classList.add("open")` API is kept: this adapter mirrors it
     onto showPopover()/hidePopover(), so no call site had to change. */
  (function enableTopLayerSheets() {
    const W = typeof window !== "undefined" ? window : null;
    if (!W || !W.HTMLElement || !W.HTMLElement.prototype.hasOwnProperty("showPopover")
        || !W.MutationObserver) return;                   // graceful fallback
    document.documentElement.classList.add("has-popover");
    document.querySelectorAll(".overlay").forEach(el => {
      el.setAttribute("popover", "manual");   // manual: we control dismissal
      const sync = () => {
        const want = el.classList.contains("open");
        let shown = false;
        try { shown = el.matches(":popover-open"); } catch (e) {}
        try {
          if (want && !shown) el.showPopover();
          else if (!want && shown) el.hidePopover();
        } catch (e) {}
      };
      new W.MutationObserver(sync).observe(el, { attributes: true, attributeFilter: ["class"] });
      sync();
    });
    // Escape closes the topmost open sheet
    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      const open = [...document.querySelectorAll(".overlay.open")].pop();
      if (open) { open.classList.remove("open"); e.preventDefault(); }
    });
  })();

  /* Sheets are dismissed by tapping the scrim or dragging the grab handle
     down — so the per-sheet "Done" buttons were removed. */
  document.querySelectorAll(".overlay > .sheet").forEach(sheet => {
    const grip = document.createElement("div");
    grip.className = "grip";
    grip.setAttribute("aria-label", "Close");
    sheet.prepend(grip);
    let y0 = null;
    const close = () => sheet.closest(".overlay").classList.remove("open");
    grip.addEventListener("click", close);
    grip.addEventListener("pointerdown", e => {
      y0 = e.clientY;
      grip.setPointerCapture(e.pointerId);
    });
    grip.addEventListener("pointermove", e => {
      if (y0 === null) return;
      const dy = Math.max(0, e.clientY - y0);
      sheet.style.transform = `translateY(${dy}px)`;
    });
    const end = e => {
      if (y0 === null) return;
      const dy = Math.max(0, (e.clientY || 0) - y0);
      y0 = null;
      sheet.style.transform = "";
      if (dy > 60) close();
    };
    grip.addEventListener("pointerup", end);
    grip.addEventListener("pointercancel", end);
  });


  /* ---------------- pitch markings ---------------- */
  const NS = "http://www.w3.org/2000/svg";
  const lines = document.getElementById("lines");
  function mark(el, attrs) {
    const n = document.createElementNS(NS, el);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    n.setAttribute("stroke", "rgba(255,255,255,.85)");
    n.setAttribute("stroke-width", "0.45");
    n.setAttribute("fill", attrs.fill || "none");
    n.setAttribute("vector-effect", "non-scaling-stroke");
    lines.appendChild(n);
  }
  mark("rect", { x: 1, y: 1, width: 66, height: 103, rx: .4 });
  mark("line", { x1: 1, y1: 52.5, x2: 67, y2: 52.5 });
  mark("circle", { cx: 34, cy: 52.5, r: 9.15 });
  mark("circle", { cx: 34, cy: 52.5, r: .6, fill: "rgba(255,255,255,.85)" });
  [[1, false], [104, true]].forEach(([edge, flip]) => {
    const dir = flip ? -1 : 1;
    mark("rect", { x: 34 - 20.16, y: flip ? edge - 16.5 : edge, width: 40.32, height: 16.5 });
    mark("rect", { x: 34 - 9.16, y: flip ? edge - 5.5 : edge, width: 18.32, height: 5.5 });
    mark("circle", { cx: 34, cy: edge + dir * 11, r: .6, fill: "rgba(255,255,255,.85)" });
    const y = edge + dir * 16.5;
    mark("path", { d: `M ${34 - 7.3} ${y} A 9.15 9.15 0 0 ${flip ? 1 : 0} ${34 + 7.3} ${y}` });
  });

  /* ---------------- formations: [x, y, position label] ---------------- */
  const FORMATIONS = {
    "11": {
      "4-3-3": [[50,93,"GK"],[16,79,"LB"],[38,81,"CB"],[62,81,"CB"],[84,79,"RB"],[30,62,"CM"],[50,66,"CDM"],[70,62,"CM"],[18,42,"LW"],[50,38,"ST"],[82,42,"RW"]],
      "4-4-2": [[50,93,"GK"],[16,79,"LB"],[38,81,"CB"],[62,81,"CB"],[84,79,"RB"],[14,60,"LM"],[38,63,"CM"],[62,63,"CM"],[86,60,"RM"],[38,40,"ST"],[62,40,"ST"]],
      "4-2-3-1": [[50,93,"GK"],[16,79,"LB"],[38,81,"CB"],[62,81,"CB"],[84,79,"RB"],[38,66,"CDM"],[62,66,"CDM"],[20,50,"LW"],[50,47,"CAM"],[80,50,"RW"],[50,33,"ST"]],
      "3-5-2": [[50,93,"GK"],[28,81,"CB"],[50,83,"CB"],[72,81,"CB"],[10,60,"LWB"],[30,64,"CM"],[50,60,"CDM"],[70,64,"CM"],[90,60,"RWB"],[40,40,"ST"],[60,40,"ST"]]
    },
    "9": {
      "3-2-3": [[50,93,"GK"],[25,79,"LB"],[50,81,"CB"],[75,79,"RB"],[35,62,"CM"],[65,62,"CM"],[22,42,"LW"],[50,38,"ST"],[78,42,"RW"]],
      "3-3-2": [[50,93,"GK"],[25,79,"LB"],[50,81,"CB"],[75,79,"RB"],[25,60,"LM"],[50,63,"CM"],[75,60,"RM"],[38,40,"ST"],[62,40,"ST"]],
      "2-3-3": [[50,93,"GK"],[35,81,"CB"],[65,81,"CB"],[25,62,"LM"],[50,64,"CM"],[75,62,"RM"],[22,42,"LW"],[50,38,"ST"],[78,42,"RW"]]
    }
  };

  /* ---------------- state helpers ---------------- */
  const board = document.getElementById("board");
  const bench = document.getElementById("bench");
  const ghost = document.getElementById("dragGhost");
  const squadSel = document.getElementById("squad");
  const formSel = document.getElementById("formation");
  const oppToggle = document.getElementById("oppToggle");
  const namesToggle = document.getElementById("namesToggle");

  const roster = () => (store.data && store.data.roster) || [];
  const unavailable = () => (store.data && store.data.unavailable) || [];
  const isOut = id => unavailable().includes(id);
  let subSel = null;   // roster id of the sub currently selected to come on
  function colors() {
    const c = (store.data && store.data.colors) || {};
    return { team: c.team || "#2563eb", opp: c.opp || "#ff453a" };
  }
  function inkFor(hex) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b2 = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b2 * 114) / 1000 > 140 ? "#171717" : "#ffffff";
  }
  function applyColors() {
    const c = colors();
    const rs = document.documentElement.style;
    rs.setProperty("--team", c.team); rs.setProperty("--team-ink", inkFor(c.team));
    rs.setProperty("--opp", c.opp); rs.setProperty("--opp-ink", inkFor(c.opp));
  }
  const bstate = () => {
    if (!store.data.board) store.data.board = { squad: "11", formation: "4-3-3", showOpp: false, placed: {} };
    return store.data.board;
  };
  function saveBoard() { store.save({ board: bstate() }); }
  function saveRoster(r, nextId) { store.save({ roster: r, nextId }); }

  let oppTokens = [];
  let teamTokens = {};   // id -> {el}
  let ballToken = null;
  let mode = "move";
  let dragging = false;

  const clamp01 = v => Math.min(1, Math.max(0, v));
  const firstName = n => n.trim().split(/\s+/)[0] || n;

  function makeTok(cls, label, name) {
    const el = document.createElement("div");
    el.className = "tok " + cls;
    el.textContent = label;
    if (name) {
      const s = document.createElement("span");
      s.className = "pname"; s.textContent = name;
      el.appendChild(s);
    }
    board.appendChild(el);
    return el;
  }
  function setPos(el, x, y) { el.style.left = (x * 100) + "%"; el.style.top = (y * 100) + "%"; }
  // Pixel variant, used only while a drill animation is running. anime.js reads
  // the element's INLINE left/top as its start value; if that is a % string and
  // the keyframes are px, anime converts between units using offsetWidth for
  // both axes and the pieces jump (they were landing near 0,0 before playing).
  // Keeping start value and keyframes in the same unit avoids that entirely.
  function setPosPx(el, x, y) {
    const r = board.getBoundingClientRect();
    el.style.left = (x * r.width) + "px";
    el.style.top  = (y * r.height) + "px";
  }

  /* ---------------- rendering ---------------- */
  function renderTeam() {
    const b = bstate();
    for (const id in teamTokens) {
      if (!b.placed[id] || !roster().find(p => String(p.id) === String(id))) {
        teamTokens[id].el.remove(); delete teamTokens[id];
      }
    }
    for (const p of roster()) {
      const pos = b.placed[p.id];
      if (!pos) continue;
      let t = teamTokens[p.id];
      if (!t) {
        const el = makeTok("team", p.pos, firstName(p.name));
        t = teamTokens[p.id] = { el };
        enableTeamDrag(t, p.id);
      }
      t.el.childNodes[0].textContent = p.pos;
      t.el.querySelector(".pname").textContent = firstName(p.name);
      setPos(t.el, pos.x, pos.y);
    }
    renderBench();
  }
  function subTokenEl(p, b) {
    const el = document.createElement("div");
    el.className = "btok";
    const disc = document.createElement("div");
    disc.className = "disc"; disc.textContent = p.pos;
    el.append(disc);
    if (b.showNames !== false) {
      const nm = document.createElement("div");
      nm.className = "bname"; nm.textContent = firstName(p.name);
      el.append(nm);
    }
    return el;
  }
  function renderBench() {
    const b = bstate();
    bench.innerHTML = "";
    const outList = document.getElementById("outList");
    outList.innerHTML = "";
    for (const p of roster()) {
      if (isOut(p.id)) {
        const el = subTokenEl(p, b);
        el.classList.add("outTok");
        el.title = "Tap to make available";
        el.addEventListener("click", () => restoreAvailable(p.id));
        outList.appendChild(el);
        continue;
      }
      if (b.placed[p.id]) continue;
      const el = subTokenEl(p, b);
      if (subSel === p.id) el.classList.add("sel");
      enableSubDrag(el, p);
      bench.appendChild(el);
    }
    updateSubHint();
  }
  function updateSubHint() {
    const h = document.getElementById("subHint");
    if (!h) return;
    const p = subSel != null ? roster().find(x => x.id === subSel) : null;
    h.hidden = !p;
    h.textContent = p ? `Tap a player to bring ${firstName(p.name)} on, or an empty spot to add them` : "";
  }
  function toggleSubSel(id) { subSel = (subSel === id) ? null : id; renderBench(); }
  function markUnavailable(id) {
    if (isOut(id)) return;
    store.data.unavailable = [...unavailable(), id];
    delete bstate().placed[id];
    if (subSel === id) subSel = null;
    store.save({ unavailable: store.data.unavailable });
    renderTeam(); renderBench();
  }
  function restoreAvailable(id) {
    store.data.unavailable = unavailable().filter(x => x !== id);
    store.save({ unavailable: store.data.unavailable });
    renderBench();
  }
  // substitution sheet: pick position for the player coming on, then swap
  let subCtx = null;
  const subPanel = document.getElementById("subPanel");
  function openSubSheet(inId, outId) {
    const inP = roster().find(p => p.id === inId);
    const outP = roster().find(p => p.id === outId);
    if (!inP || !outP) return;
    subCtx = { inId, outId };
    document.getElementById("subOffName").textContent = firstName(outP.name) + " · " + outP.pos;
    document.getElementById("subOnName").textContent = firstName(inP.name) + " · " + inP.pos;
    document.getElementById("subOnName2").textContent = firstName(inP.name);
    document.getElementById("subPos").value = outP.pos;   // default to the spot being filled
    subPanel.classList.add("open");
  }
  document.getElementById("subConfirm").addEventListener("click", () => {
    if (!subCtx) return;
    const b = bstate(), { inId, outId } = subCtx;
    const newPos = (document.getElementById("subPos").value.trim() || "").toUpperCase();
    if (b.placed[outId]) { b.placed[inId] = { ...b.placed[outId] }; delete b.placed[outId]; }
    if (newPos) {
      const inP = roster().find(p => p.id === inId);
      if (inP && inP.pos !== newPos) {
        inP.pos = newPos;
        saveRoster(roster(), store.data.nextId);
      }
    }
    subSel = null; subCtx = null;
    subPanel.classList.remove("open");
    renderTeam(); renderBench(); saveBoard();
  });
  document.getElementById("subCancel").addEventListener("click", () => {
    subCtx = null; subPanel.classList.remove("open");
  });
  subPanel.addEventListener("click", e => { if (e.target === subPanel) { subCtx = null; subPanel.classList.remove("open"); } });
  function buildOpp() {
    oppTokens.forEach(t => t.remove()); oppTokens = [];
    const b = bstate();
    const slots = FORMATIONS[b.squad][b.formation];
    for (const [x, y, pos] of slots) {
      const el = makeTok("opp", pos);
      setPos(el, (100 - x) / 100, (100 - y) / 100);
      el.style.display = b.showOpp ? "flex" : "none";
      enableFreeDrag(el);
      oppTokens.push(el);
    }
  }
  function buildBall(reset) {
    if (!ballToken) { ballToken = makeTok("ball", ""); enableFreeDrag(ballToken); }
    if (reset) setPos(ballToken, .5, .5);
  }
  function syncControls() {
    const b = bstate();
    if (squadSel.value !== b.squad) { squadSel.value = b.squad; fillFormationOptions(); }
    if (formSel.value !== b.formation) formSel.value = b.formation;
    oppToggle.classList.toggle("on", b.showOpp);
    const namesOn = b.showNames !== false;   // default on
    namesToggle.classList.toggle("on", namesOn);
    board.classList.toggle("hideNames", !namesOn);
  }
  function renderAll() {
    applyColors();
    syncControls();
    renderTeam();
    buildOpp();
    buildBall(false);
  }

  /* ---------------- formation auto-placement ---------------- */
  function applyFormation() {
    const b = bstate();
    const slots = FORMATIONS[b.squad][b.formation];
    b.placed = {};
    const pool = roster().filter(p => !isOut(p.id));   // injured/unavailable sit out
    const assigned = new Array(slots.length).fill(null);
    slots.forEach((s, i) => {
      const idx = pool.findIndex(p => p.pos === s[2]);
      if (idx > -1) assigned[i] = pool.splice(idx, 1)[0];
    });
    slots.forEach((s, i) => {
      if (!assigned[i] && pool.length) assigned[i] = pool.shift();
    });
    slots.forEach((s, i) => {
      if (assigned[i]) b.placed[assigned[i].id] = { x: s[0] / 100, y: s[1] / 100 };
    });
    renderTeam(); buildOpp(); saveBoard();
  }

  /* ---------------- dragging ---------------- */
  function enableFreeDrag(el) {
    el.addEventListener("pointerdown", e => {
      if (mode !== "move") return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      el.classList.add("dragging"); dragging = true;
      const r = board.getBoundingClientRect();
      const mv = ev => setPos(el, clamp01((ev.clientX - r.left) / r.width), clamp01((ev.clientY - r.top) / r.height));
      const up = () => {
        el.classList.remove("dragging"); dragging = false;
        el.removeEventListener("pointermove", mv);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
      };
      el.addEventListener("pointermove", mv);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    });
  }

  function enableTeamDrag(t, id) {
    t.el.addEventListener("pointerdown", e => {
      if (mode !== "move") return;
      e.preventDefault();
      t.el.setPointerCapture(e.pointerId);
      const r = board.getBoundingClientRect();
      const benchZone = document.getElementById("benchZone");
      const sx = e.clientX, sy = e.clientY;
      let lastX = e.clientX, lastY = e.clientY, moved = false;
      const b = bstate();
      const mv = ev => {
        lastX = ev.clientX; lastY = ev.clientY;
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) <= 6) return; // ignore jitter so taps stay clean
        if (!moved) { moved = true; t.el.classList.add("dragging"); dragging = true; }
        const x = clamp01((ev.clientX - r.left) / r.width);
        const y = clamp01((ev.clientY - r.top) / r.height);
        b.placed[id] = { x, y }; setPos(t.el, x, y);
        const bz = benchZone.getBoundingClientRect();
        benchZone.classList.toggle("dropTarget",
          lastX >= bz.left && lastX <= bz.right && lastY >= bz.top && lastY <= bz.bottom);
      };
      const up = () => {
        t.el.removeEventListener("pointermove", mv);
        t.el.removeEventListener("pointerup", up);
        t.el.removeEventListener("pointercancel", up);
        benchZone.classList.remove("dropTarget");
        if (!moved) {                                 // a tap, not a drag
          if (subSel != null && subSel !== id) openSubSheet(subSel, id);  // sub the selected player in
          return;
        }
        t.el.classList.remove("dragging"); dragging = false;
        const oz = document.getElementById("outZone").getBoundingClientRect();
        if (lastX >= oz.left && lastX <= oz.right && lastY >= oz.top && lastY <= oz.bottom) {
          markUnavailable(id); return;                // dragged onto Out = injured/unavailable
        }
        const bz = benchZone.getBoundingClientRect();
        const overBench = lastX >= bz.left && lastX <= bz.right && lastY >= bz.top && lastY <= bz.bottom;
        if (overBench || lastY > r.bottom + 10) { delete b.placed[id]; renderTeam(); }
        saveBoard();
      };
      t.el.addEventListener("pointermove", mv);
      t.el.addEventListener("pointerup", up);
      t.el.addEventListener("pointercancel", up);
    });
  }

  // subs support both gestures:
  //   tap                    -> select for a substitution (then tap a player)
  //   drag onto empty pitch  -> place them there
  //   drag onto a player     -> substitution sheet (edit position, swap)
  //   drag onto the Out zone -> mark unavailable
  function enableSubDrag(el, p) {
    el.addEventListener("pointerdown", e => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY;
      let moved = false;
      const mv = ev => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) <= 8) return;
        if (!moved) { moved = true; ghost.textContent = p.pos; ghost.style.display = "flex"; }
        ghost.style.left = ev.clientX + "px"; ghost.style.top = ev.clientY + "px";
      };
      const up = ev => {
        ghost.style.display = "none";
        el.removeEventListener("pointermove", mv);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
        if (!moved) { toggleSubSel(p.id); return; }   // tap = select for a sub
        const oz = document.getElementById("outZone").getBoundingClientRect();
        if (ev.clientX >= oz.left && ev.clientX <= oz.right && ev.clientY >= oz.top && ev.clientY <= oz.bottom) {
          markUnavailable(p.id); return;
        }
        const r = board.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
          const b = bstate();
          // dropped on a placed player? open the substitution sheet for that swap
          let swapId = null, best = 28; // px radius
          for (const q of roster()) {
            const pos = b.placed[q.id];
            if (!pos) continue;
            const d = Math.hypot(pos.x * r.width - (ev.clientX - r.left), pos.y * r.height - (ev.clientY - r.top));
            if (d < best) { best = d; swapId = q.id; }
          }
          if (swapId !== null) { openSubSheet(p.id, swapId); return; }
          // otherwise place on the empty spot
          b.placed[p.id] = {
            x: clamp01((ev.clientX - r.left) / r.width),
            y: clamp01((ev.clientY - r.top) / r.height)
          };
          subSel = null;
          renderTeam(); renderBench(); saveBoard();
        }
      };
      el.addEventListener("pointermove", mv);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    });
  }

  /* ---------------- drawing ---------------- */
  const canvas = document.getElementById("ink");
  const ctx = canvas.getContext("2d");
  let strokes = [];
  let current = null;

  function resizeCanvas() {
    const r = board.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = r.width * dpr; canvas.height = r.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // keep bench and drill tray no wider than the pitch, centred beneath it
    if (r.width > 0) {
      for (const id of ["benchZone", "drillTray"]) {
        const el = document.getElementById(id);
        if (el) el.style.width = Math.round(r.width) + "px";
      }
    }
    redraw();
  }
  
  const tacticalLayer = document.getElementById("tacticalLayer");


  // resample a stroke into a wavy line (dribble notation)
  function wavyPoints(pts, r) {
    const P = pts.map(p => [p[0] * r.width, p[1] * r.height]);
    const amp = Math.max(1.5, r.width * 0.005);
    const wavelength = Math.max(15, r.width * 0.05);
    const step = Math.max(2.5, r.width * 0.009);
    const out = [P[0]];
    let dist = 0;
    for (let i = 1; i < P.length; i++) {
      const [x0, y0] = P[i - 1], [x1, y1] = P[i];
      const seg = Math.hypot(x1 - x0, y1 - y0);
      if (!seg) continue;
      const n = Math.max(1, Math.floor(seg / step));
      const perp = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2;
      for (let j = 1; j <= n; j++) {
        const t = j / n;
        const d = dist + seg * t;
        const off = amp * Math.sin((d / wavelength) * 2 * Math.PI);
        out.push([
          x0 + (x1 - x0) * t + off * Math.cos(perp),
          y0 + (y1 - y0) * t + off * Math.sin(perp)
        ]);
      }
      dist += seg;
    }
    return out;
  }

  function buildSvgPath(s, r, id) {
    const pts = s.pts; if (pts.length < 2) return "";
    let d = "";
    if (s.mode === "dribble") {
      const w = wavyPoints(pts, r);
      d = `M ${w[0][0]} ${w[0][1]} `;
      for (let i = 1; i < w.length; i++) d += `L ${w[i][0]} ${w[i][1]} `;
    } else {
      d = `M ${pts[0][0] * r.width} ${pts[0][1] * r.height} `;
      for (let i = 1; i < pts.length; i++) d += `L ${pts[i][0] * r.width} ${pts[i][1] * r.height} `;
    }
    
    let strokeColor = s.color || "rgba(255,255,255,0.95)";
    let dash = (s.mode === "pass" || s.mode === "passrun") ? "stroke-dasharray='9,8'" : "";
    // No arrowhead on a pass: the dashes already read as a pass, playback shows
    // the direction, and the marker cluttered the end of every short pass.
    let marker = (s.mode === "passrun") ? `marker-end="url(#arrow-${s.mode})"` : "";
    
    return `<path id="${id}" d="${d}" stroke="${strokeColor}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 2px 6px rgba(0,0,0,0.5));" ${dash} ${marker}></path>`;
  }

  function redraw() {
    const r = board.getBoundingClientRect();
    ctx.clearRect(0, 0, r.width, r.height);
    let svgHtml = `
      <defs>
        <marker id="arrow-pass" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.9)" />
        </marker>
        <marker id="arrow-run" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.9)" />
        </marker>
        <marker id="arrow-dribble" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.9)" />
        </marker>
      </defs>
    `;
    let i = 0;
    for (const s of strokes) {
       svgHtml += buildSvgPath(s, r, "stroke-" + i++);
    }
    if (current) {
       svgHtml += buildSvgPath(current, r, "stroke-current");
    }
    if (tacticalLayer) tacticalLayer.innerHTML = svgHtml;
  }

  board.addEventListener("pointerdown", e => {
    if (mode === "move") {
      // with a sub selected, tapping an empty part of the pitch places them there
      if (subSel != null && (e.target === board || e.target.id === "ink" || e.target.id === "lines")) {
        const r = board.getBoundingClientRect();
        bstate().placed[subSel] = {
          x: clamp01((e.clientX - r.left) / r.width),
          y: clamp01((e.clientY - r.top) / r.height)
        };
        subSel = null;
        renderTeam(); renderBench(); saveBoard();
      }
      return;
    }
    e.preventDefault();
    board.setPointerCapture(e.pointerId);
    const r = board.getBoundingClientRect();
    current = { mode, pts: [[(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]] };
    if (drillsMode && drillColor !== "#ffffff") current.color = drillColor; // colour drill lines only
    // BIND the stroke to whatever piece it started on. The coach's finger is
    // literally on that piece, so record it once here rather than re-guessing
    // by proximity on every playback.
    if (drillsMode) {
      const sx = current.pts[0][0], sy = current.pts[0][1];
      // Players first: a cone almost always sits under the player standing on
      // it, and binding the stroke to the cone would animate the cone and
      // leave the player behind. Only fall back to other kit if no player.
      const pick = pred => {
        let hit = null, hitD = 0.07;
        drillItems.forEach(it => {
          if (!pred(it)) return;
          const d = Math.hypot(it.x - sx, it.y - sy);
          if (d < hitD) { hitD = d; hit = it; }
        });
        return hit;
      };
      const hit = pick(it => isPlayerKind(it.kind)) || pick(it => it.kind === "dball");
      if (hit) current.from = hit.id;
    }
    const mv = ev => {
      current.pts.push([(ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height]);
      redraw();
    };
    const up = () => {
      if (current && current.pts.length > 1) strokes.push(current);
      current = null; redraw();
      board.removeEventListener("pointermove", mv);
      board.removeEventListener("pointerup", up);
      board.removeEventListener("pointercancel", up);
    };
    board.addEventListener("pointermove", mv);
    board.addEventListener("pointerup", up);
    board.addEventListener("pointercancel", up);
  });

  /* ---------------- squad sheet ---------------- */
  const panel = document.getElementById("squadPanel");
  const inName = document.getElementById("inName");
  const inPos = document.getElementById("inPos");
  const editTeamName = document.getElementById("editTeamName");

  function renderRoster() {
    const list = document.getElementById("rosterList");
    list.innerHTML = "";
    for (const p of roster()) {
      const row = document.createElement("div");
      row.className = "rrow";
      const rp = document.createElement("div"); rp.className = "rpos"; rp.textContent = p.pos;
      const rn = document.createElement("div"); rn.className = "rname"; rn.textContent = p.name;
      const del = document.createElement("button"); del.className = "del"; del.textContent = "✕";
      del.setAttribute("aria-label", "Remove");
      del.addEventListener("click", () => {
        const r = roster().filter(x => x.id !== p.id);
        delete bstate().placed[p.id];
        store.data.roster = r;
        saveRoster(r, store.data.nextId);
        renderRoster(); renderTeam();
      });
      row.append(rp, rn, del);
      list.appendChild(row);
    }
  }
  document.getElementById("addPlayer").addEventListener("click", () => {
    const name = inName.value.trim();
    const pos = (inPos.value.trim() || "?").toUpperCase();
    if (!name) return;
    const r = roster();
    const nextId = (store.data.nextId || r.length + 1);
    r.push({ id: nextId, name, pos });
    store.data.roster = r;
    store.data.nextId = nextId + 1;
    inName.value = ""; inPos.value = ""; inName.focus();
    saveRoster(r, store.data.nextId);
    renderRoster(); renderBench();
  });
  inName.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); inPos.focus(); } });
  inPos.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("addPlayer").click(); } });
  editTeamName.addEventListener("change", () => {
    const v = editTeamName.value.trim();
    if (!v) return;
    store.data.teamName = v;
    document.getElementById("hdrTeam").textContent = v;
    store.save({ teamName: v });
  });
  document.getElementById("squadBtn").addEventListener("click", () => {
    editTeamName.value = store.data.teamName || "";
    const c = colors();
    document.getElementById("teamColor").value = c.team;
    document.getElementById("oppColor").value = c.opp;
    renderRoster();
    panel.classList.add("open");
  });
  ["teamColor", "oppColor"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => {
      store.data.colors = {
        team: document.getElementById("teamColor").value,
        opp: document.getElementById("oppColor").value
      };
      store.save({ colors: store.data.colors });
      applyColors();
    });
  });
  document.getElementById("closeSquad")?.addEventListener("click", () => panel.classList.remove("open"));
  panel.addEventListener("click", e => { if (e.target === panel) panel.classList.remove("open"); });

  /* ---------------- controls ---------------- */
  const ctlMenuPanel = document.getElementById("ctlMenuPanel");
  document.getElementById("closeCtlMenu")?.addEventListener("click", () =>
    ctlMenuPanel.classList.remove("open"));
  ctlMenuPanel.addEventListener("click", e => {
    if (e.target === ctlMenuPanel) ctlMenuPanel.classList.remove("open");
    // actions that open another sheet (or reset) close this one; toggles keep it open
    const b = e.target.closest("button");
    if (b && ["squadBtn", "drillLibBtn", "resetBtn"].includes(b.id))
      ctlMenuPanel.classList.remove("open");
  });
  function clearDrillBoard() {
    clearDrillItems();
    strokes.length = 0;   // clear the active buffer in place, whatever it points at
    redraw();
  }
  // "Start a new drill": empty pitch, cleared name, kit pane opened so the
  // first action (placing a cone or player) is immediately available.
  document.getElementById("newDrillBtn")?.addEventListener("click", () => {
    document.getElementById("drillPanel").classList.remove("open");
    setView("drills");
    clearDrillBoard();
    const nameIn = document.getElementById("drillName");
    if (nameIn) nameIn.value = "";
    // nothing loaded yet, so open Kit — placing a piece is the first action
    if (window.openDrillKit) window.openDrillKit();
  });
  document.getElementById("reformBtn").addEventListener("click", () => {
    if (drillsMode) { clearDrillBoard(); return; }   // drills: ⟳ clears the pitch
    applyFormation();   // team: players back to standard shape; drawings stay
  });

  document.querySelectorAll(".mode").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".mode").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      mode = b.dataset.mode;
      document.body.classList.toggle("drawing", mode !== "move");
    });
  });
  // Drawing tools are only reachable in Drills now, so any view without them
  // must be returned to "move" or a leftover pen mode blocks dragging.
  // Label every line/action tool from its aria-label, so the Lines pane reads
  // as words rather than a row of unexplained glyphs.
  document.querySelectorAll("#boardView footer .mode, #boardView footer .act").forEach(b => {
    if (b.querySelector(".toolLbl")) return;
    const txt = b.getAttribute("aria-label");
    if (!txt) return;
    const s = document.createElement("span");
    s.className = "toolLbl";
    s.textContent = txt;
    b.appendChild(s);
  });
  window.setBoardMoveMode = function () {
    mode = "move";
    document.body.classList.remove("drawing");
    document.querySelectorAll(".mode").forEach(x =>
      x.classList.toggle("on", x.dataset.mode === "move"));
  };
  // colour palette pops up out of the bottom toolbar:
  //  - "Players"/"Opp" rows set the team/opp KIT colours (all views, global)
  //  - "Item" row sets the colour of the next cone/marker/line placed (drills)
  const drillColors = document.getElementById("drillColors");
  function markActive(row, color) {
    if (!row) return;   // tolerate markup without this row rather than throwing
    const c = (color || "").toLowerCase();
    row.querySelectorAll(".swatch").forEach(x =>
      x.classList.toggle("on", (x.dataset.color || "").toLowerCase() === c));
  }
  function refreshColorPalette() {
    const c = colors();
    markActive(drillColors.querySelector('.palRow[data-target="team"]'), c.team);
    markActive(drillColors.querySelector('.palRow[data-target="opp"]'), c.opp);
    markActive(drillColors.querySelector('.palRow[data-target="piece"]'), drillColor);
  }
  document.getElementById("colorBtn").addEventListener("click", e => {
    e.stopPropagation();
    refreshColorPalette();
    drillColors.classList.toggle("open");
  });
  drillColors.querySelectorAll(".palRow").forEach(row => {
    const target = row.dataset.target;
    row.querySelectorAll(".swatch").forEach(sw => {
      sw.addEventListener("click", () => {
        const color = sw.dataset.color;
        if (target === "piece") {
          drillColor = color;
        } else {
          const c = colors();
          store.data.colors = { team: c.team, opp: c.opp, [target]: color };
          store.save({ colors: store.data.colors });
          applyColors();
          const pick = document.getElementById(target === "team" ? "teamColor" : "oppColor");
          if (pick) pick.value = color;   // keep My Squad pickers in sync
        }
        markActive(row, color);
      });
    });
  });
  // tap anywhere else closes the pop-up
  document.addEventListener("pointerdown", e => {
    if (drillColors.classList.contains("open") &&
        !drillColors.contains(e.target) && !e.target.closest("#colorBtn"))
      drillColors.classList.remove("open");
  });
  document.getElementById("undoBtn").addEventListener("click", () => { strokes.pop(); redraw(); });
  document.getElementById("clearBtn").addEventListener("click", () => { strokes = []; redraw(); });
  document.getElementById("resetBtn").addEventListener("click", () => {
    if (drillsMode) { clearDrillBoard(); return; }
    strokes = []; redraw(); applyFormation(); buildBall(true);
  });
  namesToggle.addEventListener("click", () => {
    const b = bstate();
    b.showNames = b.showNames === false;   // flip: undefined/true -> false, false -> true
    syncControls();
    renderBench();
    saveBoard();
  });
  oppToggle.addEventListener("click", () => {
    const b = bstate();
    b.showOpp = !b.showOpp;
    oppToggle.classList.toggle("on", b.showOpp);
    oppTokens.forEach(el => el.style.display = b.showOpp ? "flex" : "none");
    saveBoard();
  });
  function fillFormationOptions() {
    const names = Object.keys(FORMATIONS[squadSel.value]);
    formSel.innerHTML = names.map(n => `<option>${n}</option>`).join("");
  }
  squadSel.addEventListener("change", () => {
    const b = bstate();
    b.squad = squadSel.value;
    fillFormationOptions();
    b.formation = formSel.value;
    applyFormation(); buildBall(true);
  });
  formSel.addEventListener("change", () => {
    bstate().formation = formSel.value;
    applyFormation();
  });
  window.addEventListener("resize", resizeCanvas);

  /* ---------------- drills mode ---------------- */
  let drillsMode = false;
  let drillItems = [];        // {kind, x, y, el, color?}
  let drillColor = "#ffffff"; // active colour for new cones/markers/lines in drills
  
  // SEQUENCER
  let drillSteps = [[]]; // array of strokes
  let currentStep = 0;
  
  // one sketch buffer per view; `strokes` always points at the active one
  const strokeBufs = { team: strokes, game: [], drills: drillSteps[0] };
  let teamStash = null;       // team board parked while the game view is active
  const drillTray = document.getElementById("drillTray");

  let currentView = "team";
  function applyGameLineup() {
    const b = bstate(), g = gday();
    if (!g.lineup) {
      // first time on this game's pitch: start from the current board
      g.lineup = {
        formation: b.formation, squad: b.squad,
        placed: JSON.parse(JSON.stringify(b.placed)), at: Date.now()
      };
      saveGday();
    }
    b.squad = g.lineup.squad; b.formation = g.lineup.formation;
    b.placed = JSON.parse(JSON.stringify(g.lineup.placed));
  }
  function syncBoardToLineup() {
    const b = bstate(), g = gday();
    if (!g.lineup) return;
    g.lineup.squad = b.squad; g.lineup.formation = b.formation;
    g.lineup.placed = JSON.parse(JSON.stringify(b.placed));
    saveGday();
  }
  function setView(v) {
    if (v === currentView) return;
    strokeBufs[currentView] = strokes;
    if (currentView === "game") {          // leaving the game pitch
      syncBoardToLineup();
      if (teamStash) {
        const b = bstate();
        b.squad = teamStash.squad; b.formation = teamStash.formation;
        b.placed = teamStash.placed; teamStash = null;
        saveBoard();
      }
    }
    if (v === "game") {                    // entering the game pitch
      const b = bstate();
      teamStash = {
        squad: b.squad, formation: b.formation,
        placed: JSON.parse(JSON.stringify(b.placed))
      };
      applyGameLineup();
    }
    currentView = v;
    strokes = strokeBufs[v];
    drillsMode = v === "drills";
    if (drillsMode) {
      updateStepUI();
    } else {
      // Team / Game day show the bench, not the drawing tools: collapse both
      // drills bars and drop back to move mode so pieces stay draggable.
      if (window.closeDrillBars) window.closeDrillBars();
      if (window.setBoardMoveMode) window.setBoardMoveMode();
    }
    document.body.classList.toggle("drillsMode", drillsMode);
    document.body.classList.toggle("gameView", v === "game");
    const rb = document.getElementById("reformBtn");
    rb.setAttribute("aria-label", drillsMode ? "Clear pitch" : "Reset formation");
    rb.setAttribute("title", drillsMode ? "Clear the pitch" : "Reset players to formation");
    document.querySelectorAll("#viewSeg button").forEach(b =>
      b.classList.toggle("on", b.dataset.view === v));
    subSel = null;              // clear any pending sub when switching views
    renderAll();
    if (v === "game") renderScore();
    redraw();
    if (drillsMode) requestAnimationFrame(updateTrayFades);
    window.dispatchEvent(new Event("resize")); // re-measure board
  }
  function setDrillsMode(on) { setView(on ? "drills" : "team"); }
  // tap an inactive segment to switch views; tap the active one for its options
  document.querySelectorAll("#viewSeg button").forEach(b =>
    b.addEventListener("click", () => {
      const v = b.dataset.view;
      if (v === "game") {
        // Game day is a menu, not a view: always show the games dropdown
        renderGamesList();
        document.getElementById("gamesPanel").classList.add("open");
        return;
      }
      if (v === currentView) {
        // Drills mirrors Game day: the tab opens the drills list, which starts
        // with "Start a new drill" so there is an obvious way in from scratch.
        if (v === "drills") {
          if (typeof renderDrillList === "function") renderDrillList();
          document.getElementById("drillPanel").classList.add("open");
          return;
        }
        document.getElementById("ctlMenuTitle").textContent = "Team options";
        document.getElementById("resetBtn").textContent = "Reset board";
        document.getElementById("ctlMenuPanel").classList.add("open");
      } else {
        setView(v);
      }
    }));

  // edge fade hints on the kit tray when items are off-screen
  const trayScroller = drillTray.querySelector(".trayItems");
  function updateTrayFades() {
    drillTray.classList.toggle("fadeL", trayScroller.scrollLeft > 4);
    drillTray.classList.toggle("fadeR",
      trayScroller.scrollLeft + trayScroller.clientWidth < trayScroller.scrollWidth - 4);
  }
  trayScroller.addEventListener("scroll", updateTrayFades);
  window.addEventListener("resize", () => requestAnimationFrame(updateTrayFades));

  // cones, markers AND players can take the selected drill colour; other kinds
  // keep their look. For players, white means "use the default" (Player = team
  // colour, Opp = opposition colour) so the two default kits are preserved.
  const COLOURED_KINDS = new Set(["cone", "disc", "att", "def"]);
  const isPlayerKind = k => k === "att" || k === "def";
  function effectiveColor(kind, color) {
    if (!color || !COLOURED_KINDS.has(kind)) return null;
    if (isPlayerKind(kind) && color.toLowerCase() === "#ffffff") return null; // keep team/opp default
    return color;
  }
  function shade(hex, amt) {   // amt in -1..1; negative darker, positive lighter
    const n = parseInt(hex.slice(1), 16);
    const f = v => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  function paintPiece(s, kind, color) {
    if (!color) return;
    if (kind === "cone") {
      s.style.background = `linear-gradient(${shade(color, 0.14)}, ${shade(color, -0.14)})`;
    } else if (kind === "disc") {
      s.style.background = color;
      s.style.borderColor = color.toLowerCase() === "#ffffff"
        ? "rgba(0,0,0,.28)" : "rgba(255,255,255,.55)";
    } else if (isPlayerKind(kind)) {
      s.style.background = color;
    }
  }
  function shapeEl(kind, color, num) {
    const s = document.createElement("div");
    s.className = kind; s.style.pointerEvents = "none";
    paintPiece(s, kind, effectiveColor(kind, color));
    if (num && isPlayerKind(kind)) {
       // Styling lives in .hasNum (styles.css). Setting it inline made the text
       // the flex item's min-content width, so a numbered player stretched into
       // an ellipse instead of staying a circle.
       s.textContent = num;
       s.classList.add("hasNum");
    }
    return s;
  }
  let drillItemSeq = 0;
  function addDrillItem(kind, x, y, color, num, id, startCone) {
    const eff = effectiveColor(kind, color);
    const el = document.createElement("div");
    el.className = "ditem d-" + kind;
    el.appendChild(shapeEl(kind, eff, num));
    board.appendChild(el);
    setPos(el, x, y);
    // stable id so a stroke can name the piece it moves instead of the
    // playback engine guessing by proximity every time
    const item = { kind, x, y, el, num, id: (id != null ? id : ++drillItemSeq) };
    if (startCone) { item.startCone = true; el.classList.add("startCone"); }
    if (item.id > drillItemSeq) drillItemSeq = item.id;
    if (eff) item.color = eff;
    drillItems.push(item);
    
    // Tapping a cone marks it as the drill START — the slot the queue feeds
    // into, and the slot a player reaches to complete a lap. Only one at a time.
    if (kind === "cone" || kind === "disc") {
      el.addEventListener("click", () => {
        if (!drillsMode) return;
        const wasStart = !!item.startCone;
        drillItems.forEach(o => { o.startCone = false; o.el.classList.remove("startCone"); });
        item.startCone = !wasStart;
        el.classList.toggle("startCone", item.startCone);
      });
    }

    // Number picker logic
    if (kind === "att" || kind === "def") {
      el.addEventListener("click", (e) => {
        if (!drillsMode) return;
        // keep this click from reaching the document handler below, which would
        // close the popup we are about to open
        e.stopPropagation();
        const popup = document.getElementById("numSelectorPopup");
        if (popup) {
          const rect = el.getBoundingClientRect();
          popup.hidden = false;              // must be laid out before measuring
          popup.classList.remove("below");
          const pw = popup.offsetWidth || 220, ph = popup.offsetHeight || 120;
          // flip underneath when there is not enough room above the player,
          // otherwise a piece near the top of the pitch pushed it off-screen
          const below = rect.top - ph - 10 < 4;
          popup.classList.toggle("below", below);
          // keep it on screen horizontally too (it is centred on the player)
          const half = pw / 2 + 8;
          const cx = Math.min(window.innerWidth - half, Math.max(half, rect.left + rect.width / 2));
          popup.style.left = cx + "px";
          popup.style.top = (below ? rect.bottom : rect.top) + "px";
          popup.activeItem = item;
        }
      });
    }

    enableDrillDrag(item);
    return item;
  }
  function clearDrillItems() {
    drillItems.forEach(i => i.el.remove());
    drillItems = [];
    drillSteps = [[]];
    currentStep = 0;
    strokeBufs.drills = drillSteps[0];
    if (currentView === "drills") strokes = strokeBufs.drills;
    updateStepUI();
  }

  function updateStepUI() {
    const lbl = document.getElementById("dpStep");
    if (lbl) lbl.textContent = `Step ${currentStep + 1} of ${drillSteps.length}`;
    const btnP = document.getElementById("dpPrevDrill");
    
    if (btnP) btnP.disabled = currentStep === 0;
    
  }
  
  function applyStepState(targetStep) {
    // start from initial items
    const state = drillItems.map(item => ({ item, x: item.x, y: item.y }));
    for (let s = 0; s < targetStep; s++) {
      const stepStrokes = drillSteps[s];
      stepStrokes.forEach(stroke => {
        if (stroke.pts.length < 2) return;
        const startPt = stroke.pts[0];
        const pref = stroke.mode === "pass" ? ["dball"] : (stroke.mode === "run" || stroke.mode === "dribble") ? ["att", "def"] : [];
        let closest = null, minDist = 0.05;
        state.forEach(st => {
          if (pref.includes(st.item.kind)) {
            const d = Math.hypot(st.x - startPt[0], st.y - startPt[1]);
            if (d < minDist) { minDist = d; closest = st; }
          }
        });
        if (!closest) {
          minDist = 0.05;
          state.forEach(st => {
            const d = Math.hypot(st.x - startPt[0], st.y - startPt[1]);
            if (d < minDist) { minDist = d; closest = st; }
          });
        }
        if (closest) {
          const endPt = stroke.pts[stroke.pts.length - 1];
          closest.x = endPt[0];
          closest.y = endPt[1];
        }
      });
    }
    state.forEach(st => setPos(st.item.el, st.x, st.y));
  }

  function changeStep(newStep) {
    currentStep = Math.max(0, Math.min(newStep, drillSteps.length - 1));
    strokeBufs.drills = drillSteps[currentStep];
    if (currentView === "drills") strokes = strokeBufs.drills;
    applyStepState(currentStep);
    updateStepUI();
    redraw();
  }

  document.getElementById("dsPrev")?.addEventListener("click", () => changeStep(currentStep - 1));
  document.getElementById("dsNext")?.addEventListener("click", () => changeStep(currentStep + 1));
  document.getElementById("dsAdd")?.addEventListener("click", () => {
    // If not at the end, adding a step inserts or trims? We trim.
    drillSteps = drillSteps.slice(0, currentStep + 1);
    drillSteps.push([]);
    changeStep(drillSteps.length - 1);
  });

  function enableDrillDrag(item) {
    item.el.addEventListener("pointerdown", e => {
      if (mode !== "move") return;
      e.preventDefault();
      item.el.setPointerCapture(e.pointerId);
      item.el.classList.add("dragging"); dragging = true;
      const r = board.getBoundingClientRect();
      let lastX = e.clientX, lastY = e.clientY;
      const mv = ev => {
        lastX = ev.clientX; lastY = ev.clientY;
        item.x = clamp01((ev.clientX - r.left) / r.width);
        item.y = clamp01((ev.clientY - r.top) / r.height);
        setPos(item.el, item.x, item.y);
        const tz = drillTray.getBoundingClientRect();
        drillTray.classList.toggle("dropTarget",
          lastX >= tz.left && lastX <= tz.right && lastY >= tz.top && lastY <= tz.bottom);
      };
      const up = () => {
        item.el.classList.remove("dragging"); dragging = false;
        item.el.removeEventListener("pointermove", mv);
        item.el.removeEventListener("pointerup", up);
        item.el.removeEventListener("pointercancel", up);
        drillTray.classList.remove("dropTarget");
        const tz = drillTray.getBoundingClientRect();
        if ((lastX >= tz.left && lastX <= tz.right && lastY >= tz.top && lastY <= tz.bottom)
            || lastY > r.bottom + 10) {
          item.el.remove();
          drillItems = drillItems.filter(i => i !== item);
        }
      };
      item.el.addEventListener("pointermove", mv);
      item.el.addEventListener("pointerup", up);
      item.el.addEventListener("pointercancel", up);
    });
  }

  // drag new pieces from the tray onto the pitch;
  // a mostly-horizontal drag scrolls the tray instead (mouse and touch)
  document.querySelectorAll(".titem").forEach(el => {
    el.addEventListener("pointerdown", e => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const kind = el.dataset.kind;
      const sx = e.clientX, sy = e.clientY;
      const startScroll = trayScroller.scrollLeft;
      let gesture = null; // "drag" | "scroll"
      const startGhost = () => {
        ghost.textContent = "";
        ghost.style.background = "transparent";
        ghost.style.boxShadow = "none";
        ghost.appendChild(shapeEl(kind, drillColor));
        ghost.style.display = "flex";
      };
      const mv = ev => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!gesture) {
          if (Math.hypot(dx, dy) < 6) return;
          gesture = Math.abs(dx) > Math.abs(dy) ? "scroll" : "drag";
          if (gesture === "drag") startGhost();
        }
        if (gesture === "scroll") {
          trayScroller.scrollLeft = startScroll - dx;
        } else {
          ghost.style.left = ev.clientX + "px"; ghost.style.top = ev.clientY + "px";
        }
      };
      const up = ev => {
        ghost.style.display = "none";
        ghost.innerHTML = "";
        ghost.style.background = ""; ghost.style.boxShadow = "";
        el.removeEventListener("pointermove", mv);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
        if (gesture !== "drag") return;
        const r = board.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
          addDrillItem(kind,
            clamp01((ev.clientX - r.left) / r.width),
            clamp01((ev.clientY - r.top) / r.height),
            drillColor);
          // Deliberately left open: a drill is laid out with several pieces in
          // a row, so closing the pane after each one meant reopening it every
          // time. It closes on the Drill Setup segment or when leaving drills.
        }
      };
      el.addEventListener("pointermove", mv);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    });
  });

  /* ---------------- drill library ---------------- */
  // Firestore cannot store nested arrays, so stroke points are flattened on save.
  const flatStroke = s => ({ mode: s.mode, pts: s.pts.flat(), ...(s.color ? { color: s.color } : {}), ...(s.from != null ? { from: s.from } : {}) });
  function unflatStroke(s) {
    const pts = [];
    for (let i = 0; i + 1 < s.pts.length; i += 2) pts.push([s.pts[i], s.pts[i + 1]]);
    return { mode: s.mode, pts, ...(s.color ? { color: s.color } : {}), ...(s.from != null ? { from: s.from } : {}) };
  }
  const drillPanel = document.getElementById("drillPanel");
  const drillNameIn = document.getElementById("drillName");
  const drillNotesIn = document.getElementById("drillNotes");

  // Built-in starter drills. Now loaded from js/drills.js
  const PRESET_DRILLS = window.PRESET_DRILLS || [];
  let activePreset = null;
  function loadPreset(p) {
    activePreset = p;
    setDrillsMode(true);
    clearDrillItems();
    (p.items || []).forEach(i => addDrillItem(i.kind, i.x, i.y, i.color, i.num, i.id, i.startCone));
    const loadedStrokes = (p.strokes || []).map(s => ({ mode: s.mode, pts: s.pts.map(pt => [pt[0], pt[1]]), ...(s.color ? { color: s.color } : {}), ...(s.from != null ? { from: s.from } : {}) }));
    if (p.steps) {
      drillSteps = p.steps.map(step => step.map(s => ({ mode: s.mode, pts: s.pts.map(pt => [pt[0], pt[1]]), ...(s.color ? { color: s.color } : {}), ...(s.from != null ? { from: s.from } : {}) })));
    } else {
      drillSteps = [loadedStrokes];
    }
    currentStep = 0;
    changeStep(0);
  }

  function drills() { return (store.data && store.data.drills) || []; }
  let currentDrillDiff = "Simple";
  function renderPresetList() {
    const list = document.getElementById("presetList");
    if (!list) return;
    list.innerHTML = "";
    const filtered = (window.PRESET_DRILLS || []).filter(p => (p.difficulty || "").toLowerCase() === (currentDrillDiff || "").toLowerCase());
    for (const p of filtered) {
      const el = document.createElement("div");
      el.className = "rosterItem presetItem";
      
      const details = document.createElement("div");
      details.className = "rosterDetails";
      const nameDiv = document.createElement("div");
      nameDiv.className = "rosterName";
      nameDiv.textContent = p.name;
      const sub = document.createElement("div");
      sub.className = "rosterPos";
      sub.textContent = p.info ? p.info.trains : "";
      
      details.appendChild(nameDiv);
      details.appendChild(sub);
      el.appendChild(details);
      
      const actions = document.createElement("div");
      actions.className = "rosterActions";
      const infoBtn = document.createElement("button");
      infoBtn.className = "iconBtn";
      infoBtn.textContent = "ⓘ";
      infoBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showDrillInfo(p);
      });
      actions.appendChild(infoBtn);
      el.appendChild(actions);
      
      el.addEventListener("click", () => showDrillInfo(p));
      list.appendChild(el);
    }
  }

  document.querySelectorAll(".drillTab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".drillTab").forEach(b => b.classList.remove("on"));
      btn.classList.add("on");
      currentDrillDiff = btn.dataset.diff;
      renderPresetList();
    });
  });
  const drillInfoPanel = document.getElementById("drillInfoPanel");
  function fillList(el, items) {
    el.innerHTML = "";
    (items || []).forEach(t => {
      const li = document.createElement("li");
      li.textContent = t;
      el.appendChild(li);
    });
  }
  function showDrillInfo(p) {
    const info = p.info || {};
    document.getElementById("diTitle").textContent = p.name;
    document.getElementById("diTrains").textContent = info.trains || "";
    document.getElementById("diSetup").textContent = info.setup || "";
    fillList(document.getElementById("diSteps"), info.steps);
    fillList(document.getElementById("diCoaching"), info.coaching);
    const progWrap = document.getElementById("diProgWrap");
    const hasProg = info.progression && info.progression.length;
    progWrap.hidden = !hasProg;
    if (hasProg) fillList(document.getElementById("diProgression"), info.progression);
    const loadBtn = document.getElementById("diLoadBtn");
    loadBtn.onclick = () => {
      loadPreset(p);
      drillInfoPanel.classList.remove("open");
      drillPanel.classList.remove("open");
    };
    drillInfoPanel.classList.add("open");
  }
  document.getElementById("diClose")?.addEventListener("click",
    () => drillInfoPanel.classList.remove("open"));
  document.getElementById("doneDrillPanel")?.addEventListener("click", 
    () => drillPanel.classList.remove("open"));
  drillInfoPanel.addEventListener("click", e => {
    if (e.target === drillInfoPanel) drillInfoPanel.classList.remove("open");
  });
  function renderDrillList() {
    const list = document.getElementById("drillList");
    list.innerHTML = "";
    for (const d of drills()) {
      const row = document.createElement("div");
      row.className = "rrow";
      const rn = document.createElement("div");
      rn.className = "rname"; rn.textContent = d.name;
      const inf = document.createElement("button");
      inf.className = "inf"; inf.textContent = "ⓘ";
      inf.setAttribute("aria-label", "Drill instructions");
      if (d.instructions) inf.classList.add("has");
      inf.addEventListener("click", ev => { ev.stopPropagation(); openDrillEdit(d); });
      const shr = document.createElement("button");
      shr.className = "shr"; shr.textContent = "↗";
      shr.setAttribute("aria-label", "Share drill");
      shr.addEventListener("click", ev => { ev.stopPropagation(); shareDrill(d); });
      const del = document.createElement("button");
      del.className = "del"; del.textContent = "✕";
      del.setAttribute("aria-label", "Delete drill");
      del.addEventListener("click", ev => {
        ev.stopPropagation();
        store.data.drills = drills().filter(x => x.id !== d.id);
        store.save({ drills: store.data.drills });
        renderDrillList();
      });
      row.append(rn, inf, shr, del);
      row.addEventListener("click", () => { loadDrill(d); drillPanel.classList.remove("open"); });
      list.appendChild(row);
    }
  }
  function loadDrill(d) {
    activePreset = d;
    setDrillsMode(true);
    const dpBar = document.getElementById("drillPlayerBar");
    if (dpBar) dpBar.classList.remove("hidden");
    const dpTitle = document.getElementById("dpTitle");
    if (dpTitle) dpTitle.textContent = d.name || "Drill";
    clearDrillItems();
    (d.items || []).forEach(i => addDrillItem(i.kind, i.x, i.y, i.color, i.num, i.id, i.startCone));
    if (d.steps) {
      drillSteps = d.steps.map(step => step.map(unflatStroke));
    } else {
      drillSteps = [(d.strokes || []).map(unflatStroke)];
    }
    currentStep = 0;
    changeStep(0);
  }
  document.getElementById("saveDrillBtn").addEventListener("click", () => {
    const name = drillNameIn.value.trim() || ("Drill " + (drills().length + 1));
    const notes = drillNotesIn.value.trim();
    const d = {
      id: Date.now(),
      name,
      // id is saved so a stroke's `from` binding still names the right piece
      // after the drill is reloaded
      items: drillItems.map(({ kind, x, y, color, num, id, startCone }) => ({ kind, x, y, ...(color ? { color } : {}), ...(num ? { num } : {}), ...(id != null ? { id } : {}), ...(startCone ? { startCone: true } : {}) })),
      strokes: drillSteps.flat().map(flatStroke),
      ...(notes ? { instructions: notes } : {})
    };
    store.data.drills = [...drills(), d];
    store.save({ drills: store.data.drills });
    drillNameIn.value = "";
    drillNotesIn.value = "";
    renderDrillList();
  });


  // Number Selector Logic
  document.addEventListener("click", (e) => {
    const popup = document.getElementById("numSelectorPopup");
    if (popup && !popup.hidden) {
      if (e.target.closest(".num-btn")) {
        const num = e.target.getAttribute("data-num");
        if (popup.activeItem) {
          popup.activeItem.num = num || null;
          // Re-render shape
          popup.activeItem.el.innerHTML = "";
          popup.activeItem.el.appendChild(shapeEl(popup.activeItem.kind, effectiveColor(popup.activeItem.kind, popup.activeItem.color), popup.activeItem.num));
        }
        popup.hidden = true;
      } else if (!e.target.closest("#numSelectorPopup")) {
        // anything outside the popup closes it — including another piece, which
        // previously left it open (and seemingly frozen) while it reopened
        popup.hidden = true;
      }
    }
  });

  // Drill Navigation Logic
  document.getElementById("dpPrevDrill")?.addEventListener("click", () => {
    if (!activePreset) return;
    const catDrills = PRESET_DRILLS.filter(d => d.difficulty === activePreset.difficulty);
    const idx = catDrills.indexOf(activePreset);
    if (idx > 0) loadPreset(catDrills[idx - 1]);
  });
  document.getElementById("dpNextDrill")?.addEventListener("click", () => {
    if (!activePreset) return;
    const catDrills = PRESET_DRILLS.filter(d => d.difficulty === activePreset.difficulty);
    const idx = catDrills.indexOf(activePreset);
    if (idx < catDrills.length - 1) loadPreset(catDrills[idx + 1]);
  });
  // view / edit a saved drill's instructions
  const drillEditPanel = document.getElementById("drillEditPanel");
  const deNotes = document.getElementById("deNotes");
  let editingDrill = null;
  function openDrillEdit(d) {
    editingDrill = d;
    document.getElementById("deTitle").textContent = d.name;
    deNotes.value = d.instructions || "";
    drillEditPanel.classList.add("open");
  }
  document.getElementById("deSaveBtn").addEventListener("click", () => {
    if (!editingDrill) return;
    const notes = deNotes.value.trim();
    const d = drills().find(x => x.id === editingDrill.id);
    if (d) {
      if (notes) d.instructions = notes; else delete d.instructions;
      store.save({ drills: store.data.drills });
    }
    drillEditPanel.classList.remove("open");
    renderDrillList();
  });
  document.getElementById("deLoadBtn").addEventListener("click", () => {
    if (editingDrill) loadDrill(editingDrill);
    drillEditPanel.classList.remove("open");
    drillPanel.classList.remove("open");
  });
  /* Copy the drill's raw layout to the clipboard. Drills only exist inside this
     account's Firestore document, so this is the one way to get one out of the
     app — to send it on, or to hand it over when a drill is misbehaving. */
  document.getElementById("deCopyBtn")?.addEventListener("click", async (e) => {
    if (!editingDrill) return;
    const d = drills().find(x => x.id === editingDrill.id) || editingDrill;
    const txt = JSON.stringify({
      name: d.name,
      items: (d.items || []).map(i => ({
        kind: i.kind, x: +(+i.x).toFixed(3), y: +(+i.y).toFixed(3),
        ...(i.num != null ? { num: i.num } : {}),
        ...(i.color ? { color: i.color } : {}),
        ...(i.startCone ? { startCone: true } : {})
      })),
      // strokes are stored flattened for Firestore; unflatten so the points are
      // readable as [x,y] pairs
      strokes: (d.strokes || []).map(st => ({
        mode: st.mode, ...(st.color ? { color: st.color } : {}),
        pts: unflatStroke(st).pts.map(pt => [+pt[0].toFixed(3), +pt[1].toFixed(3)])
      })),
      ...(d.instructions ? { instructions: d.instructions } : {})
    }, null, 1);
    const btn = e.currentTarget, was = btn.textContent;
    try {
      await navigator.clipboard.writeText(txt);
      btn.textContent = "Copied";
    } catch (_) {
      // clipboard is blocked outside a secure context / older iOS
      const ta = document.createElement("textarea");
      ta.value = txt; ta.style.cssText = "position:fixed;top:50%;left:4%;width:92%;height:40%;z-index:9999";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); btn.textContent = "Copied"; }
      catch (__) { btn.textContent = "Select and copy"; }
      setTimeout(() => ta.remove(), 6000);
    }
    setTimeout(() => { btn.textContent = was; }, 2000);
  });
  document.getElementById("deClose")?.addEventListener("click", () => drillEditPanel.classList.remove("open"));
  drillEditPanel.addEventListener("click", e => { if (e.target === drillEditPanel) drillEditPanel.classList.remove("open"); });
  document.getElementById("drillLibBtn").addEventListener("click", () => {
    renderPresetList();
    renderDrillList();
    drillPanel.classList.add("open");
  });
  document.getElementById("closeDrills")?.addEventListener("click", () => drillPanel.classList.remove("open"));
  drillPanel.addEventListener("click", e => { if (e.target === drillPanel) drillPanel.classList.remove("open"); });

  /* ---------------- share as image ---------------- */
  function drawPitchPNG(c, W, H) {
    const bandH = H / 12;
    for (let i = 0; i < 12; i++) {
      c.fillStyle = i % 2 ? "#297042" : "#2e7c4a";
      c.fillRect(0, i * bandH, W, bandH + 1);
    }
    const sx = W / 68, sy = H / 105;
    c.strokeStyle = "rgba(255,255,255,.9)";
    c.fillStyle = "rgba(255,255,255,.9)";
    c.lineWidth = Math.max(2, W * 0.004);
    c.strokeRect(1 * sx, 1 * sy, 66 * sx, 103 * sy);
    c.beginPath(); c.moveTo(1 * sx, 52.5 * sy); c.lineTo(67 * sx, 52.5 * sy); c.stroke();
    c.beginPath(); c.arc(34 * sx, 52.5 * sy, 9.15 * sx, 0, 7); c.stroke();
    c.beginPath(); c.arc(34 * sx, 52.5 * sy, 2.5, 0, 7); c.fill();
    [[1, 1], [104, -1]].forEach(([edge, dir]) => {
      const top = dir > 0 ? edge : edge - 16.5;
      c.strokeRect((34 - 20.16) * sx, top * sy, 40.32 * sx, 16.5 * sy);
      const top2 = dir > 0 ? edge : edge - 5.5;
      c.strokeRect((34 - 9.16) * sx, top2 * sy, 18.32 * sx, 5.5 * sy);
      c.beginPath(); c.arc(34 * sx, (edge + dir * 11) * sy, 2.5, 0, 7); c.fill();
    });
  }
  function drawStrokePNG(c, W, H, s) {
    if (!s.pts || s.pts.length < 2) return;
    c.strokeStyle = s.color || "rgba(255,255,255,.95)";
    c.lineWidth = W * 0.008; c.lineCap = "round"; c.lineJoin = "round";
    c.setLineDash(s.mode === "pass" ? [W * 0.022, W * 0.02] : []);
    let pts = s.pts;
    if (s.mode === "dribble") {
      const fake = { width: W, height: H };
      pts = wavyPoints(s.pts, fake);
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    } else {
      c.beginPath(); c.moveTo(pts[0][0] * W, pts[0][1] * H);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0] * W, pts[i][1] * H);
    }
    c.stroke(); c.setLineDash([]);
    // pass omitted deliberately — no arrowhead on a pass line (see redraw())
    if (["run", "dribble"].includes(s.mode)) {
      const raw = s.pts, n = raw.length;
      const a = raw[Math.max(0, n - 6)], b = raw[n - 1];
      const bx = b[0] * W, by = b[1] * H;
      const ang = Math.atan2(by - a[1] * H, bx - a[0] * W);
      const L = W * 0.028;
      c.beginPath();
      c.moveTo(bx - L * Math.cos(ang - .5), by - L * Math.sin(ang - .5));
      c.lineTo(bx, by);
      c.lineTo(bx - L * Math.cos(ang + .5), by - L * Math.sin(ang + .5));
      c.stroke();
    }
  }
  function tokenPNG(c, W, x, y, r, fill, ink, label, name) {
    c.beginPath(); c.arc(x, y, r, 0, 7);
    c.fillStyle = fill; c.fill();
    c.lineWidth = Math.max(1.5, r * 0.09); c.strokeStyle = "rgba(0,0,0,.25)"; c.stroke();
    c.fillStyle = ink; c.font = `700 ${Math.round(r * 0.82)}px 'Barlow Condensed',sans-serif`;
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(label, x, y + r * 0.05);
    if (name) {
      c.font = `600 ${Math.round(r * 0.75)}px 'Barlow Condensed',sans-serif`;
      c.fillStyle = "#fff";
      c.shadowColor = "rgba(0,0,0,.8)"; c.shadowBlur = 4;
      c.fillText(name, x, y + r * 1.85);
      c.shadowBlur = 0;
    }
  }
  function makeShareCanvas(title, subtitle, footerHeight = 0) {
    const W = 1080, HEAD = 180, H = Math.round(W * 105 / 68);
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H + HEAD + footerHeight;
    const c = cv.getContext("2d");
    c.fillStyle = "#101411"; c.fillRect(0, 0, W, cv.height);
    c.fillStyle = "#ffd60a"; c.textAlign = "left"; c.textBaseline = "middle";
    c.font = "700 68px 'Barlow Condensed',sans-serif";
    c.fillText(title.toUpperCase(), 40, HEAD / 2 - (subtitle ? 24 : 0));
    if (subtitle) {
      c.fillStyle = "#95a09a"; c.font = "600 36px 'Barlow Condensed',sans-serif";
      c.fillText(subtitle, 40, HEAD / 2 + 36);
    }
    c.translate(0, HEAD);
    return { cv, c, W, H };
  }
  async function shareCanvas(cv, filename, title) {
    const blob = await new Promise(res => cv.toBlob(res, "image/png"));
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); return; } catch (e) {
        if (e.name === "AbortError") return; // user cancelled
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  // sharing is an account feature; nudge guests to create one
  function guestShareBlocked() {
    if (!store.guestMode) return false;
    alert("Sharing needs a free account. Create one to share team sheets and drills.");
    return true;
  }
  async function shareTeamSheet() {
    if (guestShareBlocked()) return;
    const b = bstate();
    
    // Calculate dynamic footer height based on substitutes
    const offPitch = roster().filter(p => !b.placed[p.id]);
    const benchList = offPitch.filter(p => !isOut(p.id));
    const outList = offPitch.filter(p => isOut(p.id));

    let footerHeight = 0;
    if (benchList.length > 0) {
      footerHeight += 70 + 65 + Math.ceil(benchList.length / 2) * 50 + 40;
    }
    if (outList.length > 0) {
      if (footerHeight === 0) footerHeight += 70;
      footerHeight += 65 + Math.ceil(outList.length / 2) * 50 + 40;
    }
    if (footerHeight > 0) footerHeight += 20;

    const teamName = store.data.teamName || "My team";
    const g = (store.data && store.data.gameday) || {};
    let sub = b.formation + "  ·  " + b.squad + " v " + b.squad;
    if (g.opp) sub += "  ·  vs " + g.opp;
    if (g.date) {
      const d = new Date(g.date + "T" + (g.time || "00:00"));
      if (!isNaN(d)) sub += "  ·  " + d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) +
        (g.time ? " " + g.time : "");
    }
    const { cv, c, W, H } = makeShareCanvas(teamName, sub, footerHeight);
    drawPitchPNG(c, W, H);
    const cur = (currentView === "team" || currentView === "game") ? strokes : strokeBufs.team;
    cur.forEach(s => drawStrokePNG(c, W, H, s));
    const r = W * 0.032;
    const showNames = b.showNames !== false;
    const col = colors();
    if (b.showOpp) {
      oppTokens.forEach(el => {
        const x = parseFloat(el.style.left) / 100 * W;
        const y = parseFloat(el.style.top) / 100 * H;
        tokenPNG(c, W, x, y, r, col.opp, inkFor(col.opp), el.childNodes[0].textContent || "");
      });
    }
    for (const p of roster()) {
      const pos = b.placed[p.id]; if (!pos) continue;
      tokenPNG(c, W, pos.x * W, pos.y * H, r, col.team, inkFor(col.team), p.pos,
        showNames ? firstName(p.name) : null);
    }
    if (ballToken) {
      const x = parseFloat(ballToken.style.left) / 100 * W;
      const y = parseFloat(ballToken.style.top) / 100 * H;
      c.beginPath(); c.arc(x, y, r * 0.55, 0, 7); c.fillStyle = "#fff"; c.fill();
    }
    
    // Draw Substitutes in the footer
    
    c.translate(0, H); // move down into the footer area
    
    let currentY = 70;
    const leftX = 60;
    const rightX = W / 2 + 30;
    
    c.textAlign = "left";
    c.textBaseline = "top";
    
    function drawSection(title, list) {
      if (list.length === 0) return;
      c.fillStyle = "#ffd60a";
      c.font = "700 36px 'Barlow Condensed',sans-serif";
      c.fillText(title, leftX, currentY);
      
      currentY += 65;
      
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const colX = (i % 2 === 0) ? leftX : rightX;
        
        c.fillStyle = "#95a09a";
        c.font = "700 32px 'Barlow Condensed',sans-serif";
        c.fillText(p.pos, colX, currentY);
        
        c.fillStyle = "#ffffff";
        c.font = "600 32px 'Barlow Condensed',sans-serif";
        c.fillText(p.name, colX + 80, currentY);
        
        if (i % 2 !== 0 || i === list.length - 1) currentY += 50;
      }
      currentY += 40;
    }
    
    drawSection("BENCH", benchList);
    drawSection("OUT", outList);
    
    await shareCanvas(cv, teamName.replace(/\s+/g, "-").toLowerCase() + "-lineup.png", teamName + " line-up");
  }
  function drillPiecePNG(c, W, kind, x, y, color, num) {
    const u = W * 0.016; // base unit
    c.save(); c.translate(x, y);
    if (kind === "cone") {
      c.fillStyle = color || "#ff8a14";
      c.beginPath(); c.moveTo(0, -u); c.lineTo(u * .9, u); c.lineTo(-u * .9, u); c.closePath(); c.fill();
    } else if (kind === "disc") {
      c.fillStyle = color || "#ffd60a"; c.beginPath(); c.arc(0, 0, u * .8, 0, 7); c.fill();
      c.lineWidth = 3;
      c.strokeStyle = (color && color.toLowerCase() === "#ffffff") ? "rgba(0,0,0,.28)" : "rgba(255,255,255,.55)";
      c.stroke();
    } else if (kind === "pole") {
      c.fillStyle = "#ff453a"; c.fillRect(-u * .18, -u * 1.4, u * .36, u * 2.8);
      c.fillStyle = "#fff";
      c.fillRect(-u * .18, -u * .9, u * .36, u * .5);
      c.fillRect(-u * .18, u * .1, u * .36, u * .5);
    } else if (kind === "dball") {
      c.fillStyle = "#fff"; c.beginPath(); c.arc(0, 0, u * .8, 0, 7); c.fill();
      c.fillStyle = "#111"; c.beginPath(); c.arc(0, 0, u * .3, 0, 7); c.fill();
    } else if (kind === "att" || kind === "def") {
      c.fillStyle = color || (kind === "att" ? colors().team : colors().opp);
      c.beginPath(); c.arc(0, 0, u, 0, 7); c.fill();
      c.lineWidth = 2.5; c.strokeStyle = "rgba(0,0,0,.25)"; c.stroke();
      if (num) {
        c.fillStyle = "#fff";
        c.font = `bold ${u*1.1}px sans-serif`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(num, 0, 0);
      }
    } else if (kind === "goal" || kind === "mini") {
      const w = kind === "goal" ? u * 4 : u * 2.4, h = kind === "goal" ? u * 1.6 : u * 1.1;
      c.lineWidth = kind === "goal" ? 6 : 4;
      c.strokeStyle = kind === "goal" ? "#fff" : "#ffa02e";
      c.beginPath();
      c.moveTo(-w / 2, h / 2); c.lineTo(-w / 2, -h / 2); c.lineTo(w / 2, -h / 2); c.lineTo(w / 2, h / 2);
      c.stroke();
    }
    c.restore();
  }
  async function shareDrill(d) {
    if (guestShareBlocked()) return;
    const { cv, c, W, H } = makeShareCanvas(d.name, (store.data.teamName || "") + "  ·  drill");
    drawPitchPNG(c, W, H);
    (d.strokes || []).map(unflatStroke).forEach(s => drawStrokePNG(c, W, H, s));
    (d.items || []).forEach(i => drillPiecePNG(c, W, i.kind, i.x * W, i.y * H, i.color, i.num));
    await shareCanvas(cv, d.name.replace(/\s+/g, "-").toLowerCase() + "-drill.png", d.name);
  }

  /* ---------------- game day: details ---------------- */
  function gday() {
    if (!store.data.gameday)
      store.data.gameday = { date: "", time: "", opp: "", notes: "", lineup: null, score: { us: 0, them: 0 } };
    return store.data.gameday;
  }
  let gdaySaveTimer = null;
  function saveGday() { store.save({ gameday: gday() }); }
  // scoreboard (game view)
  function gscore() { const g = gday(); if (!g.score) g.score = { us: 0, them: 0 }; return g.score; }
  function renderScore() {
    const s = gscore();
    document.getElementById("scoreUs").textContent = s.us || 0;
    document.getElementById("scoreThem").textContent = s.them || 0;
    document.getElementById("scoreUsName").textContent = (store.data.teamName || "Us");
    document.getElementById("scoreThemName").textContent = (gday().opp || "Opp");
  }
  document.querySelectorAll("#scoreBar button").forEach(btn => {
    btn.addEventListener("click", () => {
      const s = gscore(), team = btn.dataset.team, d = parseInt(btn.dataset.d, 10);
      s[team] = Math.max(0, (s[team] || 0) + d);
      renderScore();
      saveGday();
    });
  });
  [["gDate", "date"], ["gTime", "time"], ["gOpp", "opp"], ["gNotes", "notes"]].forEach(([id, key]) => {
    const el = document.getElementById(id);
    el.addEventListener("input", () => {
      gday()[key] = el.value;
      clearTimeout(gdaySaveTimer);
      gdaySaveTimer = setTimeout(saveGday, 700);
    });
  });
  function renderGameday() {
    const g = gday();
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (document.activeElement !== el) el.value = v || "";
    };
    set("gDate", g.date); set("gTime", g.time); set("gOpp", g.opp); set("gNotes", g.notes);
    document.getElementById("gLineupInfo").textContent = g.lineup
      ? `Captured ${new Date(g.lineup.at).toLocaleString()} · ${g.lineup.formation} (${g.lineup.squad} v ${g.lineup.squad}) — tap the pitch to open it on the board`
      : "Showing the current board — capture it to save this game's line-up. Tap the pitch to edit.";
    document.getElementById("gRestore").hidden = !g.lineup;
    const gameChip = document.getElementById("gameChip");
    gameChip.textContent = g.opp ? "vs " + g.opp : "Game day";
    document.getElementById("gameCfgChip").hidden = false; // CSS limits the bar to the game view
    renderScore();
    renderGamePitch();
  }
  const gamePanel = document.getElementById("gamePanel");
  function openGameCfg() {
    renderGameday();
    gamePanel.classList.add("open");
  }
  function closeGameCfg() { gamePanel.classList.remove("open"); }
  document.getElementById("gameChip").addEventListener("click", openGameCfg);
  document.getElementById("gameCfgChip").addEventListener("click", openGameCfg);
  document.getElementById("closeGame")?.addEventListener("click", closeGameCfg);
  gamePanel.addEventListener("click", e => { if (e.target === gamePanel) closeGameCfg(); });
  document.getElementById("gSaveBtn").addEventListener("click", () => {
    upsertCurrentGame();
    renderGameday();          // chips reflect the saved game
    const btn = document.getElementById("gSaveBtn");
    btn.textContent = "Saved ✓";
    setTimeout(() => {
      btn.textContent = "Save game";
      closeGameCfg();         // back to whichever pitch you came from
    }, 700);
  });
  function renderGamePitch() {
    const cv = document.getElementById("gPitchPreview");
    if (!cv || !cv.getContext) return;
    const g = gday(), b = bstate();
    const placed = g.lineup ? g.lineup.placed : b.placed;
    const W = 460, H = Math.round(W * 105 / 68);
    cv.width = W; cv.height = H;
    const c = cv.getContext("2d");
    if (!c || !c.fillRect) return;
    drawPitchPNG(c, W, H);
    const r = W * 0.04;
    const col = colors();
    for (const p of roster()) {
      const pos = placed[p.id]; if (!pos) continue;
      tokenPNG(c, W, pos.x * W, pos.y * H, r, col.team, inkFor(col.team), p.pos);
    }
  }
  function restoreLineup() {
    closeGameCfg();
    if (currentView !== "game") setView("game");
    else { applyGameLineup(); renderAll(); }
  }
  document.getElementById("gRestore").addEventListener("click", restoreLineup);
  document.getElementById("gPitchPreview").addEventListener("click", restoreLineup);

  /* ---------------- saved games library ---------------- */
  const gamesPanel = document.getElementById("gamesPanel");
  function games() { return (store.data && store.data.games) || []; }
  function gameLabel(g) {
    let d = "";
    if (g.date) {
      const dt = new Date(g.date + "T00:00");
      if (!isNaN(dt)) d = dt.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    }
    return (g.opp ? "vs " + g.opp : "Game") + (d ? " · " + d : "") + (g.time ? " " + g.time : "");
  }
  function upsertCurrentGame() {
    const g = gday();
    if (!g.opp && !g.date && !g.notes && !g.lineup) return; // nothing worth saving
    if (!g.id) g.id = Date.now();
    const list = games().filter(x => x.id !== g.id);
    list.push(JSON.parse(JSON.stringify(g)));
    list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    store.data.games = list;
    store.save({ games: list });
  }
  function renderGamesList() {
    const list = document.getElementById("gamesList");
    list.innerHTML = "";
    for (const g of games()) {
      const row = document.createElement("div");
      row.className = "rrow";
      const rn = document.createElement("div");
      rn.className = "rname"; rn.textContent = gameLabel(g);
      const del = document.createElement("button");
      del.className = "del"; del.textContent = "✕";
      del.setAttribute("aria-label", "Delete game");
      del.addEventListener("click", ev => {
        ev.stopPropagation();
        store.data.games = games().filter(x => x.id !== g.id);
        store.save({ games: store.data.games });
        renderGamesList();
      });
      row.append(rn, del);
      row.addEventListener("click", () => {
        if (currentView === "game") syncBoardToLineup(); // keep edits to the game being left
        upsertCurrentGame();   // archive it
        store.data.gameday = JSON.parse(JSON.stringify(g));
        saveGday();
        renderGameday();
        gamesPanel.classList.remove("open");
        // straight to this game's pitch; details sit behind the … chip
        if (currentView === "game") { applyGameLineup(); renderAll(); redraw(); }
        else setView("game");
      });
      list.appendChild(row);
    }
    if (!games().length) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "No saved games yet.";
      list.appendChild(empty);
    }
  }
  document.getElementById("newGameBtn").addEventListener("click", () => {
    if (currentView === "game") syncBoardToLineup();
    upsertCurrentGame();   // archive the current one first
    setView("team");
    store.data.gameday = { date: "", time: "", opp: "", notes: "", lineup: null };
    saveGday();
    renderGameday();
    gamesPanel.classList.remove("open");
    openGameCfg();         // straight into the setup form
  });
  document.getElementById("closeGames")?.addEventListener("click", () => gamesPanel.classList.remove("open"));
  gamesPanel.addEventListener("click", e => { if (e.target === gamesPanel) gamesPanel.classList.remove("open"); });
  document.getElementById("gCapture").addEventListener("click", () => {
    const b = bstate();
    gday().lineup = {
      formation: b.formation, squad: b.squad,
      placed: JSON.parse(JSON.stringify(b.placed)), at: Date.now()
    };
    saveGday(); renderGameday();
  });
  document.getElementById("gShare").addEventListener("click", () => shareTeamSheet());

  /* ---------------- game timer ---------------- */
  const TKEY = "spbGameTimer";
  let gt = { running: false, startAt: 0, period: 1, base: {}, cfg: { periods: 2, mins: 30 } };
  try {
    const t = JSON.parse(localStorage.getItem(TKEY));
    if (t && t.cfg && t.base) gt = t;
  } catch (e) {}
  const timerDisplay = document.getElementById("timerDisplay");
  const timerMeta = document.getElementById("timerMeta");
  const timerChip = document.getElementById("timerChip");
  const timerStartBtn = document.getElementById("timerStart");
  const cfgPeriods = document.getElementById("cfgPeriods");
  const cfgMinutes = document.getElementById("cfgMinutes");

  function gtSave() { try { localStorage.setItem(TKEY, JSON.stringify(gt)); } catch (e) {} }
  function gtElapsed() { return (gt.base[gt.period] || 0) + (gt.running ? Date.now() - gt.startAt : 0); }
  function fmt(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }
  let audioCtx = null;
  function beep(n = 2) {
    if (n > 0) try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < n; i++) {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.connect(g); g.connect(audioCtx.destination);
        o.frequency.value = 880; g.gain.value = 0.25;
        const t0 = audioCtx.currentTime + i * 0.3;
        o.start(t0); o.stop(t0 + 0.18);
      }
    } catch (e) {}
    else try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    if (n > 0 && navigator.vibrate) navigator.vibrate([220, 90, 220]);
  }
  const plabel = () => gt.cfg.periods === 4 ? "Q" : "H";
  function renderPeriodSeg() {
    const cont = document.getElementById("periodSeg");
    cont.innerHTML = "";
    for (let i = 1; i <= gt.cfg.periods; i++) {
      const b = document.createElement("button");
      b.textContent = plabel() + i;
      b.classList.toggle("on", gt.period === i);
      b.addEventListener("click", () => {
        if (gt.running) { gt.base[gt.period] = gtElapsed(); gt.running = false; }
        gt.period = i;
        gtSave(); renderPeriodSeg(); gtTick();
      });
      cont.appendChild(b);
    }
  }
  function gtTick() {
    const endMs = gt.cfg.mins * 60000;
    let el = gtElapsed();
    if (gt.running && el >= endMs) {
      gt.running = false; gt.base[gt.period] = endMs; el = endMs;
      beep(4); gtSave();
    }
    const ended = el >= endMs;
    timerDisplay.textContent = fmt(el);
    timerDisplay.classList.toggle("alerting", ended);
    timerMeta.textContent = ended
      ? `End of ${plabel()}${gt.period}`
      : `${plabel()}${gt.period} · ${fmt(el)} of ${gt.cfg.mins}:00`;
    timerStartBtn.textContent = gt.running ? "Pause" : (el > 0 && !ended ? "Resume" : "Start");
    timerChip.hidden = false;
    timerChip.textContent = `${gt.running ? "⏸" : "▶"} ${plabel()}${gt.period} ${fmt(el)}`;
    timerChip.classList.toggle("live", gt.running);
  }
  function gtToggle() {
    const endMs = gt.cfg.mins * 60000;
    if (!gt.running && gtElapsed() >= endMs) return;
    if (gt.running) { gt.base[gt.period] = gtElapsed(); gt.running = false; }
    else { gt.running = true; gt.startAt = Date.now(); beep(0); }
    gtSave(); gtTick();
  }
  timerStartBtn.addEventListener("click", gtToggle);
  document.getElementById("timerReset").addEventListener("click", () => {
    gt = { running: false, startAt: 0, period: 1, base: {}, cfg: gt.cfg };
    gtSave(); renderPeriodSeg(); gtTick();
  });
  cfgPeriods.addEventListener("change", () => {
    gt.cfg.periods = +cfgPeriods.value;
    if (gt.period > gt.cfg.periods) gt.period = gt.cfg.periods;
    gtSave(); renderPeriodSeg(); gtTick();
  });
  cfgMinutes.addEventListener("change", () => {
    gt.cfg.mins = Math.max(1, +cfgMinutes.value || 30);
    gtSave(); gtTick();
  });
  cfgPeriods.value = String(gt.cfg.periods);
  cfgMinutes.value = String(gt.cfg.mins);
  timerChip.addEventListener("click", gtToggle);

  /* ---------------- subs timer (independent) ---------------- */
  const SKEY = "spbSubsTimer";
  let st = { running: false, startAt: 0, base: 0, int: 10 };
  try {
    const t = JSON.parse(localStorage.getItem(SKEY));
    if (t && t.int) st = t;
  } catch (e) {}
  const subsDisplay = document.getElementById("subsDisplay");
  const subsChip = document.getElementById("subsChip");
  const subsStartBtn = document.getElementById("subsStart");
  const cfgSubInt = document.getElementById("cfgSubInt");

  function stSave() { try { localStorage.setItem(SKEY, JSON.stringify(st)); } catch (e) {} }
  function stRemaining() {
    const el = st.base + (st.running ? Date.now() - st.startAt : 0);
    return st.int * 60000 - el;
  }
  function stTick() {
    let rem = stRemaining();
    if (st.running && rem <= 0) {
      beep(3);
      st.base = 0; st.startAt = Date.now();   // roll straight into the next interval
      stSave();
      rem = stRemaining();
      subsChip.classList.add("subsDue");
      setTimeout(() => subsChip.classList.remove("subsDue"), 8000);
    }
    subsDisplay.textContent = fmt(rem);
    subsStartBtn.textContent = st.running ? "Pause" : (st.base > 0 ? "Resume" : "Start");
    subsChip.hidden = false;
    subsChip.textContent = `${st.running ? "⏸" : "▶"} Subs ${fmt(rem)}`;
    subsChip.classList.toggle("live", st.running);
  }
  function stToggle() {
    if (st.running) { st.base += Date.now() - st.startAt; st.running = false; }
    else {
      st.int = Math.max(1, +cfgSubInt.value || st.int || 10);
      st.running = true; st.startAt = Date.now();
      beep(0);
    }
    stSave(); stTick();
  }
  subsStartBtn.addEventListener("click", stToggle);
  document.getElementById("subsReset").addEventListener("click", () => {
    st = { running: false, startAt: 0, base: 0, int: st.int };
    stSave(); stTick();
  });
  cfgSubInt.addEventListener("change", () => {
    st.int = Math.max(1, +cfgSubInt.value || 10);
    st.base = 0; stSave(); stTick();
  });
  cfgSubInt.value = String(st.int);
  subsChip.addEventListener("click", stToggle);

  setInterval(() => { gtTick(); stTick(); }, 500);
  renderPeriodSeg();

  /* ---------------- remote updates ---------------- */
  store.subscribe(() => {
    if (dragging) return;      // do not fight the coach's thumb
    renderAll();
    renderGameday();
  });

  /* ---------------- drill animation ---------------- */
  let drillTimeline = null;
  const playDrillBtn = document.getElementById("playDrillBtn");
  const playDrillGlyph = document.getElementById("playDrillGlyph");
  const playDrillLabel = document.getElementById("playDrillLabel");

  let loopModeActive = false;
  let currentState = null;

  function stopDrillAnim() {
    if (drillTimeline) {
      drillTimeline.pause();
      drillTimeline = null;
    }
    // reset positions
    drillItems.forEach(item => {
      setPos(item.el, item.x, item.y);
      item.el.style.transform = '';
    });
    currentState = null;
    if (playDrillGlyph) playDrillGlyph.textContent = "▶";
    if (playDrillLabel) playDrillLabel.textContent = "Play";
    if (playDrillBtn) playDrillBtn.classList.remove("on");
  }
  
  function onTimelineComplete() {
    if (loopModeActive) {
      buildTimeline(false); // Loop without resetting
    } else {
      stopDrillAnim();
    }
  }

  function startDrillAnim() {
    if (drillTimeline) {
      stopDrillAnim();
      return;
    }
    buildTimeline(true); // Initial play always resets
  }

  /* ============ DRILL ROTATION ============
     A drill is a CIRCUIT plus a QUEUE, not a cloud of pieces to be guessed at.

       circuit — the pieces the coach's strokes move, in stroke order. With
                 bound strokes this is exact; legacy drills fall back to the
                 proximity match in buildTimeline, which yields the same list.
       queue   — every other numbered player, in number order.

     One lap advances everyone by one place:
       front of queue      -> the first circuit slot
       each queue member   -> the place of the player ahead
       last circuit runner -> the slot at the back of the queue

     Because every player inherits an EXISTING slot, the layout is preserved
     exactly over repeated loops, and there are no distance thresholds to tune.
     This replaced ~190 lines of geometric queue detection. */
  /* ============ STATIONS ============
     Every cone/marker is a STATION with its own queue: the players standing at
     and behind it, ordered by distance from the cone. Each drawn leg says
     "front of station A travels to station B", and the arriving player joins
     the BACK of B's queue.

     This one rule covers both shapes without detecting anything:
       square circuit — 4 stations with a queue of one each, plus the long
                        feeding queue at the start cone;
       facing lines   — 2 stations with long queues, players shuttling between
                        them and joining the opposite back.
     Lanes need no special handling either: legs and stations are local, so two
     drills side by side simply never reference each other's stations. */
  function rotateDrill(state, startPos, legs, pieceTime, rect) {
    if (!legs.length) return;

    const stationItems = state.filter(st => st.item.kind === "cone" || st.item.kind === "disc");
    if (!stationItems.length) return;          // no stations: nothing to rotate around

    const stations = stationItems.map(st => ({
      p: startPos.get(st.item) || { x: st.x, y: st.y }, queue: [], slots: []
    }));
    const nearest = p => {
      let best = null, bd = Infinity;
      stations.forEach(s => {
        const d = Math.hypot(s.p.x - p.x, s.p.y - p.y);
        if (d < bd) { bd = d; best = s; }
      });
      return best;
    };

    // every player belongs to the station they started nearest to
    state.forEach(st => {
      if (!isPlayerKind(st.item.kind)) return;
      const sp = startPos.get(st.item); if (!sp) return;
      const s = nearest(sp); if (s) s.queue.push(st);
    });
    // front of the queue = closest to the cone; slots keep the line's own geometry
    stations.forEach(s => {
      s.queue.sort((a, b) => {
        const pa = startPos.get(a.item), pb = startPos.get(b.item);
        return Math.hypot(pa.x - s.p.x, pa.y - s.p.y) - Math.hypot(pb.x - s.p.x, pb.y - s.p.y);
      });
      s.slots = s.queue.map(st => startPos.get(st.item));
    });

    // apply the legs: the traveller leaves its station and joins the destination
    const departed = new Set();
    const arrivals = new Map();
    legs.forEach(leg => {
      const src = nearest({ x: leg.from[0], y: leg.from[1] });
      const dst = nearest({ x: leg.to[0],   y: leg.to[1] });
      if (!src || !dst || src === dst) return;
      const st = state.find(o => o.item === leg.item); if (!st) return;
      departed.add(leg.item);
      if (!arrivals.has(dst)) arrivals.set(dst, []);
      arrivals.get(dst).push(st);
    });
    if (!departed.size) return;

    // re-lay each queue: those who stayed shuffle forward, arrivals take the back
    stations.forEach(s => {
      const survivors = s.queue.filter(st => !departed.has(st.item));
      const finalQ = survivors.concat(arrivals.get(s) || []);
      finalQ.forEach((st, i) => {
        let slot = s.slots[i];
        if (!slot) {                            // queue longer than we have slots
          const n = s.slots.length;
          const a = s.slots[n - 1], b = s.slots[n - 2] || s.p;
          if (!a) return;
          slot = { x: a.x + (a.x - b.x) * (i - n + 1), y: a.y + (a.y - b.y) * (i - n + 1) };
        }
        if (Math.hypot(st.x - slot.x, st.y - slot.y) < 0.005) return;
        const t = pieceTime.get(st.item) || 0;
        drillTimeline.add({
          targets: st.item.el,
          keyframes: [{ left: (slot.x * rect.width) + "px", top: (slot.y * rect.height) + "px" }],
          duration: 700,
          easing: "linear"
        }, t + 100);
        st.x = slot.x; st.y = slot.y;
        pieceTime.set(st.item, t + 100 + 700);
      });
    });
  }

  function buildTimeline(resetPositions) {
    if (!drillsMode || drillSteps.length === 0) return;
    
    // seed positions in px so they match the px keyframes below
    if (resetPositions || !currentState) {
      currentState = drillItems.map(item => ({ item, x: item.x, y: item.y }));
      drillItems.forEach(item => {
        setPosPx(item.el, item.x, item.y);
        item.el.style.transform = '';
      });
    } else {
      // In a loop, apply the final transforms from the previous loop as actual DOM positions!
      currentState.forEach(st => {
         setPosPx(st.item.el, st.x, st.y);
         st.item.el.style.transform = '';
      });
    }

    drillTimeline = anime.timeline({
      easing: 'linear',
      complete: onTimelineComplete
    });

    let hasAnyAnimation = false;
    let pieceTime = new Map();
    // remember where everything started: the rotation pass at the end needs the
    // queue's original geometry to work out where "the back" is
    const startPos = new Map();
    currentState.forEach(st => {
      pieceTime.set(st.item, 0); st.hasMoved = false;
      startPos.set(st.item, { x: st.x, y: st.y });
    });
    
    const allStrokes = drillSteps.flat();
    const legs = [];              // {item, from:[x,y], to:[x,y]} in stroke order
    const plan = [];              // one entry per animated leg, timed in pass B
    const DEP_TOL = 0.08;         // "these two points are the same place"
    /* A pass is already allowed to be STRUCK by a ball up to 0.15 away (see the
       actor-resolution threshold below) because nobody draws a line exactly on
       the ball. The "pass before you go" rule has to be equally forgiving, or
       the engine binds a pass to a player and then lets that same player run
       off before playing it — which is what emptied the left lane of complex3. */
    const LOOSE_TOL = 0.15;
    const LEG_GAP = 150;          // breath between a leg finishing and the next

    /* ---- PASS A — WHO does WHAT, and WHERE it ends -------------------
       Walked in draw order because working out the actor depends on where
       everything has got to by this point in the sequence. No timing is
       decided here: a leg's start can depend on a leg drawn LATER (a runner
       meeting a pass), so the clock is resolved separately in pass B. */

    allStrokes.forEach(stroke => {
        if (stroke.pts.length < 2) return;
        const startPt = stroke.pts[0];
        let closest = null;
        /* A leg belongs to a SLOT, not to a player. Whoever is standing on the
           leg's start position right now performs it — that is what makes the
           drill keep looping: after one rotation player 5 is on cone 1, so
           player 5 runs the cone1->cone2 leg, not player 1.
           `stroke.from` is deliberately NOT used to choose the actor: pinning a
           leg to one player is exactly what stopped the rotation continuing. It
           is kept in the data only to record what the coach drew. */
        const pref = (stroke.mode === "pass") ? ["dball"] :
                     (stroke.mode === "run" || stroke.mode === "dribble" || stroke.mode === "passrun") ? ["att", "def"] : [];

        let candidates = [];
        currentState.forEach(st => {
           const isPref = pref.includes(st.item.kind);
           // player-moving legs must never grab a cone standing on the same spot
           if (pref.length && !isPref) return;
           const d = Math.hypot(st.x - startPt[0], st.y - startPt[1]);
           const threshold = isPref ? 0.15 : 0.05;
           if (d < threshold) {
               candidates.push({ st, d, isPref, hasMoved: !!st.hasMoved });
           }
        });

        if (candidates.length > 0) {
            candidates.sort((a, b) => {
                if (a.isPref && !b.isPref) return -1;
                if (!a.isPref && b.isPref) return 1;
                // prefer someone who has not run yet this cycle
                if (a.hasMoved !== b.hasMoved) return a.hasMoved ? 1 : -1;
                // then simply whoever is standing closest to the leg's start
                return a.d - b.d;
            });
            closest = candidates[0].st;
        }
        
        let closestBall = null;
        if (closest && (stroke.mode === "dribble" || stroke.mode === "passrun")) {
          let minDBall = 0.15; // VERY forgiving 15% distance for the ball too!
          currentState.forEach(st => {
            if (st.item !== closest.item && st.item.kind === "dball") {
              const d = Math.hypot(st.x - startPt[0], st.y - startPt[1]);
              if (d < minDBall) { minDBall = d; closestBall = st; }
            }
          });
        }

        if (closest) {
          hasAnyAnimation = true;

          let pathPts = stroke.pts;
          if (stroke.mode === "dribble") {
            const r = board.getBoundingClientRect();
            const w = wavyPoints(pathPts, r);
            pathPts = w.map(p => [p[0]/r.width, p[1]/r.height]);
          }
          
          let len = 0;
          for (let i = 1; i < stroke.pts.length; i++) {
             len += Math.hypot(stroke.pts[i][0] - stroke.pts[i-1][0], stroke.pts[i][1] - stroke.pts[i-1][1]);
          }
          const dur = Math.max(800, len * 3500);

          // Snapshot of who has to be standing on my start point. Taken HERE,
          // while currentState still holds the positions for this point in the
          // sequence; the times are resolved in pass B.
          const startDeps = [];
          currentState.forEach(st => {
             if (Math.hypot(st.x - startPt[0], st.y - startPt[1]) < DEP_TOL)
                startDeps.push(st.item);
          });

          /* NEVER TELEPORT. The actor is bound from up to 0.15 away, so the
             drawn start is rarely exactly where the piece is standing — and
             animating from the drawn point made the piece jump there first.
             (In complex3 the third pass was drawn 0.11 from where the ball had
             come to rest, so the ball flicked sideways before travelling.)
             Start the path from the piece's real position instead. */
          pathPts = [[closest.x, closest.y], ...pathPts.slice(1)];

          // Animate in PIXELS, not %. anime.js converts a % keyframe to px using
          // the element's offsetWidth for BOTH axes, so on a 68:105 pitch every
          // vertical move was scaled by width/height (~0.65) and the drill
          // squashed as it played. Pixels are unambiguous.
          const _r = board.getBoundingClientRect();
          const keyframes = pathPts.map(p => ({ left: (p[0]*_r.width)+'px', top: (p[1]*_r.height)+'px' }));

          const endPt = pathPts[pathPts.length - 1];
          let ballKeyframes = null, ballEnd = null;
          if (closestBall) {
             ballKeyframes = pathPts.map((p, i) => {
                 let dx = 0, dy = 0;
                 if (i < pathPts.length - 1) {
                     dx = pathPts[i+1][0] - p[0];
                     dy = pathPts[i+1][1] - p[1];
                 } else if (i > 0) {
                     dx = p[0] - pathPts[i-1][0];
                     dy = p[1] - pathPts[i-1][1];
                 }
                 const len = Math.hypot(dx, dy) || 1;
                 return { left: ((p[0] + (dx/len)*0.025)*_r.width)+'px',
                          top:  ((p[1] + (dy/len)*0.025)*_r.height)+'px' };
             });
             // Convert the final keyframe back to normalised 0..1. These are PX
             // now (see the note above); dividing by 100 as if they were still
             // percentages put the ball's tracked position far off the pitch,
             // so no later stroke could find it and the ball moved only once.
             const bend = ballKeyframes[ballKeyframes.length - 1];
             ballEnd = [parseFloat(bend.left) / _r.width, parseFloat(bend.top) / _r.height];
          }

          plan.push({
            actor: closest.item, ball: closestBall ? closestBall.item : null,
            isBallLeg: closest.item.kind === "dball",
            startPt, endPt, dur, keyframes, ballKeyframes, startDeps
          });

          closest.x = endPt[0];
          closest.y = endPt[1];
          closest.hasMoved = true;
          if (isPlayerKind(closest.item.kind))
            legs.push({ item: closest.item, from: startPt, to: endPt });

          if (closestBall) {
             closestBall.x = ballEnd[0];
             closestBall.y = ballEnd[1];
             closestBall.hasMoved = true;
          }
        }
    });

    /* ================= PASS B — WHEN each leg runs =================
       What triggers a move is the END of the lines it depends on, not merely
       something sitting on its start. Three rules, applied in order:

         1. the actor (and any ball it carries) must have finished its last leg;
         2. whoever has to be standing on my START must have arrived there;
         3. the RECEIVING END has to be ready too — and that is the rule the
            old start-only check could not express.

       Rule 3 covers the two things a combination drill is made of:

         PASS TO A MOVING TARGET — "player 2 passes to wherever player 1 is",
         player 1 having run somewhere else first. Player 1 never goes near the
         pass's start, so rule 2 is blind to them and the ball was launched at
         empty grass. A pass now waits for any earlier leg ENDING where it ends.

         RUNNING ONTO A PASS — "player 1 passes half way to player 2, player 2
         must run and get the ball". Both legs are free to start at once, so
         they used to be fired together and each finished on its own length —
         the runner beating the ball there, or arriving long after it. A run
         that ends where a pass ends is now timed to ARRIVE WITH IT, without
         ever starting earlier than rules 1 and 2 allow.
       ============================================================== */
    const timeOf = it => pieceTime.get(it) || 0;
    const nearPt = (a, b, tol) => Math.hypot(a[0] - b[0], a[1] - b[1]) < (tol || DEP_TOL);

    plan.forEach((p, i) => {
      let t = Math.max(timeOf(p.actor), p.ball ? timeOf(p.ball) : 0);
      p.startDeps.forEach(it => { t = Math.max(t, timeOf(it)); });

      if (p.isBallLeg) {                       // rule 3a: pass to a moving target
        for (let j = 0; j < i; j++)
          if (!plan[j].isBallLeg && nearPt(plan[j].endPt, p.endPt))
            t = Math.max(t, plan[j].end);
      }
      if (t > 0) t += LEG_GAP;
      p.start = t;

      if (!p.isBallLeg) {                      // rule 3b: run onto a pass
        for (let j = 0; j < i; j++)
          if (plan[j].isBallLeg && nearPt(plan[j].endPt, p.endPt))
            p.start = Math.max(t, plan[j].end - p.dur);
        /* rule 3c: PASS BEFORE YOU GO. "player 1 passes through the cones,
           player 1 then runs to the back of the queue." Nothing about the run
           itself says it must follow the pass — the runner is free by rules 1
           and 2 — so the player sprinted off and the ball left afterwards from
           an empty spot. A player leaving a point waits until any pass struck
           FROM that point has been played. Struck, not received: you go the
           moment the ball leaves your foot. */
        for (let j = 0; j < i; j++)
          if (plan[j].isBallLeg && nearPt(plan[j].startPt, p.startPt, LOOSE_TOL))
            p.start = Math.max(p.start, plan[j].start);
      }
      p.end = p.start + p.dur;

      drillTimeline.add({
        targets: p.actor.el, keyframes: p.keyframes, duration: p.dur, easing: 'linear'
      }, p.start);
      pieceTime.set(p.actor, p.end);

      if (p.ball) {
        drillTimeline.add({
          targets: p.ball.el, keyframes: p.ballKeyframes, duration: p.dur, easing: 'linear'
        }, p.start);
        pieceTime.set(p.ball, p.end);
      }
    });

    /* ---- rotation: finished players rejoin the BACK of the queue ----
       In a 4-player drill run by 8 players, once 1–4 have gone they should
       fall in behind 8 while 5 steps up, rather than being left wherever the
       stroke happened to end. The queue direction is taken from the spacing
       between the last two numbered players at their START positions, so it
       works for a line, a diagonal or a staggered queue. */
    rotateDrill(currentState, startPos, legs, pieceTime, board.getBoundingClientRect());

    if (!hasAnyAnimation) {
      drillTimeline = null;
      return;
    }

    if (playDrillGlyph) playDrillGlyph.textContent = "⏹";
    if (playDrillLabel) playDrillLabel.textContent = "Stop";
    if (playDrillBtn) playDrillBtn.classList.add("on");
  }

  const dpInfoBtn = document.getElementById("dpInfoBtn");
  const dpLoopBtn = document.getElementById("dpLoopBtn");
  if (dpLoopBtn) {
    dpLoopBtn.addEventListener("click", () => {
      loopModeActive = !loopModeActive;
      dpLoopBtn.classList.toggle("on", loopModeActive);
      // keep the accessible state in step with the visual one
      dpLoopBtn.setAttribute("aria-pressed", loopModeActive ? "true" : "false");
      dpLoopBtn.title = loopModeActive
        ? "Looping — the rotation keeps running"
        : "Keep the rotation running";
    });
  }
  const dpSaveBtn = document.getElementById("dpSaveBtn");
  if (dpSaveBtn) {
    dpSaveBtn.addEventListener("click", () => {
      // Open the drills menu
      const drillPanel = document.getElementById("drillPanel");
      if (drillPanel) drillPanel.style.display = "flex";
      // Focus on the Drill Name input if possible
      const drillNameInput = document.getElementById("drillName");
      if (drillNameInput) drillNameInput.focus();
    });
  }
  
  if (dpInfoBtn) {
    dpInfoBtn.addEventListener("click", () => {
      if (activePreset) showDrillInfo(activePreset);
    });
  }
  if (playDrillBtn) playDrillBtn.addEventListener("click", startDrillAnim);

  /* ---------------- init ---------------- */
  fillFormationOptions();
  renderAll();
  renderGameday();
  buildBall(true);
  resizeCanvas();
}


  /* Drills dock: one persistent bar, three panes, one open at a time.
       kit   = markers/players used to lay the drill out
       lines = the drawing tools used to add the plays
       play  = the transport (step / loop / info / play)
     Only the dock reserves layout space; panes overlay the pitch while open.
     Team and Game day get none of this — they show the bench instead. */
  const kitTray   = document.getElementById("drillTray");
  const drillDock = document.getElementById("drillDock");
  const linesBar  = document.querySelector("#boardView footer");
  const playBar   = document.getElementById("drillPlayerBar");
  let openPane = null;                    // null | "kit" | "lines" | "play"

  function setKitOpen(on) {
    if (!kitTray) return;
    kitTray.classList.toggle("open", on);
    // updateTrayFades is scoped to initBoard; a resize reaches its listener
    if (on) window.dispatchEvent(new Event("resize"));
  }
  function setLinesOpen(on) {
    if (!linesBar) return;
    linesBar.classList.toggle("open", on);
    // leaving the drawing tools must return the board to dragging, or the
    // last-used pen mode silently blocks moving pieces
    if (!on && window.setBoardMoveMode) window.setBoardMoveMode();
  }
  function setDrillPane(name) {
    openPane = (openPane === name) ? null : name;   // tapping the active one closes it
    setKitOpen(openPane === "kit");
    setLinesOpen(openPane === "lines");
    if (playBar) playBar.classList.toggle("hidden", openPane !== "play");
    if (drillDock) drillDock.querySelectorAll("button[data-pane]").forEach(b =>
      b.classList.toggle("on", b.dataset.pane === openPane));
    // lifts the colour palette clear of whichever pane is open (see styles.css)
    document.body.classList.toggle("paneOpen", !!openPane);
  }
  if (drillDock) {
    drillDock.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      // #colorBtn also lives on the dock and has no data-pane — it runs its own
      // handler and must not be treated as a pane switch
      if (!b.dataset.pane) return;
      e.stopPropagation();
      setDrillPane(b.dataset.pane);
    });
  }
  window.closeDrillBars = () => {
    openPane = null;
    setKitOpen(false); setLinesOpen(false);
    if (playBar) playBar.classList.add("hidden");
    if (drillDock) drillDock.querySelectorAll("button").forEach(b => b.classList.remove("on"));
    document.body.classList.remove("paneOpen");
  };
  // used by "Start a new drill" to drop the coach straight into placing kit
  window.openDrillKit = () => { if (openPane !== "kit") setDrillPane("kit"); };

