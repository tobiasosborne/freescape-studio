import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script } from "node:vm";
test("production editor is one offline HTML artifact with embedded CSS and runtime", async () => {
  await import("../scripts/build.mjs");
  const html = await readFile("dist/index.html", "utf8");
  assert.ok(html.includes("<style>"));
  assert.ok(html.includes(".workspace"));
  assert.ok(!html.includes('href="/src/style.css"'));
  assert.ok(!html.includes('src="/src/app.js"'));
  assert.ok(html.length > 50000);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new Script(script));
});
