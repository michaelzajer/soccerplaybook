window.PRESET_DRILLS = [
  {
    id: "d-complex-passing-pattern",
    name: "Numbered Passing & Movement Pattern",
    difficulty: "complex",
    info: {
      trains: "Passing patterns, dribbling, following the pass.",
      setup: "Players 1-4 in a diamond/Y shape. Players 5-11 lined up waiting.",
      steps: [
        "Player 1 dribbles towards Player 2.",
        "Player 2 passes to Player 3 and follows the pass.",
        "Player 3 dribbles to Player 4.",
        "Player 4 dribbles forward then passes back to the start (Player 5)."
      ],
      coaching: [
        "Keep the ball close when dribbling.",
        "Firm, accurate passes on the ground.",
        "Sprint to the next cone after passing."
      ]
    },
    items: [
      { kind: "att", x: 0.5, y: 0.75, num: "1" },
      { kind: "att", x: 0.3, y: 0.55, num: "2" },
      { kind: "att", x: 0.7, y: 0.55, num: "3" },
      { kind: "att", x: 0.5, y: 0.35, num: "4" },
      { kind: "att", x: 0.5, y: 0.82, num: "5" },
      { kind: "att", x: 0.5, y: 0.85, num: "6" },
      { kind: "att", x: 0.5, y: 0.88, num: "7" },
      { kind: "att", x: 0.5, y: 0.91, num: "8" },
      { kind: "att", x: 0.5, y: 0.94, num: "9" },
      { kind: "att", x: 0.5, y: 0.97, num: "10" },
      { kind: "att", x: 0.5, y: 1.00, num: "11" },
      { kind: "cone", x: 0.3, y: 0.55 },
      { kind: "cone", x: 0.7, y: 0.55 },
      { kind: "cone", x: 0.5, y: 0.35 },
      { kind: "dball", x: 0.5, y: 0.73 }
    ],
    steps: [
      // Step 0: P1 dribbles to P2
      [
        { mode: "dribble", pts: [[0.5, 0.75], [0.32, 0.57]] }
      ],
      // Step 1: P2 passes to P3 and follows pass
      [
        { mode: "pass", pts: [[0.32, 0.57], [0.68, 0.57]] },
        { mode: "run", pts: [[0.32, 0.57], [0.68, 0.57]] }
      ],
      // Step 2: P3 dribbles to P4
      [
        { mode: "dribble", pts: [[0.68, 0.57], [0.52, 0.37]] }
      ],
      // Step 3: P4 dribbles forward
      [
        { mode: "dribble", pts: [[0.52, 0.37], [0.52, 0.20]] }
      ],
      // Step 4: P4 passes to P5
      [
        { mode: "pass", pts: [[0.52, 0.20], [0.5, 0.80]] }
      ]
    ]
  }
];
