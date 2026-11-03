import { movePlayer, stepGravity, setPlayerHeight } from "./movement.js";
export class EditorNavigation {
  constructor(getWorld, getArea, view) {
    this.getWorld = getWorld;
    this.getArea = getArea;
    this.view = view;
    this.mode = "orbit";
    this.keys = new Set();
    this.saved = new Map();
    this.state = null;
  }
  setMode(mode) {
    if (this.mode !== "orbit" && this.state)
      this.saved.set(this.mode, {
        position: [...this.state.position],
        rotation: [...this.state.rotation],
      });
    this.mode = mode;
    this.keys.clear();
    this.view.orbit.enabled = mode === "orbit";
    if (mode === "orbit") return;
    const { position, target } = this.view.cameraState(),
      delta = target.map((n, i) => n - position[i]),
      len = Math.hypot(...delta) || 1;
    const saved = this.saved.get(mode);
    this.state = {
      world: this.getWorld(),
      areaId: this.getArea(),
      position: saved?.position || position,
      rotation: saved?.rotation || [
        (Math.asin(delta[1] / len) * 180) / Math.PI,
        (Math.atan2(delta[0], delta[2]) * 180) / Math.PI,
        0,
      ],
      mode: mode === "walk" ? 1 : mode === "fly2" ? 3 : 2,
      height: this.getWorld().defaults.height,
      requestedHeight: this.getWorld().defaults.height,
      vars: new Int32Array(256),
      velocityY: 0,
      fallStart: null,
      syncVars() {},
      interact() {},
      get area() {
        return this.world.areas.find((a) => a.id === this.areaId);
      },
    };
  }
  step(dt) {
    if (this.mode === "orbit" || !this.state) return;
    const r = this.state;
    r.world = this.getWorld();
    r.areaId = this.getArea();
    const c = r.world.controls,
      k = this.keys,
      active = (name) => !!c[name] && k.has(c[name]);
    const speed =
      r.world.preferences.moveStep * 7 * dt * (k.has("Shift") ? 3 : 1);
    r.rotation[1] +=
      (Number(active("turnLeft")) - Number(active("turnRight"))) * 90 * dt;
    r.rotation[0] = Math.max(
      -89,
      Math.min(
        89,
        r.rotation[0] +
          (Number(active("lookUp")) - Number(active("lookDown"))) * 90 * dt,
      ),
    );
    r.rotation[2] +=
      (Number(active("tiltLeft")) - Number(active("tiltRight"))) * 90 * dt;
    if (this.mode === "walk") {
      r.requestedHeight = Math.max(
        64,
        Math.min(
          280,
          r.requestedHeight +
            (Number(active("rise")) - Number(active("fall"))) * speed,
        ),
      );
      setPlayerHeight(r, active("crouch") ? 64 : r.requestedHeight);
    }
    movePlayer(
      r,
      {
        forward: (Number(active("forward")) - Number(active("back"))) * speed,
        strafe: (Number(active("right")) - Number(active("left"))) * speed,
        rise: (Number(active("rise")) - Number(active("fall"))) * speed,
      },
      this.mode.startsWith("cam"),
    );
    if (this.mode === "walk") stepGravity(r, dt);
    this.view.player(r);
    const d = Math.PI / 180,
      p = r.rotation[0] * d,
      y = r.rotation[1] * d;
    this.view.orbit.target.set(
      r.position[0] + Math.sin(y) * Math.cos(p) * 1000,
      r.position[1] + Math.sin(p) * 1000,
      r.position[2] + Math.cos(y) * Math.cos(p) * 1000,
    );
    this.view.orbit.enabled = false;
  }
}
