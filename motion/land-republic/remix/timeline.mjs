// Remix of the first film: same 120 BPM score and beat grid (../beats.json),
// re-cut around one moving object, the Land Republic pin, which carries the
// story from the first frame to the last. Every pin move is listed in
// PIN_MOVES so the sound pass can pan its whoosh with it.

export const BPM = 120;
export const BEATS = 40;
export const DURATION = 20;
export const FPS = 30;

export const SECTIONS = [
  { id: 'hook', from: 0, to: 8, hero: 6.4, label: 'Hook: the pin places the problem' },
  { id: 'brand', from: 8, to: 12, hero: 9.9, label: 'The pin draws the path' },
  { id: 'discover', from: 12, to: 20, hero: 17.6, label: 'Real site, real clicks' },
  { id: 'listings', from: 20, to: 26, hero: 24.9, label: 'Civic Apartment and Mowe Prime' },
  { id: 'trust', from: 26, to: 28, hero: 27.8, label: 'Find it. Own it. Build on it.' },
  { id: 'proof', from: 28, to: 32, hero: 30.2, label: 'Proof: initial deposit' },
  { id: 'next', from: 32, to: 36, hero: 34.6, label: 'Find your next property.' },
  { id: 'lockup', from: 36, to: 40, hero: 39.2, label: 'Logo lockup' },
];

// The pin's flight plan. `at` is the beat it lands; it launches LAUNCH
// seconds before. `to` names a target the film resolves from its layout;
// `x` is that target's rough horizontal position (0..1) for panning sound,
// `from` where the pin enters from when it comes back on screen.
export const LAUNCH = 0.16;
export const PIN_MOVES = [
  { at: 0, to: 'w-finding', x: 0.2, from: -0.05 },
  { at: 1, to: 'w-the', x: 0.5 },
  { at: 2, to: 'w-land', x: 0.45 },
  { at: 3, to: 'search-1', x: 0.82, dart: true },
  { at: 3.25, to: 'search-2', x: 0.66, dart: true },
  { at: 3.5, to: 'search-3', x: 0.9, dart: true },
  { at: 4, to: 'w-shouldnt', x: 0.25 },
  { at: 5, to: 'w-be', x: 0.62 },
  { at: 6, to: 'w-hard', x: 0.48, slam: true },
  { at: 7.5, to: 'exit-top', x: 0.55 },
  { at: 8, to: 'path-start', x: 0.1, from: 0.1 },
  { at: 9.75, to: 'path-end', x: 0.9, trail: true },
  { at: 11, to: 'away', x: 1.05 },
  { at: 21, to: 'civic', x: 0.42, from: 1.05 },
  { at: 24, to: 'mowe', x: 0.42, hop: true },
  { at: 26.25, to: 'plot', x: 0.7 },
  { at: 29.5, to: 'badge', x: 0.8, from: 0.95 },
  { at: 31, to: 'proof-exit', x: 0.86 },
  { at: 34, to: 'period', x: 0.45, from: 0.62 },
  { at: 35.5, to: 'home', x: 0.5, hop: true },
  { at: 36.5, to: 'logo', x: 0.2, vanish: true },
];

