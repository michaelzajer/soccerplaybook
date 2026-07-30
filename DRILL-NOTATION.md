# Drill notation

A short text format for describing a drill precisely enough that it can be built
without anyone guessing at the geometry. Paste it into the app (**Drills → Import
from text…**) or hand it to Claude.

Why it exists: describing a drill in prose leaves the layout ambiguous, and every
drill built from prose so far has come out wrong. A picture of the pitch plus an
ordered list of actions removes the guesswork.

There are two ways to write one. **Describe it in metres** (usually what you
want), or **draw a grid picture** (when the layout is irregular).

---

# 1. Describing it in metres

Three blocks, in the order you would explain the drill to an assistant.

```
DRILL Passing square

CONES
square 14              # 4 cones, 14 m sides
centre 50% 55%         # optional; defaults to the middle of the pitch

PLAYERS
12 spread evenly       # 3 to each cone: one on it, two queued behind
start bottom-left      # that cone is the entry, and player 1 stands on it

SEQUENCE
pass and follow        # each player passes to the next cone and follows the pass
```

## Why metres work

The board is a real pitch — **68 m wide by 105 m long** — so distances convert
exactly. Two things worth knowing:

- The app's snapping square is about **5 m**, so a 14 m square is just under
  three squares a side. Anything under ~5 m apart will snap onto the same square.
- A square in metres is deliberately **not** a square in board coordinates: 14 m
  is 21% of the width but only 13% of the length. The parser handles that; you
  just give real distances.
- Queue spacing is one snapping square (~5 m). A real queue stands closer than
  that, but the pieces are about 5 m across, so anything tighter merges them.

## CONES

| Line | Meaning |
|---|---|
| `square 14` | four cones, 14 m sides |
| `rectangle 20 x 12` | 20 m across, 12 m deep |
| `diamond 14` | four cones, 14 m across the points |
| `triangle 12` | equilateral, 12 m sides, apex upfield |
| `line 4 x 8` | four cones in a row, 8 m apart (`vertical` for up the pitch) |
| `pair 15` | two cones 15 m apart up the pitch (`across` for side by side) |
| `centre 34 52` | put the shape's middle here, in metres |
| `centre 50% 60%` | …or as a percentage of the pitch |

Cones are numbered **from the bottom-left, clockwise** — up the left side, across
the top, down the right — which is how a follow-your-pass circuit reads. Refer to
them as `c1`, `c2`, `c3`…

## PLAYERS

| Line | Meaning |
|---|---|
| `12 spread evenly` | shared out across the cones, queueing behind each |
| `8 all at c1` | everyone queued at one cone |
| `start bottom-left` | which cone is the entry (`start cone c3` also works) |

Numbering runs **one to each cone first**, then fills the second place in each
queue, and so on. So with 12 players and 4 cones, players 1–4 stand on the cones,
5–8 are second in each queue, 9–12 third — which means "player 1 passes to player
2" always means "to the next cone round", exactly as you would say it.

## SEQUENCE

| Line | Meaning |
|---|---|
| `pass and follow` | the whole circuit: each player passes to the next cone and follows |
| `shuttle` | two cones, fronts swapping ends (use with `pair`) |
| `pass 1 -> 2` | an explicit step |
| `run 1 -> c2` | …by player or by cone |
| `passrun c1 -> c2` | pass and follow, as one action |

`pass and follow` writes a **closed** circuit — four passes for four cones, not
three. That closing pass is what recycles players back to the queue; leave it out
and the drill drains after one pass through and looks broken.

---

# 2. Drawing a grid picture

Use this when the layout will not fall out of a shape — irregular positions,
mixed kit, or two separate lanes.

## The shape of a file

```
DRILL <name>

GRID
<one row of squares per line, separated by spaces>

LINES
<one action per line, in the order you would draw them>
```

Anything after `#` is a comment.

## GRID

One token per square, separated by whitespace. Rows top to bottom, so the grid is
a plan view of the pitch with your goal at the bottom.

| Token | Meaning |
|---|---|
| `.` or `-` | empty square |
| `o` | cone |
| `o!` | the cone the queue feeds into (the entry) |
| `d` | disc — `d!` also works |
| `*` | ball |
| `1` … `99` | one of your players, by shirt number |
| `r1` … `r99` | an opposition player |
| `p` | pole |
| `G` | full goal |
| `g` | mini goal |
| `o+1` | two things on the **same** square — here a cone with player 1 on it |

The grid can be any size; it is scaled to the pitch. Roughly 12 wide by 10–20 deep
matches the app's own snapping grid, where one square is about one cone.

## LINES

One action per line, in **the order you would draw them on the board**. Draw order
is not cosmetic — the engine reads backwards through it to work out what waits for
what, so "A passes, then B runs onto it" must be written in that order.

```
pass     1 -> 2        # a pass from player 1 to player 2
run      1 -> o3       # player 1 runs to cone 3
dribble  2 -> o4       # player 2 carries the ball to cone 4
passrun  o1 -> o2      # pass and follow it (one action)
pass     1 -> F9       # a pass into SPACE — the square at column F, row 9
```

Numbering is optional; `1.` or `1)` at the start of a line is ignored.

### Naming things

- **Players** — their shirt number: `1`, `7`, `11`. Opposition: `r4`.
- **Cones and discs** — `o1`, `o2`, `o3`… numbered in reading order, left to
  right and top to bottom. `c1`, `c2` also work.
- **Balls** — `*1`, `*2`, or just `*` for the first one.
- **A bare square** — a column letter and a row number, `A1` top-left, counting
  the way you wrote the grid. Use this for a pass into space, where the ball is
  meant to stop short of anybody.

### What the engine does on its own

You do not need to describe the timing. Given the lines in draw order it works out:

- a pass into space, with a player running on to collect it;
- a pass aimed at wherever a player has just run to;
- a player leaving only once they have played the ball;
- the ball arriving before the man who passed it;
- everyone rotating back through the queue at the end of a lap.

## Worked example

`tools/examples/square.txt` — four cones in a square, players 1–4 on them, 5–8
queued behind cone 1, follow your pass:

```
DRILL Passing square

GRID
.  .  .     .  .  .  .  .    .  .  .
.  .  o+2   .  .  .  .  o+3  .  .  .
.  .  .     .  .  .  .  .    .  .  .
.  .  .     .  .  .  .  .    .  .  .
.  .  o!+1  .  .  .  .  o+4  .  .  .
.  .  *     .  .  .  .  .    .  .  .
.  .  5     .  .  .  .  .    .  .  .
.  .  6     .  .  .  .  .    .  .  .
.  .  7     .  .  .  .  .    .  .  .
.  .  8     .  .  .  .  .    .  .  .

LINES
1. passrun o1 -> o3
2. passrun o3 -> o4
3. passrun o4 -> o2
4. passrun o2 -> o1
```

A follow-your-pass square is a **closed** circuit: four passes, not three. Leave
the last one out and the queue drains after four laps, which looks exactly like an
engine bug and is not one.

## Command line

```bash
node tools/drill-from-text.mjs tools/examples/square.txt
node tools/drill-from-text.mjs my-drill.txt --name "Complex 3"
```

Prints the drill as JSON on stdout, ready to paste into **Import from text…**.

The parser lives in `js/drill-text.js` and is shared by the app and the CLI, so
the two cannot drift apart. `_notation.mjs` takes the example above all the way
through to playback and asserts the rotation is correct.
