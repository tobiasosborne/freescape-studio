import { Runtime } from "./runtime.js";
import {
  movePlayer,
  stepGravity,
  lineOfSight,
  setPlayerHeight,
} from "./movement.js";
import { instrumentValue } from "./persistence.js";
import { AudioBank } from "./audio.js";
import { controlAction } from "./controls.js";
export class Player {
  constructor(world, viewport, hud, onError = () => {}) {
    this.viewport = viewport;
    this.hud = hud;
    this.keys = new Set();
    this.audio = new AudioBank();
    this.error = onError;
    this.running = true;
    this.centerCursor = true;
    this.selectedMode = world.defaults.mode === 3 ? 3 : 2;
    this.accumulator = 0;
    this.last = performance.now();
    this.runtime = new Runtime(world, {
      sound: (id) =>
        this.audio.play(this.runtime?.world.sounds[id] ?? world.sounds[id]),
      shot: () => {
        hud.classList.add("firing");
        setTimeout(() => hud.classList.remove("firing"), 90);
      },
      occluded: (from, to) => !lineOfSight(this.runtime, from, to),
    });
    this.renderHud();
    this.down = (e) => {
      if (e.target.closest?.("input,textarea,select")) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.add(key);
      this.runtime.vars[15] = e.key.length === 1 ? e.key.charCodeAt(0) : 0;
      const controls = this.runtime.world.controls;
      if (key === controls.mode && !e.repeat) this.action("mode");
      if (key === controls.selectMode && !e.repeat) this.action("selectMode");
      if (key === controls.centerCursor && !e.repeat)
        this.action("centerCursor");
      if (key === controls.faceForward)
        this.runtime.rotation = [0, this.runtime.rotation[1], 0];
      if (key === controls.uTurn && !e.repeat)
        this.runtime.rotation[1] = (this.runtime.rotation[1] + 180) % 360;
      if (key === controls.save && !e.repeat) this.save();
      if (key === controls.load && !e.repeat) this.load();
      if (key === controls.activate && !e.repeat) this.interact("activated");
      if (key === controls.shoot && !e.repeat) this.interact("shot");
      if (
        [" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      )
        e.preventDefault();
    };
    this.up = (e) =>
      this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    this.blur = () => this.keys.clear();
    window.addEventListener("keydown", this.down);
    window.addEventListener("keyup", this.up);
    window.addEventListener("blur", this.blur);
    this.mouse = (e) => {
      if (document.pointerLockElement === viewport.renderer.domElement) {
        this.runtime.rotation[1] -= e.movementX * 0.12;
        this.runtime.rotation[0] = Math.max(
          -85,
          Math.min(85, this.runtime.rotation[0] - e.movementY * 0.12),
        );
      }
    };
    window.addEventListener("mousemove", this.mouse);
    this.zoneDown = (e) => (this.buttons = e.buttons || 0);
    this.zoneUp = (e) => {
      const rect = viewport.host.getBoundingClientRect(),
        x = ((e.clientX - rect.left) / rect.width) * 320,
        y = ((e.clientY - rect.top) / rect.height) * 200,
        buttons = this.buttons || (e.button === 2 ? 2 : 1);
      const action = controlAction(this.runtime.world, x, y, buttons);
      if (!action) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      if (action === "shoot" || action === "activate")
        this.interact(action === "shoot" ? "shot" : "activated");
      else if (action === "save") this.save();
      else if (action === "load") this.load();
      else if (this.action(action)) return;
      else {
        const key = this.runtime.world.controls[action];
        this.keys.add(key);
        this.controlBoost = buttons === 2 ? 5 : 1;
        setTimeout(() => {
          this.keys.delete(key);
          this.controlBoost = 1;
        }, 180);
      }
    };
    viewport.host.addEventListener("pointerdown", this.zoneDown, true);
    viewport.host.addEventListener("pointerup", this.zoneUp, true);
  }
  action(action) {
    if (action === "mode")
      this.runtime.mode = this.runtime.mode === 1 ? this.selectedMode : 1;
    else if (action === "selectMode") {
      this.selectedMode = this.selectedMode === 2 ? 3 : 2;
      if (this.runtime.mode !== 1) this.runtime.mode = this.selectedMode;
    } else if (action === "centerCursor") {
      this.centerCursor = !this.centerCursor;
      this.renderHud();
    } else if (action === "faceForward")
      this.runtime.rotation = [0, this.runtime.rotation[1], 0];
    else if (action === "uTurn")
      this.runtime.rotation[1] = (this.runtime.rotation[1] + 180) % 360;
    else return false;
    return true;
  }
  pointer(event, hit) {
    const rect = this.viewport.host.getBoundingClientRect();
    const input = {
      x: Math.round(((event.clientX - rect.left) / rect.width) * 320),
      y: Math.round(((event.clientY - rect.top) / rect.height) * 200),
      buttons: event.buttons || this.buttons || (event.button === 2 ? 2 : 1),
    };
    return this.interact(event.button === 2 ? "activated" : "shot", hit, input);
  }
  interact(event, hit, input) {
    const rect = this.viewport.renderer.domElement.getBoundingClientRect();
    if (hit === undefined)
      hit = this.viewport.pick(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
    const v = this.runtime.world.viewWindow;
    this.runtime.vars[16] = input?.buttons ?? (event === "shot" ? 1 : 2);
    this.runtime.vars[17] = Math.max(
      0,
      Math.min(319, input?.x ?? Math.round(v.x + v.width / 2)),
    );
    this.runtime.vars[18] = Math.max(
      0,
      Math.min(199, input?.y ?? Math.round(v.y + v.height / 2)),
    );
    if (hit)
      this.runtime.interact(
        hit.id,
        event,
        hit.distance,
        hit.global ? 0 : this.runtime.areaId,
      );
    else if (event === "shot") this.runtime.fire();
    return hit;
  }
  step(now) {
    if (!this.running) return;
    this.accumulator += Math.min(100, now - this.last);
    this.last = now;
    try {
      let loops = 0;
      while (this.accumulator >= 20 && loops++ < 5) {
        this.accumulator -= 20;
        const r = this.runtime,
          c = r.world.controls,
          k = this.keys,
          active = (a) => c[a] && k.has(c[a]);
        if (r.frame >= r.blockedUntil) {
          const speed =
            ((this.controlBoost || 1) *
              (k.has("Shift") ? 2 : 1) *
              r.world.preferences.moveStep *
              0.15) /
            r.area.scale;
          r.rotation[1] +=
            (Number(active("turnLeft")) - Number(active("turnRight"))) * 2;
          r.rotation[0] = Math.max(
            -89,
            Math.min(
              89,
              r.rotation[0] +
                (Number(active("lookUp")) - Number(active("lookDown"))) * 2,
            ),
          );
          r.rotation[2] +=
            (Number(active("tiltLeft")) - Number(active("tiltRight"))) * 2;
          if (r.mode === 1) {
            r.requestedHeight = Math.max(
              64,
              Math.min(
                280,
                (r.requestedHeight ?? r.height) +
                  (Number(active("rise")) - Number(active("fall"))) * speed,
              ),
            );
            setPlayerHeight(r, active("crouch") ? 64 : r.requestedHeight);
          }
          movePlayer(r, {
            forward:
              (Number(active("forward")) - Number(active("back"))) * speed,
            strafe: (Number(active("right")) - Number(active("left"))) * speed,
            rise: (Number(active("rise")) - Number(active("fall"))) * speed,
          });
          stepGravity(r, 0.02);
          if (active("shoot") && r.vars[20] & 8 && r.frame % 8 === 0)
            this.interact("shot");
        }
        r.tick();
      }
      this.viewport.update(this.runtime.world, this.runtime.areaId, {
        play: true,
      });
      this.viewport.player(this.runtime);
      this.renderHud();
    } catch (error) {
      this.running = false;
      this.error(error.message);
    }
  }
  renderHud() {
    const r = this.runtime,
      palette = r.area.palette;
    this.hud.replaceChildren();
    for (const i of r.world.instruments) {
      const value = instrumentValue(i, r.vars);
      if (value === null) continue;
      const el = document.createElement("div");
      el.className = `instrument ${i.type}`;
      el.dataset.id = i.id;
      Object.assign(el.style, {
        left: `${i.x / 3.2}%`,
        top: `${i.y / 2}%`,
        width: `${i.width / 3.2}%`,
        height: `${i.height / 2}%`,
        color: palette[i.fg],
        background: palette[i.bg],
        fontSize: `${Math.max(10, (this.viewport.host.clientHeight * 8) / 200)}px`,
      });
      if (["horizontal", "vertical"].includes(i.type)) {
        const bar = document.createElement("span");
        Object.assign(bar.style, {
          background: palette[i.fg],
          width: i.type === "horizontal" ? `${value * 100}%` : "100%",
          height: i.type === "vertical" ? `${value * 100}%` : "100%",
        });
        el.append(bar);
      } else el.textContent = value;
      this.hud.append(el);
    }
    if (!this.centerCursor) return;
    const cross = document.createElement("div");
    cross.className = "crosshair";
    cross.textContent = "+";
    const v = r.world.viewWindow;
    cross.style.left = `${(v.x + v.width / 2) / 3.2}%`;
    cross.style.top = `${(v.y + v.height / 2) / 2}%`;
    this.hud.append(cross);
  }
  save() {
    try {
      localStorage.setItem(
        `freescape-studio:game:${this.runtime.world.name}`,
        this.runtime.saveGame(),
      );
      this.onMessage?.("Game saved");
    } catch (e) {
      this.error(e.message);
    }
  }
  load() {
    try {
      const text = localStorage.getItem(
        `freescape-studio:game:${this.runtime.world.name}`,
      );
      if (!text) throw Error("No saved game for this world");
      this.runtime.loadGame(text);
      this.onMessage?.("Game loaded");
    } catch (e) {
      this.error(e.message);
    }
  }
  dispose() {
    this.running = false;
    window.removeEventListener("keydown", this.down);
    window.removeEventListener("keyup", this.up);
    window.removeEventListener("blur", this.blur);
    window.removeEventListener("mousemove", this.mouse);
    this.viewport.host.removeEventListener("pointerdown", this.zoneDown, true);
    this.viewport.host.removeEventListener("pointerup", this.zoneUp, true);
    this.hud.replaceChildren();
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
