# Civic Apartment, 15 s vertical film

Land Republic. 1080 × 1920, 30 fps, 15.0 s, for Reels and TikTok.

## Render contract

- The film is a pure function of time. `window.seek(t)` in `film.html` paints frame t.
- No CSS transitions, timers or `requestAnimationFrame`. No state carried between frames.
  Noise is seeded `mulberry32` only.
- `node render.mjs` seeks every frame in headless Chromium and pipes PNGs to ffmpeg:
  H.264 High, yuv420p, CRF 16, BT.709 tags, `+faststart`.

```sh
node audio/score.mjs                         # Afro-house score, SFX, beats.json, -14 LUFS mix
node render.mjs --audio audio/mix.wav --out out/civic-apartment-15s.mp4
node tools/check.mjs                         # safe area, font, still hold, determinism
python3 tools/separate_layers.py             # rebuild scene 3's parallax layers
node render.mjs --still 1.3                  # one frame as PNG
```

## Layout

| Path | What it is |
|---|---|
| `src/lib.js` | Canvas size, safe area, brand colours, 118 BPM beat grid, easing, seeded noise |
| `src/type.js` | Word-by-word masked headlines (60 ms stagger, expo-out entrance) |
| `src/frame.js` | The curved frame shape taken from the facade |
| `src/map.js` | Stand-in map, camera transform (with rotation), glowing roads, credit |
| `src/scene1.js` | Scene 1, 0 to 2.533 s: dive toward Ajah, expressway line, headline |
| `src/scene2.js` | Scene 2, 2.533 to 5.1 s: roads, plot, pin, radii, landmarks, address, pin to frame |
| `src/scene3.js` | Scene 3, 5.1 to 8.133 s: street-view render with layered parallax, title, balcony detail cut |
| `src/scene4.js` | Scene 4, 8.133 to 11.7 s: wipe to off-white, price cards, segmented control, headline |
| `src/scene5.js` | Scene 5, 11.7 to 15.0 s: dusk render pulls back, end card, still hold from 13.5 s |
| `tools/separate_layers.py` | Splits the street-view render into sky, building and branch layers; verifies the building pixels are untouched |
| `tools/check.mjs` | Seeks every frame and checks the rules that can be checked mechanically |
| `assets/brand/logo-white.png` | Logo taken from the end card of the 16:9 brand video (822 px wide) |
| `src/film.js` | Compositor: plate grade, motion blur on fast moves, 3% grain |
| `audio/score.mjs` | Synthesized Afro-house score with a log drum, the five SFX and the final fade; writes `beats.json` |
| `beats.json` | Beat grid: 60/118 s per beat, each beat snapped to its nearest frame |

## Footage plates

Scenes 1 and 2 currently draw a stand-in map, marked on screen as a stand-in.
The naira sign is drawn (Red Hat Display has none): the font's N with two bars. To use real
footage, export an image sequence into `assets/plates/scene1/` and describe it in
`assets/plates/plates.json`:

```json
{ "scene1": { "pattern": "assets/plates/scene1/civic_%03d.jpeg", "frames": 120, "firstFrame": 0, "offset": 15 } }
```

`offset` skips frames at the head of the export so the camera is already moving on
frame 0. The roads, plot, pin and landmark spots are still positioned by the stand-in
camera; they need Google Earth Studio track points to follow real footage.
