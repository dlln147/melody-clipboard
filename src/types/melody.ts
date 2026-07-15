/** PPQ (pulses/ticks per quarter note) used throughout the app. */
export const PPQ = 480;

export type ScaleName =
  | "major"
  | "minor"
  | "naturalMinor"
  | "harmonicMinor"
  | "melodicMinor"
  | "dorian"
  | "phrygian"
  | "lydian"
  | "mixolydian"
  | "locrian";

/** A source-agnostic note produced by the parser, before pitch resolution. */
export interface SourceNote {
  /** Raw scale degree expression, e.g. "1", "b3", "#4", "8". */
  sd: string;
  octave: number;
  startTick: number;
  durationTicks: number;
  isRest: boolean;
  voice: number;
}

/** A source-agnostic key event, before pitch resolution. */
export interface SourceKey {
  startTick: number;
  tonic: string;
  scale: string;
}

/** The intermediate, source-format-independent representation. */
export interface SourceMelody {
  notes: SourceNote[];
  keys: SourceKey[];
  usedModern: boolean;
}

/** A fully resolved note with a concrete MIDI pitch. */
export interface ResolvedNote {
  startTick: number;
  durationTicks: number;
  midiPitch: number;
  voice: number;
  outOfRange: boolean;
}

export interface MelodySettings {
  tonic: string;
  scale: ScaleName;
  baseOctave: number;
  tempoBpm: number;
  timeSignatureNumerator: number;
  timeSignatureDenominator: number;
  velocity: number;
  startAtBeatOne: boolean;
  includeTempoMeta: boolean;
  includeTimeSignatureMeta: boolean;
  respectKeyChanges: boolean;
}

export const DEFAULT_SETTINGS: MelodySettings = {
  tonic: "C",
  scale: "major",
  baseOctave: 3,
  tempoBpm: 120,
  timeSignatureNumerator: 4,
  timeSignatureDenominator: 4,
  velocity: 100,
  startAtBeatOne: true,
  includeTempoMeta: true,
  includeTimeSignatureMeta: true,
  respectKeyChanges: true,
};

export interface MelodySummary {
  detectedTonic: string | null;
  detectedScale: ScaleName | null;
  noteCount: number;
  lengthBeats: number;
  lengthBars: number;
  earliestNoteTick: number;
  latestNoteTick: number;
  usedModern: boolean;
}

export interface ParseWarning {
  code: string;
  message: string;
}

export interface ParseError {
  message: string;
  path?: string;
}

export interface ParseResult {
  ok: boolean;
  source?: SourceMelody;
  error?: ParseError;
  warnings: ParseWarning[];
}

/** The normalized model handed off to the Rust backend for MIDI generation. */
export interface NormalizedMelody {
  ppq: 480;
  tempoBpm: number;
  timeSignatureNumerator: number;
  timeSignatureDenominator: number;
  velocity: number;
  includeTempoMeta: boolean;
  includeTimeSignatureMeta: boolean;
  notes: Array<{
    startTick: number;
    durationTicks: number;
    midiPitch: number;
    voice: number;
  }>;
}

export interface ExportSummary {
  path: string;
  noteCount: number;
  durationTicks: number;
  durationBeats: number;
  fileSizeBytes: number;
}
