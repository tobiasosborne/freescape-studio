import {
  clone,
  descendants,
  nextId,
  createObject,
  serializeWorld,
  parseWorld,
  validateObject,
} from "./model.js";
export function exportObject(area, id) {
  return JSON.stringify(
    {
      format: "freescape-object",
      version: 1,
      root: id,
      objects: descendants(area, id).map((o) => {
        const copy = clone(o);
        delete copy.name;
        delete copy.condition;
        return copy;
      }),
    },
    null,
    2,
  );
}
export function importObject(area, text) {
  const data = JSON.parse(text);
  if (
    data.format !== "freescape-object" ||
    data.version !== 1 ||
    !Array.isArray(data.objects) ||
    data.objects.length > 4096
  )
    throw Error("Invalid object file");
  const staged = clone(area),
    map = new Map(),
    copies = [];
  for (const o of data.objects) {
    const copy = createObject(staged, o.type, {
      ...o,
      id: nextId(staged.objects),
      name: `${o.type} ${nextId(staged.objects)}`,
      condition: "",
    });
    map.set(o.id, copy.id);
    copies.push(copy);
  }
  for (const o of copies)
    o.members = o.members.map((id) => {
      if (!map.has(id)) throw Error("Missing group member");
      return map.get(id);
    });
  if (!map.has(data.root)) throw Error("Missing root object");
  const obstacles = area.objects.filter(
    (o) =>
      o.status === "visible" && !["sensor", "group", "line"].includes(o.type),
  );
  for (let attempt = 0; attempt <= obstacles.length; attempt++) {
    const min = [0, 1, 2].map((i) =>
        Math.min(...copies.map((o) => o.position[i])),
      ),
      max = [0, 1, 2].map((i) =>
        Math.max(...copies.map((o) => o.position[i] + o.size[i])),
      );
    const overlap = obstacles.filter((o) =>
      min.every(
        (p, i) => p < o.position[i] + o.size[i] && max[i] > o.position[i],
      ),
    );
    if (!overlap.length) break;
    const rise =
      Math.max(...overlap.map((o) => o.position[1] + o.size[1])) - min[1];
    if (rise <= 0 || attempt === obstacles.length)
      throw Error("No free space for imported object");
    for (const o of copies) {
      o.position[1] += rise;
      o.startPosition[1] += rise;
      validateObject(o);
    }
  }
  area.objects = staged.objects;
  return area.objects.find((o) => o.id === map.get(data.root));
}
export class WorldLibrary {
  constructor(storage) {
    this.storage = storage;
    this.key = "freescape-studio:library";
  }
  entries() {
    try {
      return JSON.parse(this.storage.getItem(this.key) || "{}");
    } catch {
      throw Error("Local library data could not be read");
    }
  }
  list() {
    return Object.keys(this.entries()).sort();
  }
  save(name, world) {
    if (!name.trim()) throw Error("Enter a world name");
    const entries = this.entries();
    Object.defineProperty(entries, name, {
      value: serializeWorld(world),
      enumerable: true,
      configurable: true,
      writable: true,
    });
    try {
      this.storage.setItem(this.key, JSON.stringify(entries));
    } catch {
      throw Error("Browser storage is full. Download your world as JSON.");
    }
  }
  load(name) {
    const text = this.entries()[name];
    if (typeof text !== "string") throw Error("World not found");
    return parseWorld(text);
  }
  remove(name) {
    const entries = this.entries();
    delete entries[name];
    this.storage.setItem(this.key, JSON.stringify(entries));
  }
}
export function instrumentValue(i, vars) {
  if (i.type === "undefined") return null;
  if (i.type === "text") return i.text || "";
  const value = vars[i.variable] || 0;
  if (i.type === "number")
    return String(
      Math.round(
        Math.max(
          Math.min(i.min, i.max),
          Math.min(Math.max(i.min, i.max), value),
        ),
      ),
    );
  return i.max === i.min
    ? 0
    : Math.max(0, Math.min(1, (value - i.min) / (i.max - i.min)));
}
export function spreadPalette(palette, start, end) {
  if (start === end) return;
  const lo = Math.min(start, end),
    hi = Math.max(start, end),
    a = palette[lo].match(/\w\w/g).map((v) => parseInt(v, 16)),
    b = palette[hi].match(/\w\w/g).map((v) => parseInt(v, 16));
  for (let i = lo; i <= hi; i++) {
    const t = (i - lo) / (hi - lo);
    palette[i] =
      "#" +
      a
        .map((v, c) =>
          (Math.round((v + (b[c] - v) * t) / 17) * 17)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
  }
}
export function download(name, content, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
