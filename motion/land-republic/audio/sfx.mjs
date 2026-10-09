// Places every sound cue from timeline.mjs on the measured grid in
// beats.json, mixes it over the music and masters to -14 LUFS integrated with
// true peak under -1 dBTP. Writes build/audio/sfx.wav and build/audio/mix.wav.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Bus, sec, db, readWav, writeWav, reverb, lufs, highpassBus } from './dsp.mjs';
import { cueSound, master } from './sfxkit.mjs';
import { CUES, DURATION, counterTicks } from '../timeline.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const grid = JSON.parse(fs.readFileSync(path.join(root, 'beats.json'), 'utf8'));
const timeOf = (beat) => grid.offset + beat * grid.period;

const N = sec(DURATION);
const sfx = new Bus(N);
const space = new Bus(N);

// Pops and pins are tuned to the chord under them, so the interface sounds
// play along with the track instead of on top of it.
const POP_NOTES = { 'ui-1': 81, 'ui-2': 84, 'ui-3': 86, 'ui-4': 89, 'lock-1': 82, 'lock-2': 86, 'lock-3': 89, name: 94, 'source-card': 86 };
const PIN_NOTES = { 'pin-1': 81, 'pin-2': 84 };

const placed = [];
CUES.forEach((c, idx) => {
  const t = timeOf(c.beat);
  const { sig, pan, wet, lead } = cueSound(c, idx, { period: grid.period, counterTicks, popNotes: POP_NOTES, pinNotes: PIN_NOTES });
  const start = sec(t) - sec(lead);
  sfx.add(sig, start, 1, pan);
  if (wet) space.add(sig, start, wet, pan);
  placed.push({ tag: c.tag, kind: c.kind, beat: c.beat, t: +t.toFixed(4) });
});

const [rl, rr] = reverb(space.L, space.R, { room: 0.78, damp: 0.45, predelay: 0.012 });
sfx.addStereo(rl, rr, 0, db(-2));
writeWav(path.join(root, 'build', 'audio', 'sfx.wav'), sfx.L, sfx.R, fs);

// ---------------------------------------------------------------- master

const music = readWav(path.join(root, 'build', 'audio', 'music.wav'), fs);
const mix = new Bus(N);
mix.addStereo(music.L, music.R, 0, db(-1.5));
mix.addStereo(sfx.L, sfx.R, 0, db(0));
highpassBus(mix, 22);

const result = master(mix);
const tp = result.tp;
writeWav(path.join(root, 'build', 'audio', 'mix.wav'), result.bus.L, result.bus.R, fs);
fs.writeFileSync(path.join(root, 'build', 'audio', 'cues.json'), JSON.stringify(placed, null, 1));
console.log(`music alone ${lufs(music.L, music.R).toFixed(1)} LUFS, sfx alone ${lufs(sfx.L, sfx.R).toFixed(1)} LUFS`);
console.log(`master: ${result.lu.toFixed(2)} LUFS, true peak ${tp.toFixed(2)} dBTP, limiter max reduction ${result.red.toFixed(2)} dB, gain ${result.gainDb.toFixed(2)} dB, ${placed.length} cues`);
