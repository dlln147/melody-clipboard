import type {
  MelodySettings,
  MelodySummary,
  NormalizedMelody,
  ParseWarning,
  ResolvedNote,
  ScaleName,
  SourceKey,
  SourceMelody,
  SourceNote,
} from "../types/melody";
import { PPQ } from "../types/melody";
import { makeWarning } from "./validation";
import { normalizeScaleName, parseScaleDegree, resolvePitch, tonicToPitchClass } from "./musicTheory";

export interface ResolveResult {
  notes: ResolvedNote[];
  warnings: ParseWarning[];
  summary: MelodySummary;
}

function detectFirstKey(keys: SourceKey[]): { tonic: string; scale: ScaleName } | null {
  if (keys.length === 0) return null;
  const sorted = [...keys].sort((a, b) => a.startTick - b.startTick);
  const first = sorted[0]!;
  const scale = normalizeScaleName(first.scale);
  if (!scale) return null;
  return { tonic: first.tonic, scale };
}

function keyAtTick(
  sortedKeys: SourceKey[],
  tick: number,
  fallbackTonic: string,
  fallbackScale: ScaleName,
): { tonic: string; scale: ScaleName } {
  let candidate: SourceKey | null = null;
  for (const key of sortedKeys) {
    if (key.startTick <= tick) {
      candidate = key;
    } else {
      break;
    }
  }
  if (candidate) {
    const scale = normalizeScaleName(candidate.scale);
    if (scale) return { tonic: candidate.tonic, scale };
  }
  return { tonic: fallbackTonic, scale: fallbackScale };
}

/**
 * Resolves a SourceMelody against user settings into concrete MIDI pitches,
 * applying key-change lookup, start-at-beat-one normalization, and
 * out-of-range / duplicate-note detection.
 */
export function resolveMelody(source: SourceMelody, settings: MelodySettings): ResolveResult {
  const warnings: ParseWarning[] = [];
  const sortedKeys = [...source.keys].sort((a, b) => a.startTick - b.startTick);

  const fallbackTonic = settings.tonic;
  const fallbackScale = settings.scale;

  const nonRestSource = source.notes.filter((n) => !n.isRest);
  const allItems = source.notes;

  const earliestNoteTick = nonRestSource.length > 0 ? Math.min(...nonRestSource.map((n) => n.startTick)) : 0;
  const latestNoteTick =
    nonRestSource.length > 0 ? Math.max(...nonRestSource.map((n) => n.startTick + n.durationTicks)) : 0;

  const spanStart = allItems.length > 0 ? Math.min(...allItems.map((n) => n.startTick)) : 0;
  const spanEnd = allItems.length > 0 ? Math.max(...allItems.map((n) => n.startTick + n.durationTicks)) : 0;
  const lengthTicks = Math.max(0, spanEnd - spanStart);
  const lengthBeats = lengthTicks / PPQ;
  const lengthBars = settings.timeSignatureNumerator > 0 ? lengthBeats / settings.timeSignatureNumerator : 0;

  let outOfRangeCount = 0;
  const resolvedRaw: Array<ResolvedNote & { sourceIndex: number }> = [];

  nonRestSource.forEach((note: SourceNote, idx: number) => {
    const parsed = parseScaleDegree(note.sd);
    if (!parsed) return; // already validated upstream; defensive skip

    const key = settings.respectKeyChanges
      ? keyAtTick(sortedKeys, note.startTick, fallbackTonic, fallbackScale)
      : { tonic: fallbackTonic, scale: fallbackScale };

    const tonicPitchClass = tonicToPitchClass(key.tonic) ?? tonicToPitchClass(fallbackTonic) ?? 0;

    const { midiPitch, outOfRange } = resolvePitch(
      parsed,
      note.octave,
      tonicPitchClass,
      key.scale,
      settings.baseOctave,
    );

    if (outOfRange) outOfRangeCount++;

    resolvedRaw.push({
      startTick: note.startTick,
      durationTicks: note.durationTicks,
      midiPitch,
      voice: note.voice,
      outOfRange,
      sourceIndex: idx,
    });
  });

  let offset = 0;
  if (settings.startAtBeatOne && resolvedRaw.length > 0) {
    offset = Math.min(...resolvedRaw.map((n) => n.startTick));
  }

  const inRange = resolvedRaw
    .filter((n) => !n.outOfRange)
    .map((n) => ({
      startTick: Math.max(0, n.startTick - offset),
      durationTicks: n.durationTicks,
      midiPitch: n.midiPitch,
      voice: n.voice,
      outOfRange: n.outOfRange,
    }));

  const seen = new Map<string, number>();
  for (const n of inRange) {
    const key = `${n.startTick}:${n.midiPitch}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const hasDuplicates = [...seen.values()].some((count) => count > 1);

  if (outOfRangeCount > 0) {
    warnings.push(
      makeWarning(
        "outOfRangePitch",
        `${outOfRangeCount} note pitch${outOfRangeCount === 1 ? "" : "es"} fell outside the valid MIDI range and were excluded.`,
      ),
    );
  }
  if (hasDuplicates) {
    warnings.push(makeWarning("duplicateNotes", "Duplicate notes occupy the same pitch and time."));
  }

  const detected = detectFirstKey(source.keys);

  const summary: MelodySummary = {
    detectedTonic: detected?.tonic ?? null,
    detectedScale: detected?.scale ?? null,
    noteCount: nonRestSource.length,
    lengthBeats,
    lengthBars,
    earliestNoteTick,
    latestNoteTick,
    usedModern: source.usedModern,
  };

  return { notes: inRange, warnings, summary };
}

/** Converts resolved notes + settings into the normalized model passed to Rust. */
export function toNormalizedMelody(notes: ResolvedNote[], settings: MelodySettings): NormalizedMelody {
  return {
    ppq: PPQ,
    tempoBpm: settings.tempoBpm,
    timeSignatureNumerator: settings.timeSignatureNumerator,
    timeSignatureDenominator: settings.timeSignatureDenominator,
    velocity: settings.velocity,
    includeTempoMeta: settings.includeTempoMeta,
    includeTimeSignatureMeta: settings.includeTimeSignatureMeta,
    notes: notes.map((n) => ({
      startTick: n.startTick,
      durationTicks: n.durationTicks,
      midiPitch: n.midiPitch,
      voice: n.voice,
    })),
  };
}
