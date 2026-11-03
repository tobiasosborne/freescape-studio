// Produces the files to hand to people:
//   release/Freescape-Studio.html          – the whole app in one file
//   release/Freescape-Studio-v<ver>.zip    – that file + a plain-language note
// Run `npm run build` first (the `package` npm script does both).
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const dir = "release",
  stage = `${dir}/stage`,
  html = "Freescape-Studio.html",
  zip = `Freescape-Studio-v${version}.zip`;
await rm(dir, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await copyFile("dist/index.html", `${dir}/${html}`);
await copyFile("dist/index.html", `${stage}/${html}`);
await writeFile(
  `${stage}/START HERE.txt`,
  `FREESCAPE STUDIO ${version}
Build 3D worlds from simple shapes, give them rules, then walk around inside.

HOW TO START (Windows 10 / 11)
  1. Right-click this zip file and choose "Extract All...", then "Extract".
  2. Double-click "${html}".
     It opens in your web browser (Microsoft Edge, Chrome or Firefox).
  That's it. Nothing is installed, nothing is sent over the internet.

  If Windows asks "How do you want to open this file?", pick Microsoft Edge
  and tick "Always use this app".

YOUR WORK
  Your world is saved automatically inside the browser on this computer.
  To keep a copy or move it to another computer: Save > Download JSON.
  To share a finished game: Export > Download standalone HTML, then send
  that file to friends - they can play it the same way.

FIRST STEPS
  A short "Getting started" card appears the first time you open it.
  Help > Guide & controls lists all keys. In play mode press F1 to get
  back to the editor.
`.replace(/\n/g, "\r\n"),
);
try {
  execFileSync("zip", ["-q", "-j", "-X", `../${zip}`, html, "START HERE.txt"], {
    cwd: stage,
  });
} catch (e) {
  console.error("Could not create the zip (is the `zip` tool installed?)");
  throw e;
}
await rm(stage, { recursive: true });
console.log(`Packaged ${dir}/${html} and ${dir}/${zip}`);
