#!/bin/bash
# Render the whole video in 4 parallel chunks, join them, then add the audio.
set -e
cd "$(dirname "$0")"
FPS=60
DUR=$(python3 -c "import json;print(json.load(open('sfx.json'))['duration'])")
TOTAL=$(python3 -c "print(round($DUR*$FPS))")
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
ffmpeg -y -loglevel error -f concat -safe 0 -i chunks.txt -c copy video_only.mp4
ffmpeg -y -loglevel error -i video_only.mp4 -i mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart home-screen-redesign.mp4
ffmpeg -y -loglevel error -i video_only.mp4 -i music.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart home-screen-redesign-music-only.mp4
ls -la home-screen-redesign*.mp4