export const CUES = [
  // hook
  { beat: 0, kind: 'slam', gain: 0.9, tag: 'w-finding' },
  { beat: 1, kind: 'slam', gain: 0.75, tag: 'w-theright' },
  { beat: 2, kind: 'slam', gain: 0.9, tag: 'w-land' },
  { beat: 4, kind: 'slam', gain: 0.85, tag: 'w-shouldnt' },
  { beat: 5, kind: 'slam', gain: 0.75, tag: 'w-bethis' },
  { beat: 6, kind: 'slamBig', gain: 1.0, tag: 'w-hard' },
  { beat: 7, kind: 'whooshIn', gain: 0.6, tag: 'to-drop' },
  // brand
  { beat: 8, kind: 'impact', gain: 0.85, tag: 'drop' },
  { beat: 10, kind: 'pop', gain: 0.5, tag: 'ui-1' },
  { beat: 10.25, kind: 'pop', gain: 0.5, tag: 'ui-2' },
  { beat: 10.5, kind: 'pop', gain: 0.5, tag: 'ui-3' },
  { beat: 10.75, kind: 'pop', gain: 0.55, tag: 'ui-4' },
  { beat: 11, kind: 'tick', gain: 0.45, tag: 'cursor-in' },
  // discovery, unchanged from the first film
  { beat: 12.75, kind: 'hover', gain: 0.4, tag: 'hover-1' },
  { beat: 13, kind: 'click', gain: 0.9, tag: 'click-nav' },
  { beat: 13.5, kind: 'swipe', gain: 0.5, tag: 'scroll-1' },
  { beat: 14.75, kind: 'hover', gain: 0.4, tag: 'hover-2' },
  { beat: 15, kind: 'click', gain: 0.9, tag: 'click-learn' },
  { beat: 15.5, kind: 'swipe', gain: 0.5, tag: 'scroll-2' },
  { beat: 16.75, kind: 'hover', gain: 0.4, tag: 'hover-3' },
  { beat: 17, kind: 'click', gain: 0.9, tag: 'click-verified' },
  { beat: 17.5, kind: 'confirm', gain: 0.5, tag: 'verified-lift' },
  { beat: 18.75, kind: 'hover', gain: 0.4, tag: 'hover-4' },
  { beat: 19, kind: 'click', gain: 0.9, tag: 'click-open' },
  { beat: 19.5, kind: 'whoosh', gain: 0.6, tag: 'open-listing' },
  // listings
  { beat: 20, kind: 'whoosh', gain: 0.55, tag: 'civic-in' },
  { beat: 20.5, kind: 'tick', gain: 0.4, tag: 'civic-title' },
  { beat: 21.5, kind: 'tick', gain: 0.35, tag: 'civic-f1' },
  { beat: 21.75, kind: 'tick', gain: 0.35, tag: 'civic-f2' },
  { beat: 22, kind: 'pop', gain: 0.45, tag: 'civic-f3' },
  { beat: 23, kind: 'whoosh', gain: 0.55, tag: 'mowe-in' },
  { beat: 23.5, kind: 'tick', gain: 0.4, tag: 'mowe-title' },
  { beat: 24.5, kind: 'tick', gain: 0.35, tag: 'mowe-f1' },
  { beat: 24.75, kind: 'tick', gain: 0.35, tag: 'mowe-f2' },
  { beat: 25, kind: 'pop', gain: 0.45, tag: 'mowe-f3' },
  // trust
  { beat: 26, kind: 'slam', gain: 0.85, tag: 'w-findit' },
  { beat: 26.5, kind: 'slam', gain: 0.8, tag: 'w-ownit' },
  { beat: 26.6, kind: 'swipe', gain: 0.4, tag: 'boundary' },
  { beat: 27, kind: 'slamBig', gain: 0.62, tag: 'w-buildonit' },
  { beat: 27.5, kind: 'stamp', gain: 0.6, tag: 'verified' },
  // proof
  { beat: 28, kind: 'impact', gain: 1.0, tag: 'proof' },
  { beat: 28.25, kind: 'counter', gain: 0.45, tag: 'count' },
  { beat: 29, kind: 'swipe', gain: 0.45, tag: 'source-in' },
  { beat: 30, kind: 'whooshIn', gain: 0.6, tag: 'to-next' },
  // next
  { beat: 32, kind: 'slam', gain: 0.9, tag: 'w-findyournext' },
  { beat: 33, kind: 'slam', gain: 0.7, tag: 'w-property' },
  { beat: 35, kind: 'whooshIn', gain: 0.6, tag: 'to-logo' },
  // lockup
  { beat: 36, kind: 'impact', gain: 0.85, tag: 'logo' },
  { beat: 36.5, kind: 'lock', gain: 0.6, tag: 'logo-lock' },
  { beat: 37, kind: 'tick', gain: 0.35, tag: 't-discover' },
  { beat: 37.5, kind: 'tick', gain: 0.35, tag: 't-invest' },
  { beat: 38, kind: 'tick', gain: 0.35, tag: 't-own' },
  { beat: 38.5, kind: 'tick', gain: 0.4, tag: 'url' },
];

export { COUNTER, counterTicks } from '../timeline.mjs';
