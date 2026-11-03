import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  createObject,
  groupObjects,
  parseWorld,
  serializeWorld,
} from "../src/model.js";
import {
  exportObject,
  importObject,
  WorldLibrary,
  instrumentValue,
  spreadPalette,
} from "../src/persistence.js";
test("S1 object files preserve geometry/group but omit names and conditions; load remaps IDs", () => {
  const w = createWorld(),
    a = w.areas[1];
  const x = createObject(a, "cuboid"),
    y = createObject(a, "pyramid");
  x.name = "Secret";
  x.condition = "ENDGAME";
  const group = groupObjects(a, [x.id, y.id]);
  const saved = exportObject(a, group.id);
  const data = JSON.parse(saved);
  assert.equal(data.objects.length, 3);
  assert.ok(data.objects.every((o) => !("name" in o) && !("condition" in o)));
  const loaded = importObject(a, saved);
  assert.equal(loaded.members.length, 2);
  assert.notEqual(loaded.id, group.id);
  assert.equal(a.objects.find((o) => o.id === loaded.members[0]).condition, "");
});
test("local library save, load, delete and failure reporting use separate namespaced entries", () => {
  const map = new Map(),
    storage = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, v),
      removeItem: (k) => map.delete(k),
    };
  const lib = new WorldLibrary(storage);
  lib.save("My world", createWorld());
  assert.deepEqual(lib.list(), ["My world"]);
  assert.equal(lib.load("My world").format, "freescape-studio");
  lib.remove("My world");
  assert.deepEqual(lib.list(), []);
  assert.throws(() => lib.load("Missing"), /not found/i);
});
test("instruments clamp and scale reversed bars, signed numbers and undefined types", () => {
  const vars = new Int32Array(256);
  vars[30] = 25;
  assert.equal(
    instrumentValue(
      { type: "horizontal", variable: 30, min: 0, max: 100 },
      vars,
    ),
    0.25,
  );
  assert.equal(
    instrumentValue({ type: "vertical", variable: 30, min: 100, max: 0 }, vars),
    0.75,
  );
  vars[30] = -25;
  assert.equal(
    instrumentValue(
      { type: "number", variable: 30, min: -100, max: 100 },
      vars,
    ),
    "-25",
  );
  assert.equal(instrumentValue({ type: "undefined" }, vars), null);
});
test("palette spread includes endpoints and quantizes channels to original four-bit RGB", () => {
  const p = Array(16).fill("#000000");
  p[3] = "#ffffff";
  spreadPalette(p, 0, 3);
  assert.deepEqual(p.slice(0, 4), ["#000000", "#555555", "#aaaaaa", "#ffffff"]);
});
test("S1 LOAD OBJECT searches upward for space and fails atomically when the area is full", () => {
  const w = createWorld(),
    a = w.areas[1],
    o = createObject(a, "cuboid", { position: [1000, 20, 1000] }),
    imported = importObject(a, exportObject(a, o.id));
  assert.ok(imported.position[1] >= 220);
  const full = createWorld().areas[1];
  full.objects = [];
  const giant = createObject(full, "cuboid", {
      position: [0, 0, 0],
      size: [8192, 8192, 8192],
    }),
    before = a.objects.length;
  assert.throws(
    () => importObject(a, exportObject(full, giant.id)),
    /space|bounds/i,
  );
  assert.equal(a.objects.length, before);
});

test("world loading rejects incomplete player/view settings and malformed geometry before the editor uses them", () => {
  for (const change of [
    (w) => delete w.viewWindow,
    (w) => (w.viewWindow.width = 321),
    (w) => delete w.preferences,
    (w) => delete w.defaults.climb,
    (w) => (w.defaults.mode = 1.5),
    (w) => (w.areas[1].objects[0].colors = []),
    (w) => (w.areas[1].objects[0].members = null),
    (w) => {
      const o = createObject(w.areas[1], "pyramid");
      o.points = [];
    },
    (w) => {
      const o = createObject(w.areas[1], "sensor");
      o.sensor.speed = 0;
    },
    (w) => (w.sounds[0].id = 31),
    (w) => (w.areas[1].globals = [999]),
  ]) {
    const w = createWorld();
    change(w);
    assert.throws(
      () => parseWorld(serializeWorld(w)),
      /invalid|missing|bounds/i,
    );
  }
});
