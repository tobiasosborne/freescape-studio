import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import { readFile } from "node:fs/promises";
import { playerPlugin } from "../scripts/bundle.mjs";

async function editor() {
  const source = await readFile(
    new URL("../src/viewport.js", import.meta.url),
    "utf8",
  );
  const bundle = await build({
    entryPoints: ["src/app.js"],
    bundle: true,
    format: "iife",
    write: false,
    plugins: [
      playerPlugin,
      {
        name: "test-renderer-only",
        setup(b) {
          b.onLoad({ filter: /src\/viewport\.js$/ }, () => ({
            contents: source.replace(
              /rendererFactory\s*=\s*\(options\)\s*=>\s*new THREE\.WebGLRenderer\(options\)/,
              "rendererFactory = globalThis.__rendererFactory",
            ),
            loader: "js",
          }));
        },
      },
    ],
  });
  const errors = [],
    virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (e) => errors.push(e.message));
  virtualConsole.on("error", (e) => errors.push(e));
  const dom = new JSDOM('<div id="app"></div>', {
    url: "https://freescape.test",
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole,
  });
  const w = dom.window;
  let animation;
  w.structuredClone = structuredClone;
  w.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  w.requestAnimationFrame = (cb) => {
    animation = cb;
    return 1;
  };
  w.__rendererFactory = () => ({
    domElement: w.document.createElement("canvas"),
    setPixelRatio() {},
    setSize() {},
    render() {},
    dispose() {},
  });
  w.URL.createObjectURL = () => "blob:test";
  w.URL.revokeObjectURL = () => {};
  w.eval(bundle.outputFiles[0].text);
  const doc = w.document,
    click = async (action, value) => {
      const el = [...doc.querySelectorAll(`[data-action="${action}"]`)].find(
        (e) => value === undefined || e.dataset.value === String(value),
      );
      assert.ok(el, `Action ${action}:${value} exists`);
      el.click();
      await new Promise((r) => setImmediate(r));
    };
  const change = async (selector, value) => {
    const el = doc.querySelector(selector);
    assert.ok(el, selector);
    if (el.type === "checkbox") el.checked = value;
    else el.value = value;
    el.dispatchEvent(new w.Event("change", { bubbles: true }));
    await new Promise((r) => setImmediate(r));
  };
  const getWorld = () =>
    JSON.parse(w.localStorage.getItem("freescape-studio:autosave"));
  return {
    w,
    doc,
    click,
    change,
    errors,
    getWorld,
    frame: (time) => animation(time),
    close: () => dom.window.close(),
  };
}
test("editor wires real model through add, inspector, undo/redo, grouping, save and play", async () => {
  const t = await editor();
  try {
    await t.click("create", "cuboid");
    await t.change('[aria-label="Object name"]', "A test block");
    await t.change('[aria-label="Position X"]', 1500);
    assert.ok(
      t
        .getWorld()
        .areas[1].objects.some(
          (o) => o.name === "A test block" && o.position[0] === 1500,
        ),
    );
    await t.click("duplicate");
    assert.equal(t.getWorld().areas[1].objects.length, 47);
    await t.click("undo");
    assert.equal(t.getWorld().areas[1].objects.length, 46);
    await t.click("redo");
    assert.equal(t.getWorld().areas[1].objects.length, 47);
    await t.click("save");
    await t.click("library-save");
    assert.ok(t.w.localStorage.getItem("freescape-studio:library"));
    await t.click("close");
    await t.click("play");
    assert.ok(t.doc.body.classList.contains("play-mode"));
    t.frame(100);
    await t.click("play");
    assert.ok(!t.doc.body.classList.contains("play-mode"));
    assert.deepEqual(t.errors, []);
  } finally {
    t.close();
  }
});
test("editor script diagnostics reject bad source and apply valid FCL", async () => {
  const t = await editor();
  try {
    await t.click("select", 2);
    await t.click("tab", "scripts");
    await t.change("#fcl-source", "BOGUS (1)");
    await t.click("apply-script");
    assert.match(
      t.doc.querySelector("#script-status").textContent,
      /Unknown command BOGUS/,
    );
    await t.change("#fcl-source", "IF SHOT? THEN ADDVAR (1,V30) ENDIF");
    await t.click("apply-script");
    assert.equal(
      t.getWorld().areas[1].objects.find((o) => o.id === 2).condition,
      "IF SHOT? THEN ADDVAR (1,V30) ENDIF",
    );
    assert.deepEqual(t.errors, []);
  } finally {
    t.close();
  }
});
test("editor creates and deletes areas and edits instruments, palettes and controls", async () => {
  const t = await editor();
  try {
    await t.click("new-area");
    assert.equal(t.getWorld().areas.length, 4);
    await t.click("areas");
    await t.click("delete-area", 3);
    assert.equal(t.getWorld().areas.length, 3);
    assert.equal(t.doc.querySelector("#area-select").value, "1");
    await t.click("tab", "instruments");
    await t.click("new-instrument");
    await t.change("#instrument-type", "horizontal");
    await t.click("apply-instrument", 3);
    assert.equal(t.getWorld().instruments.at(-1).type, "horizontal");
    await t.click("palette");
    await t.change('[data-palette="1"]', "#ffffff");
    await t.click("apply-palette");
    assert.equal(t.getWorld().areas[1].palette[1], "#ffffff");
    await t.click("settings");
    await t.click("controls");
    await t.click("original-controls");
    await t.click("apply-controls");
    assert.equal(t.getWorld().controls.forward, "o");
    assert.deepEqual(t.errors, []);
  } finally {
    t.close();
  }
});
test("editor exposes independent camera navigation and border-zone form controls", async () => {
  const t = await editor();
  try {
    await t.change("#camera-mode", "cam1");
    assert.equal(t.doc.querySelector("#view-label").textContent, "CAM1");
    t.w.dispatchEvent(
      new t.w.KeyboardEvent("keydown", { key: "w", bubbles: true }),
    );
    t.frame(100);
    t.w.dispatchEvent(
      new t.w.KeyboardEvent("keyup", { key: "w", bubbles: true }),
    );
    await t.click("settings");
    await t.click("controls");
    await t.click("new-zone");
    assert.ok(t.doc.querySelector('[data-zone-field="action"]'));
    await t.click("apply-controls");
    assert.equal(t.getWorld().controlZones.length, 1);
    assert.deepEqual(t.errors, []);
  } finally {
    t.close();
  }
});
test("face shade controls and group inspector transforms update saved world geometry", async () => {
  const t = await editor();
  try {
    await t.click("select", 2);
    await t.change("#shade-enabled", true);
    await t.change("#shade-secondary", 4);
    await t.click("face", 0);
    assert.equal(
      t.getWorld().areas[1].objects.find((o) => o.id === 2).patterns[0].b,
      4,
    );
    await t.click("select", 3);
    await t.change('[data-select="2"]', true);
    await t.click("group");
    const g = t.getWorld().areas[1].objects.at(-1),
      before = t.getWorld().areas[1].objects.find((o) => o.id === 2)
        .position[0];
    await t.change('[aria-label="Position X"]', g.position[0] + 100);
    assert.equal(
      t.getWorld().areas[1].objects.find((o) => o.id === 2).position[0],
      before + 100,
    );
    assert.deepEqual(t.errors, []);
  } finally {
    t.close();
  }
});
test("copy placement offers all relative directions and preserves conditions", async () => {
  const t = await editor();
  try {
    await t.click("select", 3);
    const original = t.getWorld()?.areas[1]?.objects.find((o) => o.id === 3);
    await t.click("copy-options");
    await t.click("copy-place", "left");
    const w = t.getWorld(),
      copy = w.areas[1].objects.at(-1),
      source = w.areas[1].objects.find((o) => o.id === 3);
    assert.ok(copy.position[0] < source.position[0]);
    assert.equal(copy.condition, source.condition);
    assert.deepEqual(t.errors, []);
  } finally {
    t.close();
  }
});
test("object movement and stretch controls support fine and separate right-button steps", async () => {
  const t = await editor();
  try {
    await t.click("select", 3);
    await t.click("nudge", "move:0:1");
    assert.equal(
      t.getWorld().areas[1].objects.find((o) => o.id === 3).position[0],
      2450,
    );
    const btn = t.doc.querySelector('[data-value="move:0:1"]');
    btn.dispatchEvent(
      new t.w.MouseEvent("contextmenu", {
        bubbles: true,
        button: 2,
        cancelable: true,
      }),
    );
    assert.equal(
      t.getWorld().areas[1].objects.find((o) => o.id === 3).position[0],
      2700,
    );
    await t.click("nudge", "stretch:0:1");
    assert.equal(
      t.getWorld().areas[1].objects.find((o) => o.id === 3).size[0],
      330,
    );
    assert.deepEqual(t.errors, []);
  } finally {
    t.close();
  }
});

