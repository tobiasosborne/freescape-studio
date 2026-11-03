import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { Viewport } from "../src/viewport.js";
import { createWorld, createObject, groupObjects } from "../src/model.js";
test("Three.js viewport installs TransformControls helper, updates picking and disposes resources", () => {
  const dom = new JSDOM('<div id="view"></div>');
  const prior = {
    document: globalThis.document,
    window: globalThis.window,
    devicePixelRatio: globalThis.devicePixelRatio,
    ResizeObserver: globalThis.ResizeObserver,
  };
  Object.assign(globalThis, {
    document: dom.window.document,
    window: dom.window,
    devicePixelRatio: 1,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
  });
  try {
    const host = document.querySelector("#view");
    Object.defineProperties(host, {
      clientWidth: { value: 800 },
      clientHeight: { value: 600 },
    });
    const renderer = {
      domElement: document.createElement("canvas"),
      setPixelRatio() {},
      setSize() {},
      render() {},
      dispose() {},
    };
    const errors = [],
      oldError = console.error;
    const transforms = [];
    console.error = (...args) => errors.push(args[0]);
    let view;
    try {
      view = new Viewport(
        host,
        {
          transform(...args) {
            transforms.push(args);
          },
        },
        () => renderer,
      );
    } finally {
      console.error = oldError;
    }
    assert.deepEqual(errors, []);
    assert.ok(view.scene.children.includes(view.transform.getHelper()));
    const w = createWorld(),
      o = createObject(w.areas[1], "cuboid");
    view.setTool("translate");
    view.update(w, 1, { selected: [o.id] });
    assert.equal(view.transform.object.userData.id, o.id);
    assert.deepEqual(
      view.transform.object.position.toArray(),
      o.position.map((p, i) => p + o.size[i] / 2),
    );
    view.transform.object.geometry.computeBoundingBox();
    assert.deepEqual(
      view.transform.object.geometry.boundingBox
        .getCenter(view.camera.position.clone())
        .toArray(),
      [0, 0, 0],
    );
    view.transform.dragging = true;
    view.transform.object.position.x += 50;
    view.transform.dragging = false;
    assert.deepEqual(
      transforms[0][1],
      o.position.map((p, i) => p + (i === 0 ? 50 : 0)),
    );
    view.render();
    const another = createObject(w.areas[1], "cuboid", {
      position: [4500, 20, 4600],
    });
    const group = groupObjects(w.areas[1], [o.id, another.id]);
    view.update(w, 1, { selected: [group.id] });
    assert.equal(view.transform.object.userData.id, group.id);
    assert.equal(view.selection.visible, true);
    view.dispose();
  } finally {
    Object.assign(globalThis, prior);
    dom.window.close();
  }
});
