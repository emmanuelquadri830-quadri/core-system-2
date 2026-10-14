# Home screen redesign video

A vertical (1080 × 1920, 60 fps) video of the cycle tracker home screen going from the old design to the new one inside an iPhone frame. The new screen is rebuilt live: cards and circles are drawn, text is typed, and the camera zooms in on each part as it is edited.

## Files

- `home-screen-redesign.mp4`: the finished video, with background music and soft interface sounds (typing, clicks, camera moves).
- `home-screen-redesign-music-only.mp4`: the same video with music only.
- `assets/old.png`, `assets/new.png`: the two designs the video was made from.

## How it is built

- `app.js` rebuilds the new design as HTML, measured against `assets/new.png` so every element lines up with the export.
- `index.html` holds the stage: background, titles, the iPhone frame and the editing overlays (cursor, selection boxes, keycaps).
- `timeline.js` is the script. Every frame is a pure function of time, so any frame can be rendered on its own. Section timings, typing speed and camera moves are all set there.
- `audio.py` synthesises the music and the interface sounds (no samples, so there are no rights issues) and writes `music.wav` and `mix.wav`.
- `render.mjs` drives headless Chromium and pipes frames into ffmpeg.

## Rendering again

Needs Node with Playwright and Chromium, Python 3 with numpy, and ffmpeg.

```
node dump_sfx.mjs        # writes sfx.json (duration and sound cue times)
python3 audio.py         # writes music.wav and mix.wav
./render_all.sh          # renders frames in 4 parallel chunks and muxes the audio
node preview.mjs 12.5 30 # optional: saves single frames at the given seconds
```
