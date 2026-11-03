import test from "node:test";
import assert from "node:assert/strict";
import { AudioBank } from "../src/audio.js";
import { createWorld } from "../src/model.js";
test("manual sound bank has 32 slots with only 0–6 defined by default", () => {
  const w = createWorld();
  assert.equal(w.sounds.length, 32);
  assert.ok(w.sounds.slice(0, 7).every((s) => s.defined));
  assert.ok(w.sounds.slice(7).every((s) => !s.defined));
});
test("undefined sounds remain silent and defined sounds schedule oscillator and gain", async () => {
  let starts = 0;
  const old = globalThis.AudioContext;
  globalThis.AudioContext = class {
    currentTime = 0;
    destination = {};
    async resume() {}
    createGain() {
      return {
        connect() {},
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      };
    }
    createOscillator() {
      return {
        connect() {},
        type: "",
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        start() {
          starts++;
        },
        stop() {},
      };
    }
  };
  try {
    const bank = new AudioBank(),
      w = createWorld();
    await bank.play(w.sounds[7]);
    assert.equal(starts, 0);
    await bank.play(w.sounds[4]);
    assert.equal(starts, 1);
  } finally {
    globalThis.AudioContext = old;
  }
});
