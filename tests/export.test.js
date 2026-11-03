import test from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/model.js";
import { standaloneHTML } from "../src/export.js";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { JSDOM, VirtualConsole } from "jsdom";
test("standalone embeds world and runner safely with no network dependency", () => {
  const w = createWorld();
  w.name = "A </script><script>alert(1)</script> world";
  const html = standaloneHTML(w, "window.TEST_PLAYER=true;");
  assert.ok(html.includes("window.TEST_PLAYER=true;"));
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("\\u003c/script>"));
  assert.ok(!/<script[^>]+src=/.test(html));
  assert.ok(html.includes("freescape-studio"));
  assert.ok(html.includes("Restart world"));
});
test("exported player boots its embedded module graph and saves/loads a game without the editor", async () => {
  const source = await readFile(
    new URL("../src/viewport.js", import.meta.url),
    "utf8",
  );
  const result = await build({
    entryPoints: ["src/player.js"],
    bundle: true,
    format: "iife",
    write: false,
    plugins: [
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
  const world = createWorld();
  world.conditions = [{ id: 1, source: 'SETVAR (42,V30) PRINT ("Ready",1)' }];
  world.defaults.initialCondition = 1;
  world.instruments = [
    {
      id: 1,
      name: "Message",
      type: "text",
      x: 8,
      y: 170,
      width: 200,
      height: 16,
      variable: 30,
      min: 0,
      max: 100,
      fg: 1,
      bg: 15,
      text: "",
    },
  ];
  const errors = [],
    vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(e.message));
  vc.on("error", (e) => errors.push(e));
  const dom = new JSDOM(standaloneHTML(world, result.outputFiles[0].text), {
    url: "https://standalone.test",
    runScripts: "outside-only",
    virtualConsole: vc,
  });
  const w = dom.window;
  w.structuredClone = structuredClone;
  w.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  let frame;
  w.requestAnimationFrame = (callback) => {
    frame = callback;
    return 1;
  };
  w.__rendererFactory = () => ({
    domElement: w.document.createElement("canvas"),
    setPixelRatio() {},
    setSize() {},
    render() {},
    dispose() {},
  });
  try {
    for (const script of w.document.scripts) w.eval(script.textContent);
    frame(w.performance.now() + 30);
    assert.match(w.document.querySelector(".hud").textContent, /Ready/);
    w.document.querySelector("#save-game").click();
    const saved = JSON.parse(
      w.localStorage.getItem("freescape-studio:game:Untitled world"),
    );
    assert.equal(saved.vars[30], 42);
    w.document.querySelector("#restart").click();
    w.document.querySelector("#load-game").click();
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});
