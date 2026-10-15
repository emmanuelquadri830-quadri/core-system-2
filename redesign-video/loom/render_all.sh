#!/bin/bash
# Render the Loom walkthrough in 4 parallel chunks and join them (no audio).
set -e
cd "$(dirname "$0")"
FPS=30
DUR=$(node -e "
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node22/lib/node_modules/playwright'); } })();
(async () => { const b = await chromium.launch(); const p = await b.newPage(); await p.goto('file://' + process.cwd() + '/index.html'); console.log(await p.evaluate(() => window.DURATION)); await b.close(); })();
")
TOTAL=$(python3 -c "print(round($DUR*$FPS))")
echo "duration $DUR s, $TOTAL frames"
W=4
STEP=$(( (TOTAL + W - 1) / W ))
pids=()
for i in $(seq 0 $((W-1))); do
  A=$((i*STEP)); B=$(( (i+1)*STEP )); [ $B -gt $TOTAL ] && B=$TOTAL
  node render.mjs $FPS $A $B chunk_$i.mp4 png > log_$i.txt 2>&1 &
  pids+=($!)
done
for p in "${pids[@]}"; do wait $p; done
cat log_*.txt
rm -f chunks.txt; for i in $(seq 0 $((W-1))); do echo "file 'chunk_$i.mp4'" >> chunks.txt; done
ffmpeg -y -loglevel error -f concat -safe 0 -i chunks.txt -c copy -movflags +faststart loom-live.mp4
ffprobe -v error -show_entries stream=width,height,r_frame_rate,nb_frames -show_entries format=duration -of compact loom-live.mp4
