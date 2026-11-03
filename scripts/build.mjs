import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile, copyFile } from "node:fs/promises";
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
const [template, css, icon, pkg] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("src/style.css", "utf8"),
  readFile("public/icon.svg", "utf8"),
  readFile("package.json", "utf8").then(JSON.parse),
]);
const html = template
  .replace("</head>", () => `<!-- ${THREE_NOTICE} --></head>`)
  // Inline the favicon so a lone emailed copy of the file still has it.
  .replace(
    /<link rel="icon" href="\/icon\.svg" type="image\/svg\+xml" \/>/,
    () =>
      `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(icon)}">`,
  )
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

// Extras used only when the same file is hosted over HTTPS (GitHub Pages):
// a web-app manifest + offline service worker make it installable from
// Edge/Chrome ("Install Freescape Studio") with a Start-menu icon.
for (const f of ["icon.svg", "icon-192.png", "icon-512.png"])
  await copyFile(`public/${f}`, `dist/${f}`);
await writeFile(
  "dist/manifest.webmanifest",
  JSON.stringify(
    {
      name: "Freescape Studio",
      short_name: "Freescape",
      description:
        "Build geometric 3D worlds, give them rules, and step inside.",
      start_url: "./",
      scope: "./",
      display: "standalone",
      background_color: "#e6e2d6",
      theme_color: "#1f3433",
      icons: [
        { src: "icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "icon.svg", sizes: "any", type: "image/svg+xml" },
      ],
    },
    null,
    2,
  ),
);
const version = `${pkg.version}-${createHash("sha256").update(html).digest("hex").slice(0, 10)}`;
await writeFile(
  "dist/sw.js",
  `// Freescape Studio offline cache (${version})
const CACHE = "freescape-studio-${version}";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Pages: network first so updates arrive; cached copy when offline.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return r;
        })
        .catch(() => caches.match("./index.html")),
    );
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
`,
);
console.log(
  `Built dist/index.html (${Math.round(Buffer.byteLength(html) / 1024)} kB), self-contained; no CDN or server required.`,
);
