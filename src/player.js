import { Viewport } from "./viewport.js";
import { Player } from "./play.js";
const world = window.FREESCAPE_WORLD,
  host = document.querySelector("#player-viewport"),
  hud = document.createElement("div");
hud.className = "hud";
let player;
const message = (text) => {
  const el = document.querySelector("#message");
  el.textContent = text;
  el.style.display = "block";
  setTimeout(() => (el.style.display = "none"), 4000);
};
const view = new Viewport(host, {
  pick(hit, event) {
    if (event.button === 0 || event.button === 2) player?.pointer(event, hit);
  },
});
host.append(hud);
player = new Player(world, view, hud, message);
player.onMessage = message;
document.querySelector("#restart").onclick = () => player.runtime.reset();
document.querySelector("#save-game").onclick = () => player.save();
document.querySelector("#load-game").onclick = () => player.load();
document.querySelector("#look").onclick = () =>
  view.renderer.domElement.requestPointerLock?.();
document.querySelector("#activate").onclick = () =>
  player.interact("activated");
document.querySelector("#shoot").onclick = () => player.interact("shot");
document.querySelectorAll("[data-step]").forEach(
  (button) =>
    (button.onclick = () => {
      const key = world.controls[button.dataset.step];
      player.keys.add(key);
      setTimeout(() => player.keys.delete(key), 200);
    }),
);
function frame(now) {
  requestAnimationFrame(frame);
  player.step(now);
  view.render();
}
requestAnimationFrame(frame);
