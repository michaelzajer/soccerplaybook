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

  // subs are tap-to-select (for a substitution); dragging one into the Out zone
  // marks the player unavailable
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
        if (ev.clientX >= oz.left && ev.clientX <= oz.right && ev.clientY >= oz.top && ev.clientY <= oz.bottom)
          markUnavailable(p.id);
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
    // proportional so the wave reads the same on screen and in share images
    const amp = Math.max(2.6, r.width * 0.0095);
    const wavelength = Math.max(11, r.width * 0.041);
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
  function paint(s, r) {
    const pts = s.pts; if (pts.length < 2) return;
    ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = s.color || "rgba(255,255,255,.95)";
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
  document.getElementById("closeSquad").addEventListener("click", () => panel.classList.remove("open"));
  panel.addEventListener("click", e => { if (e.target === panel) panel.classList.remove("open"); });

  /* ---------------- controls ---------------- */
  const ctlMenuPanel = document.getElementById("ctlMenuPanel");
  document.getElementById("closeCtlMenu").addEventListener("click", () =>
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
  // colour palette pops up out of the bottom toolbar:
  //  - "Players"/"Opp" rows set the team/opp KIT colours (all views, global)
  //  - "Item" row sets the colour of the next cone/marker/line placed (drills)
  const drillColors = document.getElementById("drillColors");
  function markActive(row, color) {
    const c = (color || "").toLowerCase();
    row.querySelectorAll(".swatch").forEach(x =>
      x.classList.toggle("on", x.dataset.color.toLowerCase() === c));
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
  // one sketch buffer per view; `strokes` always points at the active one
  const strokeBufs = { team: strokes, game: [], drills: [] };
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
        document.getElementById("ctlMenuTitle").textContent =
          v === "drills" ? "Drill options" : "Team options";
        document.getElementById("resetBtn").textContent =
          v === "drills" ? "Clear pitch" : "Reset board";
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
  function shapeEl(kind, color) {
    const s = document.createElement("div");
    s.className = kind; s.style.pointerEvents = "none";
    paintPiece(s, kind, effectiveColor(kind, color));
    return s;
  }
  function addDrillItem(kind, x, y, color) {
    const eff = effectiveColor(kind, color);
    const el = document.createElement("div");
    el.className = "ditem d-" + kind;
    el.appendChild(shapeEl(kind, eff));
    board.appendChild(el);
    setPos(el, x, y);
    const item = { kind, x, y, el };
    if (eff) item.color = eff;
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
        }
      };
      el.addEventListener("pointermove", mv);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    });
  });

  /* ---------------- drill library ---------------- */
  // Firestore cannot store nested arrays, so stroke points are flattened on save.
  const flatStroke = s => ({ mode: s.mode, pts: s.pts.flat(), ...(s.color ? { color: s.color } : {}) });
  function unflatStroke(s) {
    const pts = [];
    for (let i = 0; i + 1 < s.pts.length; i += 2) pts.push([s.pts[i], s.pts[i + 1]]);
    return { mode: s.mode, pts, ...(s.color ? { color: s.color } : {}) };
  }
  const drillPanel = document.getElementById("drillPanel");
  const drillNameIn = document.getElementById("drillName");
  const drillNotesIn = document.getElementById("drillNotes");

  // Built-in starter drills. Coordinates are normalised 0..1 on a portrait pitch
  // (y=0 is the top goal). Tapping loads onto the board; the coach can tweak and Save.
  const PRESET_DRILLS = [
    {
      // 5 attackers keep the ball off 2 defenders inside a marked box.
      // Ball circulates round the edge, then a split pass cuts the middle.
      name: "Rondo 5v2",
      info: {
        trains: "Possession under pressure, first touch, scanning",
        setup: "Mark a 15x15m box. Five players spread around the edge, two defenders inside.",
        steps: [
          "Outside players keep the ball, one or two touch.",
          "Circulate around the edge, then split the two defenders when a gap opens.",
          "A defender who wins it or forces it out swaps with the player at fault."
        ],
        coaching: [
          "Open your body to see the next pass before the ball arrives.",
          "First touch away from pressure.",
          "Move after you pass — do not stand still."
        ]
      },
      items: [
        { kind: "disc", x: 0.26, y: 0.28 }, { kind: "disc", x: 0.74, y: 0.28 },
        { kind: "disc", x: 0.74, y: 0.72 }, { kind: "disc", x: 0.26, y: 0.72 },
        { kind: "att", x: 0.30, y: 0.42 }, { kind: "att", x: 0.50, y: 0.26 },
        { kind: "att", x: 0.70, y: 0.42 }, { kind: "att", x: 0.62, y: 0.70 },
        { kind: "att", x: 0.38, y: 0.70 },
        { kind: "def", x: 0.46, y: 0.48 }, { kind: "def", x: 0.56, y: 0.55 },
        { kind: "dball", x: 0.32, y: 0.44 }
      ],
      strokes: [
        { mode: "pass", pts: [[0.30, 0.42], [0.50, 0.26]] },
        { mode: "pass", pts: [[0.50, 0.26], [0.70, 0.42]] },
        { mode: "pass", pts: [[0.70, 0.42], [0.38, 0.70]] },   // split pass
        { mode: "pass", pts: [[0.38, 0.70], [0.62, 0.70]] },
        { mode: "pass", pts: [[0.62, 0.70], [0.30, 0.42]] }
      ]
    },
    {
      // Midfielder sets to the winger, deep player overlaps outside,
      // winger dribbles the byline and crosses for the striker to finish.
      name: "Overlap & Cross",
      info: {
        trains: "Wide combination play, overlapping runs, crossing and finishing",
        setup: "One channel down the right, goal at the top. Feeder starts centrally with the ball, striker in front, winger wide.",
        steps: [
          "Feeder passes into the striker's feet.",
          "Striker sets it out wide to the winger.",
          "Feeder overlaps outside the winger.",
          "Winger drives to the byline and crosses.",
          "Striker attacks the cross to finish."
        ],
        coaching: [
          "Time the overlap — go as the set pass is played.",
          "Weight and disguise the set-up pass.",
          "Attack the cross at the near post, do not wait for it."
        ]
      },
      items: [
        { kind: "goal", x: 0.50, y: 0.10 },
        { kind: "cone", x: 0.34, y: 0.68 }, { kind: "cone", x: 0.66, y: 0.68 },
        { kind: "att", x: 0.50, y: 0.84 }, { kind: "att", x: 0.50, y: 0.54 },
        { kind: "att", x: 0.75, y: 0.62 },
        { kind: "def", x: 0.50, y: 0.16 },
        { kind: "dball", x: 0.50, y: 0.86 }
      ],
      strokes: [
        { mode: "pass", pts: [[0.50, 0.84], [0.50, 0.56]] },   // feeder to striker
        { mode: "pass", pts: [[0.50, 0.56], [0.73, 0.62]] },   // set out to winger
        { mode: "run", pts: [[0.50, 0.84], [0.68, 0.72], [0.82, 0.46]] }, // overlap
        { mode: "dribble", pts: [[0.75, 0.62], [0.82, 0.44], [0.85, 0.30]] }, // byline
        { mode: "pass", pts: [[0.85, 0.30], [0.52, 0.20]] },   // cross
        { mode: "run", pts: [[0.50, 0.56], [0.49, 0.24]] }     // striker attacks it
      ]
    },
    {
      // Weave the poles, beat a defender, finish. Second striker follows
      // in for the rebound.
      name: "Slalom & Finish",
      info: {
        trains: "Close control at speed, beating a player, finishing",
        setup: "Four poles staggered from the edge of the box, a passive defender inside, goal at the top. Players queue at the start with a ball each.",
        steps: [
          "Dribble through the poles with close control.",
          "Accelerate out of the last pole and beat the defender.",
          "Finish low across the keeper.",
          "A second player follows in for any rebound."
        ],
        coaching: [
          "Small touches through the poles, both feet.",
          "Change of pace on the exit.",
          "Head up before the shot — pick your spot."
        ]
      },
      items: [
        { kind: "goal", x: 0.50, y: 0.10 },
        { kind: "pole", x: 0.44, y: 0.78 }, { kind: "pole", x: 0.58, y: 0.70 },
        { kind: "pole", x: 0.44, y: 0.62 }, { kind: "pole", x: 0.58, y: 0.54 },
        { kind: "def", x: 0.50, y: 0.40 },
        { kind: "att", x: 0.50, y: 0.86 }, { kind: "att", x: 0.28, y: 0.44 },
        { kind: "dball", x: 0.50, y: 0.88 }
      ],
      strokes: [
        { mode: "dribble", pts: [
          [0.50, 0.86], [0.36, 0.80], [0.56, 0.72], [0.38, 0.64],
          [0.58, 0.56], [0.40, 0.46], [0.58, 0.36]
        ] },
        { mode: "pass", pts: [[0.58, 0.36], [0.50, 0.13]] },   // shot
        { mode: "run", pts: [[0.28, 0.44], [0.44, 0.22]] }     // follow in
      ]
    },
    {
      // Two attackers against one defender plus a keeper. Carry, combine
      // around the defender, finish; second attacker fills the far post.
      name: "2v1 to Goal",
      info: {
        trains: "Attacking overloads, decision making, finishing",
        setup: "Start from cones about 25m out, one defender between the attackers and goal, keeper in.",
        steps: [
          "Ball carrier drives at the defender to commit them.",
          "Release the second attacker at the right moment.",
          "Support runner finishes first time.",
          "Carrier continues to the far post for any rebound."
        ],
        coaching: [
          "Draw the defender in before releasing the pass.",
          "Do not pass too early — make the decision for them.",
          "Talk to each other on the run."
        ]
      },
      items: [
        { kind: "goal", x: 0.50, y: 0.10 },
        { kind: "cone", x: 0.30, y: 0.82 }, { kind: "cone", x: 0.70, y: 0.82 },
        { kind: "att", x: 0.40, y: 0.76 }, { kind: "att", x: 0.62, y: 0.70 },
        { kind: "def", x: 0.50, y: 0.46 }, { kind: "def", x: 0.50, y: 0.16 },
        { kind: "dball", x: 0.40, y: 0.78 }
      ],
      strokes: [
        { mode: "dribble", pts: [[0.40, 0.76], [0.44, 0.54]] },
        { mode: "pass", pts: [[0.44, 0.54], [0.62, 0.48]] },   // release the 2nd man
        { mode: "run", pts: [[0.62, 0.70], [0.60, 0.42]] },
        { mode: "pass", pts: [[0.60, 0.42], [0.52, 0.14]] },   // shot
        { mode: "run", pts: [[0.44, 0.54], [0.44, 0.24]] }     // far post support
      ]
    },
    {
      // Winger delivers from wide; near- and far-post runners time their
      // movement to attack the cross.
      name: "Crossing & Finishing",
      info: {
        trains: "Delivery from wide areas, timing runs, first-time finishing",
        setup: "Winger wide with a supply of balls, two strikers central, keeper in goal.",
        steps: [
          "Winger drives to the byline and crosses.",
          "Near-post runner attacks the front space.",
          "Far-post runner holds, then arrives behind.",
          "Finish first time."
        ],
        coaching: [
          "Delay the runs until the cross is struck.",
          "Attack the ball, do not wait for it.",
          "Keep near and far post runners separated."
        ]
      },
      items: [
        { kind: "goal", x: 0.50, y: 0.10 },
        { kind: "cone", x: 0.72, y: 0.70 }, { kind: "cone", x: 0.74, y: 0.46 },
        { kind: "att", x: 0.80, y: 0.58 }, { kind: "att", x: 0.42, y: 0.36 },
        { kind: "att", x: 0.60, y: 0.40 },
        { kind: "def", x: 0.50, y: 0.16 },
        { kind: "dball", x: 0.80, y: 0.60 }
      ],
      strokes: [
        { mode: "dribble", pts: [[0.80, 0.58], [0.84, 0.42], [0.86, 0.28]] },
        { mode: "pass", pts: [[0.86, 0.28], [0.50, 0.22]] },   // cross
        { mode: "run", pts: [[0.42, 0.36], [0.40, 0.20]] },    // near post
        { mode: "run", pts: [[0.60, 0.40], [0.58, 0.22]] }     // far post
      ]
    },
    {
      // Third-man run: A into the pivot, pivot releases C who has timed a
      // run beyond, C finishes. Classic penetrating combination.
      name: "Third-Man Run",
      info: {
        trains: "Penetrating combinations, timing of runs, playing forward",
        setup: "Player A on the ball deep, a pivot in front of them, player C wide and high ready to run. Goal at the top.",
        steps: [
          "A plays into the pivot's feet.",
          "As the ball travels, C bursts beyond the line.",
          "Pivot releases C first time in behind.",
          "C finishes — C is the third man who receives the penetrating pass."
        ],
        coaching: [
          "C's run starts as the first pass is played, not after.",
          "One touch from the pivot to keep the tempo.",
          "Run beyond the defence, not to feet."
        ]
      },
      items: [
        { kind: "goal", x: 0.50, y: 0.10 },
        { kind: "cone", x: 0.36, y: 0.70 }, { kind: "cone", x: 0.64, y: 0.70 },
        { kind: "att", x: 0.50, y: 0.84 }, { kind: "att", x: 0.52, y: 0.56 },
        { kind: "att", x: 0.78, y: 0.66 },
        { kind: "def", x: 0.50, y: 0.16 },
        { kind: "dball", x: 0.50, y: 0.86 }
      ],
      strokes: [
        { mode: "pass", pts: [[0.50, 0.84], [0.52, 0.58]] },   // A to pivot
        { mode: "run", pts: [[0.78, 0.66], [0.66, 0.48], [0.58, 0.38]] }, // third-man run
        { mode: "pass", pts: [[0.52, 0.56], [0.60, 0.40]] },   // pivot releases C
        { mode: "pass", pts: [[0.60, 0.40], [0.50, 0.14]] }    // finish
      ]
    },
    {
      // Possession game in a grid used to coach the defending three:
      // pressure, cover, balance. App has two player colours, so the working
      // defensive unit (3) is shown pressing the six in possession.
      name: "3 v 3 v 3",
      info: {
        trains: "Pressure, cover and balance; defending as a unit",
        setup: "A 20 × 30 yard grid marked with cones. Three groups of three (9 players), shown here in red, blue and yellow; extra players rotate in.",
        steps: [
          "Play 3v3v3 for possession — two teams keep the ball, one team defends.",
          "First defender steps HARD to the ball to pressure it.",
          "Second defender tucks in behind to cover.",
          "Third defender reads the play from behind and provides balance.",
          "Rotate the defending group; run for 14 minutes."
        ],
        coaching: [
          "First defender: quick, aggressive pressure to force the play.",
          "Cover defender: right angle and distance behind the pressure.",
          "Balance defender: read from behind and protect the far space."
        ],
        progression: [
          "Make it a competition: each team defends for a two-minute period and counts steals and disruptions.",
          "The two teams in possession count how many times they split the defenders.",
          "Score: steals plus disruptions added together, plus splits multiplied by two (2 minutes × 4)."
        ]
      },
      items: [
        { kind: "cone", x: 0.30, y: 0.28 }, { kind: "cone", x: 0.70, y: 0.28 },
        { kind: "cone", x: 0.70, y: 0.72 }, { kind: "cone", x: 0.30, y: 0.72 },
        // three teams of three, mixed as in a possession game
        { kind: "att", x: 0.38, y: 0.38, color: "#ff453a" },
        { kind: "att", x: 0.54, y: 0.34, color: "#2f6bff" },
        { kind: "att", x: 0.64, y: 0.44, color: "#ffd60a" },
        { kind: "att", x: 0.36, y: 0.55, color: "#2f6bff" },
        { kind: "att", x: 0.52, y: 0.63, color: "#ffd60a" },
        { kind: "att", x: 0.64, y: 0.60, color: "#ff453a" },
        { kind: "att", x: 0.47, y: 0.45, color: "#ffd60a" },
        { kind: "att", x: 0.45, y: 0.60, color: "#ff453a" },
        { kind: "att", x: 0.58, y: 0.52, color: "#2f6bff" },
        { kind: "dball", x: 0.40, y: 0.50 }
      ],
      strokes: []
    },
    {
      // Defenders guard one goal; three lines of attackers ~40y out attack on
      // the coach's call. Focus is the defenders' communication when the
      // numbers keep changing. Attackers shown yellow, defenders in opp kit.
      name: "Defensive Communication",
      info: {
        trains: "Defensive communication, cover and coordination; defending outnumbered",
        setup: "One goal defended by 3–4 defenders. Three lines of attackers about 40 yards out, each with a ball.",
        steps: [
          "The coach calls out a random attack; the defenders must talk and react to it.",
          "Vary it constantly: three attackers with one ball; three attackers each with a ball (one per defender); two attackers with one ball; five attackers with one ball; five with two balls, and so on.",
          "The defenders sort out who takes which attacker as the attack unfolds."
        ],
        coaching: [
          "Talk early and loudly — call who has which attacker.",
          "When outnumbered, defend the greatest threat first.",
          "Cover and shift across together as a unit."
        ]
      },
      items: [
        { kind: "goal", x: 0.50, y: 0.09 },
        { kind: "def", x: 0.32, y: 0.31 }, { kind: "def", x: 0.44, y: 0.28 },
        { kind: "def", x: 0.57, y: 0.28 }, { kind: "def", x: 0.69, y: 0.31 },
        // three lines of attackers ~40y out, each with a ball
        { kind: "att", x: 0.30, y: 0.60, color: "#ffd60a" },
        { kind: "att", x: 0.28, y: 0.69, color: "#ffd60a" },
        { kind: "att", x: 0.31, y: 0.77, color: "#ffd60a" },
        { kind: "att", x: 0.50, y: 0.60, color: "#ffd60a" },
        { kind: "att", x: 0.48, y: 0.69, color: "#ffd60a" },
        { kind: "att", x: 0.51, y: 0.77, color: "#ffd60a" },
        { kind: "att", x: 0.70, y: 0.60, color: "#ffd60a" },
        { kind: "att", x: 0.68, y: 0.69, color: "#ffd60a" },
        { kind: "att", x: 0.71, y: 0.77, color: "#ffd60a" },
        { kind: "dball", x: 0.30, y: 0.64 }, { kind: "dball", x: 0.50, y: 0.64 },
        { kind: "dball", x: 0.70, y: 0.64 }
      ],
      strokes: [
        { mode: "dribble", pts: [[0.30, 0.58], [0.34, 0.44], [0.40, 0.34]] },
        { mode: "dribble", pts: [[0.50, 0.58], [0.50, 0.44], [0.50, 0.34]] },
        { mode: "dribble", pts: [[0.70, 0.58], [0.66, 0.44], [0.60, 0.34]] }
      ]
    }
  ];
  function loadPreset(p) {
    setDrillsMode(true);
    clearDrillItems();
    (p.items || []).forEach(i => addDrillItem(i.kind, i.x, i.y, i.color));
    strokes = (p.strokes || []).map(s => ({ mode: s.mode, pts: s.pts.map(pt => [pt[0], pt[1]]), ...(s.color ? { color: s.color } : {}) }));
    redraw();
  }

  function drills() { return (store.data && store.data.drills) || []; }
  function renderPresetRow() {
    const row = document.getElementById("presetRow");
    if (!row || row.childElementCount) return;   // build once
    for (const p of PRESET_DRILLS) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "presetChip";
      chip.textContent = p.name;
      chip.addEventListener("click", () => showDrillInfo(p));
      row.appendChild(chip);
    }
  }
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
  document.getElementById("diClose").addEventListener("click",
    () => drillInfoPanel.classList.remove("open"));
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
    setDrillsMode(true);
    clearDrillItems();
    (d.items || []).forEach(i => addDrillItem(i.kind, i.x, i.y, i.color));
    strokes = (d.strokes || []).map(unflatStroke);
    redraw();
  }
  document.getElementById("saveDrillBtn").addEventListener("click", () => {
    const name = drillNameIn.value.trim() || ("Drill " + (drills().length + 1));
    const notes = drillNotesIn.value.trim();
    const d = {
      id: Date.now(),
      name,
      items: drillItems.map(({ kind, x, y, color }) => ({ kind, x, y, ...(color ? { color } : {}) })),
      strokes: strokes.map(flatStroke),
      ...(notes ? { instructions: notes } : {})
    };
    store.data.drills = [...drills(), d];
    store.save({ drills: store.data.drills });
    drillNameIn.value = "";
    drillNotesIn.value = "";
    renderDrillList();
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
  document.getElementById("deClose").addEventListener("click", () => drillEditPanel.classList.remove("open"));
  drillEditPanel.addEventListener("click", e => { if (e.target === drillEditPanel) drillEditPanel.classList.remove("open"); });
  document.getElementById("drillLibBtn").addEventListener("click", () => {
    renderPresetRow();
    renderDrillList();
    drillPanel.classList.add("open");
  });
  document.getElementById("closeDrills").addEventListener("click", () => drillPanel.classList.remove("open"));
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
    if (["run", "pass", "dribble"].includes(s.mode)) {
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
      c.font = `600 ${Math.round(r * 0.66)}px 'Barlow Condensed',sans-serif`;
      c.fillStyle = "#fff";
      c.shadowColor = "rgba(0,0,0,.8)"; c.shadowBlur = 4;
      c.fillText(name, x, y + r * 1.75);
      c.shadowBlur = 0;
    }
  }
  function makeShareCanvas(title, subtitle) {
    const W = 1080, HEAD = 110, H = Math.round(W * 105 / 68);
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H + HEAD;
    const c = cv.getContext("2d");
    c.fillStyle = "#101411"; c.fillRect(0, 0, W, HEAD);
    c.fillStyle = "#ffd60a"; c.textAlign = "left"; c.textBaseline = "middle";
    c.font = "700 44px 'Barlow Condensed',sans-serif";
    c.fillText(title.toUpperCase(), 36, HEAD / 2 - (subtitle ? 14 : 0));
    if (subtitle) {
      c.fillStyle = "#95a09a"; c.font = "600 28px 'Barlow Condensed',sans-serif";
      c.fillText(subtitle, 36, HEAD / 2 + 26);
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
    const teamName = store.data.teamName || "My team";
    const g = (store.data && store.data.gameday) || {};
    let sub = b.formation + "  ·  " + b.squad + " v " + b.squad;
    if (g.opp) sub += "  ·  vs " + g.opp;
    if (g.date) {
      const d = new Date(g.date + "T" + (g.time || "00:00"));
      if (!isNaN(d)) sub += "  ·  " + d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) +
        (g.time ? " " + g.time : "");
    }
    const { cv, c, W, H } = makeShareCanvas(teamName, sub);
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
    await shareCanvas(cv, teamName.replace(/\s+/g, "-").toLowerCase() + "-lineup.png", teamName + " line-up");
  }
  function drillPiecePNG(c, W, kind, x, y, color) {
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
    (d.items || []).forEach(i => drillPiecePNG(c, W, i.kind, i.x * W, i.y * H, i.color));
    await shareCanvas(cv, d.name.replace(/\s+/g, "-").toLowerCase() + "-drill.png", d.name);
  }
  document.getElementById("shareTeamBtn").addEventListener("click", () => {
    document.getElementById("ctlMenuPanel").classList.remove("open");
    shareTeamSheet();
  });

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
  document.getElementById("closeGame").addEventListener("click", closeGameCfg);
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
  document.getElementById("closeGames").addEventListener("click", () => gamesPanel.classList.remove("open"));
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

  /* ---------------- init ---------------- */
  fillFormationOptions();
  renderAll();
  renderGameday();
  buildBall(true);
  resizeCanvas();
}
