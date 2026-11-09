// The table's sounds, synthesised with Web Audio: no files, nothing until the player turns sound
// on, and never a sound for a loss (docs/design/02-voice-and-copy.md §11). Loaded on demand.

export type TableSound = {
  /** The ball's rumble in the lane, by speed in scale widths a second; 0 is silence. */
  rolling: (speed: number) => void;
  /** The ball meets an end of the lane. */
  bounce: () => void;
  /** The ball comes to rest on the number. */
  land: () => void;
  /** Chip k lands on the bet. */
  clink: (k: number) => void;
  /** Roulette: the ball clips a deflector on the bowl. */
  deflect: () => void;
  /** Roulette: the ball leaves the track over a deflector. */
  clack: () => void;
  /** Roulette: the ball meets the frets of its pocket, softer each bounce. */
  fret: (k: number) => void;
  /** Roulette: the ball comes to rest in its pocket. */
  pocket: () => void;
  close: () => void;
};

type AudioContextClass = typeof AudioContext;

export function createTableSound(): TableSound | null {
  const Context: AudioContextClass | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextClass }).webkitAudioContext;
  if (!Context) return null;
  const ctx = new Context();
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  let rumble: { filter: BiquadFilterNode; gain: GainNode } | null = null;

  const ready = () => {
    if (ctx.state === "suspended") void ctx.resume();
    return ctx.currentTime;
  };

  const burst = (
    at: number,
    freq: number,
    q: number,
    gain: number,
    decay: number,
    type: BiquadFilterType = "bandpass"
  ) => {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const level = ctx.createGain();
    level.gain.setValueAtTime(gain, at);
    level.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    source.connect(filter).connect(level).connect(ctx.destination);
    source.start(at, Math.random() * 0.5);
    source.stop(at + decay + 0.02);
  };

  const tone = (
    at: number,
    freq: number,
    gain: number,
    decay: number,
    type: OscillatorType = "sine",
    to?: number
  ) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, at + decay);
    const level = ctx.createGain();
    level.gain.setValueAtTime(gain, at);
    level.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(level).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + decay + 0.02);
  };

  return {
    rolling(speed) {
      const now = ready();
      if (!rumble) {
        if (speed === 0) return;
        const source = ctx.createBufferSource();
        source.buffer = noise;
        source.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.Q.value = 0.9;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        source.connect(filter).connect(gain).connect(ctx.destination);
        source.start();
        rumble = { filter, gain };
      }
      const s = Math.min(1.2, speed);
      rumble.gain.gain.setTargetAtTime(s * 0.07, now, 0.05);
      rumble.filter.frequency.setTargetAtTime(260 + s * 520, now, 0.05);
    },
    bounce() {
      burst(ready(), 1800, 1.5, 0.12, 0.05);
    },
    land() {
      const at = ready();
      tone(at, 210, 0.22, 0.16, "sine", 120);
      burst(at, 900, 1, 0.06, 0.06);
    },
    clink(k) {
      const at = ready();
      const lift = 1 + (k % 3) * 0.04;
      tone(at, 2350 * lift, 0.05, 0.14, "triangle");
      tone(at + 0.004, 3720 * lift, 0.03, 0.1, "triangle");
      burst(at, 5200, 2, 0.04, 0.03, "highpass");
    },
    deflect() {
      const at = ready();
      burst(at, 2600, 4, 0.07, 0.025);
      tone(at, 1900, 0.025, 0.04, "triangle");
    },
    clack() {
      burst(ready(), 2400, 2, 0.1, 0.04);
    },
    fret(k) {
      const at = ready();
      const gain = 0.11 * 0.6 ** k;
      burst(at, 3100, 3, gain, 0.03);
      tone(at, 1500, gain * 0.5, 0.05, "triangle");
    },
    pocket() {
      const at = ready();
      tone(at, 520, 0.14, 0.12, "sine", 300);
      burst(at, 1400, 1.5, 0.07, 0.05);
    },
    close() {
      void ctx.close();
    }
  };
}
