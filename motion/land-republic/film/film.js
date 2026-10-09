// Film entry. window.seek(t) paints frame t and nothing else: no transitions,
// no timers, no animation frames in render mode, no state between frames.

import { makeClock, preload } from './engine.js';
import { SECTIONS, CUES, DURATION, FPS } from '../timeline.mjs';

const params = new URLSearchParams(location.search);
const AR = params.get('ar') || '16x9';
const RENDER = params.has('render');
const SIZES = { '16x9': [1920, 1080], '1x1': [1080, 1080], '9x16': [1080, 1920] };
const [W, H] = SIZES[AR];

const stage = document.getElementById('stage');
stage.style.width = `${W}px`;
stage.style.height = `${H}px`;
document.documentElement.dataset.ar = AR;

const grid = await (await fetch('../beats.json', { cache: 'no-store' })).json();
const manifest = await fetch('../assets/manifest.json', { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null);
const clock = makeClock(grid);

const cueBeat = (tag) => {
  const c = CUES.find((x) => x.tag === tag);
  if (!c) throw new Error(`unknown cue ${tag}`);
  return c.beat;
};

// Brand tokens and faces come from the captured site, never from guesses.
if (manifest) {
  const b = manifest.brand;
  const rs = document.documentElement.style;
  for (const [k, v] of Object.entries(b.colors || {})) rs.setProperty(`--${k}`, v);
  for (const f of manifest.fonts || []) {
    const face = new FontFace(f.family, `url(../assets/${f.file})`, { weight: f.weight || '400', style: f.style || 'normal' });
    document.fonts.add(face);
    await face.load().catch((e) => console.error('font failed', f.file, e));
  }
  if (b.display) rs.setProperty('--display', b.display);
  if (b.ui) rs.setProperty('--ui', b.ui);
}

const logoParts = manifest ? (await (await fetch(`../assets/${manifest.logo.parts}`)).json()).parts : [];

export const ctx = {
  logoParts,
  stage,
  W,
  H,
  AR,
  portrait: AR === '9x16',
  square: AR === '1x1',
  clock,
  T: (beat) => clock.t(beat),           // beat number to seconds on the measured grid
  cueT: (tag) => clock.t(cueBeat(tag)), // a sound cue to seconds
  section: (id) => {
    const s = SECTIONS.find((x) => x.id === id);
    return { from: clock.t(s.from), to: clock.t(s.to) };
  },
  manifest,
  asset: (file) => `../assets/${file}`,
  // pick a layout value per aspect ratio: L({ '16x9': a, '1x1': b, '9x16': c })
  L: (o) => (AR in o ? o[AR] : o.default),
};

const order = (params.get('scenes') || 'hook,site,montage,trust,proof,next,lockup').split(',');
const scenes = [];
for (const id of order) {
  try {
    const mod = await import(`./scenes/${id}.js`);
    scenes.push(mod.default(ctx));
  } catch (e) {
    if (!String(e).includes('Failed to fetch dynamically imported module')) throw e;
  }
}

// Scenes outside their window are not rendered at all, and a scene that is
// on gets every property rewritten, so no frame depends on the one before.
window.seek = (t) => {
  for (const s of scenes) {
    const on = t >= s.from && t < s.to;
    s.root.style.display = on ? 'block' : 'none';
    if (on) s.update(t);
  }
};
// Hard cuts: scene edges plus any cuts a scene declares. The renderer keeps
// a frame's motion-blur samples on one side of a cut, never across it.
const cuts = [...new Set(scenes.flatMap((s) => [s.from, s.to, ...(s.cuts || [])]))]
  .filter((c) => c > 0 && c < DURATION)
  .sort((a, b) => a - b);
window.filmInfo = { duration: DURATION, fps: FPS, width: W, height: H, ar: AR, scenes: scenes.map((s) => s.id), cuts };
window.ready = (async () => {
  await preload(stage);
  window.seek(0);
  return true;
})();

// Preview only: a scrubber and playback against the mixed score.
if (!RENDER) {
  const dock = document.getElementById('dock');
  dock.hidden = false;
  const scrub = document.getElementById('scrub');
  const out = document.getElementById('time');
  const play = document.getElementById('play');
  const arSel = document.getElementById('ar');
  arSel.value = AR;
  arSel.onchange = () => {
    params.set('ar', arSel.value);
    location.search = params.toString();
  };
  const audio = new Audio('../build/audio/mix.wav');
  const fit = () => {
    const k = Math.min(innerWidth / W, (innerHeight - 50) / H);
    stage.style.transformOrigin = '0 0';
    stage.style.transform = `scale(${k})`;
  };
  fit();
  addEventListener('resize', fit);
  const show = (t) => {
    window.seek(t);
    scrub.value = t;
    out.textContent = t.toFixed(2);
  };
  scrub.oninput = () => {
    audio.pause();
    play.textContent = 'Play';
    audio.currentTime = +scrub.value;
    show(+scrub.value);
  };
  play.onclick = () => {
    if (audio.paused) {
      audio.play();
      play.textContent = 'Pause';
      const loop = () => {
        if (audio.paused) return;
        show(audio.currentTime);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } else {
      audio.pause();
      play.textContent = 'Play';
    }
  };
  const t0 = params.get('t');
  if (t0) show(+t0);
}
