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
  /** Slots: the drums' whirr, by how fast the fastest turns (1 is full speed); 0 is silence. */
  whirr: (speed: number) => void;
  /** Slots: reel `i` catches on its stop, a little lower from left to right. */
  reelStop: (i: number) => void;
  /** Keno: the air under the balls, 1 while it blows; 0 is silence. */
  air: (level: number) => void;
  /** Keno: a ball knocks the glass or another ball, by how hard. */
  knock: (strength: number) => void;
  /**
   * A ball drops into keno's rack or a plinko cup, a little brighter when it is one of yours or
   * its cup pays more than the stake.
   */
  drop: (hit: boolean) => void;
  /** Plinko: the ball hits a pin, a little higher each row. */
  pin: (row: number) => void;
  /** Coin toss: the thumb flicks the coin up, a bright ring. */
  flick: () => void;
  /** Coin toss: the coin meets the felt and rattles flat, a little brighter on your call. */
  coin: (match: boolean) => void;
  /** Baccarat: a card slides out of the shoe across the felt. */
  slide: () => void;
  /** Baccarat: a card is turned over, a short snap. */
  snap: () => void;
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
  let drums: { filter: BiquadFilterNode; gain: GainNode } | null = null;
  let blower: { filter: BiquadFilterNode; gain: GainNode } | null = null;

  /** A looped noise through a band-pass, silent until it is turned up. */
  const loop = (q: number) => {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    return { filter, gain };
  };

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
        rumble = loop(0.9);
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
    whirr(speed) {
      const now = ready();
      if (!drums) {
        if (speed === 0) return;
        drums = loop(1.4);
      }
      const s = Math.min(1, speed);
      drums.gain.gain.setTargetAtTime(s * 0.05, now, 0.05);
      drums.filter.frequency.setTargetAtTime(380 + s * 900, now, 0.05);
    },
    reelStop(i) {
      const at = ready();
      tone(at, 190 - i * 14, 0.2, 0.12, "sine", 95);
      burst(at, 2400, 2, 0.08, 0.035);
    },
    air(level) {
      const now = ready();
      if (!blower) {
        if (level === 0) return;
        blower = loop(0.5);
        blower.filter.frequency.value = 700;
      }
      blower.gain.gain.setTargetAtTime(Math.min(1, level) * 0.06, now, 0.12);
    },
    knock(strength) {
      burst(ready(), 2600 + Math.random() * 1600, 3, Math.min(0.06, strength * 0.00008), 0.025);
    },
    pin(row) {
      const at = ready();
      tone(at, 1700 + row * 90, 0.04, 0.07, "triangle");
      burst(at, 4200, 2, 0.025, 0.02);
    },
    drop(hit) {
      const at = ready();
      tone(at, 260, 0.16, 0.12, "sine", 150);
      burst(at, 1500, 1.5, 0.06, 0.04);
      if (hit) tone(at + 0.05, 1320, 0.05, 0.3, "triangle");
    },
    flick() {
      const at = ready();
      tone(at, 2650, 0.05, 0.5, "triangle");
      tone(at, 3980, 0.025, 0.35);
    },
    coin(match) {
      const at = ready();
      burst(at, 1800, 1.2, 0.09, 0.05);
      for (let i = 1; i < 6; i++) burst(at + 0.05 * i * (1 - i * 0.07), 2600, 3, 0.04 / i, 0.025);
      if (match) tone(at + 0.12, 1320, 0.05, 0.3, "triangle");
    },
    slide() {
      burst(ready(), 2400, 0.8, 0.05, 0.12);
    },
    snap() {
      burst(ready(), 3200, 2.5, 0.07, 0.035);
    },
    close() {
      void ctx.close();
    }
  };
}
