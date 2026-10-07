# Motion studio rules

## Render contract
- Every film is a pure function of time: window.seek(t) paints frame t.
- No CSS transitions, no setTimeout, no requestAnimationFrame in render mode, no state carried between frames. Seeded noise only (mulberry32), never Math.random.
- Render with node render.mjs, encode H.264 yuv420p, CRF 16.

## Look
- Banned defaults: centered title on gradient, everything fading in, corner labels and frame borders, glow on UI chrome, generic particle bursts.
- One display face, one UI face. One accent color unless the brief says otherwise.
- Every 2 to 4 seconds something new must happen on screen.

## Sound
- Score and SFX are synthesized in code unless a track is supplied.
- Place hits on the measured beat grid (beats.json). Loudness -14 LUFS.

## Loop before you show me anything
1. Render one frame per beat as a contact sheet and LOOK at it.
2. Score it 1-10 on: hook in first 2s, readability at phone size, motion quality, variety, brand accuracy, sound sync.
3. Fix the 3 worst problems. Repeat until every score is 8+.
4. Only then do the full render.

## Springs only
<!-- Reconstructed from the rule's name; the kit's original wording was not supplied. -->
- Every move is a damped spring evaluated in closed form (film/engine.js `spring`, `track`). No cubic-bezier, no linear tweens, no CSS easing keywords.
- Holds are holds. Cuts are cuts. Anything in between is a spring.
- Retargeting adds a new step response on top of the old one, so momentum carries through chained moves.

## Banned clichés
<!-- Reconstructed from the rule's name; the kit's original wording was not supplied. -->
- Visual: lens flares, light leaks, film burns, glitch or RGB-split transitions, VHS noise, typewriter reveals, spinning or flipping logos, a slow zoom on every still, confetti, neon glow, swoosh lower thirds, shake on every hit.
- Copy: unlock, elevate, seamless, journey, game changer, revolutionize, next level, like never before, your dream home awaits.

## This film
- Brand facts, screenshots, fonts, colors and numbers come only from the captured site (assets/inventory.json). Nothing in the UI is redrawn.
- Timing lives in timeline.mjs. The film and the SFX pass both convert beats to seconds through beats.json.
