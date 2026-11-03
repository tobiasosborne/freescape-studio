import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createWorld,
  createArea,
  createObject,
  groupObjects,
} from "../src/model.js";
import { compile, Runtime, COMMANDS } from "../src/runtime.js";
const g = JSON.parse(
  readFileSync(new URL("./goldens/manual-behavior.json", import.meta.url)),
);
function fixture() {
  const w = createWorld(),
    o = createObject(w.areas[1], "cuboid", { position: [1000, 200, 1000] });
  return { w, o, r: new Runtime(w) };
}
test("G03: reset clears user variables and preserves V255", () => {
  const { r } = fixture();
  r.vars[30] = 600;
  r.vars[255] = 1200;
  r.reset();
  assert.equal(r.vars.length, g.G03.expected.variableCount);
  assert.equal(r.vars[30], 0);
  assert.equal(r.vars[255], 1200);
  assert.equal(r.vars[20], 15);
});
test("G04: destroyed object cannot be made visible until reset", () => {
  const { r } = fixture();
  r.run("DESTROY (2) VIS (2)");
  assert.equal(r.object(2).status, g.G04.expectedBeforeReset);
  r.reset();
  assert.equal(r.object(2).status, g.G04.expectedAfterReset);
});
test("G05: GOTO selects entrance position and rotation and stops the old area script", () => {
  const { w } = fixture();
  const a = createArea(w);
  a.entrances[0] = structuredClone(g.G05.entrance);
  const r = new Runtime(w);
  r.run("GOTO (1,2) SETVAR (12,V30)");
  assert.equal(r.areaId, 2);
  assert.deepEqual(r.position, g.G05.expected.position);
  assert.deepEqual(r.rotation, g.G05.expected.rotation);
  assert.equal(r.vars[30], 0);
});
test("G06: loop moves moveable objects 20 times and ignores static objects", () => {
  for (const moveable of [true, false]) {
    const { w, o } = fixture();
    o.moveable = moveable;
    w.areas[1].animators.push({
      id: 1,
      name: "Manual loop",
      source: g.G06.program,
    });
    const r = new Runtime(w);
    r.run("STARTANIM (1)");
    for (let i = 0; i < 30; i++) r.tick();
    assert.deepEqual(
      r.object(2).position,
      moveable ? g.G06.expectedPosition : g.G06.staticExpectedPosition,
    );
  }
});
test("G07: PRINT only updates a text instrument, and translates newline escapes", () => {
  const { w } = fixture();
  w.instruments = [
    { id: 1, type: "text", text: "" },
    { id: 2, type: "number", text: "" },
  ];
  const r = new Runtime(w);
  r.run(g.G07.program);
  assert.equal(r.world.instruments[0].text, g.G07.expectedText);
  r.run('PRINT ("NO",2)');
  assert.equal(r.world.instruments[1].text, "");
});
test("G08: mode clamps to supported player vehicles", () => {
  const { r } = fixture();
  for (const c of g.G08.cases) {
    r.run(`MODE (${c.input})`);
    assert.equal(r.mode, c.expected);
  }
});
test("FCL arithmetic uses value first, destination second; branches nest and aliases compile", () => {
  const { r } = fixture();
  r.run(
    "SETVAR (600,V30) ADDVAR (25,V30) SUBVAR (15,V30) IF VAR>? (V30,600) AND VIS? (2) THEN IF SHOT? THEN SETVAR (1,V31) ELSE SETVAR (2,V31) ENDIF ELSE SETVAR (3,V31) ENDIF",
  );
  assert.equal(r.vars[30], 610);
  assert.equal(r.vars[31], 2);
  r.run("SETVAR (7,V32) ANDV (3,V32) ORV (8,V32) XORV (1,V32) NOTV (V32)");
  assert.equal(r.vars[32], ~10);
  r.run("GETXPOS (V33,2)");
  assert.equal(r.vars[33], 1000);
});
test("initial general condition runs once; general and current area conditions run per frame", () => {
  const { w } = fixture();
  w.defaults.initialCondition = 1;
  w.conditions = [
    { id: 1, source: "ADDVAR (1,V30)" },
    { id: 2, source: "ADDVAR (1,V31)" },
  ];
  w.areas[1].conditions = [{ id: 1, source: "ADDVAR (1,V32)" }];
  createArea(w).conditions = [{ id: 1, source: "ADDVAR (1,V33)" }];
  const r = new Runtime(w);
  r.tick();
  r.tick();
  assert.deepEqual(Array.from(r.vars.slice(30, 34)), [1, 2, 2, 0]);
});
test("WAIT resumes next frame; DELAY freezes other scripts for 50hz duration", () => {
  const { w } = fixture();
  w.conditions = [{ id: 1, source: "ADDVAR (1,V30) WAIT ADDVAR (1,V31)" }];
  const r = new Runtime(w);
  r.tick();
  assert.equal(r.vars[30], 1);
  assert.equal(r.vars[31], 0);
  r.tick();
  assert.equal(r.vars[31], 1);
  r.run("DELAY (3)");
  const before = r.vars[30];
  r.tick();
  r.tick();
  assert.equal(r.vars[30], before);
  r.tick();
  assert.ok(r.vars[30] >= before);
});
test("object activation is range limited, event flags are transient and execute preserves caller", () => {
  const { w } = fixture();
  w.areas[1].objects[1].condition = "IF ACT? THEN EXECUTE (1) ENDIF";
  w.areas[1].objects[0].condition = "IF ACTIVATED? THEN GETXPOS (V30,2) ENDIF";
  const r = new Runtime(w);
  assert.equal(r.interact(2, "activated"), false);
  r.position = [1000, 300, 1000];
  assert.equal(r.interact(2, "activated"), true);
  assert.equal(r.vars[30], 1000);
  r.tick();
  assert.equal(r.vars[30], 1000);
});
test("animator WAITTRIG blocks, consumes trigger and resumes; STOP preserves state", () => {
  const { w, o } = fixture();
  o.moveable = true;
  w.areas[1].animators = [
    { id: 1, source: "INCLUDE (2) START WAITTRIG MOVE (10,0,0) END RESTART" },
  ];
  const r = new Runtime(w);
  r.run("STARTANIM (1)");
  r.tick();
  assert.equal(r.object(2).position[0], 1000);
  r.run("TRIGANIM (1)");
  r.tick();
  assert.equal(r.object(2).position[0], 1010);
  r.run("STOPANIM (1)");
  for (let i = 0; i < 3; i++) r.tick();
  assert.equal(r.object(2).position[0], 1010);
});
test("sound scheduling and timer flag use simulation frames", () => {
  const { w } = fixture();
  const sounds = [];
  w.defaults.timer = 2;
  w.conditions = [{ id: 1, source: "IF TIMER? THEN ADDVAR (1,V30) ENDIF" }];
  const r = new Runtime(w, { sound: (id) => sounds.push(id) });
  r.run("SOUND (4) SYNCSND (5)");
  assert.deepEqual(sounds, [4]);
  r.tick();
  assert.deepEqual(sounds, [4, 5]);
  r.tick();
  assert.equal(r.vars[30], 1);
});
test("compiler reports unknown commands, malformed blocks, invalid vars and literal range", () => {
  for (const source of [
    "BOGUS (1)",
    "IF SHOT? INVIS (2)",
    "LOOP (2) ENDIF",
    "SETVAR (1,V256)",
    "SETVAR (20000,V30)",
  ])
    assert.throws(
      () => compile(source),
      /line|variable|THEN|LOOP|literal/i,
      source,
    );
  assert.ok(COMMANDS.includes("WAITTRIG"));
  assert.doesNotThrow(() => compile("IF SHOT? THEN INVIS (2)")); // trailing ENDIF optional in manual examples
});
test("execution budget terminates recursive EXECUTE instead of hanging", () => {
  const { w } = fixture();
  w.areas[1].objects[1].condition = "EXECUTE (2)";
  const r = new Runtime(w);
  assert.throws(() => r.run("EXECUTE (2)"), /budget/i);
});
test("game save/load restores active state, variables, positions and animator continuations", () => {
  const { r } = fixture();
  r.vars[30] = 900;
  r.position = [500, 300, 500];
  r.run("INVIS (2)");
  const saved = r.saveGame();
  r.reset();
  r.loadGame(saved);
  assert.equal(r.vars[30], 900);
  assert.deepEqual(r.position, [500, 300, 500]);
  assert.equal(r.object(2).status, "invisible");
});
test("S1 VAR>?/VAR<? command reference uses P1 compared with P2, including aliases", () => {
  const { r } = fixture();
  r.run(
    "IF VAR>? (2,1) THEN SETVAR (1,V30) ENDIF IF V<? (1,2) THEN SETVAR (1,V31) ENDIF",
  );
  assert.equal(r.vars[30], 1);
  assert.equal(r.vars[31], 1);
});
test("S1 SHOT? and COLLIDED? consume their own event flag on first check", () => {
  for (const [op, event] of [
    ["SHOT?", "shot"],
    ["COLLIDED?", "collided"],
  ]) {
    const { w } = fixture();
    w.areas[1].objects[1].condition = `IF ${op} THEN ADDVAR (1,V30) ENDIF IF ${op} THEN ADDVAR (1,V30) ENDIF`;
    const r = new Runtime(w);
    r.interact(2, event, 0);
    assert.equal(r.vars[30], 1);
  }
});
test("S1 REMOVE detaches a member from animator movement", () => {
  const { w, o } = fixture();
  o.moveable = true;
  w.areas[1].animators = [
    { id: 1, source: "INCLUDE (2) REMOVE (2) MOVE (100,0,0)" },
  ];
  const r = new Runtime(w);
  r.run("STARTANIM (1)");
  r.tick();
  assert.deepEqual(r.object(2).position, [1000, 200, 1000]);
});
test("S1 SETVAR literal destination is a no-op", () => {
  const { r } = fixture();
  assert.doesNotThrow(() => r.run("SETVAR (1,2)"));
  assert.equal(r.vars[2], 4000);
});
test("S1 animator enclosure collides with an obstacle between two members", () => {
  const { w, o } = fixture();
  o.moveable = true;
  createObject(w.areas[1], "cuboid", {
    position: [2000, 200, 1000],
    moveable: true,
  });
  createObject(w.areas[1], "cuboid", {
    position: [1500, 200, 1300],
    size: [100, 500, 100],
    condition: "IF COL? THEN ADDVAR (1,V30) ENDIF",
  });
  w.areas[1].animators = [
    { id: 1, source: "INCLUDE (2) INCLUDE (3) MOVE (0,0,500)" },
  ];
  const r = new Runtime(w);
  r.run("STARTANIM (1)");
  r.tick();
  assert.ok(r.object(2).position[2] <= 1100);
  assert.equal(r.vars[30], 1);
});
test("ENDGAME stops the old frame immediately after restoring the world", () => {
  const w = createWorld();
  w.conditions = [
    { id: 1, source: "ENDGAME" },
    { id: 2, source: "SETVAR (99,V30)" },
  ];
  const r = new Runtime(w);
  r.tick();
  assert.equal(r.vars[30], 0);
});
test("including a moveable group animates its members together and reset restores them", () => {
  const { w, o } = fixture();
  const a = w.areas[1],
    second = createObject(a, "cuboid", { position: [1400, 200, 1000] }),
    g = groupObjects(a, [o.id, second.id]);
  g.moveable = true;
  a.animators = [{ id: 1, source: `INCLUDE (${g.id}) MOVE (100,0,0)` }];
  const r = new Runtime(w);
  r.run("STARTANIM (1)");
  r.tick();
  assert.equal(r.object(o.id).position[0], 1100);
  assert.equal(r.object(second.id).position[0], 1500);
  r.reset();
  assert.equal(r.object(second.id).position[0], 1400);
});
test("publisher startup idiom supports LOOP(0) with AGAIN inside an ELSE branch", () => {
  const w = createWorld();
  w.defaults.initialCondition = 1;
  w.conditions = [
    {
      id: 1,
      source:
        "LOOP (0) WAIT IF VAR>? (V19,3) THEN ELSE AGAIN ENDIF SETVAR (2,V30)",
    },
  ];
  const r = new Runtime(w);
  r.tick();
  r.tick();
  assert.equal(r.vars[30], 0);
  r.tick();
  r.tick();
  r.tick();
  assert.equal(r.vars[30], 2);
});
test("groups respond to member interactions and apply visibility/destruction to their members", () => {
  const { w, o } = fixture();
  const a = w.areas[1],
    group = groupObjects(a, [o.id]);
  group.condition = "IF SHOT? THEN ADDVAR (1,V30) ENDIF";
  const r = new Runtime(w);
  r.interact(o.id, "shot", 0);
  assert.equal(r.vars[30], 1);
  r.run(`INVIS (${group.id})`);
  assert.equal(r.object(o.id).status, "invisible");
  r.run(`VIS (${group.id}) DESTROY (${group.id}) VIS (${group.id})`);
  assert.equal(r.object(o.id).status, "destroyed");
  r.reset();
  assert.equal(r.object(o.id).status, "visible");
});

