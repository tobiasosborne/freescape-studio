import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, createObject, TYPES } from "../src/model.js";
import { geometryFor, faceCount, materialsFor } from "../src/geometry.js";
test("all geometric primitive families produce finite vertices and expected faces", () => {
  const a = createWorld().areas[1];
  for (const type of TYPES.filter((t) => !["sensor", "group"].includes(t))) {
    const o = createObject(a, type);
    const geometry = geometryFor(o);
    assert.ok(geometry.attributes.position.count > 0, type);
    assert.ok(
      Array.from(geometry.attributes.position.array).every(Number.isFinite),
      type,
    );
    geometry.computeBoundingBox();
    assert.ok(geometry.boundingBox.min.x >= -0.001);
    assert.ok(geometry.boundingBox.max.x <= 200.001);
  }
  assert.equal(faceCount("cuboid"), 6);
  assert.equal(faceCount("hexagon"), 2);
});
test("two-colour face shades preserve both palette entries in a repeating texture", () => {
  const a = createWorld().areas[1],
    o = createObject(a, "cuboid");
  o.patterns = [{ a: 1, b: 4 }, null, null, null, null, null];
  const materials = materialsFor(o, a.palette);
  assert.ok(materials[0].map?.isDataTexture);
  assert.equal(materials[0].map.image.data.length, 16);
  assert.ok(geometryFor(o).attributes.uv);
  for (const m of materials) {
    m.map?.dispose();
    m.dispose();
  }
});
test("solid cuboid faces point outward, including its upward floor surface", () => {
  const a = createWorld().areas[1],
    o = createObject(a, "cuboid"),
    g = geometryFor(o),
    normals = g.attributes.normal;
  const expected = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  g.groups.forEach((group, i) => {
    assert.deepEqual(
      [
        normals.getX(group.start),
        normals.getY(group.start),
        normals.getZ(group.start),
      ].map((n) => (Math.abs(n) < 0.0001 ? 0 : n)),
      expected[i],
    );
  });
});
test("point edits and orthogonal turns are represented in geometry", () => {
  const a = createWorld().areas[1],
    o = createObject(a, "triangle");
  o.points[0] = [0, 0, 0.5];
  const g = geometryFor(o);
  assert.ok(Array.from(g.attributes.position.array).includes(100));
  const box = createObject(a, "cuboid", {
    size: [100, 200, 300],
    rotation: [0, 90, 0],
  });
  const rotated = geometryFor(box);
  rotated.computeBoundingBox();
  assert.ok(
    Math.abs(rotated.boundingBox.max.x - rotated.boundingBox.min.x - 300) <
      0.001,
  );
});
