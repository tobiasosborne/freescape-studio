import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const output = resolve("test-results");
await mkdir(output, { recursive: true });
const report = {
  status: "running",
  phase: "browser-launch",
  checks: [],
  screenshots: [],
  errors: [],
};
const browserCache = join(homedir(), ".cache", "ms-playwright");
const cached = existsSync(browserCache)
  ? readdirSync(browserCache)
      .filter((name) => /^chromium(-|_headless_shell-)/.test(name))
      .sort()
      .reverse()
      .map((name) =>
        join(
          browserCache,
          name,
          name.startsWith("chromium_headless")
            ? "chrome-headless-shell-linux64/chrome-headless-shell"
            : "chrome-linux64/chrome",
        ),
      )
      .find(existsSync)
  : undefined;
let browser;
const inspect = async (name, task) => {
  report.phase = name;
  await task();
  report.checks.push({ name, status: "passed" });
};
const watch = (page) => {
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") report.errors.push(message.text());
  });
};
const frames = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
async function canvasCheck(page) {
  await frames(page);
  const result = await page.locator("canvas").evaluate((canvas) => {
    const gl = canvas.getContext("webgl2");
    if (!gl) return { webgl: false };
    const probe = document.createElement("canvas");
    probe.width = probe.height = 32;
    const context = probe.getContext("2d");
    context.drawImage(canvas, 0, 0, 32, 32);
    const pixels = context.getImageData(0, 0, 32, 32).data,
      colors = new Set();
    for (let i = 0; i < pixels.length; i += 4)
      colors.add(
        `${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`,
      );
    return {
      webgl: true,
      lost: gl.isContextLost(),
      error: gl.getError(),
      colors: colors.size,
      width: canvas.width,
      height: canvas.height,
    };
  });
  assert.equal(result.webgl, true, "A real WebGL 2 context must exist");
  assert.equal(result.lost, false, "The WebGL context must remain live");
  assert.equal(result.error, 0, "Rendering must not leave a GL error");
  assert.ok(
    result.colors > 4,
    `Expected rendered geometry, got ${result.colors} sampled colours`,
  );
  assert.ok(result.width > 0 && result.height > 0);
}
async function screenshot(page, name) {
  await frames(page);
  const path = join(output, name);
  await page.screenshot({ path, fullPage: true });
  report.screenshots.push(path);
}
const closeDialog = (page) =>
  page.getByRole("button", { name: "Close dialog", exact: true }).click();
const savedGame = (page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) =>
      key.startsWith("freescape-studio:game:"),
    );
    return key ? JSON.parse(localStorage.getItem(key)) : null;
  });
const editorPosition = (page) =>
  page
    .locator("#status-coordinates")
    .textContent()
    .then((text) => {
      const match = text.match(/POS\s+(-?\d+),\s*(-?\d+),\s*(-?\d+)/);
      assert.ok(match, `Missing player coordinates: ${text}`);
      return match.slice(1).map(Number);
    });
