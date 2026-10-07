// Single source of truth for timing. The film and the sound design both read
// this file, then convert beat numbers to seconds through the measured grid in
// beats.json, so a visual hit and its sound can never drift apart.

export const BPM = 120;
export const BEATS = 40;            // 10 bars of 4/4 = 20 seconds
export const DURATION = 20;
export const FPS = 30;

// Story sections, in beats. Every section starts on a bar line.
// `hero` is the beat the review sheet uses as the section's representative frame.
export const SECTIONS = [
  { id: 'hook',     from: 0,  to: 8,  hero: 6.6,  label: 'Hook: the problem' },
  { id: 'brand',    from: 8,  to: 12, hero: 10.6, label: 'Land Republic appears' },
  { id: 'discover', from: 12, to: 20, hero: 15.6, label: 'Property discovery' },
  { id: 'montage',  from: 20, to: 24, hero: 21.6, label: 'Explore real properties' },
  { id: 'trust',    from: 24, to: 28, hero: 26.8, label: 'Trust and investment' },
  { id: 'proof',    from: 28, to: 32, hero: 30.0, label: 'Proof point' },
  { id: 'next',     from: 32, to: 36, hero: 33.8, label: 'Find your next property' },
  { id: 'lockup',   from: 36, to: 40, hero: 38.8, label: 'Logo lockup' },
];

// Sound cues. `beat` may be fractional (0.5 = an eighth note later).
// `kind` picks a synthesized sound in audio/sfx.mjs. `gain` is linear.
// The film reads the same list, so every click, slam and cut is drawn on the
// frame where its sound starts.
export const CUES = [
  // Hook: words slam in on the beat, chatter on the gap, whoosh into the drop.
  { beat: 0,    kind: 'slam',    gain: 1.0,  tag: 'w-finding' },
  { beat: 1,    kind: 'slam',    gain: 0.8,  tag: 'w-theright' },
  { beat: 2,    kind: 'slam',    gain: 1.0,  tag: 'w-land' },
  { beat: 3,    kind: 'chatter', gain: 0.6,  tag: 'chaos' },
  { beat: 4,    kind: 'slam',    gain: 0.9,  tag: 'w-shouldnt' },
  { beat: 5,    kind: 'slam',    gain: 0.8,  tag: 'w-bethis' },
  { beat: 6,    kind: 'slamBig', gain: 1.0,  tag: 'w-hard' },
  { beat: 7,    kind: 'whooshIn', gain: 0.7, tag: 'to-drop' },

  // Brand: drop, then real UI pieces lock into place one by one.
  { beat: 8,    kind: 'impact',  gain: 0.9,  tag: 'drop' },
  { beat: 8.5,  kind: 'pop',     gain: 0.55, tag: 'ui-1' },
  { beat: 9,    kind: 'pop',     gain: 0.55, tag: 'ui-2' },
  { beat: 9.5,  kind: 'pop',     gain: 0.55, tag: 'ui-3' },
  { beat: 10,   kind: 'pop',     gain: 0.6,  tag: 'ui-4' },
  { beat: 11,   kind: 'tick',    gain: 0.5,  tag: 'cursor-in' },

  // Discovery: four real clicks, each on a beat.
  { beat: 12.75, kind: 'hover',  gain: 0.4,  tag: 'hover-1' },
  { beat: 13,   kind: 'click',   gain: 0.9,  tag: 'click-browse' },
  { beat: 13.5, kind: 'swipe',   gain: 0.5,  tag: 'scroll-1' },
  { beat: 14.75, kind: 'hover',  gain: 0.4,  tag: 'hover-2' },
  { beat: 15,   kind: 'click',   gain: 0.9,  tag: 'click-location' },
  { beat: 15.5, kind: 'confirm', gain: 0.5,  tag: 'location-set' },
  { beat: 16.75, kind: 'hover',  gain: 0.4,  tag: 'hover-3' },
  { beat: 17,   kind: 'click',   gain: 0.9,  tag: 'click-filter' },
  { beat: 17.5, kind: 'pop',     gain: 0.45, tag: 'results' },
  { beat: 18.75, kind: 'hover',  gain: 0.4,  tag: 'hover-4' },
  { beat: 19,   kind: 'click',   gain: 0.9,  tag: 'click-open' },
  { beat: 19.5, kind: 'whoosh',  gain: 0.6,  tag: 'open-listing' },

  // Montage: one cut per beat, a tag pop on each price.
  { beat: 20,   kind: 'whoosh',  gain: 0.55, tag: 'cut-1' },
  { beat: 20.5, kind: 'pop',     gain: 0.4,  tag: 'price-1' },
  { beat: 21,   kind: 'whoosh',  gain: 0.55, tag: 'cut-2' },
  { beat: 21.5, kind: 'pop',     gain: 0.4,  tag: 'price-2' },
  { beat: 22,   kind: 'whoosh',  gain: 0.55, tag: 'cut-3' },
  { beat: 22.5, kind: 'pop',     gain: 0.4,  tag: 'price-3' },
  { beat: 23,   kind: 'whoosh',  gain: 0.55, tag: 'cut-4' },
  { beat: 23.5, kind: 'pop',     gain: 0.4,  tag: 'price-4' },

  // Trust: three phrases on three beats, then pins and the boundary.
  { beat: 24,   kind: 'slam',    gain: 0.9,  tag: 'w-findit' },
  { beat: 25,   kind: 'slam',    gain: 0.9,  tag: 'w-ownit' },
  { beat: 26,   kind: 'slamBig', gain: 0.9,  tag: 'w-buildonit' },
  { beat: 26.5, kind: 'pin',     gain: 0.6,  tag: 'pin-1' },
  { beat: 27,   kind: 'pin',     gain: 0.6,  tag: 'pin-2' },
  { beat: 27.5, kind: 'stamp',   gain: 0.6,  tag: 'verified' },

  // Proof: the break. One heavy hit, then the counter.
  { beat: 28,   kind: 'impact',  gain: 1.0,  tag: 'proof' },
  { beat: 28.25, kind: 'counter', gain: 0.45, tag: 'count' },
  { beat: 30,   kind: 'whooshIn', gain: 0.6, tag: 'to-next' },

  // Next: back in.
  { beat: 32,   kind: 'slam',    gain: 0.9,  tag: 'w-findyournext' },
  { beat: 33,   kind: 'slam',    gain: 0.7,  tag: 'w-property' },
  { beat: 35,   kind: 'whooshIn', gain: 0.6, tag: 'to-logo' },

  // Lockup.
  { beat: 36,   kind: 'impact',  gain: 0.9,  tag: 'logo' },
  { beat: 36.5, kind: 'lock',    gain: 0.6,  tag: 'logo-lock' },
  { beat: 37,   kind: 'tick',    gain: 0.4,  tag: 'tagline' },
  { beat: 38,   kind: 'type',    gain: 0.35, tag: 'url' },
];

export const sectionAt = (beat) =>
  SECTIONS.find((s) => beat >= s.from && beat < s.to) || SECTIONS[SECTIONS.length - 1];

export const cue = (tag) => {
  const c = CUES.find((x) => x.tag === tag);
  if (!c) throw new Error(`unknown cue ${tag}`);
  return c;
};
