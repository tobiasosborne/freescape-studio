import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, createObject, groupObjects } from "../src/model.js";
import { Runtime } from "../src/runtime.js";
import {
  movePlayer,
  stepGravity,
  worldColliders,
  lineOfSight,
} from "../src/movement.js";
test("G09: FLY1 is horizontal, FLY2 follows pitch", () => {
  for (const mode of [2, 3]) {
    const r = new Runtime(createWorld());
    r.mode = mode;
    r.rotation = [30, 0, 0];
    r.position = [4000, 1000, 4000];
    movePlayer(r, { forward: 100 });
    assert.ok(Math.abs(r.position[1] - (mode === 2 ? 1000 : 1050)) < 0.001);
  }
});
test("swept movement stops at a solid wall and emits collision; invisible objects allow travel", () => {
  const w = createWorld(),
    o = createObject(w.areas[1], "cuboid", {
      position: [3900, 20, 4200],
      size: [200, 1000, 100],
      condition: "IF COLLIDED? THEN ADDVAR (1,V30) ENDIF",
    });
  const r = new Runtime(w);
  r.position = [4000, 300, 4000];
  r.mode = 2;
  movePlayer(r, { forward: 500 });
  assert.ok(r.position[2] < 4200);
  assert.ok(r.vars[30] > 0);
  r.object(o.id).status = "invisible";
  movePlayer(r, { forward: 500 });
  assert.ok(r.position[2] > 4200);
});
test("walk climbs low steps, stands on real pyramid surface and records unsafe falls", () => {
  const w = createWorld();
  createObject(w.areas[1], "cuboid", {
    position: [3900, 20, 4100],
    size: [200, 80, 200],
  });
  const r = new Runtime(w);
  r.position = [4000, 300, 4000];
  movePlayer(r, { forward: 150 });
  stepGravity(r, 0.02);
  assert.ok(r.position[1] >= 380);
  const pyramid = createObject(r.world.areas[1], "pyramid", {
    position: [1000, 20, 1000],
    size: [1000, 1000, 1000],
  });
  r.position = [1500, 2000, 1250];
  for (let i = 0; i < 300; i++) stepGravity(r, 0.02);
  assert.ok(r.position[1] > 700 && r.position[1] < 900);
  assert.ok(r.vars[10] > 0);
});
test("sensors respect range, directional mask, rate, effect and line of sight", () => {
  const w = createWorld();
  const sensor = createObject(w.areas[1], "sensor", {
    position: [4000, 300, 4000],
    size: [0, 0, 0],
  });
  sensor.sensor = { range: 500, speed: 2, effect: "sense", directions: ["+z"] };
  const r = new Runtime(w);
  r.position = [4000, 300, 4200];
  r.tick();
  assert.equal(r.vars[14], 0);
  r.tick();
  assert.equal(r.vars[14], 1);
  assert.equal(r.vars[13], sensor.id);
  r.position = [4000, 300, 3800];
  r.tick();
  r.tick();
  assert.equal(r.vars[14], 1);
  r.object(sensor.id).sensor.effect = "shoot";
  r.position = [4000, 300, 4200];
  r.tick();
  r.tick();
  assert.equal(r.vars[11], 1);
  createObject(r.area, "cuboid", {
    position: [3900, 20, 4100],
    size: [200, 500, 20],
  });
  assert.equal(lineOfSight(r, [4000, 300, 4000], [4000, 300, 4200]), false);
});
test("camera-style free movement bypasses area bounds and solid geometry", () => {
  const r = new Runtime(createWorld());
  r.position = [8100, 1000, 8100];
  movePlayer(r, { forward: 500 }, true);
  assert.equal(r.position[2], 8600);
});
test("colliding with an included global object dispatches its condition in the global area", () => {
  const w = createWorld(),
    wall = createObject(w.areas[0], "cuboid", {
      position: [3900, 20, 4200],
      size: [200, 1000, 100],
      condition: "IF COL? THEN ADDVAR (1,V30) ENDIF",
    });
  w.areas[1].globals = [wall.id];
  const r = new Runtime(w);
  r.position = [4000, 300, 4000];
  r.mode = 2;
  movePlayer(r, { forward: 500 });
  assert.equal(r.vars[30], 1);
});
test("including a global group adds its complete geometry to collision and line of sight", () => {
  const w = createWorld(),
    a = w.areas[0],
    wall = createObject(a, "cuboid", {
      position: [3900, 20, 4200],
      size: [200, 1000, 100],
    }),
    group = groupObjects(a, [wall.id]);
  w.areas[1].globals = [group.id];
  const r = new Runtime(w);
  assert.equal(lineOfSight(r, [4000, 300, 4000], [4000, 300, 4500]), false);
});

test("flying collision protects the complete player body when descending onto a platform", () => {
  const w = createWorld();
  createObject(w.areas[1], "cuboid", {
    position: [3800, 400, 3800],
    size: [400, 100, 400],
  });
  const r = new Runtime(w);
  r.mode = 2;
  r.position = [4000, 1000, 4000];
  movePlayer(r, { rise: -700 });
  assert.ok(
    r.position[1] - r.height >= 500 - 0.01,
    `feet penetrated platform: ${r.position[1] - r.height}`,
  );
});
test("flying collision detects a thin obstacle between the feet and head", () => {
  const w = createWorld();
  createObject(w.areas[1], "cuboid", {
    position: [3900, 800, 4200],
    size: [200, 100, 10],
  });
  const r = new Runtime(w);
  r.mode = 2;
  r.position = [4000, 1000, 4000];
  movePlayer(r, { forward: 500 });
  assert.ok(
    r.position[2] <= 4180.01,
    `player passed through a body-height obstacle: ${r.position[2]}`,
  );
});
