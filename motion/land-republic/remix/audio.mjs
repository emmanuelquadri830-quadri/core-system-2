// Remix sound pass: the first film's score and beat grid, the remix cues, and
// a voice for the pin. Every flight in PIN_MOVES gets a whoosh that starts
// at launch, crests just before touchdown and pans from where the pin was to
// where it lands; every landing on screen gets a short tap tuned to the chord
// under it. Masters to -14 LUFS integrated, true peak under -1 dBTP.
//
//   node remix/audio.mjs   ->  build/audio/remix-sfx.wav, remix-mix.wav

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Bus, sec, db, mtof, osc, mul, sum, gain, edges, filter, noise, readWav, writeWav, reverb, lufs, highpassBus } from '../audio/dsp.mjs';
import * as I from '../audio/instruments.mjs';
import { cueSound, addPanned, master } from '../audio/sfxkit.mjs';
import { CUES, DURATION, PIN_MOVES, LAUNCH, counterTicks } from './timeline.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const grid = JSON.parse(fs.readFileSync(path.join(root, 'beats.json'), 'utf8'));
const timeOf = (beat) => grid.offset + beat * grid.period;

const N = sec(DURATION);
const sfx = new Bus(N);
const space = new Bus(N);
const clampPan = (p) => Math.max(-0.9, Math.min(0.9, p));
const panOf = (x) => clampPan((x - 0.5) * 1.7);

// ------------------------------------------------------------------ cues

const POP_NOTES = { 'ui-1': 81, 'ui-2': 84, 'ui-3': 86, 'ui-4': 89, 'civic-f3': 86, 'mowe-f3': 89 };
// Where on screen a cue's object moves, when it is not the centre.
const CUE_PAN = { 'civic-in': 0.45, 'mowe-in': 0.45, 'source-in': 0.5, boundary: 0.45, 'civic-title': 0.25, 'mowe-title': 0.25 };

const placed = [];
CUES.forEach((c, idx) => {
  const t = timeOf(c.beat);
  const s = cueSound(c, idx, { period: grid.period, counterTicks, popNotes: POP_NOTES });
  const pan = CUE_PAN[c.tag] ?? s.pan;
  const start = sec(t) - sec(s.lead);
  sfx.add(s.sig, start, 1, pan);
  if (s.wet) space.add(s.sig, start, s.wet, pan);
  placed.push({ tag: c.tag, kind: c.kind, beat: c.beat, t: +t.toFixed(4) });
});

// ------------------------------------------------------------------ the pin

// Landing notes follow the chord of the bar (audio/score.mjs BAR_CHORD):
// Dm on the hook, F on the brand, Bb and F on the listings, Gm9 on the
// proof, C on the close, F on the logo.
const LAND_NOTE = {
  'w-finding': 86, 'w-the': 81, 'w-land': 89, 'w-shouldnt': 86, 'w-be': 81, 'w-hard': 93,
  'path-end': 89, civic: 86, mowe: 89, plot: 84, badge: 86, period: 88, home: 91, logo: 93,
};
const offscreen = (m) => /exit|away/.test(m.to);

// A thin sung line under the trail: the pin "writes" the headline.
function inkTone(durSec, fromMidi, toMidi) {
  const n = sec(durSec);
  const f = (i) => mtof(fromMidi) * Math.pow(mtof(toMidi) / mtof(fromMidi), Math.pow(i / n, 0.6));
  const tone = osc('sine', n, f);
  const air = filter(noise(n, 907), 'bp', (i) => 2 * f(i), 3);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) env[i] = Math.pow(Math.sin(Math.PI * Math.min(1, (i / n) * 1.15)), 1.4);
  return edges(mul(sum(gain(tone, 0.6), gain(air, 0.5)), env), 0.01, 0.02);
}

