// The Loom script, one cue per spoken sentence or two.
// text = what the subtitles show and what you read aloud.
// say  = how the AI voice should pronounce it (numbers and codes spelled out).
// gap  = pause after the line, in seconds (longer where the screen demonstrates something).

const CUES = [
  { id: 'c1', part: 1, text: 'Hi, I am a product designer based in Lagos.', gap: 0.45 },
  { id: 'c2', part: 1, text: 'For more than 5 years I have designed mobile apps and websites, from early research to the screens developers build.', say: 'For more than five years I have designed mobile apps and websites, from early research to the screens developers build.', gap: 0.5 },
  { id: 'c3', part: 1, text: "Today I design for VivaFemini, a women's health app.", say: "Today I design for Viva Femini, a women's health app.", gap: 0.45 },
  { id: 'c4', part: 1, text: 'Before that I was at Punch, a digital agency, where I designed for many different clients and learned to explain and defend every decision I made.', gap: 0.7 },
  { id: 'c5', part: 1, text: 'Why do I fit a senior role? Because I look past the pixels and ask whether people can trust the screen.', gap: 0.6 },
  { id: 'c6', part: 1, text: 'On the old VivaFemini home screen, it said cycle day 21, and right under it, day 3 of 5 of the period.', say: 'On the old Viva Femini home screen, it said cycle day twenty one, and right under it, day three of five of the period.', gap: 0.6 },
  { id: 'c7', part: 1, text: 'The progress bar was half full, but the label said 11 percent.', say: 'The progress bar was half full, but the label said eleven percent.', gap: 0.7 },
  { id: 'c8', part: 1, text: 'In my redesign, every number tells the same story.', gap: 0.9 },
  { id: 'c9', part: 1, text: 'Day 3 of a 28-day cycle is 11 percent, so the bar shows 11 percent.', say: 'Day three of a twenty eight day cycle is eleven percent, so the bar shows eleven percent.', gap: 0.6 },
  { id: 'c10', part: 1, text: 'That is the standard I would bring to your team.', gap: 1.3 },

  { id: 'c11', part: 2, text: 'Now, design systems.', gap: 0.9 },
  { id: 'c12', part: 2, text: 'For me, a design system is a shared language between designers and developers, not a sticker sheet.', gap: 0.6 },
  { id: 'c13', part: 2, text: 'I build it in three layers.', gap: 0.8 },
  { id: 'c14', part: 2, text: 'The first layer is tokens: colour, type, spacing, corner radius and motion.', say: 'The first layer is tokens: color, type, spacing, corner radius and motion.', gap: 0.8 },
  { id: 'c15', part: 2, text: 'Our main pink is FB3179, and the deeper pink, E01B66, marks period days.', say: 'Our main pink is F B 3 1 7 9, and the deeper pink, E 0 1 B 6 6, marks period days.', gap: 0.7 },
  { id: 'c16', part: 2, text: 'White text on that deeper pink has a contrast ratio of about 4.6 to 1, so it passes WCAG AA.', say: 'White text on that deeper pink has a contrast ratio of about four point six to one, so it passes W C A G double A.', gap: 0.9 },
  { id: 'c17', part: 2, text: 'The second layer is components.', gap: 0.4 },
  { id: 'c18', part: 2, text: 'This day circle is one component with four states: a regular day, a period day that is filled, today with a double ring, and predicted period days with a dashed outline.', gap: 0.9 },
  { id: 'c19', part: 2, text: 'Each circle is 44 by 44 points, the minimum touch target Apple recommends.', say: 'Each circle is forty four by forty four points, the minimum touch target Apple recommends.', gap: 0.8 },
  { id: 'c20', part: 2, text: 'Because every screen is built from these pieces, one change to a token updates everything that uses it.', gap: 0.4 },
  { id: 'c21', part: 2, text: 'Watch the whole week change at once.', gap: 2.4 },
  { id: 'c22', part: 2, text: 'The third layer is documentation.', gap: 0.4 },
  { id: 'c23', part: 2, text: 'Every component has notes on when to use it, its states, and what developers need to build it, so the app and the Figma file never drift apart.', gap: 1.3 },

  { id: 'c24', part: 3, text: 'Now, animation.', gap: 0.9 },
  { id: 'c25', part: 3, text: 'I use motion to explain, not to decorate.', gap: 0.5 },
  { id: 'c26', part: 3, text: 'Every animation I design has one of three jobs: confirm an action, show where something came from, or connect one state to the next.', gap: 0.9 },
  { id: 'c27', part: 3, text: 'When someone logs a period day, the circle fills in 250 milliseconds with an ease-out curve, and the small dot drops in just after.', say: 'When someone logs a period day, the circle fills in two hundred and fifty milliseconds with an ease out curve, and the small dot drops in just after.', gap: 1.4 },
  { id: 'c28', part: 3, text: 'It is quick enough to feel instant and slow enough to notice.', gap: 1.0 },
  { id: 'c29', part: 3, text: 'When the home screen opens, the progress bar grows from zero to 11 percent in 400 milliseconds, so the eye lands on how far into the cycle the user is.', say: 'When the home screen opens, the progress bar grows from zero to eleven percent in four hundred milliseconds, so the eye lands on how far into the cycle the user is.', gap: 1.3 },
  { id: 'c30', part: 3, text: 'These timings are tokens too: fast is 150 milliseconds, normal is 250 and slow is 400, each with a fixed easing curve.', say: 'These timings are tokens too: fast is one hundred and fifty milliseconds, normal is two hundred and fifty and slow is four hundred, each with a fixed easing curve.', gap: 0.8 },
  { id: 'c31', part: 3, text: 'Developers get exact values, not "make it smooth".', say: 'Developers get exact values, not, make it smooth.', gap: 0.7 },
  { id: 'c32', part: 3, text: 'I only animate opacity and position, so the motion stays smooth on lower-end Android phones.', gap: 0.7 },
  { id: 'c33', part: 3, text: 'And when someone turns on Reduce Motion, the movement becomes a simple fade.', gap: 2.4 },

  { id: 'c34', part: 4, text: 'So that is how I work: a system that keeps every screen consistent, and motion that helps people understand what just happened.', gap: 0.7 },
  { id: 'c35', part: 4, text: 'Thank you for watching.', gap: 0.4 },
  { id: 'c36', part: 4, text: 'VivaFemini is a startup too, so I know how to move fast without letting quality slip.', say: 'Viva Femini is a startup too, so I know how to move fast without letting quality slip.', gap: 0.4 },
  { id: 'c37', part: 4, text: 'I would love to talk about how I can do the same for your team.', gap: 2.2 },
];

// Speaking rate for the live read (words per second). The AI voice is fitted into the same slots.
const RATE = 2.75;
const LEAD_IN = 1.0;

(function timeCues() {
  let t = LEAD_IN;
  for (const c of CUES) {
    const words = (c.say || c.text).split(/\s+/).filter(Boolean).length;
    c.speak = +(words / RATE + 0.15).toFixed(3);
    c.start = +t.toFixed(3);
    c.end = +(t + c.speak).toFixed(3);
    // short pauses shrink a little; the long demo holds stay as written
    const gap = c.gap >= 2 ? c.gap : c.gap * 0.8;
    t += c.speak + gap;
    c.slotEnd = +t.toFixed(3);
  }
  window.CUE_END = t;
})();

const CUE = Object.fromEntries(CUES.map((c) => [c.id, c]));

// time at which a word of a cue is spoken, estimated from its position in the line
function wordTime(id, word, nth = 1) {
  const c = CUE[id];
  const txt = c.text.toLowerCase();
  let idx = -1;
  for (let i = 0; i < nth; i++) idx = txt.indexOf(word.toLowerCase(), idx + 1);
  if (idx < 0) throw new Error(`word "${word}" not in ${id}`);
  return c.start + c.speak * (idx / txt.length);
}
