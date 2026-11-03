import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { geometryFor, materialsFor } from "./geometry.js";
import { objectById, descendants, includedGlobals } from "./model.js";
export class Viewport {
  constructor(
    host,
    callbacks = {},
    rendererFactory = (options) => new THREE.WebGLRenderer(options),
  ) {
    this.host = host;
    this.callbacks = callbacks;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, 1, 1, 50000);
    this.camera.position.set(8500, 5000, -1900);
    this.renderer = rendererFactory({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (this.renderer.shadowMap) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    // Lighting. Editor: soft form shading + shadows so solids read clearly.
    // Play: ambient π alone, which renders every face in its exact palette
    // colour, as in the original flat-shaded engine.
    this.ambient = new THREE.AmbientLight(0xffffff, Math.PI);
    this.sun = new THREE.DirectionalLight(0xfff6e8, 0);
    this.sun.position.set(4096 + 5200, 9000, 4096 - 2600);
    this.sun.target.position.set(4096, 0, 4096);
    Object.assign(this.sun.shadow.camera, {
      left: -6500,
      right: 6500,
      top: 6500,
      bottom: -6500,
      near: 100,
      far: 24000,
    });
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 2;
    this.sun.shadow.radius = 3;
    this.scene.add(this.ambient, this.sun, this.sun.target);
    this.backgrounds = new Map();
    this.renderer.domElement.setAttribute("aria-label", "3D world viewport");
    host.append(this.renderer.domElement);
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.target.set(4000, 400, 4300);
    this.orbit.enableDamping = true;
    this.orbit.minDistance = 30;
    this.orbit.maxDistance = 20000;
    this.transform = new TransformControls(
      this.camera,
      this.renderer.domElement,
    );
    this.scene.add(this.transform.getHelper());
    this.transform.setSpace("world");
    this.transform.setTranslationSnap(50);
    this.transform.setRotationSnap(Math.PI / 2);
    this.transform.setSize(0.8);
    this.transform.addEventListener("dragging-changed", (e) => {
      this.orbit.enabled = !e.value;
      if (e.value) {
        this.dragStart = this.transform.object?.position.clone();
      } else if (this.transform.object && this.dragStart) {
        const mesh = this.transform.object;
        this.callbacks.transform?.(
          mesh.userData.id,
          mesh.position
            .toArray()
            .map((p, i) => p - mesh.userData.pivotOffset[i]),
          mesh.scale.toArray(),
          mesh.rotation
            .toArray()
            .slice(0, 3)
            .map((r) => (r * 180) / Math.PI),
        );
      }
    });
    this.meshes = new Map();
    this.grid = new THREE.GridHelper(8192, 32, 0x1f3433, 0x1f3433);
    this.grid.position.set(4096, 21, 4096);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.1;
    this.grid.material.depthWrite = false;
    const major = new THREE.GridHelper(8192, 8, 0x1f3433, 0x1f3433);
    major.material.transparent = true;
    major.material.opacity = 0.16;
    major.material.depthWrite = false;
    major.position.y = 0.5;
    this.grid.add(major);
    this.scene.add(this.grid);
    this.selection = new THREE.Box3Helper(new THREE.Box3(), 0xf0b24e);
    this.scene.add(this.selection);
    this.selection.visible = false;
    this.ray = new THREE.Raycaster();
    this.ray.params.Line.threshold = 15;
    let pointer;
    host.addEventListener("pointerdown", (e) => {
      pointer = [e.clientX, e.clientY];
    });
    host.addEventListener("pointerup", (e) => {
      if (
        this.transform.dragging ||
        !pointer ||
        Math.hypot(e.clientX - pointer[0], e.clientY - pointer[1]) > 5
      )
        return;
      const hit = this.pick(e.clientX, e.clientY);
      this.callbacks.pick?.(hit, e);
    });
    host.addEventListener("contextmenu", (e) => e.preventDefault());
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
  }
  resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    const v = this.play
      ? this.world.viewWindow
      : { x: 0, y: 0, width: 320, height: 200 };
    const cw = (w * v.width) / 320,
      ch = (h * v.height) / 200;
    this.renderer.setSize(cw, ch, false);
    Object.assign(this.renderer.domElement.style, {
      position: "absolute",
      left: `${v.x / 3.2}%`,
      top: `${v.y / 2}%`,
      width: `${v.width / 3.2}%`,
      height: `${v.height / 2}%`,
    });
    this.camera.aspect = cw / ch;
    this.camera.updateProjectionMatrix();
  }
  update(
    world,
    areaId,
    {
      selected = [],
      play = false,
      exclude = false,
      highlight = true,
      grid = true,
      ghost = false,
    } = {},
  ) {
    this.world = world;
    this.area = world.areas.find((a) => a.id === areaId);
    if (!this.area) return;
    const changedPlay = this.play !== play;
    this.play = play;
    if (changedPlay) this.resize();
    this.orbit.enabled = !play && !this.transform.dragging;
    this.grid.visible = !play && grid && !exclude;
    const sky = this.area.palette[this.area.horizon ? this.area.sky : 0];
    this.ambient.intensity = play ? Math.PI : Math.PI * 0.62;
    this.sun.intensity = play ? 0 : Math.PI * 0.45;
    this.sun.castShadow = !play;
    this.scene.background = play ? new THREE.Color(sky) : this.skyGradient(sky);
    this.scene.fog = play
      ? null
      : new THREE.Fog(new THREE.Color(sky).lerp(new THREE.Color(0xffffff), 0.35), 16000, 46000);
    this.host.style.background =
      world.border && play
        ? `center / 100% 100% url("${world.border}")`
        : this.area.palette[this.area.ground];
    const globals = world.areas.find((a) => a.id === 0);
    const objects = [
      ...this.area.objects,
      ...(areaId === 0
        ? []
        : includedGlobals(world, this.area).map((o) => ({
            ...o,
            global: true,
          }))),
    ];
    const selectedIds = new Set(
      selected.flatMap((id) => descendants(this.area, id).map((o) => o.id)),
    );
    const alive = new Set();
    for (const o of objects) {
      const key = `${o.global ? "g" : "l"}:${o.id}`;
      alive.add(key);
      let m = this.meshes.get(key);
      const signature = JSON.stringify([
        o.type,
        o.size,
        o.rotation,
        o.points,
        o.colors,
        o.patterns,
        this.area.palette,
      ]);
      if (!m || m.userData.signature !== signature) {
        if (m) this.disposeMesh(m);
        if (o.type === "group") {
          m = new THREE.Mesh(
            new THREE.BoxGeometry(...o.size).translate(
              ...o.size.map((n) => n / 2),
            ),
            new THREE.MeshBasicMaterial({
              color: 0xe8bc77,
              wireframe: true,
              transparent: true,
              opacity: 0.25,
              depthWrite: false,
            }),
          );
        } else if (o.type === "sensor") {
          m = new THREE.Mesh(
            new THREE.OctahedronGeometry(65),
            new THREE.MeshBasicMaterial({ color: 0xf2b761, wireframe: true }),
          );
        } else if (o.type === "line")
          m = new THREE.Line(
            geometryFor(o),
            new THREE.LineBasicMaterial({
              color: this.area.palette[o.colors[0]],
              visible: o.colors[0] !== 0,
              linewidth: 2,
            }),
          );
        else {
          m = new THREE.Mesh(
            geometryFor(o),
            materialsFor(o, this.area.palette),
          );
          m.castShadow = m.receiveShadow = true;
        }
        const pivotOffset =
          o.type === "sensor" ? [0, 0, 0] : o.size.map((n) => n / 2);
        if (o.type !== "sensor")
          m.geometry.translate(...pivotOffset.map((n) => -n));
        let edges = null;
        if (m.castShadow) {
          // Fine drafting lines along hard edges (editor only).
          edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(m.geometry, 25),
            new THREE.LineBasicMaterial({
              color: 0x1f3433,
              transparent: true,
              opacity: 0.28,
            }),
          );
          edges.raycast = () => {};
          m.add(edges);
        }
        m.userData = {
          id: o.id,
          global: o.global,
          signature,
          pivotOffset,
          edges,
        };
        this.meshes.set(key, m);
        this.scene.add(m);
      }
      if (!this.transform.dragging || this.transform.object !== m) {
        m.position.fromArray(
          o.position.map((p, i) => p + m.userData.pivotOffset[i]),
        );
        m.scale.set(1, 1, 1);
        m.rotation.set(0, 0, 0);
      }
      if (m.userData.edges) m.userData.edges.visible = !play;
      m.visible =
        (o.status === "visible" || (!play && ghost)) &&
        !(o.type === "sensor" && play) &&
        !(o.type === "group" && (play || !selected.includes(o.id))) &&
        (!exclude || selectedIds.has(o.id));
    }
    for (const [key, m] of this.meshes)
      if (!alive.has(key)) {
        if (this.transform.object === m) this.transform.detach();
        this.disposeMesh(m);
        this.meshes.delete(key);
      }
    const mesh = this.meshes.get(`l:${selected[0]}`);
    this.selection.visible = !!mesh && highlight && !play;
    if (mesh) {
      this.selection.box.setFromObject(mesh);
      if (!play && this.tool && this.transform.object !== mesh)
        this.transform.attach(mesh);
    }
    if (play || !mesh || !this.tool) this.transform.detach();
    this.transform.getHelper().visible = !play && !!this.tool;
  }
  skyGradient(color) {
    // A soft vertical wash: the sky deepens upward and lifts at the horizon.
    if (this.backgrounds.has(color)) return this.backgrounds.get(color);
    const c = new THREE.Color(color),
      top = c.clone().lerp(new THREE.Color(0x1f3433), 0.16),
      low = c.clone().lerp(new THREE.Color(0xffffff), 0.32),
      h = 64,
      data = new Uint8Array(h * 4),
      tmp = new THREE.Color();
    for (let y = 0; y < h; y++) {
      // Row 0 is the bottom of the screen.
      const t = y / (h - 1);
      if (t < 0.45) tmp.copy(low).lerp(c, t / 0.45);
      else tmp.copy(c).lerp(top, (t - 0.45) / 0.55);
      const hex = tmp.getHex(); // sRGB bytes
      data.set([hex >> 16, (hex >> 8) & 255, hex & 255, 255], y * 4);
    }
    const background = new THREE.DataTexture(data, 1, h);
    background.colorSpace = THREE.SRGBColorSpace;
    background.magFilter = background.minFilter = THREE.LinearFilter;
    background.needsUpdate = true;
    this.backgrounds.set(color, background);
    return background;
  }
  disposeMesh(m) {
    this.scene.remove(m);
    if (m.userData.edges) {
      m.userData.edges.geometry.dispose();
      m.userData.edges.material.dispose();
    }
    m.geometry.dispose();
    for (const material of Array.isArray(m.material)
      ? m.material
      : [m.material]) {
      material.map?.dispose();
      material.dispose();
    }
  }
  setTool(tool, snap = 50) {
    this.tool = tool === "select" ? null : tool;
    this.transform.setTranslationSnap(snap || null);
    if (this.tool) this.transform.setMode(this.tool);
    else this.transform.detach();
  }
  pick(x, y) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector2(
      ((x - rect.left) / rect.width) * 2 - 1,
      (-(y - rect.top) / rect.height) * 2 + 1,
    );
    this.ray.setFromCamera(p, this.camera);
    const hit = this.ray
      .intersectObjects(
        [...this.meshes.values()].filter((m) => m.visible),
        false,
      )
      .find((h) => h.object.material?.visible !== false);
    if (!hit) return null;
    return {
      id: hit.object.userData.id,
      global: hit.object.userData.global,
      face: hit.face?.materialIndex ?? 0,
      distance: hit.distance,
      point: hit.point.toArray(),
    };
  }
  frame(id) {
    const o = objectById(this.area, id);
    const center = o
      ? o.position.map((p, i) => p + o.size[i] / 2)
      : [4000, 500, 4300];
    const size = o ? Math.max(...o.size, 200) : 3200;
    this.orbit.target.fromArray(center);
    this.camera.position.set(
      center[0] + size * 1.8,
      center[1] + size * 1.3,
      center[2] - size * 1.8,
    );
    this.orbit.update();
  }
  lock(id, axis) {
    const o = objectById(this.area, id);
    if (!o) return;
    const c = o.position.map((p, i) => p + o.size[i] / 2),
      s = Math.max(...o.size, 200) * 2.3;
    this.orbit.target.fromArray(c);
    this.camera.position.fromArray(c);
    this.camera.position[axis[0]] += s * axis[1];
    if (axis[0] === "y") this.camera.position.z += 0.01;
    this.orbit.update();
  }
  player(r) {
    this.camera.position.fromArray(r.position);
    const d = Math.PI / 180,
      pitch = r.rotation[0] * d,
      yaw = r.rotation[1] * d;
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(
      r.position[0] + Math.sin(yaw) * Math.cos(pitch),
      r.position[1] + Math.sin(pitch),
      r.position[2] + Math.cos(yaw) * Math.cos(pitch),
    );
    this.camera.rotateZ(r.rotation[2] * d);
  }
  render() {
    if (!this.play && this.orbit.enabled) this.orbit.update();
    this.renderer.render(this.scene, this.camera);
  }
  cameraState() {
    return {
      position: this.camera.position.toArray(),
      target: this.orbit.target.toArray(),
    };
  }
  restoreCamera(state) {
    this.camera.position.fromArray(state.position);
    this.orbit.target.fromArray(state.target);
    this.orbit.update();
  }
  dispose() {
    this.observer.disconnect();
    this.orbit.dispose();
    this.transform.disconnect();
    this.transform.getHelper().traverse((child) => {
      child.geometry?.dispose();
      for (const material of Array.isArray(child.material)
        ? child.material
        : [child.material])
        material?.dispose();
    });
    for (const mesh of this.meshes.values()) this.disposeMesh(mesh);
    for (const b of this.backgrounds.values()) b.dispose?.();
    this.renderer.dispose();
  }
}
