import {
  clone,
  areaById,
  objectById,
  parseWorld,
  serializeWorld,
  descendants,
  includedGlobals,
} from "./model.js";

const ARITY = {
  ACTIVATED: [0, 0],
  SHOT: [0, 0],
  COLLIDED: [0, 0],
  ADDVAR: [2, 2],
  SUBVAR: [2, 2],
  SETVAR: [2, 2],
  ANDV: [2, 2],
  ORV: [2, 2],
  XORV: [2, 2],
  NOTV: [1, 1],
  DESTROY: [1, 2],
  DESTROYED: [1, 2],
  EXECUTE: [1, 1],
  GOTO: [1, 2],
  GETXPOS: [2, 3],
  GETYPOS: [2, 3],
  GETZPOS: [2, 3],
  INCLUDE: [1, 1],
  REMOVE: [1, 1],
  INVIS: [1, 2],
  INVISIBLE: [1, 2],
  VIS: [1, 2],
  VISIBLE: [1, 2],
  TOGVIS: [1, 2],
  LOOP: [1, 1],
  MODE: [1, 1],
  MOVE: [3, 3],
  MOVETO: [3, 3],
  PRINT: [2, 2],
  SOUND: [1, 1],
  SYNCSND: [1, 1],
  STARTANIM: [1, 2],
  STOPANIM: [1, 2],
  TRIGANIM: [1, 1],
  UPDATEI: [1, 1],
  TIMER: [1, 1],
  DELAY: [1, 1],
  WAIT: [0, 0],
  WAITTRIG: [0, 0],
  START: [0, 0],
  RESTART: [0, 0],
  REDRAW: [0, 0],
  END: [0, 0],
  ENDGAME: [0, 0],
  "VAR=": [2, 2],
  "VAR>": [2, 2],
  "VAR<": [2, 2],
  "VAR<>": [2, 2],
};
export const COMMANDS = [
  "IF",
  "THEN",
  "ELSE",
  "ENDIF",
  "AND",
  "OR",
  "AGAIN",
  ...Object.keys(ARITY).map((k) =>
    [
      "ACTIVATED",
      "SHOT",
      "COLLIDED",
      "DESTROYED",
      "VISIBLE",
      "INVISIBLE",
      "VAR=",
      "VAR>",
      "VAR<",
      "VAR<>",
    ].includes(k)
      ? `${k}?`
      : k,
  ),
  "VIS?",
  "INVIS?",
  "TIMER?",
];
const aliases = {
  "ACT?": "ACTIVATED?",
  "COL?": "COLLIDED?",
  IV: "INVIS",
  EX: "EXECUTE",
  ADD: "ADDVAR",
  SUB: "SUBVAR",
  SET: "SETVAR",
  TOG: "TOGVIS",
  "V=?": "VAR=?",
  "V>?": "VAR>?",
  "V<?": "VAR<?",
};
function tokenize(source) {
  const tokens = [];
  let i = 0,
    line = 1;
  while (i < source.length) {
    const rest = source.slice(i);
    const ws = /^\s+/.exec(rest);
    if (ws) {
      line += (ws[0].match(/\n/g) || []).length;
      i += ws[0].length;
      continue;
    }
    const comment = /^(?:;|\/\/)[^\n]*/.exec(rest);
    if (comment) {
      i += comment[0].length;
      continue;
    }
    const m =
      /^("(?:[^"\\]|\\.)*"|V\d+\b|[A-Z][A-Z0-9_]*(?:[<>=]+)?\??|-?\d+|[(),])/i.exec(
        rest,
      );
    if (!m) throw Error(`Line ${line}: unexpected character ${rest[0]}`);
    tokens.push({ value: m[0][0] === '"' ? m[0] : m[0].toUpperCase(), line });
    i += m[0].length;
  }
  return tokens;
}
export function compile(source) {
  const tokens = tokenize(source),
    code = [],
    stack = [];
  let p = 0;
  const fail = (msg, t = tokens[p]) => {
    throw Error(`Line ${t?.line ?? tokens.at(-1)?.line ?? 1}: ${msg}`);
  };
  function call() {
    const token = tokens[p++];
    if (!token) fail("Expected command");
    const op = aliases[token.value] || token.value;
    const name = op.replace(/\?$/, "");
    if (!ARITY[name]) fail(`Unknown command ${op}`, token);
    const args = [];
    if (tokens[p]?.value === "(") {
      p++;
      if (tokens[p]?.value !== ")")
        while (true) {
          const t = tokens[p++];
          if (!t) fail("Missing parameter");
          if (/^V\d+$/.test(t.value)) {
            const v = Number(t.value.slice(1));
            if (v > 255) fail("Variable must be V0…V255", t);
            args.push({ v });
          } else if (/^-?\d+$/.test(t.value)) {
            const n = Number(t.value);
            if (n < -16384 || n > 16383)
              fail(
                "Literal outside -16384…16383; compute larger values in variables",
                t,
              );
            args.push(n);
          } else if (t.value.startsWith('"'))
            args.push(
              t.value.slice(1, -1).replace(/\\"/g, '"').replace(/\\N/gi, "\n"),
            );
          else fail("Invalid parameter", t);
          if (tokens[p]?.value === ",") {
            p++;
            continue;
          }
          break;
        }
      if (tokens[p++]?.value !== ")") fail("Expected closing parenthesis");
    }
    const [min, max] = op === "TIMER?" ? [0, 0] : ARITY[name];
    if (args.length < min || args.length > max)
      fail(
        `${op} expects ${min === max ? min : `${min}…${max}`} parameters`,
        token,
      );
    if (name.startsWith("GET") && !Number.isInteger(args[0]?.v))
      fail(`${op} destination must be a variable`, token);
    if (name === "NOTV" && !Number.isInteger(args[0]?.v))
      fail("NOTV requires a variable", token);
    if (name === "PRINT" && typeof args[0] !== "string")
      fail("PRINT requires a quoted message", token);
    return { op, args, line: token.line };
  }
  while (p < tokens.length) {
    const t = tokens[p],
      op = t.value;
    if (op === "IF") {
      p++;
      const terms = [{ join: null, ...call() }];
      while (["AND", "OR"].includes(tokens[p]?.value)) {
        const join = tokens[p++].value;
        terms.push({ join, ...call() });
      }
      if (tokens[p++]?.value !== "THEN") fail("IF requires THEN", t);
      const at = code.length;
      code.push({ op: "IF", terms, jump: 0, line: t.line });
      stack.push({ kind: "IF", at });
    } else if (op === "ELSE") {
      p++;
      const s = stack.at(-1);
      if (s?.kind !== "IF" || s.other !== undefined) fail("Unexpected ELSE", t);
      s.other = code.length;
      code.push({ op: "JUMP", jump: 0 });
      code[s.at].jump = code.length;
    } else if (op === "ENDIF") {
      p++;
      const s = stack.pop();
      if (s?.kind !== "IF") fail("Unexpected ENDIF or unclosed LOOP", t);
      code[s.other ?? s.at].jump = code.length;
    } else if (op === "AGAIN") {
      p++;
      const index = stack.findLastIndex((s) => s.kind === "LOOP");
      const s = index < 0 ? undefined : stack.splice(index, 1)[0];
      if (s?.kind !== "LOOP") fail("AGAIN requires LOOP", t);
      code.push({ op: "AGAIN", jump: s.at, line: t.line });
      code[s.at].jump = code.length;
    } else {
      const c = call();
      if (c.op === "LOOP") stack.push({ kind: "LOOP", at: code.length });
      code.push(c);
    }
  }
  for (const s of stack) {
    if (s.kind === "LOOP") fail("LOOP requires AGAIN");
    code[s.other ?? s.at].jump = code.length;
  }
  return code;
}
const runner = (source, context = {}) => ({
  code: compile(source),
  source,
  pc: 0,
  loops: [],
  included: [],
  start: 0,
  done: false,
  consumed: [],
  ...context,
});

export class Runtime {
  constructor(world, hooks = {}) {
    this.base = clone(world);
    this.hooks = hooks;
    this.vars = new Int32Array(256);
    this.reset();
  }
  get area() {
    return areaById(this.world, this.areaId);
  }
  object(id, area = this.areaId) {
    return objectById(areaById(this.world, area), id);
  }
  reset() {
    this.generation = (this.generation || 0) + 1;
    const high = this.vars[255];
    this.world = clone(this.base);
    this.vars.fill(0);
    this.vars[255] = high;
    this.vars[20] = 15;
    this.frame = 0;
    this.events = new Map();
    this.blockedUntil = 0;
    this.pendingSounds = [];
    this.transients = [];
    this.conditions = new Map();
    this.animations = new Map();
    this.timer = this.world.defaults.timer;
    this.mode = this.world.defaults.mode;
    this.areaId = this.world.defaults.startArea;
    this.position = [4000, 300, 4000];
    this.rotation = [0, 0, 0];
    this.height = this.world.defaults.height;
    this.requestedHeight = this.height;
    this.fallStart = null;
    this.velocityY = 0;
    for (const a of this.world.areas)
      for (const o of a.objects) {
        o.status = o.initialStatus;
        if (o.moveable) o.position = [...o.startPosition];
      }
    for (const a of this.world.areas)
      for (const group of a.objects.filter(
        (o) => o.type === "group" && o.moveable,
      )) {
        const source = objectById(areaById(this.base, a.id), group.id),
          offset = source.startPosition.map((p, i) => p - source.position[i]);
        for (const member of descendants(a, group.id).filter(
          (o) => o.id !== group.id,
        ))
          member.position = member.position.map((p, i) => p + offset[i]);
      }
    for (const a of this.world.areas)
      for (const group of a.objects.filter(
        (o) => o.type === "group" && o.initialStatus === "invisible",
      ))
        for (const member of descendants(a, group.id))
          member.status = "invisible";
    this.goto(this.world.defaults.startEntrance, this.areaId);
    this.syncVars();
    const initial = this.world.conditions.find(
      (c) => c.id === this.world.defaults.initialCondition,
    );
    if (initial) this.run(initial.source);
    this.hooks.reset?.();
  }
  syncVars() {
    for (let i = 0; i < 3; i++) {
      this.vars[i] = Math.round(this.position[i]);
      this.vars[i + 3] = Math.round(this.rotation[i]);
    }
    this.vars[6] = this.mode;
    this.vars[7] = this.height;
    this.vars[8] = this.areaId;
  }
  setVar(id, value) {
    this.vars[id] = value | 0;
    if (id < 3) this.position[id] = this.vars[id];
    else if (id < 6) this.rotation[id - 3] = this.vars[id];
    else if (id === 6) this.mode = Math.min(3, Math.max(1, this.vars[id]));
    else if (id === 7) {
      const height = Math.max(64, Math.min(280, this.vars[id]));
      this.position[1] += height - this.height;
      this.height = height;
      this.requestedHeight = height;
      this.vars[7] = height;
    }
  }
  goto(entrance, area = this.areaId) {
    const a = areaById(this.world, area),
      e = a?.entrances.find((e) => e.id === entrance);
    if (!e) return false;
    this.vars[9] = this.areaId;
    this.areaId = area;
    this.position = [...e.position];
    this.rotation = [...e.rotation];
    this.velocityY = 0;
    this.syncVars();
    return true;
  }
  value(arg) {
    return arg && typeof arg === "object" ? this.vars[arg.v] : arg;
  }
  animation(id, area = this.areaId) {
    const key = `${area}:${id}`;
    if (!this.animations.has(key)) {
      const a = areaById(this.world, area)?.animators.find((a) => a.id === id);
      if (!a) return null;
      this.animations.set(
        key,
        runner(a.source, {
          area,
          animation: true,
          active: false,
          trigger: false,
        }),
      );
    }
    return this.animations.get(key);
  }
  run(source, context = {}) {
    const state = runner(source, {
      area: this.areaId,
      event: null,
      subject: null,
      ...context,
    });
    this.advance(state);
    if (!state.done) this.transients.push(state);
    return state;
  }
  fire() {
    if (!(this.vars[20] & 1)) return false;
    this.vars[21]++;
    if (this.vars[20] & 4) this.hooks.sound?.(0);
    if (this.vars[20] & 2) this.hooks.shot?.();
    return true;
  }
  interact(id, event, distance, objectArea = this.areaId) {
    const object = this.object(id, objectArea);
    if (!object || object.status !== "visible") return false;
    if (event === "shot" && !(this.vars[20] & 1)) return false;
    const d =
      distance ??
      Math.hypot(
        ...object.position.map(
          (n, i) => n + object.size[i] / 2 - this.position[i],
        ),
      );
    if (event === "activated" && d > this.world.defaults.activateRange)
      return false;
    if (event === "shot") this.fire();
    const targets = [
      object,
      ...areaById(this.world, objectArea).objects.filter(
        (o) =>
          o.type === "group" &&
          o.id !== id &&
          descendants(areaById(this.world, objectArea), o.id).some(
            (child) => child.id === id,
          ),
      ),
    ];
    for (const target of targets) {
      if (target.status !== "visible") continue;
      const key = `${objectArea}:${target.id}`,
        flags = this.events.get(key) || [];
      if (!flags.includes(event)) flags.push(event);
      this.events.set(key, flags);
      this.run(target.condition, {
        subject: target.id,
        subjectArea: objectArea,
        event,
      });
    }
    return true;
  }
  predicate(c, state) {
    const a = c.args.map((v) => this.value(v)),
      name = c.op.replace(/\?$/, "");
    const object = () => this.object(a[0], a[1] ?? state.area);
    switch (name) {
      case "ACTIVATED":
        return state.event === "activated";
      case "SHOT":
      case "COLLIDED": {
        const event = name === "SHOT" ? "shot" : "collided";
        const key = `${state.subjectArea ?? state.area}:${state.subject}`,
          flags = this.events.get(key);
        if (flags) {
          const value = flags.includes(event);
          this.events.set(
            key,
            flags.filter((v) => v !== event),
          );
          return value;
        }
        const value = state.event === event && !state.consumed.includes(event);
        state.consumed.push(event);
        return value;
      }
      case "VIS":
      case "VISIBLE":
        return object()?.status === "visible";
      case "INVIS":
      case "INVISIBLE":
        return object()?.status === "invisible";
      case "DESTROYED":
        return object()?.status === "destroyed";
      case "VAR=":
        return a[1] === a[0];
      case "VAR>":
        return a[0] > a[1];
      case "VAR<":
        return a[0] < a[1];
      case "VAR<>":
        return a[1] !== a[0];
      case "TIMER":
        return (
          this.timer > 0 && this.frame > 0 && this.frame % this.timer === 0
        );
      default:
        return this.arithmetic(c, state) === 0;
    }
  }
  arithmetic(c) {
    const a = c.args.map((v) => this.value(v));
    let result;
    switch (c.op) {
      case "SETVAR":
        result = a[0];
        break;
      case "ADDVAR":
        result = a[1] + a[0];
        break;
      case "SUBVAR":
        result = a[1] - a[0];
        break;
      case "ANDV":
        result = a[1] & a[0];
        break;
      case "ORV":
        result = a[1] | a[0];
        break;
      case "XORV":
        result = a[1] ^ a[0];
        break;
      case "NOTV":
        result = ~a[0];
        break;
      default:
        throw Error(`Not an arithmetic condition: ${c.op}`);
    }
    const dest = c.args[c.op === "NOTV" ? 0 : 1];
    if (Number.isInteger(dest?.v)) this.setVar(dest.v, result);
    return result | 0;
  }
  advance(s) {
    let budget = 4000;
    while (!s.done && s.pc < s.code.length) {
      if (--budget <= 0) {
        s.done = true;
        throw Error(
          `FCL execution budget exceeded at line ${s.code[s.pc]?.line || 1}`,
        );
      }
      const c = s.code[s.pc++],
        op = c.op,
        a = c.args?.map((v) => this.value(v)) || [];
      if (op === "IF") {
        let value = this.predicate(c.terms[0], s);
        for (const term of c.terms.slice(1)) {
          const next = this.predicate(term, s);
          value = term.join === "AND" ? value && next : value || next;
        }
        if (!value) s.pc = c.jump;
        continue;
      }
      if (op === "JUMP") {
        s.pc = c.jump;
        continue;
      }
      if (
        ["SETVAR", "ADDVAR", "SUBVAR", "ANDV", "ORV", "XORV", "NOTV"].includes(
          op,
        )
      ) {
        this.arithmetic(c);
        continue;
      }
      if (["VIS", "INVIS", "TOGVIS", "DESTROY"].includes(op)) {
        const objects = descendants(areaById(this.world, a[1] ?? s.area), a[0]);
        for (const o of objects)
          if (o.status !== "destroyed")
            o.status =
              op === "DESTROY"
                ? "destroyed"
                : op === "INVIS"
                  ? "invisible"
                  : op === "VIS"
                    ? "visible"
                    : o.status === "visible"
                      ? "invisible"
                      : "visible";
        continue;
      }
      if (op.startsWith("GET")) {
        const o = this.object(a[1], a[2] ?? s.area);
        if (o)
          this.setVar(
            c.args[0].v,
            o.position[{ GETXPOS: 0, GETYPOS: 1, GETZPOS: 2 }[op]],
          );
        continue;
      }
      switch (op) {
        case "GOTO": {
          const old = this.areaId;
          if (this.goto(a[0], a[1] ?? s.area) && old !== this.areaId) {
            s.done = true;
            return;
          }
          break;
        }
        case "MODE":
          this.mode = Math.min(3, Math.max(1, a[0]));
          this.vars[6] = this.mode;
          break;
        case "EXECUTE": {
          const o = this.object(a[0], s.area);
          if (o) {
            s.code = compile(o.condition);
            s.pc = 0;
            s.loops = [];
          }
          break;
        }
        case "ENDGAME":
          this.reset();
          s.done = true;
          return;
        case "LOOP":
          if (a[0] < 0) s.pc = c.jump;
          else s.loops.push({ pc: s.pc - 1, left: a[0], infinite: a[0] === 0 });
          break;
        case "AGAIN": {
          const loop = s.loops.at(-1);
          if (loop && (loop.infinite || --loop.left > 0)) s.pc = loop.pc + 1;
          else s.loops.pop();
          break;
        }
        case "INCLUDE":
          if (s.animation && !s.included.includes(a[0])) {
            const members = descendants(areaById(this.world, s.area), a[0]).map(
              (o) => o.id,
            );
            const owned = [...this.animations.values()].some(
              (other) =>
                other !== s &&
                other.area === s.area &&
                other.included.some((id) =>
                  descendants(areaById(this.world, s.area), id).some((o) =>
                    members.includes(o.id),
                  ),
                ),
            );
            if (members.length && !owned) s.included.push(a[0]);
          }
          break;
        case "REMOVE":
          if (s.animation) s.included = s.included.filter((id) => id !== a[0]);
          break;
        case "START":
          if (s.animation) s.start = s.pc;
          break;
        case "RESTART":
          if (s.animation) {
            s.pc = s.start;
            s.loops = [];
            return;
          }
          break;
        case "MOVE":
        case "MOVETO":
          if (s.animation) {
            const first = this.object(s.included[0], s.area);
            const delta =
              op === "MOVE"
                ? a
                : a.map((v, i) => v - (first?.position[i] ?? 0));
            this.moveAnimation(s, delta);
            return;
          }
          break;
        case "END":
          if (s.animation) return;
          s.done = true;
          return;
        case "WAIT":
        case "REDRAW":
          return;
        case "DELAY":
          this.blockedUntil = this.frame + Math.max(0, a[0]);
          return;
        case "STARTANIM": {
          const anim = this.animation(a[0], a[1] ?? s.area);
          if (anim) {
            if (anim.done) {
              anim.pc = 0;
              anim.done = false;
              anim.loops = [];
            }
            anim.active = true;
          }
          break;
        }
        case "STOPANIM": {
          const anim = this.animation(a[0], a[1] ?? s.area);
          if (anim) anim.active = false;
          break;
        }
        case "TRIGANIM": {
          const anim = this.animation(a[0], s.area);
          if (anim) anim.trigger = true;
          break;
        }
        case "WAITTRIG":
          if (s.animation) {
            if (!s.trigger) {
              s.pc--;
              return;
            }
            s.trigger = false;
          }
          break;
        case "PRINT": {
          const i = this.world.instruments.find((i) => i.id === a[1]);
          if (i?.type === "text") i.text = a[0];
          this.hooks.instrument?.(a[1]);
          break;
        }
        case "UPDATEI":
          this.hooks.instrument?.(a[0]);
          break;
        case "SOUND":
          if (a[0] >= 0 && a[0] < 32) this.hooks.sound?.(a[0]);
          break;
        case "SYNCSND":
          if (a[0] >= 0 && a[0] < 32) this.pendingSounds.push(a[0]);
          break;
        case "TIMER":
          this.timer = Math.max(0, a[0]);
          break;
        default:
          if (op.endsWith("?")) this.predicate(c, s);
          else throw Error(`Unimplemented FCL instruction ${op}`);
      }
      if (this.frame < this.blockedUntil) return;
    }
    if (s.pc >= s.code.length) s.done = true;
  }
  tick() {
    const generation = this.generation;
    this.frame++;
    this.vars[19]++;
    if (this.frame < this.blockedUntil) return;
    this.syncVars();
    for (const id of this.pendingSounds.splice(0)) this.hooks.sound?.(id);
    const transient = [...this.transients];
    this.transients = [];
    for (const s of transient) {
      this.advance(s);
      if (this.generation !== generation) return;
      if (!s.done) this.transients.push(s);
      if (this.frame < this.blockedUntil) return;
    }
    const oldArea = this.areaId;
    const lists = [
      ...this.world.conditions
        .filter((c) => c.id !== this.world.defaults.initialCondition)
        .map((c) => ({ key: `g${c.id}`, c })),
      ...this.area.conditions.map((c) => ({ key: `a${oldArea}:${c.id}`, c })),
    ];
    for (const { key, c } of lists) {
      let s = this.conditions.get(key);
      if (!s || s.done) {
        s = runner(c.source, { area: this.areaId });
        this.conditions.set(key, s);
      }
      this.advance(s);
      if (
        this.generation !== generation ||
        this.areaId !== oldArea ||
        this.frame < this.blockedUntil
      )
        return;
    }
    for (const s of this.animations.values())
      if (s.active && !s.done) {
        this.advance(s);
        if (this.generation !== generation) return;
        if (this.frame < this.blockedUntil) return;
      }
    this.sense();
    this.syncVars();
  }
  sense() {
    for (const o of [
      ...this.area.objects,
      ...includedGlobals(this.world, this.area),
    ]) {
      if (
        o.type !== "sensor" ||
        o.status !== "visible" ||
        this.frame % Math.max(1, o.sensor.speed) !== 0
      )
        continue;
      const delta = this.position.map((p, i) => p - o.position[i]);
      const axis = delta
        .map(Math.abs)
        .indexOf(Math.max(...delta.map(Math.abs)));
      const direction = `${delta[axis] >= 0 ? "+" : "-"}${"xyz"[axis]}`;
      if (
        Math.hypot(...delta) > o.sensor.range ||
        !o.sensor.directions.includes(direction) ||
        this.hooks.occluded?.(o.position, this.position)
      )
        continue;
      if (o.sensor.effect === "shoot") {
        this.vars[11]++;
        this.hooks.sound?.(1);
      } else {
        this.vars[13] = o.id;
        this.vars[14]++;
      }
      this.hooks.sensor?.(o);
    }
  }
  moveAnimation(s, delta) {
    const moving = new Map();
    for (const id of s.included) {
      const root = this.object(id, s.area);
      if (!root?.moveable || root.status === "destroyed") continue;
      for (const object of descendants(areaById(this.world, s.area), id))
        if (object.status !== "destroyed") moving.set(object.id, object);
    }
    const members = [...moving.values()];
    if (!members.length) return;
    const min = [0, 1, 2].map((i) =>
        Math.min(...members.map((o) => o.position[i])),
      ),
      max = [0, 1, 2].map((i) =>
        Math.max(...members.map((o) => o.position[i] + o.size[i])),
      );
    const colliders = areaById(this.world, s.area).objects.filter(
      (o) =>
        o.status === "visible" &&
        !moving.has(o.id) &&
        !["sensor", "group", "line"].includes(o.type),
    );
    const n = Math.max(1, Math.ceil(Math.hypot(...delta) / 10));
    let fraction = 0,
      collided;
    for (let k = 1; k <= n; k++) {
      const f = k / n,
        lo = min.map((p, i) => p + delta[i] * f),
        hi = max.map((p, i) => p + delta[i] * f);
      if (lo.some((p) => p < 0) || hi.some((p) => p > 8192)) break;
      collided = colliders.find((o) =>
        lo.every(
          (p, i) =>
            p < o.position[i] + o.size[i] - 0.001 &&
            hi[i] > o.position[i] + 0.001,
        ),
      );
      if (collided) break;
      fraction = f;
    }
    for (const o of members)
      o.position = o.position.map((p, i) => p + delta[i] * fraction);
    if (collided && s.area === this.areaId) {
      this.interact(collided.id, "collided", 0);
      for (const o of members) this.interact(o.id, "collided", 0);
    }
    if (
      s.area === this.areaId &&
      members.some((o) =>
        this.position.every(
          (p, i) =>
            p > o.position[i] &&
            (i === 1 ? p - this.height : p) < o.position[i] + o.size[i],
        ),
      )
    )
      this.vars[12]++;
  }
  saveGame() {
    return JSON.stringify({
      format: "freescape-save",
      version: 1,
      base: serializeWorld(this.base),
      world: this.world,
      vars: Array.from(this.vars),
      areaId: this.areaId,
      position: this.position,
      rotation: this.rotation,
      mode: this.mode,
      height: this.height,
      requestedHeight: this.requestedHeight,
      frame: this.frame,
      blockedUntil: this.blockedUntil,
      timer: this.timer,
      events: [...this.events],
      animations: [...this.animations],
      conditions: [...this.conditions],
      transients: this.transients,
      pendingSounds: this.pendingSounds,
    });
  }
  loadGame(text) {
    const d = JSON.parse(text);
    if (
      d.format !== "freescape-save" ||
      d.version !== 1 ||
      d.base !== serializeWorld(this.base) ||
      d.vars?.length !== 256
    )
      throw Error("Save belongs to a different world or version");
    parseWorld(JSON.stringify(d.world));
    for (const key of [
      "world",
      "areaId",
      "position",
      "rotation",
      "mode",
      "height",
      "requestedHeight",
      "frame",
      "blockedUntil",
      "timer",
      "transients",
      "pendingSounds",
    ])
      this[key] = clone(d[key]);
    this.vars = new Int32Array(d.vars);
    this.events = new Map(d.events || []);
    this.animations = new Map(d.animations);
    this.conditions = new Map(d.conditions);
  }
}
