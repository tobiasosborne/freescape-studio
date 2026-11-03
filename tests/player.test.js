import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { Player } from "../src/play.js";
import { createWorld, createObject } from "../src/model.js";
test("player handles Shift movement, a missed shot and custom border controls", () => {
  const dom = new JSDOM(
    '<div id="host"><canvas></canvas><div id="hud"></div></div>',
    { url: "https://freescape.test" },
  );
  const prev = {
    window: globalThis.window,
    document: globalThis.document,
    localStorage: globalThis.localStorage,
  };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
  });
  try {
    const host = document.querySelector("#host");
    Object.defineProperties(host, {
      clientWidth: { value: 640 },
      clientHeight: { value: 400 },
    });
    host.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 640,
      height: 400,
    });
    const viewport = {
      host,
      renderer: { domElement: document.querySelector("canvas") },
      pick: () => null,
      update() {},
      player() {},
    };
    viewport.renderer.domElement.getBoundingClientRect =
      host.getBoundingClientRect;
    const w = createWorld();
    w.defaults.mode = 2;
    w.controlZones = [
      {
        action: "forward",
        x: 0,
        y: 180,
        width: 40,
        height: 20,
        button: "left",
      },
    ];
    const player = new Player(w, viewport, document.querySelector("#hud"));
    player.audio.enabled = false;
    const start = player.runtime.position[2];
    player.down({
      target: document.body,
      key: "W",
      repeat: false,
      preventDefault() {},
    });
    player.down({
      target: document.body,
      key: "Shift",
      repeat: false,
      preventDefault() {},
    });
    player.step(player.last + 40);
    assert.ok(player.runtime.position[2] > start);
    player.interact("shot");
    assert.equal(player.runtime.vars[21], 1);
    player.keys.clear();
    host.dispatchEvent(
      new dom.window.MouseEvent("pointerup", {
        bubbles: true,
        clientX: 20,
        clientY: 380,
        button: 0,
      }),
    );
    assert.ok(player.keys.has("w"));
    player.dispose();
  } finally {
    Object.assign(globalThis, prev);
    dom.window.close();
  }
});
test("player supports separate fly selection, walk/fly toggle and centre cursor toggle", () => {
  const dom = new JSDOM(
    '<div id="host"><canvas></canvas><div id="hud"></div></div>',
    { url: "https://freescape.test" },
  );
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
  });
  try {
    const viewport = {
      host: document.querySelector("#host"),
      renderer: { domElement: document.querySelector("canvas") },
      pick: () => null,
    };
    const w = createWorld(),
      player = new Player(w, viewport, document.querySelector("#hud"));
    const key = (value) =>
      player.down({
        target: document.body,
        key: value,
        repeat: false,
        preventDefault() {},
      });
    key("b");
    key("v");
    assert.equal(player.runtime.mode, 3);
    key("v");
    assert.equal(player.runtime.mode, 1);
    key("x");
    assert.equal(document.querySelector(".crosshair"), null);
    player.dispose();
  } finally {
    Object.assign(globalThis, previous);
    dom.window.close();
  }
});
test("a mouse miss does not fall back to shooting the object under the centre cursor", () => {
  const dom = new JSDOM('<div><canvas></canvas><div id="hud"></div></div>', {
      url: "https://freescape.test",
    }),
    prior = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
  });
  try {
    const w = createWorld(),
      o = createObject(w.areas[1], "cuboid", {
        condition: "IF SHOT? THEN ADDVAR (1,V30) ENDIF",
      }),
      host = document.querySelector("div"),
      canvas = document.querySelector("canvas");
    canvas.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 640,
      height: 400,
    });
    const p = new Player(
      w,
      {
        host,
        renderer: { domElement: canvas },
        pick: () => ({ id: o.id, distance: 0 }),
      },
      document.querySelector("#hud"),
    );
    p.audio.enabled = false;
    p.interact("shot", null);
    assert.equal(p.runtime.vars[30], 0);
    assert.equal(p.runtime.vars[21], 1);
    p.interact("shot");
    assert.equal(p.runtime.vars[30], 1);
    p.dispose();
  } finally {
    Object.assign(globalThis, prior);
    dom.window.close();
  }
});

test("mouse button and logical-screen coordinates populate V16, V17 and V18", () => {
  const dom = new JSDOM('<div><canvas></canvas><div id="hud"></div></div>', {
      url: "https://freescape.test",
    }),
    prior = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
  });
  try {
    const host = document.querySelector("div"),
      canvas = document.querySelector("canvas");
    host.getBoundingClientRect = () => ({
      left: 100,
      top: 50,
      width: 640,
      height: 400,
    });
    canvas.getBoundingClientRect = host.getBoundingClientRect;
    const p = new Player(
      createWorld(),
      { host, renderer: { domElement: canvas }, pick: () => null },
      document.querySelector("#hud"),
    );
    p.audio.enabled = false;
    p.pointer({ button: 0, buttons: 3, clientX: 300, clientY: 250 }, null);
    assert.deepEqual(Array.from(p.runtime.vars.slice(16, 19)), [3, 100, 100]);
    p.dispose();
  } finally {
    Object.assign(globalThis, prior);
    dom.window.close();
  }
});

test("walk height can be adjusted with rise/fall and FCL height changes survive the next frame", () => {
  const dom = new JSDOM('<div><canvas></canvas><div id="hud"></div></div>', {
      url: "https://freescape.test",
    }),
    prior = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
  });
  try {
    const host = document.querySelector("div"),
      canvas = document.querySelector("canvas"),
      p = new Player(
        createWorld(),
        {
          host,
          renderer: { domElement: canvas },
          pick: () => null,
          update() {},
          player() {},
        },
        document.querySelector("#hud"),
      );
    const feet = p.runtime.position[1] - p.runtime.height;
    p.keys.add("f");
    p.step(p.last + 40);
    assert.ok(p.runtime.height < 280);
    assert.ok(Math.abs(p.runtime.position[1] - p.runtime.height - feet) < 0.01);
    p.keys.clear();
    p.runtime.run("SETVAR (100,V7)");
    p.step(p.last + 20);
    assert.equal(p.runtime.height, 100);
    p.dispose();
  } finally {
    Object.assign(globalThis, prior);
    dom.window.close();
  }
});
test("releasing crouch under a low ceiling keeps the head below the ceiling and restores standing outside", () => {
  const dom = new JSDOM('<div><canvas></canvas><div id="hud"></div></div>', {
      url: "https://freescape.test",
    }),
    prior = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
  });
  try {
    const w = createWorld();
    createObject(w.areas[1], "cuboid", {
      position: [3800, 200, 3800],
      size: [400, 100, 400],
    });
    const host = document.querySelector("div"),
      canvas = document.querySelector("canvas"),
      p = new Player(
        w,
        {
          host,
          renderer: { domElement: canvas },
          pick: () => null,
          update() {},
          player() {},
        },
        document.querySelector("#hud"),
      );
    p.runtime.height = 64;
    p.runtime.position = [4000, 84, 4000];
    p.step(p.last + 20);
    assert.ok(
      p.runtime.position[1] < 200,
      `head went through ceiling: ${p.runtime.position[1]}`,
    );
    p.runtime.position[0] = 4500;
    p.step(p.last + 20);
    assert.equal(p.runtime.height, 280);
    p.dispose();
  } finally {
    Object.assign(globalThis, prior);
    dom.window.close();
  }
});
