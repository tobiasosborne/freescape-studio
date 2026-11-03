import {
  createWorld,
  createArea,
  createObject,
  duplicateObject,
  deleteObject,
  groupObjects,
  transformObject,
  objectById,
  areaById,
  nextId,
  History,
  clone,
  serializeWorld,
  parseWorld,
  PALETTE,
  TYPES,
  validateObject,
  descendants,
  refreshGroupBounds,
} from "./model.js";
import { demoWorld } from "./demo.js";
import { compile, COMMANDS } from "./runtime.js";
import { Viewport } from "./viewport.js";
import { Player } from "./play.js";
import { EditorNavigation } from "./navigation.js";
import { AudioBank } from "./audio.js";
import {
  WorldLibrary,
  download,
  exportObject,
  importObject,
  spreadPalette,
} from "./persistence.js";
import { standaloneHTML } from "./export.js";
import playerCode from "./player.js?bundle";

const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const icon = {
  cuboid: "◇",
  pyramid: "△",
  rectangle: "▱",
  triangle: "◬",
  quadrilateral: "⬡",
  pentagon: "⬠",
  hexagon: "⬡",
  line: "╱",
  sensor: "⌾",
  group: "▧",
};
let initial = demoWorld();
try {
  const autosave = localStorage.getItem("freescape-studio:autosave");
  if (autosave) initial = parseWorld(autosave);
} catch {}
let history = new History(initial),
  areaId = 1,
  selected = [],
  tab = "primitives",
  tool = "select",
  color = 5,
  shadeEnabled = false,
  secondary = 2,
  exclude = false,
  highlight = true,
  grid = true,
  ghost = false,
  fine = false,
  player = null,
  scriptKey = null,
  search = "",
  cameraMode = "orbit",
  cameras = Array(5).fill(null),
  cameraBeforePlay = null,
  toastTimer;
const editorVars = new Int32Array(256),
  library = new WorldLibrary(localStorage),
  audio = new AudioBank();
const world = () => history.state,
  area = () => areaById(world(), areaId),
  object = () => objectById(area(), selected[0]);
const button = (text, action, extra = "") =>
  `<button data-action="${action}" ${extra}>${text}</button>`;
const field = (name, value, attrs = "") =>
  `<label>${esc(name)}<input aria-label="${esc(name)}" value="${esc(value)}" ${attrs}></label>`;
const number = (name, value, attrs = "") =>
  field(name, value, `type="number" ${attrs}`);
const options = (values, current) =>
  values
    .map((v) => {
      const [value, label] = Array.isArray(v) ? v : [v, v];
      return `<option value="${esc(value)}" ${String(current) === String(value) ? "selected" : ""}>${esc(label)}</option>`;
    })
    .join("");
