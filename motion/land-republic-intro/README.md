# Land Republic intro, 0:00 to 0:09

A 1080×1920 (9:16) 30 fps intro for Instagram and TikTok. It runs brand, then location, then land, then property, and stops at 9.000 s.

## Run it

```
python3 audio/score.py      # synthesize the score, measure onsets -> beats.json
node render.mjs --sheet     # one frame per measured beat -> out/sheet.png
node render.mjs --verify    # determinism check (each sample painted twice)
node render.mjs             # full render -> out/land-republic-intro_0-9s.mp4
```

Requires Node 22, Playwright Chromium and ffmpeg. The Python steps need numpy, scipy, soundfile and pyloudnorm.

## Render contract

- `window.seek(t)` paints frame `t` from nothing. There are no CSS transitions, timers or `requestAnimationFrame` in render mode, and no state is carried between frames.
- Randomness comes from mulberry32 seeds (JS and Python) and hash noise in the shaders. Nothing uses `Math.random`.
- `render.mjs` paints every frame on a freshly loaded page (three pages in parallel, frames written in order). When frames were painted one after another on the same page, Chromium reused stale raster tiles: survey lines from 7.2 s appeared at 7.4 s, and the masked map leaked into the land. A sequential-versus-fresh check caught both. Fresh pages rule out carried state by construction.
- `--verify` paints a sample of frames twice, in different orders and on different pages, and fails on anything beyond rasteriser noise (more than 50 pixels differing, or any pixel off by more than 48/765).
- Encode: H.264 High, yuv420p, CRF 16, AAC 320k.

## Sound

The score and SFX are synthesized in `audio/score.py` at 120 BPM: a pad, a pulse, mallets, kicks, whooshes, typing ticks and a click. `beats.json` is measured back out of the rendered hit stem with a spectral-flux onset detector, and the film times every event from those measured hits. The mix is normalized to −14 LUFS integrated with a −1.5 dBFS peak ceiling.

## What is real and what is illustrative

| Element | Status |
|---|---|
| Land Republic mark | Rebuilt as vector from the supplied 113×40 PNG (pixel correlation 0.965). Replace it with the official vector when available. |
| Wordmark typeface | Figtree 800. This is the closest of 11 candidates measured against the logo pixels (r = 0.93), not a confirmed brand font. |
| Brand blue `#0F68D8`, ink `#111111` | Sampled from the supplied logo. |
| Nigeria map, Oyo State, Ibadan position | Natural Earth 1:10m, public domain. 7.38°N, 3.93°E is Ibadan city, not the estate. |
| "Ariya Springs", "Ibadan, Oyo State", "500 SQM", "FROM ₦2.5M" | From Land Republic's own blog ("₦2,500,000 per 500sqm"). Confirm before publishing. |
| Aerial land, estate layout, plot grid | Procedural and illustrative. This is not the real Ariya Springs site plan. |
| Sky and clouds | Procedural. |

No house or building is shown, because Ariya Springs is sold as land.

## Fonts

Figtree and IBM Plex Mono, both SIL Open Font License (licences in `assets/fonts/`).
