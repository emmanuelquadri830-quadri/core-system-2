// Location film: 15 seconds at 80 BPM (20 beats of 0.75 s). Same contract as
// the first film: the film and the sound read these cues and convert beats
// to seconds through location/beats.json, measured from the rendered score.

export const BPM = 80;
export const BEATS = 20;
export const DURATION = 15;
export const FPS = 30;

export const SECTIONS = [
  { id: 'discovery', from: 0, to: 4, hero: 2.6, label: 'The discovery' },
  { id: 'journey', from: 4, to: 8, hero: 7.2, label: 'The journey' },
  { id: 'reveal', from: 8, to: 13, hero: 11.4, label: 'The reveal' },
  { id: 'value', from: 13, to: 17, hero: 16.2, label: 'The value' },
  { id: 'brand', from: 17, to: 20, hero: 19.4, label: 'The brand moment' },
];

export const CUES = [
  { beat: 0.67, kind: 'tick', gain: 0.3, tag: 'line-1' },
  { beat: 1.33, kind: 'tick', gain: 0.3, tag: 'line-2' },
  { beat: 4, kind: 'whooshSoft', gain: 0.6, tag: 'dive' },
  { beat: 4.67, kind: 'tick', gain: 0.4, tag: 'label-lagos' },
  { beat: 5.33, kind: 'swipe', gain: 0.4, tag: 'route' },
  { beat: 6, kind: 'tick', gain: 0.35, tag: 'label-lekki' },
  { beat: 6.67, kind: 'pin', gain: 0.55, tag: 'pin-ajah' },
  { beat: 7.33, kind: 'whooshSoft', gain: 0.5, tag: 'lens' },
  { beat: 8, kind: 'boom', gain: 0.8, tag: 'reveal' },
  { beat: 8.67, kind: 'swipe', gain: 0.4, tag: 'boundary' },
  { beat: 9.33, kind: 'tick', gain: 0.4, tag: 'tag-civic' },
  { beat: 11, kind: 'tick', gain: 0.3, tag: 'line-build' },
  { beat: 10.67, kind: 'whooshSoft', gain: 0.55, tag: 'to-elevation' },
  { beat: 11.67, kind: 'tick', gain: 0.3, tag: 'line-next' },
  { beat: 13, kind: 'tick', gain: 0.4, tag: 'callout-1' },
  { beat: 13.67, kind: 'tick', gain: 0.4, tag: 'callout-2' },
  { beat: 14.67, kind: 'pop', gain: 0.4, tag: 'price' },
  { beat: 15.33, kind: 'pop', gain: 0.4, tag: 'deposit' },
  { beat: 17, kind: 'boom', gain: 0.6, tag: 'brand' },
  { beat: 17.67, kind: 'lock', gain: 0.45, tag: 'logo' },
  { beat: 18, kind: 'tick', gain: 0.3, tag: 'tagline' },
  { beat: 18.5, kind: 'tick', gain: 0.3, tag: 'url' },
];

// Places, lon/lat. Area-level public coordinates; no building is pinned
// because the exact site address was not supplied.
export const PLACES = {
  lagos: { name: 'LAGOS', lon: 3.395, lat: 6.454 },
  lekki: { name: 'LEKKI', lon: 3.474, lat: 6.44 },
  ajah: { name: 'LEKKI AJAH', lon: 3.5718, lat: 6.4683 },
};
export const ROUTE = [[3.395, 6.454], [3.43, 6.437], [3.474, 6.44], [3.52, 6.446], [3.5718, 6.4683]];
