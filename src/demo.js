import { createWorld, createArea, createObject } from "./model.js";
export function demoWorld() {
  const w = createWorld();
  w.name = "The Quiet Citadel";
  w.author = "Freescape Studio";
  const a = w.areas[1];
  a.name = "The outer courtyard";
  a.palette = [
    "#182225",
    "#eee4d0",
    "#d2c4a7",
    "#a99c82",
    "#ba6d51",
    "#e6b675",
    "#f2d995",
    "#78938c",
    "#4b7775",
    "#afd0ce",
    "#a4bdc1",
    "#e5d8bb",
    "#7b7385",
    "#cba596",
    "#807e70",
    "#3d555b",
  ];
  a.sky = 10;
  a.ground = 11;
  a.objects[0].colors = Array(6).fill(11);
  const add = (name, pos, size, color = 2, type = "cuboid", props = {}) =>
    createObject(a, type, {
      name,
      position: pos,
      size,
      colors: [
        color,
        Math.max(1, color - 1),
        color,
        color,
        Math.max(1, color - 1),
        color,
      ],
      ...props,
    });
  add("Courtyard plinth", [2400, 20, 3000], [3200, 100, 3000], 3);
  add("West wall", [2400, 120, 3600], [280, 1000, 2400], 2);
  add("East wall", [5320, 120, 3600], [280, 1000, 2400], 2);
  add("North wall", [2400, 120, 5700], [3200, 1000, 300], 2);
  add("Gate left", [2680, 120, 3500], [900, 700, 280], 2);
  add("Gate right", [4420, 120, 3500], [900, 700, 280], 2);
  add("Gate lintel", [3580, 820, 3500], [840, 280, 280], 3);
  for (const x of [2450, 5050]) {
    add("Watchtower", [x, 120, 3150], [500, 1350, 500], 2);
    add("Copper roof", [x - 90, 1470, 3060], [680, 520, 680], 4, "pyramid");
    for (let k = 0; k < 3; k++)
      add("Tower slit", [x + 90 + k * 120, 1050, 3145], [45, 200, 8], 15);
  }
  for (let x = 2450; x <= 5500; x += 430)
    add("Battlement", [x, 1120, 5700], [230, 230, 300], 3);
  const gate = add(
    "The sealed gate",
    [3580, 120, 3500],
    [840, 700, 200],
    8,
    "cuboid",
    {
      condition:
        'IF ACTIVATED? THEN IF VAR>? (V30,2) THEN INVIS (10) PRINT ("The way is open. Find the portal.",1) ELSE PRINT ("Three amber beacons hold the key.",1) ENDIF ENDIF',
    },
  );
  gate.condition = gate.condition.replace("INVIS (10)", `INVIS (${gate.id})`);
  for (const [i, p] of [
    [0, [3200, 120, 2700]],
    [1, [4700, 120, 2500]],
    [2, [6000, 120, 3400]],
  ]) {
    const beacon = add(
      `Amber beacon ${i + 1}`,
      p,
      [150, 260, 150],
      5,
      "pyramid",
    );
    beacon.condition = `IF ACTIVATED? THEN INVIS (${beacon.id}) ADDVAR (1,V30) SOUND (4) PRINT ("An amber beacon is yours.",1) ENDIF`;
    add("Beacon pedestal", [p[0] - 35, 120, p[2] - 35], [220, 90, 220], 3);
  }
  const portal = add(
    "Portal to the observatory",
    [3920, 120, 5530],
    [200, 600, 100],
    9,
    "rectangle",
  );
  portal.condition = "IF COLLIDED? OR ACTIVATED? THEN GOTO (1,2) ENDIF";
  add("Obelisk", [1800, 20, 4600], [260, 900, 260], 15);
  add("Obelisk crown", [1760, 920, 4560], [340, 240, 340], 5, "pyramid");
  for (let i = 0; i < 4; i++)
    add(
      "Approach step",
      [3550, 20 + i * 25, 2600 + i * 100],
      [900, 25, 100],
      3,
    );
  for (const [x, z] of [
    [1200, 6000],
    [6200, 5400],
    [1500, 6500],
    [6500, 6500],
  ])
    add("Distant dune", [x, 20, z], [1000, 500, 900], 3, "pyramid");
  const moving = add(
    "Floating keystone",
    [4600, 1500, 5000],
    [160, 160, 160],
    8,
    "cuboid",
    { moveable: true },
  );
  a.animators = [
    {
      id: 1,
      name: "Keystone drift",
      source: `INCLUDE (${moving.id}) START LOOP (40) MOVE (0,5,0) AGAIN LOOP (40) MOVE (0,-5,0) AGAIN RESTART`,
    },
  ];
  a.entrances[0] = {
    id: 1,
    name: "Courtyard approach",
    position: [4000, 300, 2100],
    rotation: [0, 0, 0],
  };
  const b = createArea(w, "The observatory");
  b.palette = [...a.palette];
  b.sky = 15;
  b.objects[0].colors = Array(6).fill(15);
  createObject(b, "cuboid", {
    name: "Observatory platform",
    position: [3000, 20, 3500],
    size: [2000, 100, 2500],
    colors: Array(6).fill(8),
  });
  const trophy = createObject(b, "pyramid", {
    name: "The last light",
    position: [3900, 120, 4800],
    size: [300, 700, 300],
    colors: Array(6).fill(5),
  });
  trophy.condition =
    'IF ACTIVATED? THEN PRINT ("You restored the citadel. A world of your own awaits.",1) SOUND (6) ENDIF';
  const back = createObject(b, "rectangle", {
    name: "Return portal",
    position: [3400, 120, 3800],
    size: [300, 700, 0],
    colors: Array(6).fill(9),
  });
  back.condition = "IF ACTIVATED? THEN GOTO (1,1) ENDIF";
  b.entrances[0].position = [4000, 400, 4000];
  w.conditions = [
    {
      id: 1,
      name: "Begin the journey",
      source:
        'SETVAR (0,V30) PRINT ("Explore the citadel. Activate its three amber beacons.",1) STARTANIM (1,1)',
    },
  ];
  w.defaults.initialCondition = 1;
  w.defaults.activateRange = 1500;
  w.instruments = [
    {
      id: 1,
      name: "Story",
      type: "text",
      x: 8,
      y: 166,
      width: 304,
      height: 24,
      variable: 30,
      min: 0,
      max: 100,
      fg: 1,
      bg: 15,
      text: "",
    },
    {
      id: 2,
      name: "Beacons",
      type: "number",
      x: 288,
      y: 8,
      width: 24,
      height: 8,
      variable: 30,
      min: 0,
      max: 3,
      fg: 5,
      bg: 15,
      text: "",
    },
  ];
  return w;
}