const flights = [];
let prevX = null;
PIN_MOVES.forEach((m, k) => {
  const land = timeOf(m.at);
  const launch = m.trail ? timeOf(8) : land - LAUNCH;
  const fromX = m.from ?? prevX ?? m.x;
  prevX = m.x;
  const dist = Math.min(1, Math.abs(m.x - fromX) / 0.6);
  const seed = 5000 + k * 31;
  const pA = panOf(fromX);
  const pB = panOf(m.x);

  if (m.trail) {
    // 8 to 9.75: the long draw across the headline, left to right.
    const dur = land - launch + 0.12;
    const air = I.whoosh(dur, { from: 500, peak: 2600, to: 1400, seed });
    addPanned(sfx, air, sec(launch), db(-13), pA, pB, (x) => 1 - Math.pow(1 - x, 2));
    addPanned(sfx, inkTone(dur, 77, 89), sec(launch), db(-21), pA, pB, (x) => 1 - Math.pow(1 - x, 2));
  } else if (m.dart) {
    // Searching the city: three quick, bright darts.
    const sw = I.whoosh(0.13, { from: 900, peak: 6200, to: 2200, seed });
    addPanned(sfx, sw, sec(land - 0.1), db(-15), pA, pB);
    sfx.add(I.tickSnd({ hz: 5200, seed }).map((v) => v * db(-17)), sec(land), 1, pB);
  } else {
    // A flight: bigger moves are louder and brighter; hops arc higher.
    const dur = m.hop ? 0.3 : offscreen(m) ? 0.3 : 0.26;
    const peak = (m.hop ? 5200 : 3000) + 1800 * dist;
    const sw = I.whoosh(dur, { from: 320, peak, to: offscreen(m) ? 500 : 800, seed });
    const g = db(m.hop ? -10 : -11.5) * (0.55 + 0.6 * dist);
    addPanned(sfx, sw, sec(launch - 0.03), g, pA, pB);
    space.add(sw, sec(launch - 0.03), 0.06 * g, pB);
  }

  // Touchdown, when it happens on screen.
  if (!offscreen(m) && !m.dart && LAND_NOTE[m.to]) {
    const tap = I.pin({ seed, midi: LAND_NOTE[m.to] });
    // Where another cue already hits (the words' slams, the logo's lock) the
    // tap sits under it; on its own it carries the landing.
    const shared = CUES.some((c) => Math.abs(c.beat - m.at) < 0.07);
    const g = db(shared ? -13 : -8);
    sfx.add(tap, sec(land), g, pB);
    space.add(tap, sec(land), g * 0.25, pB);
  }
  if (m.vanish) {
    // The pin sinks into the mark: a short inhale into the lock, then the
    // mark's note.
    const inhale = I.swell(0.16, { seed: seed + 1 });
    sfx.add(inhale, sec(land - 0.16), db(-15), pB);
    const ring = I.bell(LAND_NOTE.logo, { decay: 0.7, index: 0.9 });
    sfx.add(ring, sec(land + 0.02), db(-17), pB);
    space.add(ring, sec(land + 0.02), db(-17) * 0.5, pB);
  }
  flights.push({ to: m.to, beat: m.at, launch: +launch.toFixed(4), land: +land.toFixed(4), pan: [+pA.toFixed(2), +pB.toFixed(2)] });
});

const [rl, rr] = reverb(space.L, space.R, { room: 0.78, damp: 0.45, predelay: 0.012 });
sfx.addStereo(rl, rr, 0, db(-2));
const out = path.join(root, 'build', 'audio');
writeWav(path.join(out, 'remix-sfx.wav'), sfx.L, sfx.R, fs);

// ---------------------------------------------------------------- master

const music = readWav(path.join(out, 'music.wav'), fs);
const mix = new Bus(N);
mix.addStereo(music.L, music.R, 0, db(-1.5));
mix.addStereo(sfx.L, sfx.R, 0, db(0));
highpassBus(mix, 22);
const result = master(mix);
writeWav(path.join(out, 'remix-mix.wav'), result.bus.L, result.bus.R, fs);
fs.writeFileSync(path.join(out, 'remix-cues.json'), JSON.stringify({ cues: placed, pin: flights }, null, 1));
console.log(`music alone ${lufs(music.L, music.R).toFixed(1)} LUFS, sfx alone ${lufs(sfx.L, sfx.R).toFixed(1)} LUFS`);
console.log(`master: ${result.lu.toFixed(2)} LUFS, true peak ${result.tp.toFixed(2)} dBTP, limiter max reduction ${result.red.toFixed(2)} dB, gain ${result.gainDb.toFixed(2)} dB, ${placed.length} cues, ${flights.length} pin moves`);
