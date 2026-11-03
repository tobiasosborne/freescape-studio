import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { EditorNavigation } from "../src/navigation.js";
import { createWorld } from "../src/model.js";
test("five editor cameras retain independent positions and freely cross area limits", () => {
  const world = createWorld(),
    camera = new THREE.PerspectiveCamera();
  camera.position.set(8000, 1000, 8000);
  const view = {
    camera,
    orbit: {
      enabled: true,
      target: new THREE.Vector3(8000, 1000, 9000),
      update() {},
    },
    cameraState() {
      return {
        position: camera.position.toArray(),
        target: this.orbit.target.toArray(),
      };
    },
    restoreCamera(s) {
      camera.position.fromArray(s.position);
      this.orbit.target.fromArray(s.target);
    },
    player(r) {
      camera.position.fromArray(r.position);
    },
  };
  const nav = new EditorNavigation(
    () => world,
    () => 1,
    view,
  );
  nav.setMode("cam1");
  nav.keys.add("w");
  nav.step(0.5);
  nav.keys.clear();
  const first = [...nav.state.position];
  assert.ok(first[2] > 8192);
  nav.setMode("cam2");
  nav.keys.add("s");
  nav.step(0.1);
  nav.keys.clear();
  nav.setMode("cam1");
  assert.deepEqual(nav.state.position, first);
  assert.equal(view.orbit.enabled, false);
  nav.setMode("orbit");
  assert.equal(view.orbit.enabled, true);
});