let page, worldFile, standaloneFile;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
      (existsSync(chromium.executablePath())
        ? chromium.executablePath()
        : cached),
    args: [
      "--no-sandbox",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  watch(page);
  await inspect("desktop renderer", async () => {
    await page.goto(
      process.env.BASE_URL || pathToFileURL(resolve("dist/index.html")).href,
    );
    await page
      .getByRole("button", { name: "Play world", exact: true })
      .waitFor();
    await canvasCheck(page);
    await screenshot(page, "editor.png");
  });
  await inspect("authoring and history", async () => {
    await page.getByRole("button", { name: "Add cuboid", exact: true }).click();
    const name = page.getByLabel("Object name", { exact: true });
    await name.fill("Browser test block");
    await name.press("Tab");
    assert.equal(
      await page.getByRole("button", { name: /Browser test block/ }).count(),
      1,
    );
    await page.getByLabel("Position X", { exact: true }).fill("1500");
    await page.getByLabel("Position X", { exact: true }).press("Tab");
    await page
      .getByRole("button", { name: "Duplicate selected", exact: true })
      .click();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await page.getByRole("button", { name: /Browser test block/ }).click();
    assert.equal(
      await page.getByLabel("Position X", { exact: true }).inputValue(),
      "1500",
    );
  });
  await inspect("world library reopen and JSON round trip", async () => {
    await page.getByRole("button", { name: "Save world", exact: true }).click();
    await page
      .getByLabel("World name", { exact: true })
      .fill("Browser acceptance world");
    await page
      .getByRole("button", { name: "Save to library", exact: true })
      .click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download JSON", exact: true }).click(),
    ]);
    worldFile = join(output, "world.freescape.json");
    await download.saveAs(worldFile);
    const data = JSON.parse(await readFile(worldFile, "utf8"));
    assert.equal(data.format, "freescape-studio");
    assert.ok(
      data.areas.some((a) =>
        a.objects.some((o) => o.name === "Browser test block"),
      ),
    );
    await closeDialog(page);
    await page.getByRole("button", { name: /Browser test block/ }).click();
    await page
      .getByLabel("Object name", { exact: true })
      .fill("After save marker");
    await page.getByLabel("Object name", { exact: true }).press("Tab");
    await page.getByRole("button", { name: "Save world", exact: true }).click();
    await page
      .locator(".library-row")
      .filter({ hasText: "Browser acceptance world" })
      .getByRole("button", { name: "Open", exact: true })
      .click();
    assert.equal(
      await page.getByRole("button", { name: /Browser test block/ }).count(),
      1,
    );
    assert.equal(
      await page.getByRole("button", { name: /After save marker/ }).count(),
      0,
    );
    await page.getByRole("button", { name: "Save world", exact: true }).click();
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: /^Import world JSON/ }).click(),
    ]);
    await chooser.setFiles(worldFile);
    await page.locator(".modal-backdrop").waitFor({ state: "detached" });
    assert.equal(
      await page.locator("#project-name").textContent(),
      "Browser acceptance world",
    );
    await canvasCheck(page);
  });
  await inspect("play movement and game save/load/reset", async () => {
    await page.getByRole("button", { name: "Play world", exact: true }).click();
    await page
      .getByRole("button", { name: "Return to editor", exact: true })
      .waitFor();
    await page.waitForFunction(() =>
      document.querySelector("#status-coordinates").textContent.includes("POS"),
    );
    const initial = await editorPosition(page);
    await page.keyboard.down("w");
    await page.waitForFunction((z) => {
      const match = document
        .querySelector("#status-coordinates")
        .textContent.match(/POS\s+(-?\d+),\s*(-?\d+),\s*(-?\d+)/);
      return match && Number(match[3]) > z + 20;
    }, initial[2]);
    await page.keyboard.up("w");
    await page.getByRole("button", { name: "Save game", exact: true }).click();
    const saved = await savedGame(page);
    assert.ok(saved.position[2] > initial[2]);
    await page.keyboard.down("s");
    await page.waitForFunction((z) => {
      const match = document
        .querySelector("#status-coordinates")
        .textContent.match(/POS\s+(-?\d+),\s*(-?\d+),\s*(-?\d+)/);
      return match && Number(match[3]) < z - 20;
    }, saved.position[2]);
    await page.keyboard.up("s");
    await page.getByRole("button", { name: "Load game", exact: true }).click();
    await page.waitForFunction((expected) => {
      const match = document
        .querySelector("#status-coordinates")
        .textContent.match(/POS\s+(-?\d+),\s*(-?\d+),\s*(-?\d+)/);
      return match && Math.abs(Number(match[3]) - expected) < 1;
    }, saved.position[2]);
    await canvasCheck(page);
    await screenshot(page, "play.png");
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await page.waitForFunction((z) => {
      const match = document
        .querySelector("#status-coordinates")
        .textContent.match(/POS\s+(-?\d+),\s*(-?\d+),\s*(-?\d+)/);
      return match && Math.abs(Number(match[3]) - z) < 1;
    }, initial[2]);
    await page.keyboard.press("F1");
    await page
      .getByRole("button", { name: "Play world", exact: true })
      .waitFor();
  });
  await inspect("settings and FCL diagnostics", async () => {
    await page
      .getByRole("button", { name: "World settings", exact: true })
      .click();
    await page.getByLabel("Start area", { exact: true }).waitFor();
    await closeDialog(page);
    await page.getByRole("button", { name: /Browser test block/ }).click();
    await page.getByRole("button", { name: "Scripts", exact: true }).click();
    await page.getByLabel("FCL source", { exact: true }).fill("BOGUS (1)");
    await page
      .getByRole("button", { name: "Apply script", exact: true })
      .click();
    await page.getByText(/Unknown command BOGUS/).waitFor();
    await page
      .getByLabel("FCL source", { exact: true })
      .fill("IF SHOT? THEN ADDVAR (1,V30) ENDIF");
    await page
      .getByRole("button", { name: "Apply script", exact: true })
      .click();
    await page.getByText("Compiled and applied", { exact: true }).waitFor();
  });
  await inspect("standalone download", async () => {
    await page
      .getByRole("button", { name: "Export playable world", exact: true })
      .click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page
        .getByRole("button", { name: "Download standalone HTML", exact: true })
        .click(),
    ]);
    standaloneFile = join(output, "standalone.html");
    await download.saveAs(standaloneFile);
    const html = await readFile(standaloneFile, "utf8");
    assert.ok(html.includes("freescape-studio"));
    assert.ok(!html.includes("https://cdn"));
    assert.ok(html.length > 50000);
    await closeDialog(page);
  });
  await inspect(
    "standalone player runs offline and persists gameplay",
    async () => {
      const context = await browser.newContext({
          offline: true,
          viewport: { width: 1280, height: 900 },
        }),
        standalone = await context.newPage();
      watch(standalone);
      const external = [];
      standalone.on("request", (request) => {
        if (/^https?:/.test(request.url())) external.push(request.url());
      });
      try {
        await standalone.goto(pathToFileURL(standaloneFile).href);
        await standalone
          .getByRole("button", { name: "Restart world", exact: true })
          .waitFor();
        await standalone
          .locator('.instrument[data-id="1"]')
          .filter({ hasText: /Explore the citadel/ })
          .waitFor();
        await canvasCheck(standalone);
        await standalone
          .getByRole("button", { name: "Save game", exact: true })
          .click();
        const initial = await savedGame(standalone);
        assert.ok(initial);
        await standalone.keyboard.down("w");
        await frames(standalone);
        await standalone.keyboard.up("w");
        await standalone
          .getByRole("button", { name: "Save game", exact: true })
          .click();
        const moved = await savedGame(standalone);
        assert.ok(moved.position[2] > initial.position[2]);
        await standalone
          .getByRole("button", { name: "Restart world", exact: true })
          .click();
        await standalone
          .getByRole("button", { name: "Load game", exact: true })
          .click();
        await standalone
          .getByRole("button", { name: "Shoot", exact: true })
          .click();
        await standalone
          .getByRole("button", { name: "Save game", exact: true })
          .click();
        const restored = await savedGame(standalone);
        assert.deepEqual(restored.position, moved.position);
        assert.equal(restored.vars[21], moved.vars[21] + 1);
        assert.deepEqual(external, []);
        await screenshot(standalone, "standalone.png");
      } finally {
        await context.close();
      }
    },
  );
  await inspect("narrow editor and settings layout", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .locator(".menubar summary")
      .filter({ hasText: /^View$/ })
      .click();
    await page.getByRole("button", { name: "Inspector", exact: true }).click();
    await page
      .getByLabel("Object name", { exact: true })
      .waitFor({ state: "visible" });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
      "Narrow editor must not overflow horizontally",
    );
    await screenshot(page, "editor-narrow.png");
    await page
      .getByRole("button", { name: "World settings", exact: true })
      .click();
    await page
      .getByLabel("Start area", { exact: true })
      .waitFor({ state: "visible" });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
    );
    await screenshot(page, "settings-narrow.png");
    await closeDialog(page);
  });
  assert.deepEqual(report.errors, []);
  report.status = "passed";
  report.phase = "complete";
  console.log(
    `PASS: ${report.checks.length} browser acceptance groups; screenshots still require visual review.`,
  );
} catch (error) {
  report.status = report.phase === "browser-launch" ? "blocked" : "failed";
  report.failure = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await writeFile(
    join(output, "browser-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
