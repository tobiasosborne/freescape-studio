import test from "node:test";
import assert from "node:assert/strict";
import { demoWorld } from "../src/demo.js";
import { Runtime, compile } from "../src/runtime.js";
import { movePlayer, stepGravity } from "../src/movement.js";
import { parseWorld, serializeWorld } from "../src/model.js";
test("sample world validates and every object, area, general and animator script compiles", () => {
  const w = demoWorld();
  assert.deepEqual(parseWorld(serializeWorld(w)), w);
  for (const a of w.areas) {
    for (const o of a.objects) compile(o.condition);
    for (const c of [...a.conditions, ...a.animators]) compile(c.source);
  }
  for (const c of w.conditions) compile(c.source);
});
test("sample has reachable outer beacons, a locked gate and an instrumented two-area conclusion", () => {
  const r = new Runtime(demoWorld()),
    beacons = r.area.objects.filter((o) => o.name.startsWith("Amber beacon")),
    gate = r.area.objects.find((o) => o.name === "The sealed gate");
  r.interact(gate.id, "activated", 0);
  assert.equal(gate.status, "visible");
  assert.ok(
    beacons.every((o) => o.position[2] < 3500),
    "Beacons must be outside the locked wall",
  );
  for (const o of beacons) {
    r.position = [o.position[0], 300, o.position[2] - 200];
    assert.equal(r.interact(o.id, "activated"), true);
  }
  assert.equal(r.vars[30], 3);
  r.interact(gate.id, "activated", 0);
  assert.equal(gate.status, "invisible");
  const portal = r.area.objects.find((o) => o.name.startsWith("Portal"));
  r.interact(portal.id, "activated", 0);
  assert.equal(r.areaId, 2);
  const trophy = r.area.objects.find((o) => o.name === "The last light");
  r.interact(trophy.id, "activated", 0);
  assert.match(r.world.instruments[0].text, /restored the citadel/);
});