function notify(message) {
  clearTimeout(toastTimer);
  $(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.role = "status";
  el.textContent = message;
  document.body.append(el);
  toastTimer = setTimeout(() => el.remove(), 4500);
}
function edit(fn, message) {
  try {
    history.perform((w) => {
      fn(w);
      for (const a of w.areas) refreshGroupBounds(a);
      parseWorld(serializeWorld(w));
    });
    if (!areaById(world(), areaId)) areaId = world().defaults.startArea;
    selected = selected.filter((id) => objectById(area(), id));
    saveAuto();
    render();
    if (message) notify(message);
  } catch (error) {
    notify(error.message);
    render();
  }
}
function saveAuto() {
  try {
    localStorage.setItem("freescape-studio:autosave", serializeWorld(world()));
    $(".save-indicator").textContent = "Saved on this device";
  } catch {
    notify("Autosave unavailable. Download your world to keep your work.");
  }
}
function replaceWorld(w) {
  player?.dispose();
  player = null;
  history = new History(w);
  areaId = w.defaults.startArea;
  selected = [];
  scriptKey = null;
  saveAuto();
  render();
  view.frame();
}
function modal(title, body, footer = "", wide = false) {
  closeModal();
  const back = document.createElement("div");
  back.className = "modal-backdrop";
  back.innerHTML = `<section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header class="modal-header"><h2>${esc(title)}</h2>${button("×", "close", 'aria-label="Close dialog"')}</header><div class="modal-body">${body}</div>${footer ? `<footer class="modal-footer">${footer}</footer>` : ""}</section>`;
  document.body.append(back);
  back.addEventListener("click", (e) => {
    if (e.target === back) closeModal();
  });
  back.querySelector("input,button,select")?.focus();
}
function closeModal() {
  $(".modal-backdrop")?.remove();
}

$("#app").innerHTML =
  `<header class="appbar"><div class="brand"><span class="brand-mark">◇</span><div><strong>FREESCAPE</strong><small>3D CONSTRUCTION KIT · STUDIO</small></div></div><div class="project-heading"><strong id="project-name"></strong><small>Build a world. Give it a life.</small></div><span class="save-indicator">Saved on this device</span><div class="actions">${button("⚙", "settings", 'aria-label="World settings" title="World settings"')}${button("↥ Export", "export", 'aria-label="Export playable world"')}${button("Save", "save", 'aria-label="Save world"')}${button("▶ Play world", "play", 'class="primary" aria-label="Play world"')}</div></header>
<nav class="menubar" aria-label="Editor menu">${[
    [
      "File",
      [
        ["New world", "new"],
        ["Open / save library", "save"],
        ["Load world JSON…", "load-file"],
        ["Save selected object…", "save-object"],
        ["Load object…", "load-object"],
        ["Make playable world…", "export"],
        ["Restore sample world", "demo"],
      ],
    ],
    [
      "Edit",
      [
        ["Undo", "undo"],
        ["Redo", "redo"],
        ["Duplicate selected", "duplicate"],
        ["Copy placement…", "copy-options"],
        ["Group selected", "group"],
        ["Delete selected", "delete"],
        ["World settings", "settings"],
      ],
    ],
    [
      "Area",
      [
        ["New area", "new-area"],
        ["Area settings", "area-settings"],
        ["Manage areas", "areas"],
        ["Entrances", "entrances"],
        ["Global objects", "globals"],
        ["Area palette", "palette"],
      ],
    ],
    [
      "View",
      [
        ["Frame selected", "frame"],
        ["Exclude background", "exclude"],
        ["Highlight selected", "highlight"],
        ["Show invisible objects", "ghost"],
        ["Toggle grid", "grid"],
        ["Inspector", "inspector"],
      ],
    ],
    [
      "Help",
      [
        ["Guide & controls", "help"],
        ["Ground truth & scope", "sources"],
      ],
    ],
  ]
    .map(
      ([title, items]) =>
        `<details><summary>${title}</summary><div class="menu">${items.map(([name, action]) => button(name, action)).join("")}</div></details>`,
    )
    .join("")}<span class="mono">1991, REIMAGINED IN THREE.JS</span></nav>
<main class="workspace"><aside class="sidebar"><div class="side-header"><div class="eyebrow">World explorer</div><div class="area-heading"><select id="area-select" aria-label="Current area"></select>${button("+", "new-area", 'aria-label="Create area"')}</div><div class="area-actions">${button("⌁ Entrances", "entrances")}${button("◉ Settings", "area-settings")}</div></div><div class="objects-heading"><strong>Objects</strong><small id="object-count"></small></div><input id="object-search" class="search" placeholder="⌕  Find an object…" aria-label="Find objects"><div class="object-list" id="objects"></div><div class="side-bottom"><div class="inline-actions">${button("▧ Group", "group")}${button("⧉ Copy", "duplicate", 'aria-label="Duplicate selected"')}${button("⌫", "delete", 'aria-label="Delete selected"')}</div></div></aside>
<section class="viewport-shell"><div class="viewport" id="viewport"></div><div id="hud" class="hud"></div><div class="viewport-top"><div class="tool-group" id="tools">${[
    ["select", "↖", "Select"],
    ["translate", "✣", "Move"],
    ["rotate", "⟳", "Rotate"],
    ["scale", "⤢", "Scale"],
    ["paint", "▰", "Paint"],
  ]
    .map(([value, symbol, label]) =>
      button(
        symbol,
        "tool",
        `data-value="${value}" title="${label}" aria-label="${label} tool"`,
      ),
    )
    .join(
      "",
    )}</div><div class="tool-group">${button("↶", "undo", 'aria-label="Undo" title="Undo · Ctrl Z"')}${button("↷", "redo", 'aria-label="Redo" title="Redo · Ctrl Shift Z"')}</div><div class="viewport-label"><i></i> PERSPECTIVE <span> / </span> <span id="view-label">ORBIT</span></div></div><div class="viewport-corner"><div class="title">A little geometry.<br>An entire world.</div><span class="mono">SELECT · SHAPE · SCRIPT · EXPLORE</span></div><div class="view-controls"><select id="camera-mode" aria-label="Editor camera"><option value="orbit">Orbit</option><option value="cam1">Camera 1</option><option value="cam2">Camera 2</option><option value="cam3">Camera 3</option><option value="cam4">Camera 4</option><option value="cam5">Camera 5</option><option value="walk">Walk</option><option value="fly1">Fly 1</option><option value="fly2">Fly 2</option></select>${button("⊡ Frame", "frame")}${button("Grid", "grid", 'id="grid-button"')}${button("Fine", "fine", 'id="fine-button"')}</div><div class="play-strip hidden" id="play-strip">${button("↑", "step", 'data-value="forward" aria-label="Move forward"')}${button("←", "step", 'data-value="left" aria-label="Move left"')}${button("→", "step", 'data-value="right" aria-label="Move right"')}${button("Activate", "activate")}${button("Shoot", "shoot")}${button("Look around", "pointer-lock")}${button("Save game", "save-game")}${button("Load game", "load-game")}${button("Reset", "reset")}</div></section>
<aside class="inspector" id="inspector"></aside><section class="bottom-dock"><nav class="dock-tabs" aria-label="World tools">${["primitives", "scripts", "animations", "instruments", "variables", "sounds"].map((t) => button(t[0].toUpperCase() + t.slice(1), "tab", `data-value="${t}" aria-label="${t[0].toUpperCase() + t.slice(1)}"`)).join("")}</nav><div class="dock-content" id="dock"></div></section></main><footer class="statusbar"><span><span class="dot">●</span> <span id="status-mode">EDITOR</span></span><span id="status-area"></span><span id="status-selection"></span><span id="status-coordinates">DRAG TO ORBIT · SCROLL TO ZOOM · F TO FRAME</span></footer>`;
const view = new Viewport($("#viewport"), {
  pick(hit, e) {
    if (player) {
      if (e.button === 0 || e.button === 2) player.pointer(e, hit);
      return;
    }
    if (!hit) return;
    if (hit.global) {
      notify("Edit this object in Global library (area 0)");
      return;
    }
    selected = e.shiftKey ? [...new Set([...selected, hit.id])] : [hit.id];
    if (tool === "paint") {
      if (e.button === 2) edit((w) => paint(w, hit.id, hit.face));
      else color = object()?.colors[hit.face] ?? color;
    }
    render();
  },
  transform(id, position, scale, rotation) {
    edit((w) => {
      const a = areaById(w, areaId),
        o = objectById(a, id),
        delta = position.map((p, i) => Math.round(p) - o.position[i]);
      if (tool === "translate") transformObject(a, id, "move", delta);
      if (tool === "scale") {
        transformObject(
          a,
          id,
          "scale",
          scale,
          o.position.map((p, i) => p + o.size[i] / 2),
        );
      }
      if (tool === "rotate") {
        transformObject(
          a,
          id,
          "rotate",
          rotation.map((r) => Math.round(r / 90) * 90),
        );
      }
    });
  },
});
view.setTool(tool, 50);
const navigation = new EditorNavigation(world, () => areaId, view);
function renderObjects() {
  $("#area-select").innerHTML = world()
    .areas.map(
      (a) =>
        `<option value="${a.id}" ${a.id === areaId ? "selected" : ""}>${String(a.id).padStart(3, "0")} · ${esc(a.name)}</option>`,
    )
    .join("");
  $("#object-count").textContent = `${area().objects.length} total`;
  $("#objects").innerHTML = area()
    .objects.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
    .map(
      (o) =>
        `<div class="object-row ${selected.includes(o.id) ? "selected" : ""} ${o.status !== "visible" ? "invisible" : ""}"><input type="checkbox" data-select="${o.id}" aria-label="Include ${esc(o.name)} in selection" ${selected.includes(o.id) ? "checked" : ""}><button data-action="select" data-value="${o.id}" title="${esc(o.type)} ${o.id}"><span class="object-icon">${icon[o.type]}</span><span class="object-name">${esc(o.name)}</span><span class="object-id">${String(o.id).padStart(3, "0")}</span></button></div>`,
    )
    .join("");
}
const vector = (title, values, key) =>
  `<div class="vector">${["X", "Y", "Z"].map((axis, i) => number(`${title} ${axis}`, values[i], `data-object-field="${key}" data-index="${i}" step="${fine ? world().preferences.fineStep : world().preferences.objectStep}"`)).join("")}</div>`;
function nudgeButtons() {
  return (
    ["move", "stretch"]
      .map(
        (kind) =>
          `<small>${kind === "move" ? "Move" : "Stretch / shrink"}</small><div class="inline-actions">${[0, 1, 2].flatMap((axis) => [-1, 1].map((sign) => button(`${"XYZ"[axis]}${sign > 0 ? "+" : "−"}`, "nudge", `data-value="${kind}:${axis}:${sign}" aria-label="${kind} ${"XYZ"[axis]} ${sign > 0 ? "plus" : "minus"}"`))).join("")}</div>`,
      )
      .join("<br>") + "<br><small>Right-click for the secondary step.</small>"
  );
}
function paint(w, id, face) {
  for (const o of descendants(areaById(w, areaId), id)) {
    o.patterns ??= Array(6).fill(null);
    for (const i of face === undefined ? o.colors.map((_, i) => i) : [face]) {
      o.colors[i] = color;
      o.patterns[i] = shadeEnabled ? { a: color, b: secondary } : null;
    }
  }
}
function nudge(value, coarse = false) {
  if (!object()) return;
  const [kind, a, s] = value.split(":"),
    axis = Number(a),
    sign = Number(s),
    p = world().preferences,
    step = fine
      ? p.fineStep
      : coarse
        ? p.objectRightStep || p.objectStep * 5
        : p.objectStep;
  edit((w) => {
    const area = areaById(w, areaId),
      o = objectById(area, selected[0]);
    if (kind === "move") {
      const d = Math.max(
        -o.position[axis],
        Math.min(8192 - o.size[axis] - o.position[axis], step * sign),
      );
      transformObject(
        area,
        o.id,
        "move",
        [0, 1, 2].map((i) => (i === axis ? d : 0)),
      );
    } else {
      const size = Math.max(
        1,
        Math.min(8192 - o.position[axis], o.size[axis] + step * sign),
      );
      transformObject(
        area,
        o.id,
        "scale",
        [0, 1, 2].map((i) => (i === axis ? size / Math.max(o.size[i], 1) : 1)),
      );
    }
  });
}
function renderInspector() {
  const o = object();
  if (!o) {
    $("#inspector").innerHTML =
      `<header class="panel-heading"><h2>Inspector</h2><span class="info-badge">WORLD</span></header><div class="inspector-section"><h3>A place to begin</h3><p class="muted" style="line-height:1.8">Select an object in the scene or the explorer to shape it.</p></div><div class="inspector-section"><h3>${esc(area().name)}</h3><p class="muted">${area().objects.length} objects · ${area().entrances.length} entrances</p><br><div class="inline-actions">${button("Defaults", "settings")}${button("Edit palette", "palette")}</div></div><div class="inspector-section"><h3>Inside the kit</h3><p class="muted" style="line-height:1.9">Simple solids become architecture.<br>Conditions become stories.<br>Press Play to step inside.</p></div>`;
    return;
  }
  $("#inspector").innerHTML =
    `<header class="panel-heading"><h2>Object properties</h2><span class="info-badge">${esc(o.type).toUpperCase()} ${String(o.id).padStart(3, "0")}</span></header><section class="inspector-section">${field("Object name", o.name, 'data-object-field="name"')}<h3>Transform</h3>${vector("Position", o.position, "position")}${vector("Size", o.size, "size")}${nudgeButtons()}<br><div class="inline-actions">${button("↻ X", "turn", 'data-value="0" title="Turn X 90°"')}${button("↻ Y", "turn", 'data-value="1" title="Turn Y 90°"')}${button("↻ Z", "turn", 'data-value="2" title="Turn Z 90°"')}${button("Flip", "flip")}</div><br><div class="inline-actions">${[
      ["Front", "z", -1],
      ["Back", "z", 1],
      ["Left", "x", -1],
      ["Right", "x", 1],
      ["Top", "y", 1],
      ["Bottom", "y", -1],
    ]
      .map(([name, axis, sign]) =>
        button(name, "lock", `data-axis="${axis}" data-sign="${sign}"`),
      )
      .join("")}</div></section>
 <section class="inspector-section"><h3>Face colours</h3><div class="swatches">${area()
   .palette.map(
     (c, i) =>
       `<button class="swatch" data-action="color" data-value="${i}" style="background:${c}" aria-label="Palette colour ${i}" aria-pressed="${i === color}">${i === 0 ? "I" : ""}</button>`,
   )
   .join(
     "",
   )}</div><label class="check"><input id="shade-enabled" type="checkbox" ${shadeEnabled ? "checked" : ""}>Two-colour shade</label><br><label>Secondary colour<select id="shade-secondary">${options(
   area().palette.map((c, i) => [i, `Colour ${i}`]),
   secondary,
 )}</select></label><br><div class="faces">${Array.from({ length: ["cuboid", "pyramid"].includes(o.type) ? 6 : 2 }, (_, i) => `<button class="face" data-action="face" data-value="${i}" aria-label="Paint face ${i + 1}"><i style="background:${area().palette[o.colors[i] ?? o.colors[0]]}"></i>${["Right", "Left", "Top", "Bottom", "Back", "Front"][i]}</button>`).join("")}</div><br><div class="inline-actions">${button("Fill all faces", "fill")}${button("Area palette", "palette")}</div></section>
 <section class="inspector-section"><h3>Behavior</h3><label>Current state<select data-object-field="status">${options(["visible", "invisible", "destroyed"], o.status)}</select></label><br><label>Initial state<select data-object-field="initialStatus">${options(["visible", "invisible"], o.initialStatus)}</select></label><br><label class="check"><input type="checkbox" data-object-field="moveable" ${o.moveable ? "checked" : ""}>Moveable (allow animation)</label>${o.moveable ? `<br>${vector("Start position", o.startPosition, "startPosition")}` : ""}<br>${button("⌁ Edit conditions", "object-script")}</section>
 ${o.type === "sensor" ? `<section class="inspector-section"><h3>Sensor</h3>${number("Detection range", o.sensor.range, 'data-sensor="range" min="0"')}${number("Check interval (ticks)", o.sensor.speed, 'data-sensor="speed" min="1"')}<label>Effect<select data-sensor="effect">${options(["sense", "shoot"], o.sensor.effect)}</select></label><br><div class="member-list">${["+x", "-x", "+y", "-y", "+z", "-z"].map((d) => `<label class="check"><input type="checkbox" data-direction="${d}" ${o.sensor.directions.includes(d) ? "checked" : ""}>${d}</label>`).join("")}</div></section>` : ""}
 ${o.points && o.type !== "rectangle" ? `<section class="inspector-section"><h3>Point editing</h3><p class="muted">Coordinates relative to object size.</p><br>${o.points.map((p, i) => `<small>POINT ${i + 1}</small><div class="vector">${p.map((v, j) => number(`Point ${i + 1} ${"XYZ"[j]}`, v, `data-point="${i}" data-index="${j}" step="0.05"`)).join("")}</div>`).join("")}</section>` : ""}
 ${
   o.type === "group"
     ? `<section class="inspector-section"><h3>Group members</h3>${area()
         .objects.filter((x) => x.id !== o.id && x.type !== "group")
         .map(
           (x) =>
             `<label class="check"><input type="checkbox" data-member="${x.id}" ${o.members.includes(x.id) ? "checked" : ""}>${esc(x.name)}</label>`,
         )
         .join("")}<br>${button("Ungroup", "ungroup")}</section>`
     : ""
 }<section class="inspector-section"><div class="inline-actions">${button("Copy to…", "copy-options")}${button("Save object", "save-object")}${button("Delete", "delete")}</div></section>`;
}
function scriptList(animation = false) {
  const rows = [];
  if (animation) {
    for (const a of area().animators)
      rows.push({
        key: `animation:${a.id}`,
        name: `${String(a.id).padStart(3, "0")} ${a.name || "Animator"}`,
        source: a.source,
      });
  } else {
    if (object())
      rows.push({
        key: `object:${object().id}`,
        name: `Object · ${object().name}`,
        source: object().condition,
      });
    for (const c of area().conditions)
      rows.push({
        key: `area:${c.id}`,
        name: `Area · ${c.name || c.id}`,
        source: c.source,
      });
    for (const c of world().conditions)
      rows.push({
        key: `general:${c.id}`,
        name: `General · ${c.name || c.id}`,
        source: c.source,
      });
  }
  return rows;
}
function renderDock() {
  $(".dock-tabs")
    .querySelectorAll("button")
    .forEach((b) => b.classList.toggle("active", b.dataset.value === tab));
  if (tab === "primitives") {
    $("#dock").innerHTML =
      `<div class="dock-intro"><small>A world starts with a shape.</small><span class="mono muted">CLICK TO ADD · SHIFT CLICK TO MULTISELECT</span></div><div class="primitive-grid">${TYPES.filter(
        (t) => t !== "group",
      )
        .map(
          (t) =>
            `<button class="primitive" data-action="create" data-value="${t}" aria-label="Add ${t}"><span class="shape-icon">${icon[t]}</span>${t[0].toUpperCase() + t.slice(1)}</button>`,
        )
        .join("")}</div>`;
    return;
  }
  if (["scripts", "animations"].includes(tab)) {
    const animation = tab === "animations",
      rows = scriptList(animation);
    if (!rows.some((r) => r.key === scriptKey)) scriptKey = rows[0]?.key;
    const current = rows.find((r) => r.key === scriptKey);
    $("#dock").innerHTML =
      `<div class="dock-layout"><div class="dock-list">${rows.map((r) => button(esc(r.name), "script-select", `data-value="${r.key}" class="${r.key === scriptKey ? "active" : ""}"`)).join("")}<div class="inline-actions">${button("+ " + (animation ? "Animator" : "General"), "new-script", `data-value="${animation ? "animation" : "general"}"`)}${!animation ? button("+ Area", "new-script", 'data-value="area"') : ""}</div></div><div class="script-editor"><label class="hidden" for="fcl-source">FCL source</label><textarea id="fcl-source" aria-label="FCL source" spellcheck="false" placeholder="IF SHOT? THEN INVIS (2) ENDIF">${esc(current?.source || "")}</textarea><div class="script-meta">${button("Apply script", "apply-script", 'class="primary"')}${button("Delete", "delete-script")}${animation ? button("Preview", "preview-animation") : ""}<small id="script-status">${current ? esc(current.name) : "Create a condition to begin"}</small></div></div></div>`;
    return;
  }
  if (tab === "instruments") {
    $("#dock").innerHTML =
      `<div class="dock-intro"><small>Instruments connect your world’s variables to the screen.</small><div class="inline-actions">${button("+ Instrument", "new-instrument")}${button("View & border", "screen-settings")}</div></div>${world()
        .instruments.map(
          (i) =>
            `<div class="library-row"><span>${String(i.id).padStart(3, "0")} · ${esc(i.name)} <small>${esc(i.type)} · V${i.variable}</small></span>${button("Edit", "instrument", `data-value="${i.id}"`)}${button("Delete", "delete-instrument", `data-value="${i.id}"`)}</div>`,
        )
        .join("")}`;
    return;
  }
  if (tab === "variables") {
    $("#dock").innerHTML =
      `<div class="dock-intro"><small>256 signed variables · V0–V29 system · V255 persistent</small><small>Use a startup condition for initial values.</small></div><div class="variable-grid">${Array.from({ length: 256 }, (_, i) => number(`V${i}`, editorVars[i], `data-variable="${i}"`)).join("")}</div>`;
    return;
  }
  if (tab === "sounds") {
    $("#dock").innerHTML =
      `<div class="dock-intro"><small>32 sound slots · Synthesise a tone or import your own sample.</small><label class="check"><input type="checkbox" id="audio-enabled" ${audio.enabled ? "checked" : ""}>Audio enabled</label></div><div class="primitive-grid">${world()
        .sounds.map((s) =>
          button(
            `${s.id.toString().padStart(2, "0")} · ${esc(s.name)}`,
            "sound",
            `data-value="${s.id}"`,
          ),
        )
        .join("")}</div>`;
  }
}
function render() {
  if (!areaById(world(), areaId)) areaId = world().defaults.startArea;
  const playing = !!player;
  document.body.classList.toggle("play-mode", playing);
  $("#project-name").textContent = world().name;
  const playButton = $('[data-action="play"]');
  playButton.textContent = playing ? "■ Editor" : "▶ Play world";
  playButton.setAttribute(
    "aria-label",
    playing ? "Return to editor" : "Play world",
  );
  $("#play-strip").classList.toggle("hidden", !playing);
  if (!playing) {
    renderObjects();
    renderInspector();
    renderDock();
    view.update(world(), areaId, { selected, exclude, highlight, grid, ghost });
  }
  $("#tools")
    .querySelectorAll("button")
    .forEach((b) => b.classList.toggle("active", b.dataset.value === tool));
  $("#grid-button").classList.toggle("active", grid);
  $("#fine-button").classList.toggle("active", fine);
  $("#status-mode").textContent = playing ? "PLAY" : "EDITOR";
  $("#status-area").textContent =
    `AREA ${String(areaId).padStart(3, "0")} · ${area().name}`;
  $("#status-selection").textContent = selected.length
    ? `${selected.length} SELECTED · ${object()?.name || ""}`
    : `${area().objects.length} OBJECTS`;
}
function startPlay() {
  try {
    for (const a of world().areas) {
      for (const o of a.objects) compile(o.condition);
      for (const c of [...a.conditions, ...a.animators]) compile(c.source);
    }
    for (const c of world().conditions) compile(c.source);
    cameraBeforePlay = view.cameraState();
    player = new Player(world(), view, $("#hud"), notify);
    player.onMessage = notify;
    render();
  } catch (e) {
    notify(e.message);
  }
}
function stopPlay() {
  player?.dispose();
  player = null;
  view.restoreCamera(
    cameraBeforePlay || {
      position: [8500, 5000, -1900],
      target: [4000, 400, 4300],
    },
  );
  render();
}

function libraryDialog() {
  modal(
    "Your worlds",
    `<p>Keep worlds in this browser, or download a file to take them with you.</p><div class="form-grid two">${field("World name", world().name, 'id="save-name"')}<div class="inline-actions" style="align-self:end">${button("Save to library", "library-save", 'class="primary"')}${button("Download JSON", "download-world")}</div></div><div id="library-items">${
      library
        .list()
        .map(
          (name) =>
            `<div class="library-row"><span>${esc(name)}</span>${button("Open", "library-open", `data-value="${esc(name)}"`)}${button("Delete", "library-delete", `data-value="${esc(name)}"`)}</div>`,
        )
        .join("") || "<p>Your library is empty.</p>"
    }</div><div class="inline-actions">${button("Import world JSON…", "load-file")}${button("Open sample world", "demo")}</div>`,
  );
}
function worldSettings() {
  const w = world();
  modal(
    "World settings",
    `<div class="form-grid two">${field("Project title", w.name, 'id="setting-name"')}${field("Author", w.author, 'id="setting-author"')}</div><h3>Start & player</h3><div class="form-grid">${Object.entries(
      {
        startArea: "Start area",
        startEntrance: "Start entrance",
        mode: "Initial mode (1–3)",
        initialCondition: "Initial condition",
        climb: "Climb ability",
        safeFall: "Safe fall distance",
        activateRange: "Activation range",
        timer: "Timer interval (50 Hz)",
        height: "Standing height",
      },
    )
      .map(([k, n]) => number(n, w.defaults[k], `data-default="${k}"`))
      .join(
        "",
      )}</div><h3>Editing steps</h3><div class="form-grid">${Object.entries(
      w.preferences,
    )
      .map(([k, v]) =>
        number(
          k.replace(/([A-Z])/g, " $1"),
          v,
          `data-preference="${k}" min="1"`,
        ),
      )
      .join(
        "",
      )}</div><div class="inline-actions">${button("Keyboard controls", "controls")}${button("View window & border", "screen-settings")}</div>`,
    button("Apply settings", "apply-settings", 'class="primary"'),
  );
}
function areaDialog(id = areaId) {
  const a = areaById(world(), id);
  modal(
    "Area settings",
    `${field("Area name", a.name, 'id="area-name"')}<div class="form-grid">${number("Scale", a.scale, 'id="area-scale" min="0.01" step="0.25"')}${number("Sky colour index", a.sky, 'id="area-sky" min="0" max="15"')}${number("Ground colour index", a.ground, 'id="area-ground" min="0" max="15"')}</div><label class="check"><input id="area-horizon" type="checkbox" ${a.horizon ? "checked" : ""}>Draw horizon</label><p>${a.objects.length} objects · ${a.entrances.length} entrances · ${a.animators.length} animators</p>`,
    button("Apply area settings", "apply-area", 'class="primary"'),
  );
}
function entrancesDialog() {
  modal(
    "Entrances",
    `<p>Entrances store a viewpoint and direction. Scripts use GOTO (entrance,area) to travel between them.</p>${area()
      .entrances.map(
        (e) =>
          `<div class="library-row"><span>${e.id} · ${esc(e.name)} <small>${e.position.join(", ")}</small></span>${button("Go to", "goto-entrance", `data-value="${e.id}"`)}${button("Edit", "edit-entrance", `data-value="${e.id}"`)}${button("Delete", "delete-entrance", `data-value="${e.id}"`)}</div>`,
      )
      .join("")}`,
    button("+ Entrance at view", "new-entrance", 'class="primary"'),
  );
}
function entranceDialog(id) {
  const e = area().entrances.find((e) => e.id === id);
  modal(
    "Edit entrance",
    `${field("Entrance name", e.name, 'id="entrance-name"')}<div class="form-grid">${e.position.map((v, i) => number(`Entrance ${"XYZ"[i]}`, v, `data-entrance-pos="${i}"`)).join("")}${e.rotation.map((v, i) => number(`Rotation ${"XYZ"[i]}`, v, `data-entrance-rot="${i}"`)).join("")}</div>`,
    button(
      "Apply entrance",
      "apply-entrance",
      `class="primary" data-value="${id}"`,
    ),
  );
}
function zoneForm(z) {
  return `<div class="zone-form"><div class="form-grid"><label>Action<select data-zone-field="action">${options(Object.keys(world().controls), z.action)}</select></label>${["x", "y", "width", "height"].map((k) => number(k, z[k], `data-zone-field="${k}" min="0"`)).join("")}<label>Mouse button<select data-zone-field="button">${options(["left", "right", "either", "both"], z.button)}</select></label></div><br>${button("Remove zone", "remove-zone")}</div>`;
}
function zoneValues() {
  return [...document.querySelectorAll(".zone-form")].map((row) =>
    Object.fromEntries(
      [...row.querySelectorAll("[data-zone-field]")].map((input) => [
        input.dataset.zoneField,
        input.type === "number" ? Number(input.value) : input.value,
      ]),
    ),
  );
}
function controlsDialog() {
  const w = world();
  modal(
    "Controls",
    `<p>Modern keys are shown below. Clear a key to disable its action. Border buttons use coordinates in the 320 × 200 game screen.</p><div class="inline-actions">${button("Original 1991 preset", "original-controls")}${button("Modern WASD preset", "modern-controls")}</div><div class="form-grid">${Object.entries(
      w.controls,
    )
      .map(([k, v]) => field(k, v, `data-control="${k}"`))
      .join(
        "",
      )}</div><h3>Border button zones</h3><div id="zone-forms">${(w.controlZones || []).map(zoneForm).join("")}</div>${button("+ Button zone", "new-zone")}<small>Place rectangular hit areas over your border artwork. Each zone invokes a control using its chosen mouse button.</small>`,
    button("Apply controls", "apply-controls", 'class="primary"'),
    true,
  );
}
function screenDialog() {
  const w = world();
  modal(
    "View window & border",
    `<p>Place the 3D view and instruments on a logical 320 × 200 screen.</p><div class="form-grid four">${Object.entries(
      w.viewWindow,
    )
      .map(([k, v]) => number(`View ${k}`, v, `data-view="${k}"`))
      .join(
        "",
      )}</div><label>Border artwork (PNG, JPEG or WebP)<input id="border-file" type="file" accept="image/png,image/jpeg,image/webp"></label>${w.border ? `<img src="${esc(w.border)}" alt="Current border artwork" style="max-width:320px">${button("Remove border", "remove-border")}` : ""}`,
    button("Apply view window", "apply-screen", 'class="primary"'),
  );
}
function instrumentDialog(id) {
  const i = world().instruments.find((i) => i.id === id);
  modal(
    "Edit instrument",
    `${field("Instrument name", i.name, 'id="instrument-name"')}<label>Type<select id="instrument-type">${options(["undefined", "horizontal", "vertical", "number", "text"], i.type)}</select></label><div class="form-grid">${["x", "y", "width", "height", "variable", "min", "max", "fg", "bg"].map((k) => number(k, i[k], `data-instrument="${k}"`)).join("")}</div>`,
    button(
      "Apply instrument",
      "apply-instrument",
      `data-value="${id}" class="primary"`,
    ),
  );
}
function paletteDialog() {
  modal(
    "Area palette",
    `<p>Sixteen base colours. Colour 0 hides a face. RGB channels are quantized to the original 0–15 range when applied.</p><div class="form-grid four">${area()
      .palette.map(
        (c, i) =>
          `<label>Colour ${i}<input type="color" value="${c}" data-palette="${i}"></label>`,
      )
      .join(
        "",
      )}</div><div class="form-grid two">${number("From index", 1, 'id="palette-from" min="0" max="15"')}${number("To index", 15, 'id="palette-to" min="0" max="15"')}</div><div class="inline-actions">${button("Spread gradient", "spread-palette")}${button("Copy colour", "copy-palette")}${button("Reset palette", "reset-palette")}</div>`,
    button("Apply palette", "apply-palette", 'class="primary"'),
  );
}
function soundDialog(id) {
  const s = world().sounds[id];
  modal(
    `Sound ${id.toString().padStart(2, "0")}`,
    `${field("Sound name", s.name, 'id="sound-name"')}<label>Waveform<select id="sound-wave">${options(["sine", "triangle", "square", "sawtooth"], s.wave)}</select></label><div class="form-grid">${number("Frequency", s.frequency, 'id="sound-frequency" min="20" max="20000"')}${number("Duration", s.duration, 'id="sound-duration" min="0.01" max="10" step="0.05"')}${number("Volume", s.volume, 'id="sound-volume" min="0" max="1" step="0.05"')}</div><label>Replace with audio sample<input id="sound-file" type="file" accept="audio/*"></label><div class="inline-actions">${button("Preview tone", "preview-sound", `data-value="${id}"`)}${s.data ? button("Remove sample", "remove-sample", `data-value="${id}"`) : ""}</div>`,
    button("Apply sound", "apply-sound", `data-value="${id}" class="primary"`),
  );
}

document.addEventListener("contextmenu", (e) => {
  const b = e.target.closest?.('[data-action="nudge"]');
  if (b) {
    e.preventDefault();
    nudge(b.dataset.value, true);
  }
});
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const action = b.dataset.action,
    value = b.dataset.value;
  document
    .querySelectorAll(".menubar details[open]")
    .forEach((d) => (d.open = false));
  try {
    switch (action) {
      case "close":
        closeModal();
        break;
      case "select":
        selected = e.shiftKey
          ? [...new Set([...selected, Number(value)])]
          : [Number(value)];
        scriptKey = null;
        render();
        break;
      case "tool":
        tool = value;
        view.setTool(
          ["paint", "select"].includes(tool) ? "select" : tool,
          fine ? world().preferences.fineStep : world().preferences.grid,
        );
        render();
        break;
      case "tab":
        tab = value;
        scriptKey = null;
        renderDock();
        break;
      case "create": {
        let id;
        edit((w) => {
          const a = areaById(w, areaId);
          const target = view.orbit.target.toArray();
          const position = target.map((v, i) =>
            Math.max(
              0,
              Math.min(7992, Math.round((i === 1 ? 120 : v) / 50) * 50),
            ),
          );
          const o = createObject(a, value, {
            position,
            colors: Array(6).fill(color),
          });
          id = o.id;
        });
        selected = [id];
        render();
        break;
      }
      case "copy-options":
        if (!object()) {
          notify("Select an object or group to copy");
          break;
        }
        modal(
          "Copy placement",
          `<p>Place a copy relative to ${esc(object().name)}, or in front of the current view. Object conditions are copied with it.</p><div class="primitive-grid">${["left", "right", "front", "back", "above", "below", "view"].map((side) => button(side[0].toUpperCase() + side.slice(1), "copy-place", `data-value="${side}"`)).join("")}</div>`,
        );
        break;
      case "copy-place": {
        const source = object();
        if (!source) break;
        let offset = [0, 0, 0];
        const directions = {
          left: [0, -1],
          right: [0, 1],
          front: [2, -1],
          back: [2, 1],
          above: [1, 1],
          below: [1, -1],
        };
        if (value === "view") {
          const target = view.orbit.target.toArray();
          offset = target.map(
            (v, i) =>
              Math.max(0, Math.min(8192 - source.size[i], Math.round(v))) -
              source.position[i],
          );
        } else {
          const [axis, sign] = directions[value];
          offset[axis] = (source.size[axis] + 50) * sign;
        }
        let id;
        edit((w) => {
          id = duplicateObject(areaById(w, areaId), source.id, offset).id;
        });
        if (id) {
          selected = [id];
          closeModal();
          render();
        }
        break;
      }
      case "nudge":
        nudge(value);
        break;
      case "duplicate":
        if (object()) {
          let id;
          edit((w) => {
            const a = areaById(w, areaId),
              o = objectById(a, selected[0]);
            id = duplicateObject(a, o.id, [o.size[0] + 50, 0, 0]).id;
          }, "Object copied");
          selected = [id];
          render();
        }
        break;
      case "delete":
        if (selected.length)
          edit((w) => {
            const a = areaById(w, areaId);
            for (const id of selected) deleteObject(a, id);
          }, "Selection deleted · Undo is available");
        break;
      case "undo":
        history.undo();
        selected = selected.filter((id) => objectById(area(), id));
        saveAuto();
        render();
        break;
      case "redo":
        history.redo();
        saveAuto();
        render();
        break;
      case "group":
        if (selected.length < 2) {
          notify("Select two or more objects using the explorer checkboxes");
          break;
        }
        let gid;
        edit((w) => {
          gid = groupObjects(areaById(w, areaId), selected).id;
        });
        selected = [gid];
        render();
        break;
      case "ungroup":
        edit((w) => {
          const a = areaById(w, areaId);
          a.objects = a.objects.filter((o) => o.id !== selected[0]);
        });
        selected = [];
        render();
        break;
      case "turn":
        if (object())
          edit((w) =>
            transformObject(
              areaById(w, areaId),
              selected[0],
              "rotate",
              [0, 1, 2].map((i) => (i === Number(value) ? 90 : 0)),
            ),
          );
        break;
      case "flip":
        if (object())
          edit((w) =>
            transformObject(
              areaById(w, areaId),
              selected[0],
              "rotate",
              [0, 180, 0],
            ),
          );
        break;
      case "lock":
        view.lock(selected[0], [b.dataset.axis, Number(b.dataset.sign)]);
        break;
      case "frame":
        view.frame(selected[0]);
        break;
      case "grid":
        grid = !grid;
        render();
        break;
      case "fine":
        fine = !fine;
        view.setTool(
          ["select", "paint"].includes(tool) ? "select" : tool,
          fine ? world().preferences.fineStep : world().preferences.grid,
        );
        render();
        break;
      case "exclude":
        exclude = !exclude;
        render();
        break;
      case "highlight":
        highlight = !highlight;
        render();
        break;
      case "ghost":
        ghost = !ghost;
        render();
        break;
      case "inspector":
        $("#inspector").classList.toggle("show");
        break;
      case "color":
        color = Number(value);
        renderInspector();
        break;
      case "face":
        if (object()) edit((w) => paint(w, selected[0], Number(value)));
        break;
      case "fill":
        if (object()) edit((w) => paint(w, selected[0]));
        break;
      case "play":
        if (player) stopPlay();
        else startPlay();
        break;
      case "reset":
        player?.runtime.reset();
        break;
      case "activate":
        player?.interact("activated");
        break;
      case "shoot":
        player?.interact("shot");
        break;
      case "pointer-lock":
        view.renderer.domElement.requestPointerLock?.();
        break;
      case "step":
        if (player) {
          const key = player.runtime.world.controls[value];
          player.keys.add(key);
          setTimeout(() => player?.keys.delete(key), 160);
        }
        break;
      case "save-game":
        player?.save();
        break;
      case "load-game":
        player?.load();
        break;
      case "save":
        libraryDialog();
        break;
      case "library-save": {
        const name = $("#save-name").value;
        edit((w) => (w.name = name));
        library.save(name, world());
        notify("World saved to your library");
        break;
      }
      case "download-world":
        download(`${world().name}.freescape.json`, serializeWorld(world()));
        break;
      case "library-open":
        replaceWorld(library.load(value));
        closeModal();
        notify("World opened");
        break;
      case "library-delete":
        library.remove(value);
        libraryDialog();
        break;
      case "load-file":
        fileInput("application/json", async (file) => {
          replaceWorld(parseWorld(await file.text()));
          closeModal();
          notify("World imported");
        });
        break;
      case "save-object":
        if (object())
          download(
            `${object().name}.object.json`,
            exportObject(area(), object().id),
          );
        else notify("Select an object or group to export");
        break;
      case "load-object":
        fileInput("application/json", async (file) => {
          const text = await file.text();
          let id;
          edit((w) => {
            id = importObject(areaById(w, areaId), text).id;
          });
          selected = [id];
          render();
        });
        break;
      case "new":
        modal(
          "New world",
          "<p>Your current world stays in the browser’s autosave until the new world is created. Save it to your library first to keep both.</p>",
          button("Save current world", "save") +
            button("Create empty world", "confirm-new", 'class="primary"'),
        );
        break;
      case "confirm-new":
        replaceWorld(createWorld());
        closeModal();
        break;
      case "demo":
        replaceWorld(demoWorld());
        closeModal();
        notify("Sample world opened");
        break;
      case "export":
        modal(
          "Make a playable world",
          `<p>A single HTML file contains your world, Three.js, its scripts, sounds, instruments, and player. It runs without the editor or an internet connection.</p><p><strong>${esc(world().name)}</strong><br>${world().areas.length - 1} areas · ${world().areas.reduce((n, a) => n + a.objects.length, 0)} objects</p>`,
          button(
            "Download standalone HTML",
            "download-standalone",
            'class="primary"',
          ),
        );
        break;
      case "download-standalone":
        download(
          `${world().name}.html`,
          standaloneHTML(world(), playerCode),
          "text/html",
        );
        notify("Playable world exported");
        break;
      case "settings":
        worldSettings();
        break;
      case "apply-settings": {
        const name = $("#setting-name").value,
          author = $("#setting-author").value,
          defaults = {},
          preferences = {};
        document
          .querySelectorAll("[data-default]")
          .forEach((e) => (defaults[e.dataset.default] = Number(e.value)));
        document
          .querySelectorAll("[data-preference]")
          .forEach(
            (e) => (preferences[e.dataset.preference] = Number(e.value)),
          );
        edit((w) => {
          w.name = name;
          w.author = author;
          Object.assign(w.defaults, defaults);
          Object.assign(w.preferences, preferences);
        });
        closeModal();
        break;
      }
      case "new-area": {
        let id;
        edit((w) => (id = createArea(w).id));
        areaId = id;
        selected = [];
        render();
        view.frame();
        break;
      }
      case "area-settings":
        areaDialog();
        break;
      case "apply-area": {
        const values = {
          name: $("#area-name").value,
          scale: Number($("#area-scale").value),
          sky: Number($("#area-sky").value),
          ground: Number($("#area-ground").value),
          horizon: $("#area-horizon").checked,
        };
        if (
          values.scale <= 0 ||
          [values.sky, values.ground].some((v) => v < 0 || v > 15)
        )
          throw Error("Scale must be positive; palette indices must be 0–15");
        edit((w) => Object.assign(areaById(w, areaId), values));
        closeModal();
        break;
      }
      case "areas":
        modal(
          "Manage areas",
          world()
            .areas.map(
              (a) =>
                `<div class="library-row"><span>${a.id} · ${esc(a.name)}</span>${button("Open", "goto-area", `data-value="${a.id}"`)}${a.id ? button("Delete", "delete-area", `data-value="${a.id}"`) : ""}</div>`,
            )
            .join(""),
          button("Create area", "new-area"),
        );
        break;
      case "goto-area":
        areaId = Number(value);
        selected = [];
        closeModal();
        render();
        view.frame();
        break;
      case "delete-area":
        if (world().areas.filter((a) => a.id).length < 2)
          throw Error("Keep at least one playable area");
        edit((w) => {
          w.areas = w.areas.filter((a) => a.id !== Number(value));
          if (w.defaults.startArea === Number(value))
            w.defaults.startArea = w.areas.find((a) => a.id).id;
        });
        if (areaId === Number(value)) areaId = world().defaults.startArea;
        closeModal();
        render();
        break;
      case "globals":
        modal(
          "Global objects",
          `<p>Create reusable objects in area 0, then include them in any area.</p><div class="member-list">${
            world()
              .areas[0].objects.map(
                (o) =>
                  `<label class="check"><input type="checkbox" data-global="${o.id}" ${area().globals.includes(o.id) ? "checked" : ""}>${esc(o.name)}</label>`,
              )
              .join("") || "<small>No global objects yet.</small>"
          }</div>`,
          button("Edit global library", "goto-area", 'data-value="0"') +
            button("Apply globals", "apply-globals", 'class="primary"'),
        );
        break;
      case "apply-globals": {
        const ids = [...document.querySelectorAll("[data-global]:checked")].map(
          (e) => Number(e.dataset.global),
        );
        edit((w) => (areaById(w, areaId).globals = ids));
        closeModal();
        break;
      }
      case "entrances":
        entrancesDialog();
        break;
      case "new-entrance": {
        const pos = view.camera.position
          .toArray()
          .map((v) => Math.max(0, Math.min(8192, Math.round(v))));
        const direction = view.orbit.target
          .clone()
          .sub(view.camera.position)
          .normalize();
        const rot = [
          (Math.asin(direction.y) * 180) / Math.PI,
          (Math.atan2(direction.x, direction.z) * 180) / Math.PI,
          0,
        ];
        edit((w) => {
          const a = areaById(w, areaId),
            id = nextId(a.entrances);
          a.entrances.push({
            id,
            name: `Entrance ${id}`,
            position: pos,
            rotation: rot,
          });
        });
        entrancesDialog();
        break;
      }
      case "edit-entrance":
        entranceDialog(Number(value));
        break;
      case "apply-entrance": {
        const pos = [...document.querySelectorAll("[data-entrance-pos]")].map(
            (e) => Number(e.value),
          ),
          rot = [...document.querySelectorAll("[data-entrance-rot]")].map((e) =>
            Number(e.value),
          ),
          name = $("#entrance-name").value;
        edit((w) =>
          Object.assign(
            areaById(w, areaId).entrances.find((e) => e.id === Number(value)),
            { name, position: pos, rotation: rot },
          ),
        );
        entrancesDialog();
        break;
      }
      case "delete-entrance":
        edit((w) => {
          const a = areaById(w, areaId);
          a.entrances = a.entrances.filter((e) => e.id !== Number(value));
        });
        entrancesDialog();
        break;
      case "goto-entrance": {
        const entrance = area().entrances.find((e) => e.id === Number(value)),
          d = Math.PI / 180;
        view.camera.position.fromArray(entrance.position);
        view.orbit.target.set(
          entrance.position[0] + Math.sin(entrance.rotation[1] * d) * 1000,
          entrance.position[1] + Math.sin(entrance.rotation[0] * d) * 1000,
          entrance.position[2] + Math.cos(entrance.rotation[1] * d) * 1000,
        );
        view.orbit.update();
        closeModal();
        break;
      }
      case "object-script":
        tab = "scripts";
        scriptKey = `object:${selected[0]}`;
        renderDock();
        $("#fcl-source").focus();
        break;
      case "script-select":
        scriptKey = value;
        renderDock();
        break;
      case "new-script": {
        let id;
        edit((w) => {
          const list =
            value === "general"
              ? w.conditions
              : areaById(w, areaId)[
                  value === "animation" ? "animators" : "conditions"
                ];
          id = nextId(list);
          list.push({ id, name: `${value} ${id}`, source: "" });
        });
        scriptKey = `${value}:${id}`;
        renderDock();
        break;
      }
      case "apply-script": {
        const source = $("#fcl-source").value;
        try {
          compile(source);
        } catch (e) {
          $("#script-status").className = "error";
          $("#script-status").textContent = e.message;
          break;
        }
        if (!scriptKey) {
          notify("Create a condition first");
          break;
        }
        const [kind, id] = scriptKey.split(":");
        edit((w) => {
          const a = areaById(w, areaId);
          if (kind === "object") objectById(a, Number(id)).condition = source;
          else
            (kind === "general"
              ? w.conditions
              : a[kind === "animation" ? "animators" : "conditions"]
            ).find((c) => c.id === Number(id)).source = source;
        });
        $("#script-status").textContent = "Compiled and applied";
        break;
      }
      case "delete-script":
        if (scriptKey) {
          const [kind, id] = scriptKey.split(":");
          edit((w) => {
            const a = areaById(w, areaId);
            if (kind === "object") objectById(a, Number(id)).condition = "";
            else {
              const host = kind === "general" ? w : a,
                key = kind === "animation" ? "animators" : "conditions";
              host[key] = host[key].filter((c) => c.id !== Number(id));
            }
          });
          scriptKey = null;
          renderDock();
        }
        break;
      case "preview-animation":
        startPlay();
        if (scriptKey?.startsWith("animation:"))
          player?.runtime.run(
            `STARTANIM (${scriptKey.split(":")[1]},${areaId})`,
          );
        break;
      case "new-instrument": {
        let id;
        edit((w) => {
          id = nextId(w.instruments);
          w.instruments.push({
            id,
            name: `Instrument ${id}`,
            type: "undefined",
            x: 8,
            y: 170,
            width: 80,
            height: 16,
            variable: 30,
            min: 0,
            max: 100,
            fg: 1,
            bg: 15,
            text: "",
          });
        });
        instrumentDialog(id);
        break;
      }
      case "instrument":
        instrumentDialog(Number(value));
        break;
      case "apply-instrument": {
        const values = {
          name: $("#instrument-name").value,
          type: $("#instrument-type").value,
        };
        document
          .querySelectorAll("[data-instrument]")
          .forEach((e) => (values[e.dataset.instrument] = Number(e.value)));
        if (
          values.x + values.width > 320 ||
          values.y + values.height > 200 ||
          values.width < 1 ||
          values.height < 1 ||
          values.variable < 0 ||
          values.variable > 255
        )
          throw Error(
            "Instrument must fit the 320 × 200 screen and use V0–V255",
          );
        edit((w) =>
          Object.assign(
            w.instruments.find((i) => i.id === Number(value)),
            values,
          ),
        );
        closeModal();
        break;
      }
      case "delete-instrument":
        edit(
          (w) =>
            (w.instruments = w.instruments.filter(
              (i) => i.id !== Number(value),
            )),
        );
        break;
      case "controls":
        controlsDialog();
        break;
      case "new-zone":
        $("#zone-forms").insertAdjacentHTML(
          "beforeend",
          zoneForm({
            action: "forward",
            x: 8,
            y: 176,
            width: 24,
            height: 20,
            button: "either",
          }),
        );
        break;
      case "remove-zone":
        b.closest(".zone-form").remove();
        break;
      case "apply-controls": {
        const controls = {},
          zones = zoneValues();
        document
          .querySelectorAll("[data-control]")
          .forEach(
            (e) =>
              (controls[e.dataset.control] = /^F\d+$/.test(e.value)
                ? ""
                : e.value),
          );
        if (
          !Array.isArray(zones) ||
          zones.some(
            (z) =>
              !controls[z.action] ||
              !["left", "right", "either", "both"].includes(z.button),
          )
        )
          throw Error("Invalid control zone action or button");
        edit((w) => {
          w.controls = controls;
          w.controlZones = zones;
        });
        closeModal();
        break;
      }
      case "original-controls": {
        const controls = {
          forward: "o",
          back: "k",
          left: "h",
          right: "j",
          rise: "r",
          fall: "f",
          turnLeft: "q",
          turnRight: "w",
          lookUp: "p",
          lookDown: "l",
          tiltLeft: "n",
          tiltRight: "m",
          faceForward: "i",
          uTurn: "u",
          activate: "a",
          shoot: " ",
          mode: "v",
          selectMode: "b",
          centerCursor: "c",
          crouch: "Control",
          save: "1",
          load: "2",
        };
        document
          .querySelectorAll("[data-control]")
          .forEach((e) => (e.value = controls[e.dataset.control] || ""));
        break;
      }
      case "modern-controls":
        document
          .querySelectorAll("[data-control]")
          .forEach(
            (e) => (e.value = createWorld().controls[e.dataset.control] || ""),
          );
        break;
      case "screen-settings":
        screenDialog();
        break;
      case "apply-screen": {
        const values = {};
        document
          .querySelectorAll("[data-view]")
          .forEach((e) => (values[e.dataset.view] = Number(e.value)));
        if (
          values.x < 0 ||
          values.y < 0 ||
          values.width < 1 ||
          values.height < 1 ||
          values.x + values.width > 320 ||
          values.y + values.height > 200
        )
          throw Error("View must fit the 320 × 200 screen");
        const file = $("#border-file").files[0];
        const border = file ? await dataURL(file) : world().border;
        edit((w) => {
          w.viewWindow = values;
          w.border = border;
        });
        closeModal();
        break;
      }
      case "remove-border":
        edit((w) => (w.border = null));
        screenDialog();
        break;
      case "palette":
        paletteDialog();
        break;
      case "apply-palette": {
        const palette = [...document.querySelectorAll("[data-palette]")].map(
          (e) =>
            "#" +
            e.value
              .slice(1)
              .match(/../g)
              .map((c) =>
                (Math.round(parseInt(c, 16) / 17) * 17)
                  .toString(16)
                  .padStart(2, "0"),
              )
              .join(""),
        );
        edit((w) => (areaById(w, areaId).palette = palette));
        closeModal();
        break;
      }
      case "spread-palette":
      case "copy-palette": {
        const inputs = [...document.querySelectorAll("[data-palette]")],
          p = inputs.map((e) => e.value),
          from = Number($("#palette-from").value),
          to = Number($("#palette-to").value);
        if (from < 0 || to < 0 || from > 15 || to > 15)
          throw Error("Use palette indices 0–15");
        if (action === "spread-palette") spreadPalette(p, from, to);
        else p[to] = p[from];
        inputs.forEach((e, i) => (e.value = p[i]));
        break;
      }
      case "reset-palette":
        document
          .querySelectorAll("[data-palette]")
          .forEach((e, i) => (e.value = PALETTE[i]));
        break;
      case "sound":
        soundDialog(Number(value));
        break;
      case "preview-sound":
        audio.play(soundForm(Number(value)));
        break;
      case "apply-sound": {
        const sound = soundForm(Number(value)),
          file = $("#sound-file").files[0];
        if (file) sound.data = await dataURL(file);
        edit((w) => (w.sounds[Number(value)] = sound));
        closeModal();
        break;
      }
      case "remove-sample":
        edit((w) => (w.sounds[Number(value)].data = null));
        soundDialog(Number(value));
        break;
      case "help":
        modal(
          "Build a world. Step inside.",
          `<div class="help-grid"><div><h3>Shape the world</h3><p>Click a shape to add it. Select in the scene or explorer. Use Move, Rotate and Scale handles, or enter exact coordinates. Shift-click or use checkboxes to select a group. F frames a selection.</p></div><div><h3>Give it rules</h3><p>Select an object and open Scripts. FCL responds to SHOT?, ACTIVATED? and COLLIDED?. Area and general conditions run every frame. Mark objects Moveable before adding them to an animator.</p></div><div><h3>Play & explore</h3><p>WASD moves. Arrow keys look. R/F rises and falls. E activates, Space shoots, V toggles walk/fly, B selects the fly mode, C crouches, and X toggles the cursor. Right-click activates at the pointer. F1 returns to the editor. 1/2 save and load a game.</p></div><div><h3>Keep & share</h3><p>Save stores a named world locally. Download JSON to back it up. Export makes a standalone HTML player that includes your world and runtime. The entire kit works locally.</p></div></div><h3>FCL example</h3><pre>IF ACTIVATED?\nTHEN INVIS (2)\nADDVAR (1,V30)\nSOUND (4)\nENDIF</pre><small>Browser adaptations and original-source evidence are documented in the repository’s docs/SPEC.md and research/sources.json.</small>`,
          button("Start building", "close", 'class="primary"'),
          true,
        );
        break;
      case "sources":
        modal(
          "Ground truth & scope",
          `<p>This reimagining follows the 1991 first-edition IBM PC, Amiga and Atari ST manual. The 8-bit edition and 1992 Kit II have different capabilities.</p><p>Primary source: <a href="https://www.lemonamiga.com/games/docs.php?id=5" target="_blank" rel="noreferrer">Original 16-bit manual transcription</a>. Source decisions, manual errata and independent behavioral goldens are in the repository.</p><p>JSON world files, modern image/audio formats and a standalone HTML player replace the original disk formats and native runner. Original binary worlds are not imported. This is an independent reconstruction with original sample scenery.</p>`,
          button("Close", "close", 'class="primary"'),
        );
        break;
    }
  } catch (error) {
    notify(error.message);
  }
});
function soundForm(id) {
  return {
    ...world().sounds[id],
    defined: true,
    name: $("#sound-name").value,
    wave: $("#sound-wave").value,
    frequency: Number($("#sound-frequency").value),
    duration: Number($("#sound-duration").value),
    volume: Number($("#sound-volume").value),
  };
}
function fileInput(accept, callback) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.onchange = async () => {
    try {
      if (input.files[0]) await callback(input.files[0]);
    } catch (e) {
      notify(e.message);
    }
  };
  input.click();
}
function dataURL(file) {
  if (file.size > 8_000_000) throw Error("Choose a file smaller than 8 MB");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
$("#area-select").addEventListener("change", (e) => {
  areaId = Number(e.target.value);
  selected = [];
  scriptKey = null;
  render();
  view.frame();
});
$("#object-search").addEventListener("input", (e) => {
  search = e.target.value;
  renderObjects();
});
document.addEventListener("change", (e) => {
  const input = e.target;
  if (input.matches("[data-select]")) {
    const id = Number(input.dataset.select);
    selected = input.checked
      ? [...new Set([...selected, id])]
      : selected.filter((v) => v !== id);
    render();
  }
  if (
    input.matches(
      "[data-object-field],[data-sensor],[data-direction],[data-point],[data-member]",
    )
  ) {
    edit((w) => {
      const o = objectById(areaById(w, areaId), selected[0]);
      if (!o) return;
      const key = input.dataset.objectField;
      if (key) {
        if (["position", "size", "startPosition"].includes(key)) {
          const axis = Number(input.dataset.index),
            n = Number(input.value);
          if (o.type === "group" && key === "position") {
            transformObject(
              areaById(w, areaId),
              o.id,
              "move",
              [0, 1, 2].map((i) => (i === axis ? n - o.position[i] : 0)),
            );
          } else if (o.type === "group" && key === "size") {
            transformObject(
              areaById(w, areaId),
              o.id,
              "scale",
              [0, 1, 2].map((i) => (i === axis ? n / o.size[i] : 1)),
            );
          } else o[key][axis] = n;
          if (key === "position") o.startPosition = [...o.position];
        } else o[key] = input.type === "checkbox" ? input.checked : input.value;
      }
      if (input.dataset.sensor)
        o.sensor[input.dataset.sensor] =
          input.type === "number" ? Number(input.value) : input.value;
      if (input.dataset.direction)
        o.sensor.directions = input.checked
          ? [...o.sensor.directions, input.dataset.direction]
          : o.sensor.directions.filter((d) => d !== input.dataset.direction);
      if (input.dataset.point !== undefined)
        o.points[Number(input.dataset.point)][Number(input.dataset.index)] =
          Number(input.value);
      if (input.dataset.member)
        o.members = input.checked
          ? [...o.members, Number(input.dataset.member)]
          : o.members.filter((id) => id !== Number(input.dataset.member));
    });
  }
  if (input.matches("[data-variable]"))
    editorVars[Number(input.dataset.variable)] = Number(input.value);
  if (input.id === "audio-enabled") audio.enabled = input.checked;
  if (input.id === "shade-enabled") shadeEnabled = input.checked;
  if (input.id === "shade-secondary") secondary = Number(input.value);
});
$("#camera-mode").addEventListener("change", (e) => {
  const next = e.target.value;
  if (cameraMode.startsWith("cam"))
    cameras[Number(cameraMode.slice(3)) - 1] = view.cameraState();
  cameraMode = next;
  if (next.startsWith("cam")) {
    const stored = cameras[Number(next.slice(3)) - 1];
    if (stored) view.restoreCamera(stored);
  }
  navigation.setMode(next);
  $("#view-label").textContent = next.toUpperCase();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "F1") {
    e.preventDefault();
    if (player) stopPlay();
    return;
  }
  if (e.key === "Escape") {
    if ($(".modal-backdrop")) closeModal();
    else if (player) stopPlay();
    return;
  }
  if (e.target.closest?.("input,textarea,select")) return;
  if (!player && cameraMode !== "orbit")
    navigation.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    e.shiftKey ? history.redo() : history.undo();
    selected = selected.filter((id) => objectById(area(), id));
    saveAuto();
    render();
  } else if (e.key === "Delete" && !player) {
    edit((w) => {
      const a = areaById(w, areaId);
      for (const id of selected) deleteObject(a, id);
    });
  } else if (e.key.toLowerCase() === "f" && !player && cameraMode === "orbit")
    view.frame(selected[0]);
});
window.addEventListener("keyup", (e) =>
  navigation.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key),
);
window.addEventListener("blur", () => navigation.keys.clear());
let lastTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  if (player) {
    player.step(now);
    $("#status-area").textContent =
      `AREA ${String(player.runtime.areaId).padStart(3, "0")} · ${player.runtime.area.name}`;
    $("#status-coordinates").textContent =
      `${["WALK", "FLY 1", "FLY 2"][player.runtime.mode - 1]} · POS ${player.runtime.position.map(Math.round).join(", ")} · F1 EDITOR`;
  } else navigation.step(Math.min(0.05, (now - lastTime) / 1000));
  view.render();
  lastTime = now;
}
render();
requestAnimationFrame(animate);
