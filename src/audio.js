export class AudioBank {
  constructor() {
    this.enabled = true;
    this.context = null;
    this.buffers = new Map();
  }
  async play(sound) {
    if (!this.enabled || !sound || sound.defined === false) return;
    try {
      this.context ??= new AudioContext();
      await this.context.resume();
      const ctx = this.context,
        gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(sound.volume ?? 0.25, ctx.currentTime);
      if (sound.data) {
        let buffer = this.buffers.get(sound.data);
        if (!buffer) {
          const bytes = Uint8Array.from(atob(sound.data.split(",")[1]), (c) =>
            c.charCodeAt(0),
          );
          buffer = await ctx.decodeAudioData(bytes.buffer);
          this.buffers.set(sound.data, buffer);
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(gain);
        source.start();
        return;
      }
      const osc = ctx.createOscillator();
      osc.type = sound.wave || "triangle";
      osc.frequency.setValueAtTime(sound.frequency || 440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(40, (sound.frequency || 440) * 0.4),
        ctx.currentTime + (sound.duration || 0.12),
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + (sound.duration || 0.12),
      );
      osc.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + (sound.duration || 0.12));
    } catch (error) {
      this.onError?.(error);
    }
  }
}