test("an initially invisible group hides its members until VIS reveals them", () => {
  const { w, o } = fixture(),
    g = groupObjects(w.areas[1], [o.id]);
  g.initialStatus = "invisible";
  const r = new Runtime(w);
  assert.equal(r.object(o.id).status, "invisible");
  r.run(`VIS (${g.id})`);
  assert.equal(r.object(o.id).status, "visible");
});

test("INCLUDE ignores an object owned by another animator until that animator removes it", () => {
  const { w, o } = fixture();
  o.moveable = true;
  w.areas[1].animators = [
    { id: 1, source: "INCLUDE (2) MOVE (10,0,0) REMOVE (2) END" },
    { id: 2, source: "START INCLUDE (2) MOVE (0,0,100) RESTART" },
  ];
  const r = new Runtime(w);
  r.run("STARTANIM (1) STARTANIM (2)");
  r.tick();
  assert.deepEqual(r.object(2).position, [1010, 200, 1000]);
  r.tick();
  r.tick();
  assert.equal(r.object(2).position[2], 1100);
});

test("reset applies a moveable group start position to its complete hierarchy", () => {
  const { w, o } = fixture(),
    g = groupObjects(w.areas[1], [o.id]);
  g.moveable = true;
  g.startPosition[0] += 500;
  const r = new Runtime(w);
  assert.equal(r.object(o.id).position[0], 1500);
  assert.equal(r.object(g.id).position[0], 1500);
  r.object(o.id).position[0] = 2200;
  r.reset();
  assert.equal(r.object(o.id).position[0], 1500);
});
