/* ============================================================
   DRILL NOTATION -> drill JSON.  Single source of truth: the app
   imports with it and tools/drill-from-text.mjs evals this file,
   so the CLI and the app can never drift apart.
   Spec + examples: DRILL-NOTATION.md
   ============================================================ */
(function (root) {
const KIND = { o:"cone", d:"disc", "*":"dball", G:"goal", g:"mini", p:"pole" };

/* A point `metres` along the line from A towards B.

   This is what lets a drill say "player 2 comes 5 m off his cone to meet the
   ball" exactly, instead of the coach eyeballing a grid square. It is also the
   one thing prose needs that the notation could not express, so without it a
   sentence like "runs out 5m to meet the ball" had nowhere to compile to.

   Distances are REAL metres, so the vector is converted before scaling: the
   pitch is 68 x 105, so 5 m across it and 5 m up it are different fractions of
   the board. Pass PW/PH as 1 when A and B are already in metres. */
function stepTowards(A, B, metres, PW, PH) {
  const dx = (B[0] - A[0]) * PW, dy = (B[1] - A[1]) * PH;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (!len) return [A[0], A[1]];
  const f = metres / len;
  return [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f];
}
/* `<N>m from <ref> towards <ref>` — the only multi-word endpoint form. Kept
   deliberately narrow: one shape, no synonyms beyond towards/toward/to, so a
   line either parses or fails loudly. */
const REL_PT = /^([\d.]+)\s*m\s+from\s+(\S+)\s+(?:towards?|to)\s+(\S+)$/i;

/* Split "A -> B" into its two ends. An arrow is required when either end is a
   multi-word relative point; the bare "A to B" form still works when both ends
   are single tokens, and is checked second so "5m from 2 towards 1" cannot be
   torn apart at its own "to". */
function splitEnds(rest) {
  const arrow = rest.split(/\s*(?:->|>)\s*/);
  if (arrow.length === 2) return [arrow[0].trim(), arrow[1].trim()];
  const plain = /^(\S+)\s+to\s+(\S+)$/i.exec(rest.trim());
  return plain ? [plain[1], plain[2]] : null;
}

/* ==================== METRIC STYLE ====================
   Describe the drill the way a coach would: the shape and its size in METRES,
   how the players are spread, then what happens.

   Metres work because the board is a real pitch — 68 m wide by 105 m long by
   default. Note a square in metres is NOT a square in board coordinates: 12 m
   is 18% of the width but only 11% of the length. Same trap as the snapping
   lattice, handled the same way.
   ==================================================== */
var PITCH_W = 68, PITCH_H = 105;          // metres, overridable with PITCH
/* Queue spacing is ONE SNAPPING SQUARE (~5 m), not a literal queue gap. A real
   queue stands 1-2 m apart, but the board's pieces are about 5 m across and the
   lattice cell is 5 m, so anything tighter collapses two players onto the same
   square the moment the drill is snapped. Legibility wins over literalism. */
var QUEUE_GAP = 5;

function metricDrill(name, pitch, coneL, playerL, seqL) {
  var PW = pitch[0], PH = pitch[1];
  var cx = PW / 2, cy = PH / 2, shape = null;

  /* ---- the cones ---- */
  coneL.forEach(function (raw) {
    var l = raw.trim(), m;
    if ((m = /^cent(?:re|er)\s+([\d.]+)\s*(%?)\s+([\d.]+)\s*(%?)$/i.exec(l))) {
      cx = m[2] === "%" ? PW * (+m[1]) / 100 : +m[1];
      cy = m[4] === "%" ? PH * (+m[3]) / 100 : +m[3];
      return;
    }
    if ((m = /^square\s+([\d.]+)/i.exec(l)))   { shape = ["rect", +m[1], +m[1]]; return; }
    if ((m = /^rect(?:angle)?\s+([\d.]+)\s*(?:x|by)\s*([\d.]+)/i.exec(l)))
                                               { shape = ["rect", +m[1], +m[2]]; return; }
    if ((m = /^diamond\s+([\d.]+)/i.exec(l)))  { shape = ["diamond", +m[1]]; return; }
    if ((m = /^triangle\s+([\d.]+)/i.exec(l))) { shape = ["triangle", +m[1]]; return; }
    if ((m = /^line\s+(\d+)\s*(?:x|at)\s*([\d.]+)\s*(vertical|down)?/i.exec(l)))
                                               { shape = ["line", +m[1], +m[2], !!m[3]]; return; }
    if ((m = /^pair\s+([\d.]+)\s*(across|wide)?/i.exec(l)))
                                               { shape = ["pair", +m[1], !!m[2]]; return; }
    throw new Error('CONES: cannot read "' + l + '".\n' +
      '  Try: square 12 | rectangle 20 x 12 | diamond 14 | triangle 12 |\n' +
      '       line 4 x 8 [vertical] | pair 15 [across]   (all in metres)\n' +
      '  Optional: centre 34 52   or   centre 50% 60%');
  });
  if (!shape) throw new Error('CONES: no shape given (e.g. "square 12")');

  /* Cone order starts BOTTOM-LEFT and runs clockwise, which is how a
     follow-your-pass circuit reads. y grows downward (0 = far end of the
     pitch), so clockwise is up the left, across the top, down the right. */
  var S = shape[0], pts = [];
  if (S === "rect") {
    var w = shape[1] / 2, h = shape[2] / 2;
    pts = [[cx - w, cy + h], [cx - w, cy - h], [cx + w, cy - h], [cx + w, cy + h]];
  } else if (S === "diamond") {
    var d = shape[1] / 2;
    pts = [[cx, cy + d], [cx - d, cy], [cx, cy - d], [cx + d, cy]];
  } else if (S === "triangle") {
    var a = shape[1], hh = a * Math.sqrt(3) / 2;
    pts = [[cx - a / 2, cy + hh / 3], [cx, cy - hh * 2 / 3], [cx + a / 2, cy + hh / 3]];
  } else if (S === "line") {
    var n = shape[1], gap = shape[2], vert = shape[3], span = (n - 1) * gap / 2;
    for (var i = 0; i < n; i++)
      pts.push(vert ? [cx, cy - span + i * gap] : [cx - span + i * gap, cy]);
  } else if (S === "pair") {
    var g2 = shape[1] / 2;
    pts = shape[2] ? [[cx - g2, cy], [cx + g2, cy]] : [[cx, cy + g2], [cx, cy - g2]];
  }

  /* ---- the players ---- */
  var total = 0, startIdx = 0, evenly = true, allAt = -1;
  playerL.forEach(function (raw) {
    var l = raw.trim(), m;
    if ((m = /^(\d+)\s+(?:players?\s+)?(?:spread\s+|distributed\s+)?even/i.exec(l)))
                                     { total = +m[1]; evenly = true; return; }
    if ((m = /^(\d+)\s+(?:players?\s+)?(?:all\s+)?at\s+c(\d+)/i.exec(l)))
                                     { total = +m[1]; evenly = false; allAt = +m[2] - 1; return; }
    if ((m = /^(\d+)\s+players?$/i.exec(l))) { total = +m[1]; return; }
    if ((m = /^start(?:ing)?(?:\s+cone)?\s+c(\d+)/i.exec(l))) { startIdx = +m[1] - 1; return; }
    if (/^start(?:ing)?(?:\s+cone)?\s+(?:is\s+)?(?:the\s+)?bottom[\s-]?left/i.test(l))
                                     { startIdx = 0; return; }
    throw new Error('PLAYERS: cannot read "' + l + '".\n' +
      '  Try: 12 spread evenly | 8 all at c1 | start cone c1 | start bottom-left');
  });
  if (!total) total = pts.length;
  if (startIdx < 0 || startIdx >= pts.length)
    throw new Error("PLAYERS: start cone c" + (startIdx + 1) + " does not exist");

  // rotate so the start cone is first — that is what makes "player 1 passes to
  // player 2" mean "to the next cone round"
  var ring = pts.slice(startIdx).concat(pts.slice(0, startIdx));

  /* Queues trail AWAY from the middle of the shape so nobody stands in a passing
     lane. Numbering is depth-major: 1..N one to each cone, then N+1.. fill the
     second place in each queue — so player 2 IS at the next cone. */
  var items = [], num = 1, placed = 0;
  var per = Math.floor(total / ring.length), extra = total % ring.length;
  var quota = ring.map(function (_, k) {
    if (evenly) return per + (k < extra ? 1 : 0);
    var ai = (allAt - startIdx + ring.length) % ring.length;
    return k === ai ? total : 0;
  });
  /* Which way is "behind" each cone: directly away from the middle of the shape,
     so queues never stand in a passing lane. */
  var out = ring.map(function (b) {
    var ux = b[0] - cx, uy = b[1] - cy, L = Math.hypot(ux, uy) || 1;
    return [ux / L, uy / L];
  });
  /* The FRONT of each queue stands one step BEHIND its cone, not on top of it —
     the cone marks the spot, the player waits behind it. One step is one
     snapping square, so the offset survives a later Tidy instead of collapsing
     the player back onto the cone. */
  var front = ring.map(function (b, k) {
    return [b[0] + out[k][0] * QUEUE_GAP, b[1] + out[k][1] * QUEUE_GAP];
  });
  var maxDepth = Math.max.apply(null, quota);
  for (var depth = 0; depth < maxDepth; depth++) {
    for (var k = 0; k < ring.length && placed < total; k++) {
      if (depth >= quota[k]) continue;
      items.push({ kind:"att", num:String(num++),
        _m:[front[k][0] + out[k][0] * QUEUE_GAP * depth,
            front[k][1] + out[k][1] * QUEUE_GAP * depth] });
      placed++;
    }
  }
  var coneItems = ring.map(function (p, i) {
    var it = { kind:"cone", _m:[p[0], p[1]] };
    if (i === 0) it.startCone = true;
    return it;
  });
  items = coneItems.concat(items);
  items.push({ kind:"dball", _m:[front[0][0], front[0][1]] });

  /* ---- the sequence ---- */
  var strokes = [], N = ring.length;
  var mk = function (mode, a, b) {
    var q, t, out = [];
    for (q = 0; q <= 16; q++) {
      t = q / 16;
      out.push(+(((a[0] + (b[0] - a[0]) * t) / PW).toFixed(4)),
               +(((a[1] + (b[1] - a[1]) * t) / PH).toFixed(4)));
    }
    return { mode:mode, pts:out };
  };
  var labelPt = function (tok) {
    tok = String(tok).trim();
    var rel = REL_PT.exec(tok);                 // these are already in metres
    if (rel) return stepTowards(labelPt(rel[2]), labelPt(rel[3]), +rel[1], 1, 1);
    var m = /^[co](\d+)$/i.exec(tok);
    if (m) { var i = +m[1] - 1; if (!ring[i]) throw new Error("no cone c" + m[1]); return ring[i]; }
    if (/^\d+$/.test(tok)) {
      var hit = items.filter(function (x) { return x.num === tok; })[0];
      if (!hit) throw new Error("no player " + tok);
      return hit._m;
    }
    throw new Error('SEQUENCE: cannot find "' + tok + '"');
  };
  seqL.forEach(function (raw) {
    var l = raw.trim().replace(/^\d+[.)]\s*/, ""), m;
    if (/^(?:pass and follow|follow your pass)$/i.test(l)) {
      /* Between the PLAYERS, not the cones: the pass leaves the man standing
         behind one cone and arrives at the man standing behind the next.
         A CLOSED circuit too — N passes, not N-1. Leave the last one out and
         nobody is ever recycled, so the queue drains after one pass through. */
      for (var i = 0; i < N; i++) strokes.push(mk("passrun", front[i], front[(i + 1) % N]));
      return;
    }
    if (/^shuttle$/i.test(l)) {
      if (N !== 2) throw new Error('SEQUENCE: "shuttle" needs exactly 2 cones (use "pair")');
      strokes.push(mk("run", front[0], front[1]));
      strokes.push(mk("run", front[1], front[0]));
      return;
    }
    if ((m = /^(pass|run|dribble|passrun|pass\+run|carry)\s+(.+)$/i.exec(l))) {
      var mode = { pass:"pass", run:"run", dribble:"dribble", passrun:"passrun",
                   "pass+run":"passrun", carry:"dribble" }[m[1].toLowerCase()];
      var ends = splitEnds(m[2]);
      if (!ends) throw new Error('SEQUENCE: cannot read "' + l + '" — expected  ' + m[1] + ' A -> B');
      strokes.push(mk(mode, labelPt(ends[0]), labelPt(ends[1])));
      return;
    }
    throw new Error('SEQUENCE: cannot read "' + l + '".\n' +
      '  Try: pass and follow | shuttle | pass 1 -> 2 | run 1 -> c2 | passrun c1 -> c2\n' +
      '       run 2 -> 5m from 2 towards 1');
  });
  if (!strokes.length) throw new Error("SEQUENCE: nothing to do");

  return { id:"txt-" + Date.now().toString(36), name:name,
    items: items.map(function (it) {
      var o = { kind:it.kind,
        x:+Math.min(0.98, Math.max(0.02, it._m[0] / PW)).toFixed(4),
        y:+Math.min(0.98, Math.max(0.02, it._m[1] / PH)).toFixed(4) };
      if (it.num) o.num = it.num;
      if (it.startCone) o.startCone = true;
      return o;
    }),
    strokes: strokes };
}

function parseDrill(text, nameFromArg) {
  const lines = text.split(/\r?\n/);
  let name = nameFromArg || "Untitled drill";
  let mode = null;
  const gridRows = [], actions = [], coneL = [], playerL = [], seqL = [];
  let pitch = [PITCH_W, PITCH_H];
  let rotateL = null;

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();          // # comments
    if (!line) continue;
    const head = line.toUpperCase();
    if (head.startsWith("DRILL")) { if (!nameFromArg) name = line.slice(5).trim() || name; continue; }
    const pm = /^PITCH\s+([\d.]+)\s*(?:x|by)\s*([\d.]+)/i.exec(line);
    if (pm) { pitch = [+pm[1], +pm[2]]; continue; }
    /* ROTATE states the net effect of ONE lap, so the engine never has to work
       it out from where legs happen to start and end. */
    if (/^ROTATE\b/i.test(line)) { rotateL = line.replace(/^ROTATE\s*/i, ""); continue; }
    if (head === "GRID")     { mode = "grid";    continue; }
    if (head === "LINES")    { mode = "lines";   continue; }
    if (head === "CONES" || head === "MARKERS") { mode = "cones";   continue; }
    if (head === "PLAYERS")  { mode = "players"; continue; }
    if (head === "SEQUENCE" || head === "DRILL STEPS" || head === "STEPS")
                             { mode = "seq";     continue; }
    if (mode === "grid")     { gridRows.push(line.split(/\s+/)); continue; }
    if (mode === "lines")    { actions.push(line);  continue; }
    if (mode === "cones")    { coneL.push(line);    continue; }
    if (mode === "players")  { playerL.push(line);  continue; }
    if (mode === "seq")      { seqL.push(line);     continue; }
  }
  // two ways in: a GRID picture, or a described shape in METRES
  if (coneL.length) return metricDrill(name, pitch, coneL, playerL, seqL);
  if (!gridRows.length)
    throw new Error("nothing to build: expected a GRID block, or CONES / PLAYERS / SEQUENCE");

  const H = gridRows.length, W = Math.max(...gridRows.map(r => r.length));
  const at = (col, row) => ({ x:+(((col + 0.5) / W).toFixed(4)),
                              y:+(((row + 0.5) / H).toFixed(4)) });

  /* ---- read the layout ---- */
  const items = [], label = new Map();
  let nCone = 0, nBall = 0;
  gridRows.forEach((row, r) => row.forEach((cell, c) => {
    if (cell === "." || cell === "-" || cell === "") return;
    // a square can hold more than one thing: "o+1" is a cone with player 1 on it
    cell.split("+").forEach(tok => placeOne(tok, c, r));
  }));

  function placeOne(tok, c, r) {
    if (tok === "." || tok === "-" || tok === "") return;
    const start = tok.endsWith("!");
    const t = start ? tok.slice(0, -1) : tok;
    const p = at(c, r);

    if (/^\d+$/.test(t)) {                                 // your team, by shirt number
      items.push({ kind:"att", x:p.x, y:p.y, num:t });
      label.set(t, p); label.set("P" + t, p); return;
    }
    if (/^r\d+$/i.test(t)) {                               // opposition
      const n = t.slice(1);
      items.push({ kind:"def", x:p.x, y:p.y, num:n });
      label.set("r" + n, p); return;
    }
    if (t === "*") {
      nBall++; items.push({ kind:"dball", x:p.x, y:p.y });
      label.set("*" + nBall, p); if (nBall === 1) label.set("*", p); return;
    }
    if (KIND[t]) {
      const it = { kind:KIND[t], x:p.x, y:p.y };
      if (start) it.startCone = true;
      items.push(it);
      if (t === "o" || t === "d") { nCone++; label.set("o" + nCone, p); label.set("c" + nCone, p); }
      return;
    }
    throw new Error(
      `unknown grid symbol "${tok}" at row ${r + 1}, column ${c + 1}.\n` +
      `  Every square needs a space around it, and "." marks an empty one.\n` +
      `  Valid: . o o! d * p G g  1..99  r1..r99   and "o+1" to stack two things.`);
  }

  /* ---- resolve a line endpoint ---- */
  const gridRef = s => {
    const m = /^([A-Za-z]+)(\d+)$/.exec(s);
    if (!m) return null;
    let col = 0;
    for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
    const row = +m[2];
    if (col < 1 || col > W || row < 1 || row > H) return null;
    return at(col - 1, row - 1);
  };
  const resolve = s => {
    s = String(s).trim();
    if (label.has(s)) return label.get(s);
    const g = gridRef(s);                                  // a bare square = into space
    if (g) return g;
    const rel = REL_PT.exec(s);                            // "5m from 2 towards 1"
    if (rel) {
      const A = resolve(rel[2]), B = resolve(rel[3]);
      const p = stepTowards([A.x, A.y], [B.x, B.y], +rel[1], pitch[0], pitch[1]);
      return { x:+p[0].toFixed(4), y:+p[1].toFixed(4) };
    }
    throw new Error(`cannot find "${s}" — no such piece, and not a grid square`);
  };

  /* ---- read the actions ---- */
  const MODES = { pass:"pass", run:"run", dribble:"dribble", passrun:"passrun",
                  "pass+run":"passrun", carry:"dribble" };
  const strokes = actions.map((a, i) => {
    let body = a.trim();
    /* ---- the intent clauses, stripped off the end of the line first ----
       `after 2`     do not start until step 2 has finished (and its ball landed)
       `with 4`      start at the same moment as step 4
       `meets 3`     finish at the same moment as step 3 (running onto a pass)
       `around c2`   loop the path around that marker instead of going straight
       `via A, B`    explicit waypoints
       Step numbers are 1-based and may only point BACKWARDS, which is how a
       coach describes a drill anyway: "A passes, THEN B runs onto it". */
    const intent = {};
    const grab = (re, fn) => { const m = re.exec(body); if (m) { body = body.replace(re, "").trim(); fn(m); } };
    grab(/\bafter\s+([\d,\s]+?)(?=\s+(?:with|meets|around|via)\b|$)/i,
         m => intent.after = m[1].split(/[,\s]+/).filter(Boolean).map(n => +n - 1));
    grab(/\bwith\s+([\d,\s]+?)(?=\s+(?:after|meets|around|via)\b|$)/i,
         m => intent.with = m[1].split(/[,\s]+/).filter(Boolean).map(n => +n - 1));
    grab(/\bmeets\s+(\d+)/i, m => intent.arriveWith = +m[1] - 1);
    /* `by 2` names WHO does it, separately from where the line is drawn. Needed
       whenever a leg starts somewhere its actor does not live — "dribble from
       the check point back around the cone" is performed by the player whose
       home is cone 2, but the line starts 5 m away from it. Without this the
       slot would be the check point, which nobody occupies on the next lap, and
       the rotation would stall. */
    grab(/\bby\s+(\S+)/i, m => intent.by = m[1]);
    grab(/\baround\s+(\S+)/i, m => intent.around = m[1]);
    grab(/\bvia\s+(.+)$/i, m => intent.via = m[1].split(/\s*,\s*/).filter(Boolean));

    const m = /^(?:\d+[.)]\s*)?(\S+)\s+(.+)$/.exec(body);
    if (!m) throw new Error(`line ${i + 1} not understood: "${a}"\n  expected e.g.  pass 1 -> 2`);
    const kind = MODES[m[1].toLowerCase()];
    if (!kind) throw new Error(`line ${i + 1}: "${m[1]}" is not pass / run / dribble / passrun`);
    const ends = splitEnds(m[2]);
    if (!ends) throw new Error(`line ${i + 1} not understood: "${a}"\n  expected e.g.  pass 1 -> 2`);
    [intent.after, intent.with].forEach(list => (list || []).forEach(j => {
      if (!(j >= 0 && j < i))
        throw new Error(`line ${i + 1}: step ${j + 1} must be an EARLIER step`);
    }));
    if (intent.arriveWith != null && !(intent.arriveWith >= 0 && intent.arriveWith < i))
      throw new Error(`line ${i + 1}: "meets" must name an EARLIER step`);

    const A = resolve(ends[0]), B = resolve(ends[1]);

    /* Waypoints. `around X` puts two of them either side of X, which is what
       turns a straight line into a run round the back of a cone — the shape
       tidyStroke would otherwise flatten (it caps the bow at 0.22 of the
       chord, deliberately, so a hand-drawn wobble cannot become a loop). */
    let mids = [];
    if (intent.via) mids = intent.via.map(t => { const p = resolve(t); return [p.x, p.y]; });
    if (intent.around) {
      const C = resolve(intent.around);
      const ax = A.x, ay = A.y;
      let vx = C.x - ax, vy = (C.y - ay) * (pitch[1] / pitch[0]);
      const L = Math.hypot(vx, vy) || 1;
      const R = 4 / pitch[0];                       // swing about 4 m wide
      const nx = -vy / L * R, ny = (vx / L * R) * (pitch[0] / pitch[1]);
      const beyond = stepTowards([C.x, C.y], [ax, ay], -4, pitch[0], pitch[1]);
      mids = [[C.x + nx, C.y + ny], [beyond[0], beyond[1]], [C.x - nx, C.y - ny]];
    }

    const path = [[A.x, A.y], ...mids, [B.x, B.y]];
    /* Resample the whole polyline to 17 points, the count tidyStroke emits, so
       planned and hand-drawn strokes are the same shape of data. */
    const seg = [];
    let total = 0;
    for (let k = 1; k < path.length; k++) {
      const d = Math.hypot(path[k][0] - path[k-1][0], path[k][1] - path[k-1][1]);
      seg.push(d); total += d;
    }
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      let want = (k / 16) * total, j = 0;
      while (j < seg.length - 1 && want > seg[j]) { want -= seg[j]; j++; }
      const f = seg[j] ? want / seg[j] : 0;
      pts.push(+(path[j][0] + (path[j+1][0] - path[j][0]) * f).toFixed(4),
               +(path[j][1] + (path[j+1][1] - path[j][1]) * f).toFixed(4));
    }

    /* A leg belongs to a SLOT, not to a player. Recording the START POINT as
       the actor's slot is what lets the drill keep looping: on lap two whoever
       is now standing there performs it. Pinning the piece id froze the
       rotation — that is the v123 lesson, now stated in the data instead of
       being worked around at playback. */
    const home = intent.by ? resolve(intent.by) : A;
    const out = { mode:kind, pts, actor:{ slot:[home.x, home.y] } };
    if (intent.after) out.after = intent.after;
    if (intent.with) out.with = intent.with;
    if (intent.arriveWith != null) out.arriveWith = intent.arriveWith;
    if (mids.length) out.via = true;
    return out;                                           // already flat for Firestore
  });

  const drill = { id:"txt-" + Date.now().toString(36), name, items, strokes };
  if (rotateL) {
    const cycle = rotateL.split(/\s*(?:->|>)\s*/).map(s => s.trim()).filter(Boolean)
      .filter(s => !/^queue$/i.test(s))     // "queue" is implied by the last hop
      .map(s => { const p = resolve(s); return [p.x, p.y]; });
    if (cycle.length > 1) drill.rotate = { cycle };
  }
  return drill;
}


  root.parseDrillText = parseDrill;

})(typeof window !== "undefined" ? window : globalThis);
