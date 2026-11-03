import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createWorld,
  createArea,
  createObject,
  duplicateObject,
  groupObjects,
  transformObject,
  History,
  serializeWorld,
  parseWorld,
} from "../src/model.js";
const g = JSON.parse(
  readFileSync(new URL("./goldens/manual-behavior.json", import.meta.url)),
);

test("G01: new areas contain cuboid 1 and entrance 1", () => {
  const world = createWorld();
  const area = createArea(world, "Second");
  assert.equal(area.objects[0].id, g.G01.expected.baseId);
  assert.equal(area.objects[0].type, g.G01.expected.baseType);
  assert.equal(area.entrances[0].id, g.G01.expected.entranceId);
  assert.equal(world.areas[0].id, 0);
  assert.equal(area.id, 2);
});
test("G02: copy preserves conditions and has a new identity", () => {
  const a = createWorld().areas[1];
  const o = createObject(a, "cuboid");
  o.condition = g.G02.sourceCondition;
  const c = duplicateObject(a, o.id, [200, 0, 0]);
  assert.equal(c.id, g.G02.copyId);
  assert.equal(c.condition, g.G02.expectedCondition);
  assert.notEqual(c.position, o.position);
});
test("group copy remaps members and transforms each child once", () => {
  const a = createWorld().areas[1];
  const x = createObject(a, "cuboid", { position: [100, 100, 100] });
  const y = createObject(a, "pyramid", { position: [400, 100, 100] });
  const group = groupObjects(a, [x.id, y.id]);
  const copy = duplicateObject(a, group.id, [0, 0, 500]);
  assert.equal(copy.members.length, 2);
  assert.ok(!copy.members.includes(x.id));
  transformObject(a, copy.id, "move", [25, 0, 0]);
  assert.equal(
    a.objects.find((o) => o.id === copy.members[0]).position[0],
    125,
  );
  assert.equal(x.position[0], 100);
});
test("history atomically undoes and redoes a world edit", () => {
  const h = new History(createWorld());
  h.perform((w) => createObject(w.areas[1], "cuboid"));
  assert.equal(h.state.areas[1].objects.length, 2);
  h.undo();
  assert.equal(h.state.areas[1].objects.length, 1);
  h.redo();
  assert.equal(h.state.areas[1].objects.length, 2);
});
test("world round trips and rejects invalid input without mutating caller", () => {
  const w = createWorld();
  assert.deepEqual(parseWorld(serializeWorld(w)), w);
  assert.throws(
    () => parseWorld('{"format":"freescape-studio","version":999}'),
    /version/i,
  );
  const bad = structuredClone(w);
  bad.areas[1].objects[0].position[0] = NaN;
  assert.throws(() => parseWorld(JSON.stringify(bad)), /position/i);
});
test("invalid transforms are atomic", () => {
  const a = createWorld().areas[1];
  const o = createObject(a, "cuboid", {
    position: [8000, 0, 0],
    size: [100, 100, 100],
  });
  assert.throws(() => transformObject(a, o.id, "move", [200, 0, 0]), /bounds/i);
  assert.deepEqual(o.position, [8000, 0, 0]);
});
test("world look is optional and limited to shaded or flat", () => {
  const w = createWorld();
  assert.equal(parseWorld(serializeWorld(w)).look, undefined);
  for (const look of ["shaded", "flat"])
    assert.equal(parseWorld(serializeWorld({ ...w, look })).look, look);
  assert.throws(
    () => parseWorld(serializeWorld({ ...w, look: "neon" })),
    /Invalid world look/,
  );
});
