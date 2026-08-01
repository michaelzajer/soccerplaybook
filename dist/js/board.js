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
  // Pixel variant, used only while a drill animation is running. The timeline reads
  // the element's INLINE left/top as its start value; if that is a % string and
  // the keyframes are px; mixing units let the library convert via offsetWidth for
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

  // player menu sheet: edit position or substitute directly from the pitch
  let pmCtx = null;
  const pmPanel = document.getElementById("playerMenuPanel");
  window.openPlayerMenu = function(id) {
    const p = roster().find(p => p.id === id);
    if (!p) return;
    pmCtx = id;
    document.getElementById("pmName").textContent = p.name;
    document.getElementById("pmPos").value = p.pos || "";
    pmPanel.classList.add("open");
  };
  document.getElementById("pmSaveBtn")?.addEventListener("click", () => {
    if (!pmCtx) return;
    const p = roster().find(x => x.id === pmCtx);
    if (p) {
      const pos = document.getElementById("pmPos").value.trim().toUpperCase();
      if (pos && p.pos !== pos) {
        p.pos = pos;
        store.save({ roster: store.data.roster });
        renderTeam();
        renderBench();
      }
    }
    pmPanel.classList.remove("open");
  });
  document.getElementById("pmSubBtn")?.addEventListener("click", () => {
    if (!pmCtx) return;
    const b = bstate();
    delete b.placed[pmCtx];
    saveBoard();
    renderTeam();
    pmPanel.classList.remove("open");
  });
  document.getElementById("pmCancelBtn")?.addEventListener("click", () => {
    pmPanel.classList.remove("open");
  });
  pmPanel?.addEventListener("click", e => {
    if (e.target === pmPanel) pmPanel.classList.remove("open");
  });
  /* ONE swap path, used by the drag-and-drop sheet and the substitutions modal.
     The player coming on inherits the spot being vacated; the position is theirs
     to keep or change. */
  function applySubs(pairs) {
    const b = bstate();
    let rosterDirty = false, done = 0;
    /* Read every vacated spot BEFORE mutating anything. Applying one at a time is
       safe only while the pairs are disjoint, and taking the snapshot first means
       it stays safe even if that ever stops being true. */
    const spots = pairs.map(pr => b.placed[pr.outId] ? { ...b.placed[pr.outId] } : null);
    pairs.forEach((pr, i) => {
      if (!spots[i]) return;
      b.placed[pr.inId] = spots[i];
      delete b.placed[pr.outId];
      const pos = (pr.pos || "").trim().toUpperCase();
      if (pos) {
        const inP = roster().find(p => p.id === pr.inId);
        if (inP && inP.pos !== pos) { inP.pos = pos; rosterDirty = true; }
      }
      done++;
    });
    if (!done) return 0;
    if (rosterDirty) saveRoster(roster(), store.data.nextId);
    logSubs(pairs.filter((pr, i) => spots[i]));   // all at the same match minute
    renderTeam(); renderBench(); saveBoard();     // once, not once per swap
    return done;
  }
  const applySub = (inId, outId, newPos) => applySubs([{ inId, outId, pos: newPos }]) > 0;
  document.getElementById("subConfirm").addEventListener("click", () => {
    if (!subCtx) return;
    applySub(subCtx.inId, subCtx.outId, document.getElementById("subPos").value);
    subSel = null; subCtx = null;
    subPanel.classList.remove("open");
  });
  document.getElementById("subCancel").addEventListener("click", () => {
    subCtx = null; subPanel.classList.remove("open");
  });
  subPanel.addEventListener("click", e => { if (e.target === subPanel) { subCtx = null; subPanel.classList.remove("open"); } });

  /* ================= SUBSTITUTIONS MODAL =================
     A game-day sheet rather than a drag-and-drop puzzle: who is on, who is
     waiting, pick one from each and confirm. Broadcast language throughout —
     red down-arrow off, green up-arrow on. It stays open, because a double
     change is one visit to this screen, and each swap is stamped with the
     match minute and kept with the game.
     ======================================================= */
  const subsModal = document.getElementById("subsModal");
  /* Arrays, in the order they were tapped: the nth player off is paired with the
     nth player on. That is how a coach calls a triple change — "Jack, Tom and Ali
     off; Sam, Ben and Leo on" — so pairing by order needs no extra interaction,
     as long as the pairing is shown plainly enough to check. */
  let subsOut = [], subsIn = [], subsPos = {};

  const matchMinute = () => Math.floor(gtElapsed() / 60000)
    + (gt.period > 1 ? (gt.period - 1) * gt.cfg.mins : 0);
  function logSubs(pairs) {
    const g = store.data.gameday;
    if (!g || !pairs.length) return;      // only worth recording during a game
    g.subs = g.subs || [];
    const min = matchMinute(), period = gt.period;
    pairs.forEach(pr => g.subs.push({ inId: pr.inId, outId: pr.outId, min, period }));
    store.save({ gameday: g });
  }
  function subsRow(p, order) {
    const b = document.createElement("button");
    b.className = "subsRow" + (order > 0 ? " sel" : "");
    b.type = "button";
    b.dataset.id = p.id;
    const n = document.createElement("span");
    n.className = "num";
    n.textContent = (p.pos || "?").slice(0, 2);
    const w = document.createElement("span");
    w.className = "who"; w.textContent = p.name;
    const o = document.createElement("span");
    o.className = "ord"; o.textContent = order;      // only shown when selected
    /* The position is editable in place: tap it and type. Keeps a wrong position
       fixable from the screen you noticed it on, rather than a trip to My Squad. */
    const s2 = document.createElement("span");
    s2.className = "pos edit";
    s2.textContent = p.pos || "—";
    s2.setAttribute("role", "button");
    s2.setAttribute("tabindex", "0");
    s2.title = "Tap to change position";
    s2.addEventListener("click", ev => { ev.stopPropagation(); beginPosEdit(s2, p.id); });
    s2.addEventListener("keydown", ev => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); beginPosEdit(s2, p.id); }
    });
    b.append(n, w, o, s2);
    return b;
  }
  /* Swap the label for an input IN PLACE rather than re-rendering — the lists are
     rebuilt on every state change, which would blow away a freshly focused
     field mid-keystroke. */
  function beginPosEdit(span, id) {
    if (span.dataset.editing) return;
    span.dataset.editing = "1";
    const p = roster().find(x => x.id === id);
    const was = p ? (p.pos || "") : "";
    const inp = document.createElement("input");
    inp.className = "posEdit";
    inp.value = was;
    inp.maxLength = 3;
    inp.setAttribute("list", "posList");
    inp.setAttribute("aria-label", "Position");
    span.replaceWith(inp);
    inp.focus(); inp.select();
    let done = false;
    const commit = save => {
      if (done) return; done = true;
      const next = save ? (inp.value || "").trim().toUpperCase().slice(0, 3) : was;
      if (save && next && next !== was && p) {
        p.pos = next;
        saveRoster(roster(), store.data.nextId);
        renderTeam();                 // the token on the pitch carries the label
      }
      renderBench();
      renderSubsModal();              // safe now: the input is on its way out
    };
    inp.addEventListener("keydown", ev => {
      ev.stopPropagation();
      if (ev.key === "Enter") { ev.preventDefault(); commit(true); }
      if (ev.key === "Escape") { ev.preventDefault(); commit(false); }
    });
    inp.addEventListener("click", ev => ev.stopPropagation());
    inp.addEventListener("blur", () => commit(true));
  }
  // the complete pairs: the nth off with the nth on
  const subsPairs = () => {
    const n = Math.min(subsOut.length, subsIn.length), out = [];
    for (let i = 0; i < n; i++) {
      const outId = subsOut[i];
      /* THE PLAYER COMING ON TAKES THE SPOT AND THE POSITION of the player they
         replace — a striker on for a centre mid plays centre mid. Defaulting to
         null here meant the pair row DISPLAYED the outgoing position but never
         applied it unless the coach retyped it, so the sub kept their own
         position and the pitch label was wrong. */
      const outP = roster().find(x => x.id === outId);
      out.push({ outId, inId: subsIn[i],
                 pos: subsPos[outId] != null ? subsPos[outId] : (outP ? outP.pos : null) });
    }
    return out;
  };
  function renderSubsModal() {
    const b = bstate();
    const onPitch = roster().filter(p => b.placed[p.id]);
    const bench   = roster().filter(p => !b.placed[p.id] && !isOut(p.id));

    // a swap invalidates selections, so drop anyone no longer in their column
    subsOut = subsOut.filter(id => onPitch.some(p => p.id === id));
    subsIn  = subsIn.filter(id => bench.some(p => p.id === id));

    const fill = (node, list, sel, empty) => {
      node.innerHTML = "";
      if (!list.length) {
        const d = document.createElement("div");
        d.className = "subsEmpty"; d.textContent = empty;
        node.appendChild(d); return;
      }
      list.forEach(p => node.appendChild(subsRow(p, sel.indexOf(p.id) + 1)));
    };
    fill(document.getElementById("subsOnList"), onPitch, subsOut, "Nobody on the pitch yet.");
    fill(document.getElementById("subsBenchList"), bench, subsIn, "No subs available.");

    /* Pair rows, plus a greyed row for anyone picked without a partner yet, so
       an odd selection is obvious rather than silently ignored. */
    const wrap = document.getElementById("subsPairs");
    wrap.innerHTML = "";
    const nameOf = id => { const p = roster().find(x => x.id === id); return p ? firstName(p.name) : "?"; };
    const posOf  = id => { const p = roster().find(x => x.id === id); return p ? (p.pos || "") : ""; };
    const rows = Math.max(subsOut.length, subsIn.length);
    for (let i = 0; i < rows; i++) {
      const oId = subsOut[i], iId = subsIn[i], complete = oId != null && iId != null;
      const row = document.createElement("div");
      row.className = "subsPairRow" + (complete ? "" : " part");
      const ord = document.createElement("span");
      ord.className = "ord"; ord.textContent = complete ? (i + 1) : "";
      const off = document.createElement("span");
      off.className = "subsChip off" + (oId != null ? " set" : "");
      off.innerHTML = '<span class="subsArrow">&#9660;</span>' +
        (oId != null ? nameOf(oId) + " · " + posOf(oId) : "waiting for a player");
      const sw = document.createElement("span");
      sw.className = "subsSwap"; sw.innerHTML = "&#8646;";
      const on = document.createElement("span");
      on.className = "subsChip on" + (iId != null ? " set" : "");
      on.innerHTML = '<span class="subsArrow">&#9650;</span>' +
        (iId != null ? nameOf(iId) + " · " + posOf(iId) : "waiting for a sub");
      row.append(ord, off, sw, on);
      if (complete) {                     // the spot the incoming player takes
        const pi = document.createElement("input");
        pi.className = "pp"; pi.maxLength = 3; pi.setAttribute("list", "posList");
        pi.value = subsPos[oId] != null ? subsPos[oId] : posOf(oId);
        pi.addEventListener("input", () => { subsPos[oId] = pi.value; });
        row.appendChild(pi);
      }
      wrap.appendChild(row);
    }
    const pairs = subsPairs();
    document.getElementById("subsPickHint").textContent = pairs.length
      ? "The player coming on takes that spot — change it if they play elsewhere."
      : "Tap a player on the pitch, then their replacement. Pick several for a double or triple change.";
    const go = document.getElementById("subsGoBtn");
    go.disabled = !pairs.length;
    go.textContent = pairs.length > 1 ? "Make " + pairs.length + " changes" : "Make the swap";

    const clock = document.getElementById("subsClock");
    clock.textContent = store.data.gameday ? plabel() + gt.period + " " + fmt(gtElapsed()) : "";

    // what has already been changed this game
    const log = document.getElementById("subsLog");
    log.innerHTML = "";
    const subs = (store.data.gameday && store.data.gameday.subs) || [];
    subs.slice(-6).forEach(sv => {
      const o = roster().find(p => p.id === sv.outId), i = roster().find(p => p.id === sv.inId);
      const row = document.createElement("div");
      row.className = "subsLogRow";
      row.innerHTML = '<span class="min">' + sv.min + "'</span>" +
        '<span class="o">&#9660; ' + (o ? firstName(o.name) : "?") + "</span>" +
        '<span class="i">&#9650; ' + (i ? firstName(i.name) : "?") + "</span>";
      log.appendChild(row);
    });
  }
  function openSubsModal() {
    subsOut = []; subsIn = []; subsPos = {};
    renderSubsModal();
    subsModal?.classList.add("open");
  }
  document.getElementById("openSubsBtn")?.addEventListener("click", openSubsModal);
  document.querySelector("#benchZone .benchLabel")?.addEventListener("click", () => {
    if (currentView === "game") openSubsModal();
  });
  const toggleIn = (arr, id) => {
    const i = arr.indexOf(id);
    if (i > -1) arr.splice(i, 1); else arr.push(id);   // tap again to take back out
  };
  document.getElementById("subsOnList")?.addEventListener("click", e => {
    const r = e.target.closest(".subsRow"); if (!r) return;
    const id = +r.dataset.id;
    toggleIn(subsOut, id);
    if (!subsOut.includes(id)) delete subsPos[id];
    renderSubsModal();
  });
  document.getElementById("subsBenchList")?.addEventListener("click", e => {
    const r = e.target.closest(".subsRow"); if (!r) return;
    toggleIn(subsIn, +r.dataset.id);
    renderSubsModal();
  });
  document.getElementById("subsGoBtn")?.addEventListener("click", () => {
    const pairs = subsPairs();
    if (!pairs.length) return;
    applySubs(pairs);                     // one change, one minute, one save
    subsOut = []; subsIn = []; subsPos = {};
    renderSubsModal();
    /* Back to the pitch. Multi-select already lets a double or triple change be
       made in one visit, so there is nothing to stay open for — and the thing a
       coach wants to see straight after a change is the new shape. */
    subsModal.classList.remove("open");
  });
  subsModal?.addEventListener("click", e => {
    if (e.target === subsModal) subsModal.classList.remove("open");
  });

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
      const origPos = b.placed[id] ? { ...b.placed[id] } : null;
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
          else if (typeof openPlayerMenu === "function") openPlayerMenu(id);
          return;
        }
        t.el.classList.remove("dragging"); dragging = false;
        const oz = document.getElementById("outZone").getBoundingClientRect();
        if (lastX >= oz.left && lastX <= oz.right && lastY >= oz.top && lastY <= oz.bottom) {
          markUnavailable(id); return;                // dragged onto Out = injured/unavailable
        }
        const bz = benchZone.getBoundingClientRect();
        const overBench = lastX >= bz.left && lastX <= bz.right && lastY >= bz.top && lastY <= bz.bottom;
        if (overBench || lastY > r.bottom + 10) { delete b.placed[id]; renderTeam(); saveBoard(); return; }
        
        let swapped = false;
        if (origPos) {
           for (const [otherIdStr, pos] of Object.entries(b.placed)) {
              const otherId = Number(otherIdStr);
              if (otherId === id) continue;
              const px = r.left + pos.x * r.width;
              const py = r.top + pos.y * r.height;
              if (Math.hypot(lastX - px, lastY - py) < 30) {
                 b.placed[id] = { ...b.placed[otherId] };
                 b.placed[otherId] = origPos;
                 swapped = true;
                 break;
              }
           }
        }
        if (swapped) renderTeam();
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
    
    let numLabel = "";
    if (s.seq != null) {
        let mx, my;
        if (s.mode === "dribble") {
            const w = wavyPoints(pts, r);
            const midIdx = Math.floor(w.length / 2);
            mx = w[midIdx][0]; my = w[midIdx][1];
        } else {
            const midIdx = Math.floor(pts.length / 2);
            mx = pts[midIdx][0] * r.width; my = pts[midIdx][1] * r.height;
        }
        numLabel = `<circle cx="${mx}" cy="${my}" r="9" fill="#1e293b" stroke="rgba(255,255,255,0.8)" stroke-width="1.5" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5));" /><text x="${mx}" y="${my}" fill="white" font-size="11" font-family="sans-serif" font-weight="bold" text-anchor="middle" dominant-baseline="central">${s.seq}</text>`;
    }
    
    return `<path id="${id}" d="${d}" stroke="${strokeColor}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 2px 6px rgba(0,0,0,0.5));" ${dash} ${marker}></path>${numLabel}`;
  }


  /* ================= ALIGNMENT: GRID SNAP + LINE TIDYING =================
     Two problems pitch-side, both of them precision problems on a small
     screen: pieces are hard to line up by thumb, and a finger-drawn line is
     never straight. Rather than ask the coach to be accurate, the board is
     forgiving — pieces land on a lattice, and a drawn line is fitted to a
     clean shape on release.

     The lattice cell is ONE PIECE WIDE (mirrors .ditem's clamp in styles.css)
     so "one cell" reads as "one cone", and the cell is SQUARE IN PIXELS: the
     pitch is 68:105, so a square on screen is a different fraction of the
     board horizontally and vertically. Snapping in normalised units would give
     stretched cells and cones that look aligned across but not down.
     ====================================================================== */
  /* The board is a real pitch. Used for aspect-correct distances (so a leg's
     duration depends on how far it is, not which way it points) and by the
     metre-based notation in js/drill-text.js. */
  const PITCH_WID = 68, PITCH_LEN = 105;
  const GRID_FRAC = 0.075, GRID_MIN = 22, GRID_MAX = 40;   // must track .ditem
  function gridCellPx() {
    const r = board.getBoundingClientRect();
    return Math.min(GRID_MAX, Math.max(GRID_MIN, GRID_FRAC * r.width));
  }
  function gridStep() {
    const r = board.getBoundingClientRect(), c = gridCellPx();
    return { x: c / r.width, y: c / r.height };          // square in PIXELS
  }
  function snapToGrid(x, y) {
    const g = gridStep();
    return [clamp01(Math.round(x / g.x) * g.x), clamp01(Math.round(y / g.y) * g.y)];
  }
  /* A line endpoint snaps to a PIECE, and to nothing else. That is what makes
     playback exact: the dependency rules match a leg's ends against pieces, so
     an end dropped a thumb-width off the ball left the engine guessing (in
     complex3 it launched a pass from empty grass). It deliberately does NOT
     fall back to the lattice — a pass played into space has to stay where the
     coach put it, and snapping it to a grid line both moved the pass and,
     because the chord shifted under the drawn path, invented a bend. */
  /* ---- where a ball is DRAWN relative to the player on its square ----
     The ball sits IN FRONT of the player, in the direction that player is
     about to move — so it is read as "this is the ball they are about to play"
     rather than a disc stacked on their shirt. The direction is taken from the
     line that departs from the ball; with no line it falls back to down-right.

     0.85 of a piece is the gap at which the two circles just stop overlapping
     (player radius 0.5 + ball radius 0.35). Because the offset now runs ALONG
     the line of travel rather than across it, the ball also leads correctly
     during playback instead of drifting sideways off the pass. */
  const BALL_VIS_OFF = 0.85;
  const BALL_DEF_DIR = [Math.SQRT1_2, Math.SQRT1_2];        // down-right
  function ballFacing(bx, by) {
    const r = board.getBoundingClientRect(), reach = gridCellPx() * 1.3;
    let best = null, bd = reach;
    strokes.forEach(st => {
      const q = st.pts; if (!q || q.length < 2) return;
      const d = Math.hypot((q[0][0] - bx) * r.width, (q[0][1] - by) * r.height);
      if (d < bd) { bd = d; best = q; }
    });
    if (!best) return BALL_DEF_DIR;
    // look a little way down the line, so a wobbly first pixel cannot set the angle
    const far = best[Math.min(4, best.length - 1)];
    const vx = (far[0] - best[0][0]) * r.width, vy = (far[1] - best[0][1]) * r.height;
    const L = Math.hypot(vx, vy);
    return L < 1 ? BALL_DEF_DIR : [vx / L, vy / L];
  }
  /* Point every ball at the line it is about to travel down, and remember the
     offset on the item so hit-testing can use it. Cheap: a handful of balls. */
  function orientBalls() {
    // Disabled visual offsets to perfectly align the ball to the hidden grid
  }
  /* A ball is DRAWN clear of its player, so the ball the coach can SEE is not
     where the ball's model position is. Match a ball at BOTH points and always
     return its true centre — otherwise aiming at the visible ball bound the
     line to the player standing beside it. */
  function snapEndpoint(x, y, items) {
    const r = board.getBoundingClientRect(), reach = gridCellPx() * 0.7;
    let best = null, bd = reach;
    (items || drillItems).forEach(it => {
      const dx = (it.x - x) * r.width, dy = (it.y - y) * r.height;
      let d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = it; }
    });
    return best ? [best.x, best.y] : [x, y];
  }
  /* Fit a finger-drawn line to a straight chord with, at most, a gentle bow.
     The bow is the drawn path's largest sideways departure from the chord,
     damped: small wobble becomes dead straight, a deliberate arc stays an arc
     but a shallow one. Also collapses ~150 captured points to 17, which is
     what keeps the drill inside Firestore's document limits. */
  function tidyStroke(st, items, snapFn) {
    const pts = st.pts;
    if (!pts || pts.length < 2 || st.mode === "draw") return st;  // freehand stays freehand
    const r = board.getBoundingClientRect();
    const A0 = pts[0], B0 = pts[pts.length - 1];
    const snap = snapFn || function (x, y) { return snapEndpoint(x, y, items); };
    const A = snap(A0[0], A0[1]);
    const B = snap(B0[0], B0[1]);
    const vx = (B[0] - A[0]) * r.width, vy = (B[1] - A[1]) * r.height;
    const L = Math.hypot(vx, vy);
    if (L < 8) return st;                       // a tap, not a line
    const nx = -vy / L, ny = vx / L;            // unit normal to the chord
    /* Measure the bow against the chord the coach actually DREW, not the
       snapped one. Measuring against the snapped chord conflated "how much did
       they curve it" with "how far did the ends move", so snapping an end to a
       cone bent an otherwise straight line. */
    const v0x = (B0[0] - A0[0]) * r.width, v0y = (B0[1] - A0[1]) * r.height;
    const L0 = Math.hypot(v0x, v0y) || 1;
    const n0x = -v0y / L0, n0y = v0x / L0;
    let dev = 0;
    pts.forEach(p => {
      const d = ((p[0] - A0[0]) * r.width) * n0x + ((p[1] - A0[1]) * r.height) * n0y;
      if (Math.abs(d) > Math.abs(dev)) dev = d;
    });
    dev *= 0.55;                                          // keep it straightish
    if (Math.abs(dev) < 7) dev = 0;                       // shaky hand -> straight
    dev = Math.max(-L * 0.22, Math.min(L * 0.22, dev));   // never let it loop
    const cx = (A[0] + B[0]) / 2 + (nx * 2 * dev) / r.width;
    const cy = (A[1] + B[1]) / 2 + (ny * 2 * dev) / r.height;
    const out = [];
    for (let i = 0; i <= 16; i++) {                       // quadratic bezier A->C->B
      const t = i / 16, m = 1 - t;
      out.push([m*m*A[0] + 2*m*t*cx + t*t*B[0], m*m*A[1] + 2*m*t*cy + t*t*B[1]]);
    }
    st.pts = out;
    return st;
  }
  /* Bring a drill saved under the older, looser rules up to the current ones:
     cones onto the lattice, then every line end onto a piece and every line
     fitted to a clean chord. Order matters — snap the pieces FIRST, so the line
     ends are matched against where the pieces have just moved to.
     Works on drill DATA, so it can fix a drill without loading it. */
  function tidyDrillData(d) {
    const r = board.getBoundingClientRect(), reach = gridCellPx() * 0.7;
    const orig  = (d.items || []).map(i => ({ x:+i.x, y:+i.y }));
    const items = (d.items || []).map((i, k) => {
      const g = snapToGrid(orig[k].x, orig[k].y);
      return Object.assign({}, i, { x:g[0], y:g[1] });
    });
    /* Decide which piece an end BELONGS to using where that piece WAS, then put
       the end where the piece now IS. Matching against the moved pieces instead
       let a cone shift out of reach of its own line end, so ends that were 12px
       off ended up 19px off — snapping made the alignment worse, not better. */
    const snap = function (x, y) {
      let hit = -1, bd = reach;
      orig.forEach((o, k) => {
        const dd = Math.hypot((o.x - x) * r.width, (o.y - y) * r.height);
        if (dd < bd) { bd = dd; hit = k; }
      });
      return hit >= 0 ? [items[hit].x, items[hit].y] : [x, y];
    };
    const strokes = (d.strokes || []).map(st => {
      const u = unflatStroke(st);
      const fixed = tidyStroke(
        { mode:u.mode, color:u.color, pts:u.pts.map(pt => [pt[0], pt[1]]) }, items, snap);
      const out = flatStroke(fixed);
      if (u.color) out.color = u.color;
      return out;
    });
    return Object.assign({}, d, { items:items, strokes:strokes });
  }
  window.__tidyDrillData = tidyDrillData;      // used by the regression tests

  const showGrid = on => {
    if (on && drillsMode) board.style.setProperty("--grid-cell", gridCellPx() + "px");
    board.classList.toggle("showGrid", !!on && drillsMode);
  };

  function redraw() {
    if (drillsMode) orientBalls();      // the ball points down the line it will travel
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
    showGrid(true);
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
      if (current && current.pts.length > 1) strokes.push(tidyStroke(current));
      current = null; showGrid(false); redraw();
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
    if (num && (isPlayerKind(kind) || kind === "cone")) {
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
    if (kind === "att" || kind === "def" || kind === "cone") {
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
      showGrid(true);
      const mv = ev => {
        lastX = ev.clientX; lastY = ev.clientY;
        const [gx, gy] = snapToGrid((ev.clientX - r.left) / r.width,
                                    (ev.clientY - r.top) / r.height);
        item.x = gx; item.y = gy;
        setPos(item.el, item.x, item.y);
        const tz = drillTray.getBoundingClientRect();
        drillTray.classList.toggle("dropTarget",
          lastX >= tz.left && lastX <= tz.right && lastY >= tz.top && lastY <= tz.bottom);
      };
      const up = () => {
        item.el.classList.remove("dragging"); dragging = false; showGrid(false);
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
          const [gx, gy] = snapToGrid((ev.clientX - r.left) / r.width,
                                      (ev.clientY - r.top) / r.height);
          addDrillItem(kind, gx, gy, drillColor);
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
  const flatStroke = s => {
    if (!s) return { mode: "run", pts: [] };
    if (!s.pts) return { ...s, pts: [] };
    if (s.pts.length > 0 && typeof s.pts[0] !== 'number') return { ...s, pts: s.pts.flat() };
    return s;
  };
  function unflatStroke(s) {
    if (!s) return { mode: "run", pts: [] };
    if (!s.pts) return { ...s, pts: [] };
    if (s.pts.length > 0 && typeof s.pts[0] === 'object') return s;
    const pts = [];
    for (let i = 0; i + 1 < s.pts.length; i += 2) pts.push([s.pts[i], s.pts[i + 1]]);
    return { ...s, pts };
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
  /* Re-tidy a saved drill with the current rules. Drills built before the
     snapping existed have line ends sitting a thumb-width off the ball, which
     is exactly what left the playback engine guessing. */
  document.getElementById("deTidyBtn")?.addEventListener("click", (e) => {
    if (!editingDrill) return;
    const list = drills();
    const i = list.findIndex(x => x.id === editingDrill.id);
    if (i < 0) return;
    const before = (list[i].strokes || []).reduce((n, st) => n + unflatStroke(st).pts.length, 0);
    list[i] = tidyDrillData(list[i]);
    const after = (list[i].strokes || []).reduce((n, st) => n + unflatStroke(st).pts.length, 0);
    editingDrill = list[i];
    store.save({ drills: store.data.drills });
    if (currentView === "drills") loadDrill(list[i]);   // show the result at once
    const btn = e.currentTarget, was = btn.textContent;
    btn.textContent = "Tidied (" + before + " → " + after + " points)";
    setTimeout(() => { btn.textContent = was; }, 2600);
    renderDrillList();
  });

  /* Playback pace, cycled from the transport bar. Bigger = slower. Kept on the
     device (not synced) — it is a viewing preference, not part of the drill. */
  const SPEEDS = [0.6, 1, 1.6, 2.4];
  /* localStorage can THROW, not just be absent — Safari private browsing is the
     common case for a PWA, and it is read here at init rather than behind a
     click, so an unguarded access would take the whole board down. */
  const lsGet = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
  let drillSpeed = +(lsGet("spbDrillSpeed") || 1);
  if (!SPEEDS.includes(drillSpeed)) drillSpeed = 1;
  const speedBtn = document.getElementById("dpSpeedBtn");
  function renderSpeed() {
    if (!speedBtn) return;
    const label = drillSpeed === 1 ? "1×" : (Math.round(10 / drillSpeed) / 10) + "×";
    speedBtn.textContent = label;                 // 0.6 -> "1.7x" reads as faster
    speedBtn.title = "Playback speed";
  }
  speedBtn?.addEventListener("click", () => {
    drillSpeed = SPEEDS[(SPEEDS.indexOf(drillSpeed) + 1) % SPEEDS.length];
    lsSet("spbDrillSpeed", String(drillSpeed));
    renderSpeed();
    if (drillTimeline) { stopDrillAnim(); startDrillAnim(); }   // apply at once
  });
  renderSpeed();

  /* ================= DRILL BUILDER =================
     A form over the text notation — NOT a second model. Every control writes one
     line of CONES / PLAYERS / SEQUENCE, js/drill-text.js parses it, and the
     result is loaded onto the REAL pitch on each change. The sheet is short so
     the pitch shows above it, which means the preview cannot disagree with the
     drill: it IS the drill. Saving just persists what is already on screen.
     ================================================= */
  /* ---- import a drill from text ----
     Accepts the drill notation (parsed by js/drill-text.js, shared with
     tools/drill-from-text.mjs so the two cannot drift) or the JSON that
     "Copy drill data" emits. Strokes arrive as [x,y] pairs or already
     flattened; Firestore needs them flat, so normalise either way. */
  const importPanel = document.getElementById("importPanel");
  document.getElementById("importDrillBtn")?.addEventListener("click", () => {
    drillPanel.classList.remove("open");
    document.getElementById("impError").textContent = "";
    importPanel?.classList.add("open");
  });
  importPanel?.addEventListener("click", e => {
    if (e.target === importPanel) importPanel.classList.remove("open");
  });
  document.getElementById("impGoBtn")?.addEventListener("click", () => {
    const box = document.getElementById("impText");
    const errEl = document.getElementById("impError");
    const txt = (box.value || "").trim();
    errEl.textContent = "";
    if (!txt) { errEl.textContent = "Nothing to import."; return; }
    let d;
    try {
      if (txt[0] === "{") {
        d = JSON.parse(txt);
      } else if (typeof window.parseDrillText === "function") {
        d = window.parseDrillText(txt);
      } else {
        throw new Error("Text notation is not available — paste drill JSON instead.");
      }
      if (!d || !Array.isArray(d.items) || !d.items.length)
        throw new Error("No pieces found. Check the GRID block.");
      d.id = d.id || ("imp-" + Date.now().toString(36));
      d.name = (d.name || "Imported drill").slice(0, 60);
      d.items = d.items.map(i => ({
        kind: i.kind, x: clamp01(+i.x), y: clamp01(+i.y),
        ...(i.num != null ? { num: String(i.num) } : {}),
        ...(i.color ? { color: i.color } : {}),
        ...(i.startCone ? { startCone: true } : {})
      }));
      d.strokes = (d.strokes || []).map(st => {
        const pts = Array.isArray(st.pts && st.pts[0])
          ? st.pts.map(pt => [+pt[0], +pt[1]])        // [[x,y],...]
          : unflatStroke(st).pts;                     // already flat
        return flatStroke({ mode: st.mode || "run", pts,
                            ...(st.color ? { color: st.color } : {}) });
      });
    } catch (ex) {
      errEl.textContent = String(ex.message || ex);
      return;
    }
    store.data.drills = store.data.drills || [];
    store.data.drills.push(d);
    store.save({ drills: store.data.drills });
    importPanel.classList.remove("open");
    box.value = "";
    setView("drills");
    loadDrill(d);
    renderDrillList();
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
    
    // Group Starting XI and Substitutes
    const onPitch = roster().filter(p => b.placed[p.id]);
    const offPitch = roster().filter(p => !b.placed[p.id]);
    const benchList = offPitch.filter(p => !isOut(p.id));
    const outList = offPitch.filter(p => isOut(p.id));

    const posGroups = {
      "GOALKEEPERS": [],
      "DEFENDERS": [],
      "MIDFIELDERS": [],
      "FORWARDS": [],
      "OTHER": []
    };
    
    const defs = ["RB", "RWB", "CB", "LB", "LWB"];
    const mids = ["CDM", "CM", "CAM", "RM", "LM"];
    const fwds = ["RW", "LW", "ST", "CF"];
    
    onPitch.forEach(p => {
      const pos = (p.pos || "").toUpperCase();
      if (pos === "GK") posGroups["GOALKEEPERS"].push(p);
      else if (defs.includes(pos)) posGroups["DEFENDERS"].push(p);
      else if (mids.includes(pos)) posGroups["MIDFIELDERS"].push(p);
      else if (fwds.includes(pos)) posGroups["FORWARDS"].push(p);
      else posGroups["OTHER"].push(p);
    });

    let footerHeight = 0;
    let hasStarting = false;
    
    for (const [title, list] of Object.entries(posGroups)) {
      if (list.length > 0) {
        if (!hasStarting) { footerHeight += 70; hasStarting = true; }
        footerHeight += 65 + Math.ceil(list.length / 2) * 50 + 40;
      }
    }

    if (benchList.length > 0) {
      if (hasStarting) footerHeight += 70; // For "SUBSTITUTES" heading
      else if (footerHeight === 0) footerHeight += 70; // Or if it's the first thing
      footerHeight += 65 + Math.ceil(benchList.length / 2) * 50 + 40;
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
    
    // Draw Starting XI groups
    let drewStartingHeading = false;
    for (const [title, list] of Object.entries(posGroups)) {
      if (list.length > 0) {
        if (!drewStartingHeading) {
          c.fillStyle = "#ffd60a";
          c.font = "800 42px 'Barlow Condensed',sans-serif";
          c.fillText("STARTING XI", leftX, currentY);
          currentY += 70;
          drewStartingHeading = true;
        }
        drawSection(title, list);
      }
    }
    
    if (benchList.length > 0) {
      if (drewStartingHeading) {
        c.fillStyle = "#ffd60a";
        c.font = "800 42px 'Barlow Condensed',sans-serif";
        c.fillText("SUBSTITUTES", leftX, currentY);
        currentY += 70;
      }
      drawSection("BENCH", benchList);
    }
    
    if (outList.length > 0) {
      drawSection("OUT", outList);
    }
    
    await shareCanvas(cv, teamName.replace(/\s+/g, "-").toLowerCase() + "-lineup.png", teamName + " line-up");
  }
  function drillPiecePNG(c, W, kind, x, y, color, num, dir) {
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
      /* Matches the board: in front of the player, along its direction of
         travel, ringed so it reads on any shirt. `u` is the player RADIUS and
         the ball's is .8u, so 1.8u between centres stops them overlapping. */
      const d0 = dir || [Math.SQRT1_2, Math.SQRT1_2];
      const ox = d0[0] * u * 1.8, oy = d0[1] * u * 1.8;
      c.fillStyle = "#fff";
      c.beginPath(); c.arc(ox, oy, u * .8, 0, 7); c.fill();
      c.lineWidth = 2; c.strokeStyle = "rgba(0,0,0,.65)"; c.stroke();
      c.fillStyle = "#111"; c.beginPath(); c.arc(ox, oy, u * .3, 0, 7); c.fill();
    } else if (kind === "att" || kind === "def" || kind === "cone") {
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
    /* Balls last, for the same reason they sit above players on the board:
       drawn in item order a ball under a player was painted over. */
    const _its = (d.items || []);
    _its.filter(i => i.kind !== "dball")
        .forEach(i => drillPiecePNG(c, W, i.kind, i.x * W, i.y * H, i.color, i.num));
    // ...and each ball in front of its player, facing the line it departs on,
    // exactly as the board draws it (see orientBalls / ballFacing)
    _its.filter(i => i.kind === "dball").forEach(i => {
      let dir = [Math.SQRT1_2, Math.SQRT1_2], bd = W * 0.10;
      (d.strokes || []).forEach(st => {
        const q = unflatStroke(st).pts; if (!q || q.length < 2) return;
        const dd = Math.hypot((q[0][0] - i.x) * W, (q[0][1] - i.y) * H);
        if (dd < bd) {
          const f = q[Math.min(4, q.length - 1)];
          const vx = (f[0] - q[0][0]) * W, vy = (f[1] - q[0][1]) * H, L = Math.hypot(vx, vy);
          if (L > 1) { bd = dd; dir = [vx / L, vy / L]; }
        }
      });
      drillPiecePNG(c, W, i.kind, i.x * W, i.y * H, i.color, i.num, dir);
    });
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
  document.getElementById("createGameDayBtn")?.addEventListener("click", () => {
    // FPL style: create game day directly from the Team sheet, capturing the layout instantly
    upsertCurrentGame();
    const b = bstate();
    store.data.gameday = {
      date: "", time: "", opp: "", notes: "",
      lineup: {
        formation: b.formation, squad: b.squad,
        placed: JSON.parse(JSON.stringify(b.placed)), at: Date.now()
      }
    };
    saveGday();
    renderGameday();
    document.getElementById("ctlMenuPanel").classList.remove("open");
    setView("game");
    openGameCfg();
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
    const t = JSON.parse(lsGet(TKEY));
    if (t && t.cfg && t.base) gt = t;
  } catch (e) {}
  const timerDisplay = document.getElementById("timerDisplay");
  const timerMeta = document.getElementById("timerMeta");
  const timerChip = document.getElementById("timerChip");
  const timerStartBtn = document.getElementById("timerStart");
  const cfgPeriods = document.getElementById("cfgPeriods");
  const cfgMinutes = document.getElementById("cfgMinutes");

  function gtSave() { lsSet(TKEY, JSON.stringify(gt)); }
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
    const t = JSON.parse(lsGet(SKEY));
    if (t && t.int) st = t;
  } catch (e) {}
  const subsDisplay = document.getElementById("subsDisplay");
  const subsChip = document.getElementById("subsChip");
  const subsStartBtn = document.getElementById("subsStart");
  const cfgSubInt = document.getElementById("cfgSubInt");

  function stSave() { lsSet(SKEY, JSON.stringify(st)); }
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
    if (!loopModeActive) {
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
        drillTimeline.to(st.item.el, {
          keyframes: [{ left: (slot.x * rect.width) + "px", top: (slot.y * rect.height) + "px" }],
          duration: 700 / 1000,
          ease: "none"
        }, (t + 100) / 1000);
        st.x = slot.x; st.y = slot.y;
        pieceTime.set(st.item, t + 100 + 700);
      });
    });
  }

  function buildTimeline(resetPositions) {
    try {
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

    drillTimeline = gsap.timeline({
      defaults: { ease: 'none' },
      onComplete: onTimelineComplete
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
    /* Pace. These were roughly halved for a small drill: a 14 m leg fell on the
       minimum clamp, so every pass took the same 800ms and the whole thing read
       as a blur. `drillSpeed` is the coach's multiplier from the transport bar —
       larger number = slower, so 1.5 means "take half again as long". */
    /* Calibrated against the pitch: 9000ms to cover its 68 m width is about
       7.5 m/s — quicker than a real jog, but a diagram has to be watchable. */
    const RUN_MS_PER_UNIT  = 9000 * drillSpeed;
    const BALL_MS_PER_UNIT = 5000 * drillSpeed;   // a struck ball, ~1.8x quicker
    const MIN_RUN  = 1200 * drillSpeed;
    const MIN_BALL =  700 * drillSpeed;

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
        } else if (pref.length > 0) {
            let forced = null; let forcedD = Infinity;
            currentState.forEach(st => {
                if (pref.includes(st.item.kind)) {
                    const d = Math.hypot(st.x - startPt[0], st.y - startPt[1]);
                    if (d < forcedD) { forcedD = d; forced = st; }
                }
            });
            if (forced) closest = forced;
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
          
          /* Length in REAL distance, not normalised units. The pitch is 68 x 105,
             so an unweighted hypot made a 21 m pass across the pitch measure 0.31
             and the same 21 m pass up the pitch measure 0.20 — the horizontal one
             animated half again as slowly. Weighting dy by the aspect ratio makes
             a leg's duration depend on how far it actually is, not its direction.
             Units are pitch WIDTHS of real distance. */
          const AR = PITCH_LEN / PITCH_WID;
          let len = 0;
          for (let i = 1; i < stroke.pts.length; i++) {
             len += Math.hypot(stroke.pts[i][0] - stroke.pts[i-1][0],
                               (stroke.pts[i][1] - stroke.pts[i-1][1]) * AR);
          }
          /* A BALL TRAVELS FASTER THAN A PLAYER RUNS. Both used to move over the
             same duration, so a passer shadowed their own pass the whole way
             and the ball never actually got to the receiver first. A struck
             ball covers the same ground in a bit over half the time. */
          const runDur  = Math.max(MIN_RUN,  len * RUN_MS_PER_UNIT);
          const passDur = Math.max(MIN_BALL, len * BALL_MS_PER_UNIT);
          const isBallActor = closest.item.kind === "dball";
          const dur = isBallActor ? passDur : runDur;
          /* A dribbler carries the ball, so it moves at HIS pace; a pass+run
             plays the ball ahead, so it moves at ball pace and arrives first. */
          const ballDur = (stroke.mode === "dribble") ? runDur : passDur;

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

          // Animate in PIXELS, not %. A % keyframe gets converted to px using
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
                 const dxPx = dx * _r.width;
                 const dyPx = dy * _r.height;
                 const lenPx = Math.hypot(dxPx, dyPx) || 1;
                 const offsetPx = 0.025 * _r.width; // uniform physical pixel offset
                 return { left: (p[0] * _r.width + (dxPx/lenPx) * offsetPx)+'px',
                          top:  (p[1] * _r.height + (dyPx/lenPx) * offsetPx)+'px' };
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
            startPt, endPt, dur, ballDur, keyframes, ballKeyframes, startDeps
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
      /* Rule 2, but only for pieces this leg actually NEEDS. It used to wait for
         everything arriving at the start point, which meant a receiver could not
         play on until the passer had finished jogging over to him — the moment
         the ball started arriving first, that became the thing holding the drill
         up. A BALL arriving still counts (you cannot pass a ball you have not
         received); another player merely running in behind you does not. */
      p.startDeps.forEach(it => {
        if (it !== p.actor && it !== p.ball && isPlayerKind(it.kind)) return;
        t = Math.max(t, timeOf(it));
      });

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
            p.start = Math.max(p.start, plan[j].start + (plan[j].dur * 0.1));
      }
      p.end = p.start + p.dur;

      drillTimeline.to(p.actor.el, {
        keyframes: p.keyframes, duration: p.dur / 1000
      }, p.start / 1000);
      pieceTime.set(p.actor, p.end);

      if (p.ball) {
        /* Its own duration, so on a pass+run the ball ARRIVES BEFORE the player
           who played it. Tracked separately too: the next leg waiting on the
           ball must wait for the ball, not for the runner still jogging over. */
        p.ballEnd = p.start + p.ballDur;
        drillTimeline.to(p.ball.el, {
          keyframes: p.ballKeyframes, duration: p.ballDur / 1000
        }, p.start / 1000);
        pieceTime.set(p.ball, p.ballEnd);
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

    let maxBallTime = 0;
    let maxRunTime = 0;
    plan.forEach(p => {
       if (p.isBallLeg) maxBallTime = Math.max(maxBallTime, p.ballEnd || p.end);
       else maxRunTime = Math.max(maxRunTime, p.end);
    });
    
    // In continuous passing drills, don't wait for the last trailing runner to finish jogging
    // before starting the next lap. Start as soon as the ball finishes its sequence!
    const loopTriggerTime = (maxBallTime > 0) ? maxBallTime : maxRunTime;
    if (loopModeActive && loopTriggerTime > 0) {
        drillTimeline.call(() => {
            if (loopModeActive) buildTimeline(false);
        }, [], loopTriggerTime / 1000);
    }

    if (playDrillGlyph) playDrillGlyph.textContent = "⏹";
    if (playDrillLabel) playDrillLabel.textContent = "Stop";
    if (playDrillBtn) playDrillBtn.classList.add("on");
    } catch (e) {
      alert("Error in buildTimeline:\n" + e.stack);
      console.error(e);
      drillTimeline = null;
    }
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


  // Semantic Drill Parser auto-animations
  const handleSemanticInput = (e) => {
    if (typeof window.parseSequenceLines === 'function') {
      const text = e.target.value;
      if (text.trim() === "") return;
      
      const strokes = window.parseSequenceLines(text, drillItems);
      if (strokes && strokes.length > 0) {
        // Group all semantic strokes into a single step so they draw simultaneously
        drillSteps = [strokes];
        if (typeof strokeBufs !== 'undefined') strokeBufs.drills = drillSteps[0];
        currentStep = 0;
        changeStep(0);
        
        // Stop current animation and redraw board with new lines
        if (typeof stopDrillAnim === 'function') stopDrillAnim();
        if (typeof draw === 'function') draw();
        
        // Let the state save automatically so the visual lines persist
        if (typeof pushState === 'function') pushState();
      }
    }
  };

  const drillNotesBox = document.getElementById("drillNotes");
  const liveNotesBox = document.getElementById("liveNotes");

  const handleLiveNotesInput = (e) => {
    // Sync the two boxes so saving works seamlessly
    if (e.target === drillNotesBox) {
      if (liveNotesBox) liveNotesBox.value = drillNotesBox.value;
    } else if (e.target === liveNotesBox) {
      if (drillNotesBox) drillNotesBox.value = liveNotesBox.value;
    }
    handleSemanticInput({target: {value: e.target.value}});
  };

  if (drillNotesBox) drillNotesBox.addEventListener("input", handleLiveNotesInput);
  if (liveNotesBox) liveNotesBox.addEventListener("input", handleLiveNotesInput);
  
  const deNotesBox = document.getElementById("deNotes");
  if (deNotesBox) deNotesBox.addEventListener("input", handleSemanticInput);

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
  const notesPane = document.getElementById("drillNotesPane");
  function setDrillPane(name) {
    openPane = (openPane === name) ? null : name;   // tapping the active one closes it
    setKitOpen(openPane === "kit");
    setLinesOpen(openPane === "lines");
    if (playBar) playBar.classList.toggle("hidden", openPane !== "play");
    if (notesPane) notesPane.classList.toggle("hidden", openPane !== "notes");
    
    if (openPane === "notes" && notesPane) {
      setTimeout(() => {
        const ln = document.getElementById("liveNotes");
        if (ln) ln.focus();
      }, 50);
    }
    
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
    if (notesPane) notesPane.classList.add("hidden");
    if (drillDock) drillDock.querySelectorAll("button").forEach(b => b.classList.remove("on"));
    document.body.classList.remove("paneOpen");
  };
  // used by "Start a new drill" to drop the coach straight into placing kit
  window.openDrillKit = () => { if (openPane !== "kit") setDrillPane("kit"); };

