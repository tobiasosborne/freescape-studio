import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  createObject,
  groupObjects,
  transformObject,
  parseWorld,
  serializeWorld,
} from "../src/model.js";
import { Runtime } from "../src/runtime.js";
import { controlAction } from "../src/controls.js";
test("system 50 Hz counter can be reset from FCL and then advances independently", () => {
  const r = new Runtime(createWorld());
  for (let i = 0; i < 10; i++) r.tick();
  r.run("SETVAR (0,V19)");
  r.tick();
  assert.equal(r.vars[19], 1);
});
test("unread SHOT flag remains available on a later activation until consumed", () => {
  const w = createWorld();
  const o = createObject(w.areas[1], "cuboid", {
    condition: "IF ACTIVATED? THEN IF SHOT? THEN SETVAR (1,V30) ENDIF ENDIF",
  });
  const r = new Runtime(w);
  r.interact(o.id, "shot", 0);
  r.interact(o.id, "activated", 0);
  assert.equal(r.vars[30], 1);
});
test("global object interactions update included global object state without ID collisions", () => {
  const w = createWorld();
  const o = createObject(w.areas[0], "cuboid", {
    condition: "IF ACTIVATED? THEN INVIS (1,0) ENDIF",
  });
  w.areas[1].globals = [o.id];
  const r = new Runtime(w);
  assert.equal(r.interact(o.id, "activated", 0, 0), true);
  assert.equal(r.object(1, 0).status, "invisible");
  assert.equal(r.object(1, 1).status, "visible");
});
test("border zones require a defined action key and obey mouse button masks and screen coordinates", () => {
  const w = createWorld();
  w.controlZones = [
    {
      action: "forward",
      x: 0,
      y: 180,
      width: 40,
      height: 20,
      button: "either",
    },
    {
      action: "activate",
      x: 50,
      y: 180,
      width: 40,
      height: 20,
      button: "both",
    },
  ];
  assert.equal(controlAction(w, 20, 190, 1), "forward");
  assert.equal(controlAction(w, 20, 190, 2), "forward");
  assert.equal(controlAction(w, 60, 190, 1), null);
  assert.equal(controlAction(w, 60, 190, 3), "activate");
  w.controls.forward = "";
  assert.equal(controlAction(w, 20, 190, 1), null);
});
test("malformed projects reject non-finite defaults, unsafe assets and duplicate entrances", () => {
  for (const change of [
    (w) => (w.defaults.climb = -1),
    (w) => (w.areas[1].scale = 0),
    (w) => (w.border = "https://untrusted.test/x"),
    (w) => w.areas[1].entrances.push(structuredClone(w.areas[1].entrances[0])),
  ]) {
    const w = createWorld();
    change(w);
    assert.throws(() => parseWorld(serializeWorld(w)));
  }
});
test("group stretching scales member positions and sizes from group origin", () => {
  const w = createWorld(),
    a = w.areas[1];
  const first = createObject(a, "cuboid", {
      position: [1000, 100, 1000],
      size: [100, 100, 100],
    }),
    second = createObject(a, "cuboid", {
      position: [1200, 100, 1000],
      size: [100, 100, 100],
    });
  const group = groupObjects(a, [first.id, second.id]);
  transformObject(a, group.id, "scale", [2, 1, 1]);
  assert.equal(second.position[0], 1400);
  assert.equal(first.size[0], 200);
  assert.equal(group.size[0], 600);
});
test("turning a group rotates members around its common centre", () => {
  const w = createWorld(),
    a = w.areas[1];
  const x = createObject(a, "cuboid", {
      position: [1000, 100, 1000],
      size: [100, 100, 100],
    }),
    y = createObject(a, "cuboid", {
      position: [1200, 100, 1000],
      size: [100, 100, 100],
    });
  const g = groupObjects(a, [x.id, y.id]);
  transformObject(a, g.id, "rotate", [0, 90, 0]);
  assert.ok(Math.abs(x.position[0] - y.position[0]) < 0.001);
  assert.ok(Math.abs(x.position[2] - y.position[2]) >= 199.9);
});
