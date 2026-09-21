#!/usr/bin/env bash
if [ "${MB_VERSION+x}" = x ]; then echo "error: MB_VERSION is retired; tooling uses app/" >&2; exit 2; fi
# Generates narration audio for the daily update, and extracts its timings.
#
# WHY THIS EXISTS (L10): the spec assumes live Web Speech playback, where
# `boundary` events populate timings at runtime. We play a pre-generated .wav
# instead, and boundary events do not fire for recorded audio — so timings must
# be extracted here, once, and written back. That is exactly the production
# pipeline D29 describes:
#
#     script text → TTS → timing extraction → timings written back → visuals resync
#
# macOS `say` is offline, keyless, and the same voice family Safari's Web Speech
# exposes, so D04's intent (browser-native, no third-party keys, no ElevenLabs)
# holds even though its "no build-time audio assets" clause does not.
#
# ONE FILE PER SEGMENT. Each file's duration IS that segment's timing, and a
# single segment can be re-cut without redoing the whole script.
#
# OUTPUT
#   app/assets/audio/daily/<scriptId>/<segmentId>.wav
#   app/data/daily-timings.js     generated, loaded by the player
#   app/assets/audio/onboarding/onboarding_intro/<segmentId>.wav
#
# The onboarding intro is generated the same way but needs no timings: its
# player advances on the audio element's `ended` event rather than a timing
# table. Until this script has been run on a Mac those .wav files are absent,
# and the onboarding player falls back to a word-count clock — captions still
# advance, there is just no voice.
#
# The timings are written to a SEPARATE generated file, not back into
# daily-scripts.json — that stays a byte-identical copy of the spec so drift is
# always one `diff -rq` away (L13). The player prefers the generated timings,
# falls back to the spec's static block, then to a 165 wpm estimate.
#
#   bash scripts/gen-audio.sh
#
# Re-running is safe and idempotent.

set -euo pipefail

VOICE="${VOICE:-Samantha}"

SRC="app/data/daily-scripts.json"
OUTDIR="app/assets/audio/daily"
TIMINGS="app/data/daily-timings.js"
ONB_SRC="app/data/onboarding-script.json"
ONB_OUTDIR="app/assets/audio/onboarding"

[ -f "$SRC" ] || { echo "error: $SRC not found (run from repo root)" >&2; exit 1; }
command -v say >/dev/null || { echo "error: 'say' not found — macOS only" >&2; exit 2; }

if ! say -v "$VOICE" "" >/dev/null 2>&1; then
  echo "warning: voice '$VOICE' unavailable, falling back to the system default" >&2
  VOICE=""
fi

mkdir -p "$OUTDIR"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Emit "scriptId<TAB>segmentId<TAB>text" so the shell never parses JSON itself.
python3 - "$SRC" > "$TMP/segments.tsv" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
for s in d["scripts"]:
    for seg in s["segments"]:
        text = seg["text"].replace("\t", " ").replace("\n", " ")
        print("%s\t%s\t%s" % (s["id"], seg["id"], text))
PY

# ── Onboarding intro ─────────────────────────────────────────────────────────
# Same extractor, different source and output tree. The onboarding player
# advances on the audio element's `ended` event rather than a timing table, so
# this pass needs no timings written back — only the .wav files.
if [ -f "$ONB_SRC" ]; then
  python3 - "$ONB_SRC" > "$TMP/onb-segments.tsv" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
for s in d["scripts"]:
    for seg in s["segments"]:
        text = seg["text"].replace("\t", " ").replace("\n", " ")
        print("%s\t%s\t%s" % (s["id"], seg["id"], text))
PY
else
  : > "$TMP/onb-segments.tsv"
fi

count=0
while IFS=$'\t' read -r script seg text; do
  [ -z "${script:-}" ] && continue
  mkdir -p "$OUTDIR/$script"
  aiff="$TMP/$script-$seg.aiff"
  wav="$OUTDIR/$script/$seg.wav"

  if [ -n "$VOICE" ]; then say -v "$VOICE" -o "$aiff" "$text"; else say -o "$aiff" "$text"; fi
  afconvert "$aiff" "$wav" -d LEI16 -f WAVE >/dev/null

  dur=$(afinfo "$wav" | awk -F': *' '/estimated duration/{print $2}' | awk '{print $1}')
  printf '%s\t%s\t%s\n' "$script" "$seg" "$dur" >> "$TMP/durations.tsv"
  count=$((count + 1))
  printf '  %-24s %-4s %6.2fs\n' "$script" "$seg" "$dur"
done < "$TMP/segments.tsv"

# Onboarding: wavs only, no timings (the player advances on `ended`).
onb_count=0
while IFS=$'\t' read -r script seg text; do
  [ -z "${script:-}" ] && continue
  mkdir -p "$ONB_OUTDIR/$script"
  aiff="$TMP/onb-$script-$seg.aiff"
  wav="$ONB_OUTDIR/$script/$seg.wav"

  if [ -n "$VOICE" ]; then say -v "$VOICE" -o "$aiff" "$text"; else say -o "$aiff" "$text"; fi
  afconvert "$aiff" "$wav" -d LEI16 -f WAVE >/dev/null

  dur=$(afinfo "$wav" | awk -F': *' '/estimated duration/{print $2}' | awk '{print $1}')
  onb_count=$((onb_count + 1))
  printf '  %-24s %-4s %6.2fs\n' "$script" "$seg" "$dur"
done < "$TMP/onb-segments.tsv"

# Build the timings file. `start` is the running total, so a re-cut segment
# shifts everything after it automatically — visual cues reference segment ids,
# never timestamps, so they follow with no further edits (D29).
python3 - "$TMP/durations.tsv" "$TIMINGS" <<'PY'
import sys, json, collections
rows = collections.OrderedDict()
for line in open(sys.argv[1]):
    script, seg, dur = line.rstrip("\n").split("\t")
    rows.setdefault(script, []).append((seg, float(dur)))

out = {}
for script, segs in rows.items():
    t, block = 0, {}
    for seg, dur in segs:
        ms = int(round(dur * 1000))
        block[seg] = {"start": t, "duration": ms}
        t += ms
    out[script] = block

with open(sys.argv[2], "w") as f:
    f.write("// GENERATED by scripts/gen-audio.sh — do not hand-edit.\n")
    f.write("//\n")
    f.write("// Measured durations of the narration in assets/audio/daily/, in ms.\n")
    f.write("// D29: script text and timings never share an object, and visual cues\n")
    f.write("// reference segment ids rather than timestamps — so a re-cut segment\n")
    f.write("// shifts everything after it and the visuals follow automatically.\n")
    f.write("//\n")
    f.write("// Takes precedence over the static block in daily-scripts.json, which\n")
    f.write("// remains the byte-identical spec copy and the fallback.\n")
    f.write("const DAILY_TIMINGS =\n")
    f.write(json.dumps(out, indent=2))
    f.write(";\n")
print("  timings -> %s" % sys.argv[2])
PY

echo "─────────────────────────────────"
echo "$count daily + $onb_count onboarding segments generated with voice '${VOICE:-system default}'"
