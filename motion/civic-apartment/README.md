# Civic Apartment, 15 s vertical film

Land Republic. 1080 × 1920, 30 fps, 15.0 s, for Reels and TikTok.

## Render contract

- The film is a pure function of time. `window.seek(t)` in `film.html` paints frame t.
- No CSS transitions, timers or `requestAnimationFrame`. No state carried between frames.
  Noise is seeded `mulberry32` only.
- `node render.mjs` seeks every frame in headless Chromium and pipes PNGs to ffmpeg:
  H.264 High, yuv420p, CRF 16, BT.709 tags, `+faststart`.

```sh
node audio/score.mjs                         # music, SFX, beats.json, -14 LUFS mix (15.0 s)
node tools/check.mjs                         # fonts, safe area, every string on screen
node render.mjs --from 0 --to 15 --hold 13.5 --audio audio/mix.wav --out out/civic-apartment-15s.mp4
python3 -I tools/layers.py assets/renders/street-view.webp assets/renders/layers   # parallax layers
node render.mjs --still 1.3                  # one frame as PNG
```

`--hold 13.5` puts a finely coded keyframe where the end card stops moving, so the
last 1.5 s decode to identical frames (the compositor freezes the grain there too).

## Layout

| Path | What it is |
|---|---|
| `src/lib.js` | Canvas size, safe area, brand colours, 118 BPM beat grid, easing, seeded noise |
| `src/type.js` | Word-by-word masked headlines (60 ms stagger, expo-out entrance) |
| `src/frame.js` | The curved frame shape taken from the facade |
| `src/glow.js` | The glowing road line and its travelling head, shared by every scene |
| `src/scene1.js` | Scene 1: dive toward Ajah, expressway line, headline |
| `src/scene2.js` | Scene 2 (beat 5 to beat 10, 2.53 to 5.1 s): roads, plot, pin, radius circles, landmark callouts, address pill, pin head opening into the curved frame onto the street view |
| `src/scene3.js` | Scene 3 (5.1 to 8.0 s): street-level render in three parallax layers, lower-third title, detail cut to the curved glass balcony on beat 14.5 |
| `src/scene4.js` | Scene 4 (8.0 to 11.43 s): curved-frame wipe to off-white, outright price cards, segmented control with the stepping indicator, "Spread it over 12 months.", small print |
| `src/scene5.js` | Scene 5 (11.43 to 15.0 s): front elevation in the curved frame, pull-back into near-black, centred end card, still from 13.5 s |
| `tools/check.mjs` | Checks every frame's text: Red Hat Display only, nothing outside the safe area, the full list of words shown |
| `tools/layers.py` | Splits the street-level render into sky, building and front foliage; the building's pixels are never changed |
| `src/film.js` | Compositor: plate grade, motion blur on fast moves (a scene can ask for more samples per window), 3% grain |
| `audio/score.mjs` | Afro-house instrumental with a log drum at 118 BPM, synthesized (royalty-free), and the five SFX: air whoosh, pin thud, glass shimmer, indicator clicks, logo hit; 0.5 s fade; writes `beats.json` |
| `beats.json` | Beat grid: 60/118 s per beat, each beat snapped to its nearest frame |

## Footage plates

Scene 1 currently draws a stand-in map, marked on screen as a stand-in. To use real
footage, export an image sequence into `assets/plates/scene1/` and describe it in
`assets/plates/plates.json`:

```json
{ "scene1": { "pattern": "assets/plates/scene1/civic_%03d.jpeg", "frames": 120, "firstFrame": 0, "offset": 15 } }
```

`offset` skips frames at the head of the export so the camera is already moving on
frame 0. The expressway line is still positioned by the stand-in camera; it needs the
Google Earth Studio track points to follow real footage.

Scene 2 follows the same rule: its stand-in plate is marked on screen, and the
roads, plot, pin and landmark spots are placed in metres around the site
(`src/scene2.js`), so they need the Google Earth track points to sit on real
footage. The landmark callouts are off (`LANDMARKS = []` at the top of
`src/scene2.js`) until each landmark is named and placed on real coordinates.

## Type

Red Hat Display only. It has no naira sign, so `src/scene4.js` builds ₦ from the
font's own N and two bars at its stem weight.
