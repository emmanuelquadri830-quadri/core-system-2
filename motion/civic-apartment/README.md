# Civic Apartment, 15 s vertical film

Land Republic. 1080 × 1920, 30 fps, 15.0 s, for Reels and TikTok.

## Render contract

- The film is a pure function of time. `window.seek(t)` in `film.html` paints frame t.
- No CSS transitions, timers or `requestAnimationFrame`. No state carried between frames.
  Noise is seeded `mulberry32` only.
- `node render.mjs` seeks every frame in headless Chromium and pipes PNGs to ffmpeg:
  H.264 High, yuv420p, CRF 16, BT.709 tags, `+faststart`.

```sh
node audio/score.mjs --to 2.5333333          # score, SFX, beats.json, -14 LUFS mix
node render.mjs --from 0 --to 2.5333333 --audio audio/mix.wav --out out/scene1.mp4
node render.mjs --still 1.3                  # one frame as PNG
```

## Layout

| Path | What it is |
|---|---|
| `src/lib.js` | Canvas size, safe area, brand colours, 118 BPM beat grid, easing, seeded noise |
| `src/type.js` | Word-by-word masked headlines (60 ms stagger, expo-out entrance) |
| `src/frame.js` | The curved frame shape taken from the facade |
| `src/scene1.js` | Scene 1: dive toward Ajah, expressway line, headline |
| `src/film.js` | Compositor: plate grade, motion blur on fast moves, 3% grain |
| `audio/score.mjs` | Synthesized score and SFX; writes `beats.json` |
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
