// A camera shutter made with the Web Audio API (no sound file to load): the mirror/shutter opening,
// a faint mechanical whirr, then the shutter closing - about 130 ms in all.
let context: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context ??= new Ctor();
    // Browsers start audio suspended until the first click; this runs inside one.
    if (context.state === "suspended") void context.resume();
    return context;
  } catch {
    return null;
  }
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noise) {
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

// One short, filtered burst of noise: the "click" of a moving part.
function click(ctx: AudioContext, at: number, frequency: number, q: number, length: number, volume: number, type: BiquadFilterType = "bandpass") {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(at);
  source.stop(at + length + 0.02);
}

// The low "clack" of the mechanism under the click.
function thump(ctx: AudioContext, at: number, from: number, to: number, length: number, volume: number) {
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + length);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

export function playShutter() {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime + 0.005;
  // shutter opens
  click(ctx, t, 3200, 1.2, 0.03, 0.5);
  click(ctx, t, 900, 0.8, 0.045, 0.35);
  thump(ctx, t, 220, 90, 0.05, 0.3);
  // mechanism travelling
  click(ctx, t + 0.03, 1800, 0.6, 0.06, 0.07, "highpass");
  // shutter closes
  click(ctx, t + 0.085, 4200, 1.4, 0.025, 0.42);
  click(ctx, t + 0.085, 1200, 0.9, 0.04, 0.3);
  thump(ctx, t + 0.085, 180, 70, 0.045, 0.22);
}
