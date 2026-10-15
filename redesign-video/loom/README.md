# Loom walkthrough: Senior UI/UX Designer

A landscape (1920 × 1080, 30 fps) video of about 4 minutes that follows the Loom script line by line: the VivaFemini home screen on an iPhone on the left, an explainer panel on the right, and subtitles at the bottom right that pace the reading.

## Versions

- `loom-live.mp4`: no sound. Play it full screen while recording Loom and read the subtitles aloud with your camera on.
- `loom-ai-voice.mp4`: the same picture with a Nigerian English male AI voice and a quiet music bed. Only made once the voice files can be downloaded (see below).

## Files

- `cues.js` is the script: one cue per line, the words shown in the subtitles, how the AI voice should say them, and the pause after each line. The timing of every cue comes from here.
- `index.html` and `scene.js` draw the video. `scene.js` holds the camera moves, the highlight rings on the phone and the small demos (logging a period day, the progress bar, the colour token swap, Reduce Motion).
- `voice_mix.py` fits one voice clip per cue into the cue's time slot and mixes it over the music, so the AI voice needs no new render.

## Rendering again

```
./render_all.sh                      # writes loom-live.mp4
node preview.mjs 40 131 177          # optional: single frames at those seconds
python3 voice_mix.py cues.json voice/ music.wav voice_mix.wav
ffmpeg -i loom-live.mp4 -i voice_mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest loom-ai-voice.mp4
```
