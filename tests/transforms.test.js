import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  createObject,
  groupObjects,
  transformObject,
} from "../src/model.js";
import { geometryFor } from "../src/geometry.js";
const bounds = (o) => {
  const g = geometryFor(o);
  g.computeBoundingBox();
  const result = {
    min: g.boundingBox.min.toArray().map((v, i) => v + o.position[i]),
    max: g.boundingBox.max.toArray().map((v, i) => v + o.position[i]),
  };
  g.dispose();
  return result;
};
const close = (actual, expected) =>
  actual.forEach((v, i) =>
    assert.ok(
      Math.abs(v - expected[i]) < 1e-6,
      `${actual} differs from ${expected}`,
    ),
  );
test("TURN keeps a non-cubic solid size and position equal to its rendered bounds", () => {
  const a = createWorld().areas[1],
    o = createObject(a, "cuboid", {
      position: [1000, 100, 1000],
      size: [100, 200, 300],
      colors: [1, 2, 3, 4, 5, 6],
    });
  transformObject(a, o.id, "rotate", [0, 90, 0]);
  assert.deepEqual(o.size, [300, 200, 100]);
  assert.deepEqual(o.position, [900, 100, 1100]);
  close(bounds(o).min, o.position);
  close(
    bounds(o).max,
    o.position.map((p, i) => p + o.size[i]),
  );
  assert.equal(o.colors[0], 5);
  assert.equal(o.colors[4], 2);
});
test("TURN rotates a facet to an orthogonal plane and keeps the centre fixed", () => {
  const a = createWorld().areas[1],
    o = createObject(a, "rectangle", {
      position: [1000, 100, 1000],
      size: [300, 200, 0],
    });
  transformObject(a, o.id, "rotate", [0, 90, 0]);
  assert.deepEqual(o.size, [0, 200, 300]);
  close(bounds(o).min, o.position);
  close(
    bounds(o).max,
    o.position.map((p, i) => p + o.size[i]),
  );
});
test("a group TURN updates all non-cubic member bounds and the group enclosure", () => {
  const a = createWorld().areas[1],
    x = createObject(a, "cuboid", {
      position: [1000, 100, 1000],
      size: [100, 100, 300],
    }),
    y = createObject(a, "cuboid", {
      position: [1500, 100, 1000],
      size: [200, 100, 100],
    }),
    g = groupObjects(a, [x.id, y.id]);
  transformObject(a, g.id, "rotate", [0, 90, 0]);
  for (const o of [x, y]) {
    close(bounds(o).min, o.position);
    close(
      bounds(o).max,
      o.position.map((p, i) => p + o.size[i]),
    );
  }
  close(
    g.position,
    [0, 1, 2].map((i) => Math.min(x.position[i], y.position[i])),
  );
  close(
    g.size,
    [0, 1, 2].map(
      (i) =>
        Math.max(x.position[i] + x.size[i], y.position[i] + y.size[i]) -
        g.position[i],
    ),
  );
});
test("a TURN that would leave the area fails without changing the object", () => {
  const a = createWorld().areas[1],
    o = createObject(a, "cuboid", {
      position: [0, 0, 1000],
      size: [100, 100, 400],
    }),
    before = structuredClone(o);
  assert.throws(
    () => transformObject(a, o.id, "rotate", [0, 90, 0]),
    /bounds|position/i,
  );
  assert.deepEqual(o, before);
});
test("centre-pivot scaling keeps the centre of a group fixed", () => {
  const a = createWorld().areas[1],
    x = createObject(a, "cuboid", {
      position: [1000, 100, 1000],
      size: [100, 100, 100],
    }),
    y = createObject(a, "cuboid", {
      position: [1200, 100, 1000],
      size: [100, 100, 100],
    }),
    g = groupObjects(a, [x.id, y.id]);
  transformObject(a, g.id, "scale", [2, 1, 1], [1150, 150, 1050]);
  assert.equal(g.position[0], 850);
  assert.equal(g.size[0], 600);
  assert.equal(x.position[0], 850);
  assert.equal(y.position[0], 1250);
});
