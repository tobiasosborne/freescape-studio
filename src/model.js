export const TYPES = [
  "cuboid",
  "pyramid",
  "rectangle",
  "triangle",
  "quadrilateral",
  "pentagon",
  "hexagon",
  "line",
  "sensor",
  "group",
];
export const PALETTE = [
  "#171c28",
  "#f0e9d6",
  "#8b99a7",
  "#455365",
  "#c66247",
  "#e7ac66",
  "#e7d89d",
  "#7fa584",
  "#397c7c",
  "#80b7b6",
  "#647ea6",
  "#a0b0d0",
  "#947baf",
  "#cda5bd",
  "#a49076",
  "#383c48",
];
export const clone = (v) => structuredClone(v);
export const nextId = (items) => {
  let n = 1;
  while (items.some((i) => i.id === n)) n++;
  return n;
};
export const areaById = (w, id) => w.areas.find((a) => a.id === Number(id));
export const objectById = (a, id) =>
  a?.objects.find((o) => o.id === Number(id));
export function includedGlobals(world, area) {
  const global = areaById(world, 0);
  if (!global || area.id === 0) return [];
  return [
    ...new Map(
      area.globals
        .flatMap((id) => descendants(global, id))
        .map((o) => [o.id, o]),
    ).values(),
  ];
}
export function createWorld() {
  const w = {
    format: "freescape-studio",
    version: 1,
    name: "Untitled world",
    author: "",
    areas: [],
    conditions: [],
    instruments: [],
    sounds: Array.from({ length: 32 }, (_, id) => ({
      id,
      defined: id < 7,
      name:
        ["Laser out", "Shooter", "Bump", "Explosion", "Ping", "Smash", "Clang"][
          id
        ] || `Undefined ${id}`,
      wave: "triangle",
      frequency: 220 + id * 70,
      duration: 0.12,
      volume: 0.25,
      data: null,
    })),
    defaults: {
      startArea: 1,
      startEntrance: 1,
      mode: 1,
      climb: 100,
      safeFall: 400,
      activateRange: 1000,
      timer: 50,
      initialCondition: 0,
      height: 280,
    },
    preferences: {
      moveStep: 100,
      angleStep: 15,
      objectStep: 50,
      objectRightStep: 250,
      moveRightStep: 500,
      angleRightStep: 30,
      fineStep: 1,
      grid: 50,
    },
    controls: {
      forward: "w",
      back: "s",
      left: "a",
      right: "d",
      rise: "r",
      fall: "f",
      turnLeft: "ArrowLeft",
      turnRight: "ArrowRight",
      lookUp: "ArrowUp",
      lookDown: "ArrowDown",
      tiltLeft: "n",
      tiltRight: "m",
      faceForward: "i",
      uTurn: "u",
      activate: "e",
      shoot: " ",
      mode: "v",
      selectMode: "b",
      centerCursor: "x",
      crouch: "c",
      save: "1",
      load: "2",
    },
    viewWindow: { x: 0, y: 0, width: 320, height: 160 },
    border: null,
  };
  w.areas.push({
    id: 0,
    name: "Global library",
    scale: 1,
    horizon: true,
    sky: 10,
    ground: 7,
    palette: [...PALETTE],
    objects: [],
    entrances: [],
    conditions: [],
    animators: [],
    globals: [],
  });
  createArea(w, "Area 001");
  return w;
}
export function createArea(w, name) {
  const id = nextId(w.areas),
    a = {
      id,
      name: name || `Area ${String(id).padStart(3, "0")}`,
      scale: 1,
      horizon: true,
      sky: 10,
      ground: 7,
      palette: [...PALETTE],
      objects: [],
      entrances: [
        {
          id: 1,
          name: "Entrance 001",
          position: [4000, 300, 4000],
          rotation: [0, 0, 0],
        },
      ],
      conditions: [],
      animators: [],
      globals: [],
    };
  createObject(a, "cuboid", {
    position: [0, 0, 0],
    size: [8192, 20, 8192],
    name: "Base",
    colors: [7, 7, 7, 7, 7, 7],
  });
  w.areas.push(a);
  return a;
}
export function defaultPoints(type) {
  const counts = {
    rectangle: 4,
    triangle: 3,
    quadrilateral: 4,
    pentagon: 5,
    hexagon: 6,
    line: 2,
  };
  const n = counts[type];
  if (type === "pyramid")
    return [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
      [0.5, 1, 0.5],
      [0.5, 1, 0.5],
      [0.5, 1, 0.5],
      [0.5, 1, 0.5],
    ];
  if (type === "rectangle" || type === "quadrilateral")
    return [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ];
  if (type === "line")
    return [
      [0, 0, 0],
      [1, 1, 1],
    ];
  if (n)
    return Array.from({ length: n }, (_, i) => [
      0.5 + 0.5 * Math.sin((i * 2 * Math.PI) / n),
      0.5 + 0.5 * Math.cos((i * 2 * Math.PI) / n),
      0,
    ]);
  return null;
}
export function createObject(a, type, props = {}) {
  if (!TYPES.includes(type)) throw Error("Unknown object type");
  const id = nextId(a.objects);
  const o = {
    id,
    type,
    name: `${type[0].toUpperCase() + type.slice(1)} ${String(id).padStart(3, "0")}`,
    position: [4000, 20, 4600],
    size: [200, 200, 200],
    rotation: [0, 0, 0],
    colors: Array(6).fill(2),
    status: "visible",
    initialStatus: "visible",
    moveable: false,
    startPosition: null,
    condition: "",
    points: defaultPoints(type),
    members: [],
    sensor: {
      range: 1500,
      speed: 50,
      effect: "sense",
      directions: ["+x", "-x", "+y", "-y", "+z", "-z"],
    },
    ...clone(props),
  };
  o.startPosition ??= [...o.position];
  validateObject(o);
  a.objects.push(o);
  return o;
}
function vector(v, path, min = 0, max = 8192) {
  if (
    !Array.isArray(v) ||
    v.length !== 3 ||
    v.some(
      (n) => typeof n !== "number" || !Number.isFinite(n) || n < min || n > max,
    )
  )
    throw Error(
      `Invalid ${path}: finite values within bounds ${min}..${max} required`,
    );
}
export function validateObject(o) {
  if (!o || !Number.isInteger(o.id) || o.id < 1 || !TYPES.includes(o.type))
    throw Error("Invalid object identity/type");
  vector(o.position, "position");
  vector(o.size, "size");
  vector(o.rotation, "rotation", -36000, 36000);
  vector(o.startPosition, "start position");
  if (
    !["visible", "invisible", "destroyed"].includes(o.status) ||
    !["visible", "invisible"].includes(o.initialStatus)
  )
    throw Error("Invalid object status");
  if (
    !Array.isArray(o.colors) ||
    o.colors.length < 1 ||
    o.colors.length > 6 ||
    (["cuboid", "pyramid"].includes(o.type) && o.colors.length !== 6) ||
    o.colors.some((c) => !Number.isInteger(c) || c < 0 || c > 15)
  )
    throw Error("Invalid face colors");
  if (o.position.some((p, i) => p + o.size[i] > 8192))
    throw Error("Object exceeds area bounds");
  if (
    o.patterns &&
    (!Array.isArray(o.patterns) ||
      o.patterns.some(
        (p) =>
          p &&
          (!Number.isInteger(p.a) ||
            !Number.isInteger(p.b) ||
            p.a < 0 ||
            p.b < 0 ||
            p.a > 15 ||
            p.b > 15),
      ))
  )
    throw Error("Invalid face shade");
  if (typeof o.name !== "string" || typeof o.condition !== "string")
    throw Error("Invalid object text");
  if (
    o.points !== null &&
    (!Array.isArray(o.points) ||
      o.points.some(
        (p) =>
          !Array.isArray(p) ||
          p.length !== 3 ||
          p.some((n) => !Number.isFinite(n)),
      ))
  )
    throw Error("Invalid points");
  const count = {
    pyramid: 8,
    rectangle: 4,
    triangle: 3,
    quadrilateral: 4,
    pentagon: 5,
    hexagon: 6,
    line: 2,
  }[o.type];
  if (count !== undefined && o.points?.length !== count)
    throw Error("Invalid point count for " + o.type);
  if (o.type === "cuboid" && o.points !== null && o.points.length !== 8)
    throw Error("Invalid cuboid point count");
  if (
    !Array.isArray(o.members) ||
    o.members.some((id) => !Number.isInteger(id) || id < 1) ||
    new Set(o.members).size !== o.members.length ||
    (o.type !== "group" && o.members.length)
  )
    throw Error("Invalid group membership");
  if (typeof o.moveable !== "boolean") throw Error("Invalid moveable flag");
  if (o.type === "sensor") {
    const sensor = o.sensor;
    if (
      !sensor ||
      !Number.isFinite(sensor.range) ||
      sensor.range < 0 ||
      !Number.isFinite(sensor.speed) ||
      sensor.speed <= 0 ||
      !["sense", "shoot"].includes(sensor.effect) ||
      !Array.isArray(sensor.directions) ||
      sensor.directions.some(
        (d) => !["+x", "-x", "+y", "-y", "+z", "-z"].includes(d),
      )
    )
      throw Error("Invalid sensor settings");
  }
}
export function descendants(a, id, seen = new Set()) {
  if (seen.has(id)) return [];
  seen.add(id);
  const o = objectById(a, id);
  if (!o) return [];
  return [
    o,
    ...(o.type === "group"
      ? o.members.flatMap((i) => descendants(a, i, seen))
      : []),
  ];
}
export function duplicateObject(a, id, offset = [200, 0, 0]) {
  const originals = descendants(a, id);
  if (!originals.length) throw Error("Object not found");
  const pending = [],
    mapping = new Map();
  for (const o of originals) {
    const copy = clone(o);
    copy.id = nextId([...a.objects, ...pending]);
    copy.name = `${o.type} ${String(copy.id).padStart(3, "0")}`;
    copy.position = copy.position.map((p, i) => p + offset[i]);
    copy.startPosition = [...copy.position];
    validateObject(copy);
    mapping.set(o.id, copy.id);
    pending.push(copy);
  }
  for (const o of pending)
    o.members = o.members.map((id) => mapping.get(id) ?? id);
  a.objects.push(...pending);
  return pending[0];
}
export function groupObjects(a, ids) {
  const objects = ids.map((id) => objectById(a, id));
  if (!objects.length || objects.some((o) => !o))
    throw Error("Select members to group");
  const pos = [0, 1, 2].map((i) =>
      Math.min(...objects.map((o) => o.position[i])),
    ),
    max = [0, 1, 2].map((i) =>
      Math.max(...objects.map((o) => o.position[i] + o.size[i])),
    );
  return createObject(a, "group", {
    members: [...new Set(ids)],
    position: pos,
    size: max.map((p, i) => p - pos[i]),
  });
}
export function deleteObject(a, id) {
  const ids = new Set(descendants(a, id).map((o) => o.id));
  a.objects = a.objects.filter((o) => !ids.has(o.id));
  for (const o of a.objects) o.members = o.members.filter((i) => !ids.has(i));
}
const cleanCoordinate = (n) =>
  Math.abs(n - Math.round(n)) < 1e-8 ? Math.round(n) : n;
