/* Tactics board view. All state lives in store.data:
   { teamName, roster:[{id,name,pos}], nextId,
     board:{ squad, formation, showOpp, placed:{id:{x,y}} } } */

export function initBoard(store) {

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

  const roster = () => (store.data && store.data.roster) || [];
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
  function renderBench() {
    const b = bstate();
    bench.innerHTML = "";
    for (const p of roster()) {
      if (b.placed[p.id]) continue;
      const el = document.createElement("div");
      el.className = "btok";
      const disc = document.createElement("div");
      disc.className = "disc"; disc.textContent = p.pos;
      const nm = document.createElement("div");
      nm.className = "bname"; nm.textContent = firstName(p.name);
      el.append(disc, nm);
      enableBenchDrag(el, p);
      bench.appendChild(el);
    }
  }
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
  }
  function renderAll() {
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
    const pool = [...roster()];
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
      t.el.classList.add("dragging"); dragging = true;
      const r = board.getBoundingClientRect();
      const benchZone = document.getElementById("benchZone");
      let lastX = e.clientX, lastY = e.clientY;
      const b = bstate();
      const mv = ev => {
        lastX = ev.clientX; lastY = ev.clientY;
        const x = clamp01((ev.clientX - r.left) / r.width);
        const y = clamp01((ev.clientY - r.top) / r.height);
        b.placed[id] = { x, y }; setPos(t.el, x, y);
        const bz = benchZone.getBoundingClientRect();
        benchZone.classList.toggle("dropTarget",
          lastX >= bz.left && lastX <= bz.right && lastY >= bz.top && lastY <= bz.bottom);
      };
      const up = () => {
        t.el.classList.remove("dragging"); dragging = false;
        t.el.removeEventListener("pointermove", mv);
        t.el.removeEventListener("pointerup", up);
        t.el.removeEventListener("pointercancel", up);
        benchZone.classList.remove("dropTarget");
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

  function enableBenchDrag(el, p) {
    el.addEventListener("pointerdown", e => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      ghost.textContent = p.pos;
      ghost.style.display = "flex";
      ghost.style.left = e.clientX + "px"; ghost.style.top = e.clientY + "px";
      const mv = ev => { ghost.style.left = ev.clientX + "px"; ghost.style.top = ev.clientY + "px"; };
      const up = ev => {
        ghost.style.display = "none";
        el.removeEventListener("pointermove", mv);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
        const r = board.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
          const b = bstate();
          const x = clamp01((ev.clientX - r.left) / r.width);
          const y = clamp01((ev.clientY - r.top) / r.height);
          // dropped on an on-pitch teammate? substitute: sub takes their spot, they go to the bench
          let swapId = null, best = 28; // px radius
          for (const q of roster()) {
            const pos = b.placed[q.id];
            if (!pos) continue;
            const dx = pos.x * r.width - (ev.clientX - r.left);
            const dy = pos.y * r.height - (ev.clientY - r.top);
            const d = Math.hypot(dx, dy);
            if (d < best) { best = d; swapId = q.id; }
          }
          if (swapId !== null) {
            b.placed[p.id] = { ...b.placed[swapId] };
            delete b.placed[swapId];
          } else {
            b.placed[p.id] = { x, y };
          }
          renderTeam(); saveBoard();
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
  function redraw() {
    const r = board.getBoundingClientRect();
    ctx.clearRect(0, 0, r.width, r.height);
    for (const s of strokes) paint(s, r);
    if (current) paint(current, r);
  }
  // resample a stroke into a wavy line (dribble notation)
  function wavyPoints(pts, r) {
    const P = pts.map(p => [p[0] * r.width, p[1] * r.height]);
    const amp = 3.2, wavelength = 14, step = 3;
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
  function paint(s, r) {
    const pts = s.pts; if (pts.length < 2) return;
    ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(255,255,255,.95)";
    ctx.setLineDash(s.mode === "pass" ? [9, 8] : []);
    ctx.beginPath();
    if (s.mode === "dribble") {
      const w = wavyPoints(pts, r);
      ctx.moveTo(w[0][0], w[0][1]);
      for (let i = 1; i < w.length; i++) ctx.lineTo(w[i][0], w[i][1]);
    } else {
      ctx.moveTo(pts[0][0] * r.width, pts[0][1] * r.height);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * r.width, pts[i][1] * r.height);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (s.mode === "run" || s.mode === "pass" || s.mode === "dribble") {
      const n = pts.length;
      const a = pts[Math.max(0, n - 6)], bp = pts[n - 1];
      const bx = bp[0] * r.width, by = bp[1] * r.height;
      const ang = Math.atan2(by - a[1] * r.height, bx - a[0] * r.width);
      const L = 12;
      ctx.beginPath();
      ctx.moveTo(bx - L * Math.cos(ang - 0.5), by - L * Math.sin(ang - 0.5));
      ctx.lineTo(bx, by);
      ctx.lineTo(bx - L * Math.cos(ang + 0.5), by - L * Math.sin(ang + 0.5));
      ctx.stroke();
    }
  }
  board.addEventListener("pointerdown", e => {
    if (mode === "move") return;
    e.preventDefault();
    board.setPointerCapture(e.pointerId);
    const r = board.getBoundingClientRect();
    current = { mode, pts: [[(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]] };
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
    renderRoster();
    panel.classList.add("open");
  });
  document.getElementById("closeSquad").addEventListener("click", () => panel.classList.remove("open"));
  panel.addEventListener("click", e => { if (e.target === panel) panel.classList.remove("open"); });

  /* ---------------- controls ---------------- */
  document.querySelectorAll(".mode").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".mode").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      mode = b.dataset.mode;
      document.body.classList.toggle("drawing", mode !== "move");
    });
  });
  document.getElementById("undoBtn").addEventListener("click", () => { strokes.pop(); redraw(); });
  document.getElementById("clearBtn").addEventListener("click", () => { strokes = []; redraw(); });
  document.getElementById("resetBtn").addEventListener("click", () => {
    if (drillsMode) { clearDrillItems(); strokes = []; redraw(); return; }
    strokes = []; redraw(); applyFormation(); buildBall(true);
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
  let drillItems = [];        // {kind, x, y, el}
  let teamStrokes = [];       // parked while in drills mode
  let drillStrokes = [];      // parked while in team mode
  const drillTray = document.getElementById("drillTray");

  function setDrillsMode(on) {
    if (on === drillsMode) return;
    drillsMode = on;
    document.body.classList.toggle("drillsMode", on);
    document.querySelectorAll("#viewSeg button").forEach(b =>
      b.classList.toggle("on", (b.dataset.view === "drills") === on));
    if (on) { teamStrokes = strokes; strokes = drillStrokes; }
    else { drillStrokes = strokes; strokes = teamStrokes; }
    redraw();
    if (on) requestAnimationFrame(updateTrayFades);
  }
  document.querySelectorAll("#viewSeg button").forEach(b =>
    b.addEventListener("click", () => setDrillsMode(b.dataset.view === "drills")));

  // edge fade hints on the kit tray when items are off-screen
  const trayScroller = drillTray.querySelector(".trayItems");
  function updateTrayFades() {
    drillTray.classList.toggle("fadeL", trayScroller.scrollLeft > 4);
    drillTray.classList.toggle("fadeR",
      trayScroller.scrollLeft + trayScroller.clientWidth < trayScroller.scrollWidth - 4);
  }
  trayScroller.addEventListener("scroll", updateTrayFades);
  window.addEventListener("resize", () => requestAnimationFrame(updateTrayFades));

  function shapeEl(kind) {
    const s = document.createElement("div");
    s.className = kind; s.style.pointerEvents = "none";
    return s;
  }
  function addDrillItem(kind, x, y) {
    const el = document.createElement("div");
    el.className = "ditem d-" + kind;
    el.appendChild(shapeEl(kind));
    board.appendChild(el);
    setPos(el, x, y);
    const item = { kind, x, y, el };
    drillItems.push(item);
    enableDrillDrag(item);
    return item;
  }
  function clearDrillItems() {
    drillItems.forEach(i => i.el.remove());
    drillItems = [];
  }
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
        ghost.appendChild(shapeEl(kind));
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
            clamp01((ev.clientY - r.top) / r.height));
        }
      };
      el.addEventListener("pointermove", mv);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    });
  });

  /* ---------------- drill library ---------------- */
  // Firestore cannot store nested arrays, so stroke points are flattened on save.
  const flatStroke = s => ({ mode: s.mode, pts: s.pts.flat() });
  function unflatStroke(s) {
    const pts = [];
    for (let i = 0; i + 1 < s.pts.length; i += 2) pts.push([s.pts[i], s.pts[i + 1]]);
    return { mode: s.mode, pts };
  }
  const drillPanel = document.getElementById("drillPanel");
  const drillNameIn = document.getElementById("drillName");

  function drills() { return (store.data && store.data.drills) || []; }
  function renderDrillList() {
    const list = document.getElementById("drillList");
    list.innerHTML = "";
    for (const d of drills()) {
      const row = document.createElement("div");
      row.className = "rrow";
      const rn = document.createElement("div");
      rn.className = "rname"; rn.textContent = d.name;
      const del = document.createElement("button");
      del.className = "del"; del.textContent = "✕";
      del.setAttribute("aria-label", "Delete drill");
      del.addEventListener("click", ev => {
        ev.stopPropagation();
        store.data.drills = drills().filter(x => x.id !== d.id);
        store.save({ drills: store.data.drills });
        renderDrillList();
      });
      row.append(rn, del);
      row.addEventListener("click", () => { loadDrill(d); drillPanel.classList.remove("open"); });
      list.appendChild(row);
    }
  }
  function loadDrill(d) {
    setDrillsMode(true);
    clearDrillItems();
    (d.items || []).forEach(i => addDrillItem(i.kind, i.x, i.y));
    strokes = (d.strokes || []).map(unflatStroke);
    redraw();
  }
  document.getElementById("saveDrillBtn").addEventListener("click", () => {
    const name = drillNameIn.value.trim() || ("Drill " + (drills().length + 1));
    const d = {
      id: Date.now(),
      name,
      items: drillItems.map(({ kind, x, y }) => ({ kind, x, y })),
      strokes: strokes.map(flatStroke)
    };
    store.data.drills = [...drills(), d];
    store.save({ drills: store.data.drills });
    drillNameIn.value = "";
    renderDrillList();
  });
  document.getElementById("drillLibBtn").addEventListener("click", () => {
    renderDrillList();
    drillPanel.classList.add("open");
  });
  document.getElementById("closeDrills").addEventListener("click", () => drillPanel.classList.remove("open"));
  drillPanel.addEventListener("click", e => { if (e.target === drillPanel) drillPanel.classList.remove("open"); });

  /* ---------------- remote updates ---------------- */
  store.subscribe(() => {
    if (dragging) return;      // do not fight the coach's thumb
    renderAll();
  });

  /* ---------------- init ---------------- */
  fillFormationOptions();
  renderAll();
  buildBall(true);
  resizeCanvas();
}
