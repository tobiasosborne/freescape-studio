// Software SVG preview for geometry inspection; not a WebGL/browser screenshot oracle.
import { JSDOM } from "jsdom";
import * as THREE from "three";
import { SVGRenderer } from "three/addons/renderers/SVGRenderer.js";
import { writeFile, mkdir } from "node:fs/promises";
import { demoWorld } from "../src/demo.js";
import { geometryFor, materialsFor } from "../src/geometry.js";
const dom = new JSDOM();
globalThis.document = dom.window.document;
const w = demoWorld(),
  a = w.areas[1],
  scene = new THREE.Scene();
scene.background = new THREE.Color(a.palette[a.sky]);
for (const o of a.objects) {
  if (["sensor", "group", "line"].includes(o.type) || o.status !== "visible")
    continue;
  const mesh = new THREE.Mesh(geometryFor(o), materialsFor(o, a.palette));
  mesh.position.fromArray(o.position);
  mesh.renderOrder = o.id === 1 ? -20 : o.name === "Courtyard plinth" ? -10 : 0;
  scene.add(mesh);
}
const camera = new THREE.PerspectiveCamera(48, 1200 / 800, 1, 50000);
camera.position.set(8500, 5000, -1900);
camera.lookAt(4000, 400, 4300);
const renderer = new SVGRenderer();
renderer.setSize(1200, 800);
renderer.setQuality("high");
renderer.render(scene, camera);
await mkdir("test-results", { recursive: true });
await writeFile(
  "test-results/scene-software-preview.svg",
  renderer.domElement.outerHTML,
);
console.log(
  "Wrote software scene preview (SVG), no WebGL verification claimed.",
);
dom.window.close();