test("painting a group fills every member and honours the configured fine step", async () => {
  const t = await editor();
  try {
    await t.click("select", 3);
    await t.change('[data-select="4"]', true);
    await t.click("group");
    await t.click("fill");
    assert.ok(
      t
        .getWorld()
        .areas[1].objects.filter((o) => [3, 4].includes(o.id))
        .every((o) => o.colors.every((c) => c === 5)),
    );
    await t.click("settings");
    await t.change('[data-preference="fineStep"]', 2);
    await t.click("apply-settings");
    await t.click("fine");
    const g = t.getWorld().areas[1].objects.at(-1);
    await t.click("nudge", "move:0:1");
    assert.equal(
      t.getWorld().areas[1].objects.at(-1).position[0],
      g.position[0] + 2,
    );
    assert.deepEqual(t.errors, []);
  } finally {
    t.close();
  }
});

test("editing a group member updates the parent enclosure and preserves its configured start offset", async () => {
  const t = await editor();
  try {
    await t.click("select", 3);
    await t.change('[data-select="4"]', true);
    await t.click("group");
    const group = t.getWorld().areas[1].objects.at(-1);
    await t.change('[data-object-field="moveable"]', true);
    const initialX = group.position[0] + 100;
    await t.change('[aria-label="Start position X"]', initialX);
    assert.equal(
      t.getWorld().areas[1].objects.at(-1).startPosition[0],
      initialX,
    );
    await t.click("select", 3);
    await t.change('[aria-label="Position X"]', 1500);
    const updated = t
      .getWorld()
      .areas[1].objects.find((o) => o.id === group.id);
    assert.equal(updated.position[0], 1500);
    assert.equal(updated.startPosition[0] - updated.position[0], 100);
    assert.deepEqual(t.errors, []);
  } finally {
    t.close();
  }
});