function rotateVector(vector, angles) {
  let [x, y, z] = vector;
  for (let axis = 0; axis < 3; axis++) {
    const angle = (angles[axis] * Math.PI) / 180,
      c = Math.cos(angle),
      s = Math.sin(angle);
    if (axis === 0) [y, z] = [y * c - z * s, y * s + z * c];
    else if (axis === 1) [x, z] = [x * c + z * s, -x * s + z * c];
    else [x, y] = [x * c - y * s, x * s + y * c];
  }
  return [x, y, z].map(cleanCoordinate);
}
const boxPoints = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 0, 1],
  [0, 0, 1],
  [0, 1, 0],
  [1, 1, 0],
  [1, 1, 1],
  [0, 1, 1],
];
const faceNormals = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
function turnObject(o, angles, pivot) {
  if (o.type === "group") return;
  if (o.type === "sensor") {
    o.position = rotateVector(
      o.position.map((p, i) => p - pivot[i]),
      angles,
    ).map((p, i) => cleanCoordinate(p + pivot[i]));
    o.rotation = [0, 0, 0];
    return;
  }
  const size = [...o.size],
    rotation = [...o.rotation],
    simple =
      o.type === "cuboid" &&
      !o.points &&
      [...rotation, ...angles].every((a) => Math.abs(a % 90) < 1e-8),
    points = o.type === "cuboid" ? o.points || boxPoints : o.points;
  if (!points) throw Error("Object has no editable geometry");
  const world = points.map((point) => {
    const local = rotateVector(
      point.map((p, i) => p * size[i] - size[i] / 2),
      rotation,
    ).map((p, i) => p + size[i] / 2 + o.position[i] - pivot[i]);
    return rotateVector(local, angles).map((p, i) =>
      cleanCoordinate(p + pivot[i]),
    );
  });
  const min = [0, 1, 2].map((i) => Math.min(...world.map((p) => p[i]))),
    max = [0, 1, 2].map((i) => Math.max(...world.map((p) => p[i])));
  o.position = min;
  o.size = max.map((p, i) => cleanCoordinate(p - min[i]));
  o.rotation = [0, 0, 0];
  if (simple) {
    const colors = [],
      patterns = [];
    for (let i = 0; i < 6; i++) {
      const normal = rotateVector(
        rotateVector(faceNormals[i], rotation),
        angles,
      );
      const axis = normal
          .map(Math.abs)
          .indexOf(Math.max(...normal.map(Math.abs))),
        target = axis * 2 + (normal[axis] < 0 ? 1 : 0);
      colors[target] = o.colors[i % o.colors.length];
      patterns[target] = o.patterns?.[i] || null;
    }
    o.colors = colors;
    if (o.patterns) o.patterns = patterns;
    o.points = null;
  } else
    o.points = world.map((point) =>
      point.map((p, i) =>
        o.size[i] === 0 ? 0 : cleanCoordinate((p - min[i]) / o.size[i]),
      ),
    );
}
export function refreshGroupBounds(a) {
  const done = new Set(),
    active = new Set();
  function refresh(o) {
    if (o.type !== "group" || done.has(o.id)) return;
    if (active.has(o.id)) throw Error("Cyclic group membership");
    active.add(o.id);
    const members = o.members.map((id) => objectById(a, id));
    if (members.some((o) => !o)) throw Error("Missing group member");
    for (const member of members) refresh(member);
    if (members.length) {
      const offset = o.startPosition.map((p, i) => p - o.position[i]);
      o.position = [0, 1, 2].map((i) =>
        Math.min(...members.map((o) => o.position[i])),
      );
      o.size = [0, 1, 2].map(
        (i) =>
          Math.max(...members.map((o) => o.position[i] + o.size[i])) -
          o.position[i],
      );
      o.rotation = [0, 0, 0];
      o.startPosition = o.position.map((p, i) => p + offset[i]);
    }
    active.delete(o.id);
    done.add(o.id);
  }
  for (const object of a.objects) refresh(object);
}
export function transformObject(a, id, kind, value, pivot) {
  const staged = clone(a),
    members = descendants(staged, id);
  if (!members.length) throw Error("Object not found");
  const root = members[0];
  const origin =
    pivot ??
    (kind === "rotate" && root.type !== "sensor"
      ? root.position.map((p, i) => p + root.size[i] / 2)
      : [...root.position]);
  for (const o of members) {
    if (kind === "move")
      o.position = o.position.map((p, i) => cleanCoordinate(p + value[i]));
    else if (kind === "scale") {
      o.position = o.position.map((p, i) =>
        cleanCoordinate(origin[i] + (p - origin[i]) * value[i]),
      );
      o.size = o.size.map((n, i) => cleanCoordinate(n * value[i]));
    } else if (kind === "rotate") turnObject(o, value, origin);
    else throw Error("Unknown transform");
    o.startPosition = [...o.position];
  }
  refreshGroupBounds(staged);
  staged.objects.forEach(validateObject);
  const updates = new Map(staged.objects.map((o) => [o.id, o]));
  for (const object of a.objects) Object.assign(object, updates.get(object.id));
  return objectById(a, id);
}
export function serializeWorld(w) {
  return JSON.stringify(w, null, 2);
}
export function parseWorld(text) {
  if (text.length > 25_000_000) throw Error("World file is too large");
  const w = JSON.parse(text);
  if (w.format !== "freescape-studio")
    throw Error("Not a Freescape Studio JSON world");
  if (w.version !== 1) throw Error("Unsupported world version");
  if (
    typeof w.name !== "string" ||
    !Array.isArray(w.areas) ||
    !w.areas.length ||
    w.areas.length > 1024
  )
    throw Error("Invalid world/areas");
  const ids = new Set();
  for (const a of w.areas) {
    if (!Number.isInteger(a.id) || ids.has(a.id))
      throw Error("Invalid or duplicate area ID");
    ids.add(a.id);
    if (
      !Array.isArray(a.objects) ||
      !Array.isArray(a.entrances) ||
      !Array.isArray(a.animators) ||
      !Array.isArray(a.conditions) ||
      !Array.isArray(a.globals)
    )
      throw Error("Invalid area collections");
    if (
      a.palette?.length !== 16 ||
      a.palette.some((c) => !/^#[0-9a-f]{6}$/i.test(c))
    )
      throw Error("Invalid area palette");
    const objectIds = new Set();
    for (const o of a.objects) {
      validateObject(o);
      if (objectIds.has(o.id)) throw Error("Duplicate object ID");
      objectIds.add(o.id);
    }
    for (const o of a.objects)
      if (o.members.some((id) => !objectIds.has(id) || id === o.id))
        throw Error("Invalid group membership");
    const visit = (id, path = new Set()) => {
      if (path.has(id)) throw Error("Cyclic group membership");
      const o = objectById(a, id);
      for (const member of o.members) visit(member, new Set([...path, id]));
    };
    a.objects.forEach((o) => visit(o.id));
    for (const e of a.entrances) {
      vector(e.position, "entrance position");
      vector(e.rotation, "entrance rotation", -36000, 36000);
    }
  }
  if (
    !ids.has(0) ||
    !ids.has(w.defaults?.startArea) ||
    w.defaults.startArea === 0
  )
    throw Error("Invalid start/global area");
  if (
    !Array.isArray(w.conditions) ||
    !Array.isArray(w.instruments) ||
    !Array.isArray(w.sounds) ||
    w.sounds.length !== 32
  )
    throw Error("Invalid world collections");
  const finite = (n, min, max, label) => {
    if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max)
      throw Error(`Invalid ${label}`);
  };
  const unique = (items, label) => {
    const ids = new Set();
    for (const item of items) {
      if (!Number.isInteger(item.id) || item.id < 1 || ids.has(item.id))
        throw Error(`Invalid/duplicate ${label} ID`);
      ids.add(item.id);
    }
  };
  const scripts = (items) => {
    unique(items, "script");
    for (const item of items)
      if (typeof item.source !== "string" || item.source.length > 100000)
        throw Error("Invalid script source");
  };
  for (const key of [
    "startArea",
    "startEntrance",
    "mode",
    "climb",
    "safeFall",
    "activateRange",
    "timer",
    "initialCondition",
    "height",
  ])
    finite(w.defaults[key], 0, 8192, `default ${key}`);
  for (const key of ["startArea", "startEntrance", "mode", "initialCondition"])
    if (!Number.isInteger(w.defaults[key]))
      throw Error("Invalid integer default " + key);
  finite(w.defaults.height, 64, 280, "standing height");
  finite(w.defaults.mode, 1, 3, "initial mode");
  if (
    !areaById(w, w.defaults.startArea).entrances.some(
      (e) => e.id === w.defaults.startEntrance,
    )
  )
    throw Error("Start entrance does not exist");
  if (!w.preferences) throw Error("Invalid editing preferences");
  for (const key of ["moveStep", "angleStep", "objectStep", "fineStep", "grid"])
    finite(w.preferences[key], 0.01, 8192, `preference ${key}`);
  for (const [key, n] of Object.entries(w.preferences))
    finite(n, 0.01, 8192, `preference ${key}`);
  scripts(w.conditions);
  for (const a of w.areas) {
    if (typeof a.name !== "string") throw Error("Invalid area name");
    if (
      a.globals.some(
        (id) => !Number.isInteger(id) || !objectById(areaById(w, 0), id),
      )
    )
      throw Error("Invalid global object reference");
    finite(a.scale, 0.01, 128, "area scale");
    if (typeof a.horizon !== "boolean") throw Error("Invalid horizon");
    finite(a.sky, 0, 15, "sky colour");
    finite(a.ground, 0, 15, "ground colour");
    unique(a.entrances, "entrance");
    scripts(a.conditions);
    scripts(a.animators);
  }
  if (
    w.border !== null &&
    (typeof w.border !== "string" ||
      !/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(w.border))
  )
    throw Error("Invalid border image");
  unique(w.instruments, "instrument");
  for (const i of w.instruments) {
    if (
      !["undefined", "horizontal", "vertical", "number", "text"].includes(
        i.type,
      )
    )
      throw Error("Invalid instrument type");
    for (const key of [
      "x",
      "y",
      "width",
      "height",
      "variable",
      "min",
      "max",
      "fg",
      "bg",
    ])
      finite(
        i[key],
        key === "min" || key === "max" ? -2147483648 : 0,
        key === "min" || key === "max" ? 2147483647 : 8192,
        `instrument ${key}`,
      );
    if (
      i.x + i.width > 320 ||
      i.y + i.height > 200 ||
      i.variable > 255 ||
      i.fg > 15 ||
      i.bg > 15
    )
      throw Error("Instrument exceeds screen/variable/colour bounds");
  }
  for (const [index, s] of w.sounds.entries()) {
    if (s.id !== index) throw Error("Invalid sound slot identity");
    finite(s.frequency, 20, 20000, "sound frequency");
    finite(s.duration, 0.01, 10, "sound duration");
    finite(s.volume, 0, 1, "sound volume");
    if (!["sine", "square", "triangle", "sawtooth"].includes(s.wave))
      throw Error("Invalid sound waveform");
    if (
      s.data !== null &&
      (typeof s.data !== "string" ||
        !/^data:audio\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(s.data))
    )
      throw Error("Invalid audio sample");
  }
  if (
    !w.controls ||
    Object.values(w.controls).some(
      (v) => typeof v !== "string" || v.length > 30,
    )
  )
    throw Error("Invalid controls");
  if (!w.viewWindow) throw Error("Invalid view window");
  for (const key of ["x", "y", "width", "height"]) {
    finite(
      w.viewWindow[key],
      key === "width" || key === "height" ? 1 : 0,
      key === "x" || key === "width" ? 320 : 200,
      `view window ${key}`,
    );
    if (!Number.isInteger(w.viewWindow[key]))
      throw Error("Invalid view window pixel coordinate");
  }
  if (
    w.viewWindow.x + w.viewWindow.width > 320 ||
    w.viewWindow.y + w.viewWindow.height > 200
  )
    throw Error("View window exceeds screen bounds");
  for (const zone of w.controlZones || []) {
    if (
      !w.controls[zone.action] ||
      !["left", "right", "either", "both"].includes(zone.button)
    )
      throw Error("Invalid control zone");
    for (const key of ["x", "y", "width", "height"])
      finite(zone[key], 0, 320, `control zone ${key}`);
    if (zone.x + zone.width > 320 || zone.y + zone.height > 200)
      throw Error("Control zone outside screen");
  }
  return w;
}
export class History {
  constructor(state) {
    this.state = clone(state);
    this.past = [];
    this.future = [];
  }
  perform(fn) {
    const before = clone(this.state),
      next = clone(this.state);
    fn(next);
    this.past.push(before);
    if (this.past.length > 100) this.past.shift();
    this.state = next;
    this.future = [];
    return this.state;
  }
  undo() {
    if (this.past.length) {
      this.future.push(clone(this.state));
      this.state = this.past.pop();
    }
    return this.state;
  }
  redo() {
    if (this.future.length) {
      this.past.push(clone(this.state));
      this.state = this.future.pop();
    }
    return this.state;
  }
}
