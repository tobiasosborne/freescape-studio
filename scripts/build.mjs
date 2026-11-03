import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { playerPlugin } from "./bundle.mjs";
import { THREE_NOTICE } from "../src/notices.js";
const result = await build({
  entryPoints: ["src/app.js"],
  bundle: true,
  format: "iife",
  minify: true,
  write: false,
  target: "es2022",
  plugins: [playerPlugin],
});
const [template, css] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("src/style.css", "utf8"),
]);
const html = template
  .replace("</head>", () => `<!-- ${THREE_NOTICE} --></head>`)
  .replace(
    /<link\s+rel="stylesheet"\s+href="\/src\/style\.css"\s*\/?>/,
    () => `<style>${css}</style>`,
  )
  .replace(
    '<script type="module" src="/src/app.js"></script>',
    () =>
      `<script>${result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")}</script>`,
  );
await mkdir("dist", { recursive: true });
await writeFile("dist/index.html", html);
console.log(
  `Built dist/index.html (${Math.round(Buffer.byteLength(html) / 1024)} kB), self-contained; no CDN or server required.`,
);
