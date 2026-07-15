import type { ScaleName } from "../types/melody";

export const SCALE_INTERVALS: Record<ScaleName, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

export const SCALE_LABELS: Record<ScaleName, string> = {
  major: "Major",
  minor: "Minor",
  naturalMinor: "Natural Minor",
  harmonicMinor: "Harmonic Minor",
  melodicMinor: "Melodic Minor",
  dorian: "Dorian",
  phrygian: "Phrygian",
  lydian: "Lydian",
  mixolydian: "Mixolydian",
  locrian: "Locrian",
};

const SCALE_ALIASES: Record<string, ScaleName> = {
  major: "major",
  ionian: "major",
  minor: "minor",
  "natural minor": "naturalMinor",
  naturalminor: "naturalMinor",
  natural_minor: "naturalMinor",
  naturalMinor: "naturalMinor",
  "harmonic minor": "harmonicMinor",
  harmonicminor: "harmonicMinor",
  harmonicMinor: "harmonicMinor",
  "melodic minor": "melodicMinor",
  melodicminor: "melodicMinor",
  melodicMinor: "melodicMinor",
  dorian: "dorian",
  phrygian: "phrygian",
  lydian: "lydian",
  mixolydian: "mixolydian",
  locrian: "locrian",
  aeolian: "minor",
};

export function normalizeScaleName(raw: string): ScaleName | null {
  const key = raw.trim().toLowerCase();
  return SCALE_ALIASES[key] ?? null;
}

const TONIC_PITCH_CLASSES: Record<string, number> = {
  C: 0,
  "B#": 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  "E#": 5,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

/** Normalizes tonic spelling: trims, capitalizes letter, lowercases accidental, maps ♭/♯. */
export function normalizeTonicSpelling(raw: string): string {
  const s = raw.trim().replace(/♭/g, "b").replace(/♯/g, "#");
  if (s.length === 0) return s;
  const letter = s[0]!.toUpperCase();
  const rest = s.slice(1).toLowerCase();
  return letter + rest;
}

export function tonicToPitchClass(raw: string): number | null {
  const spelling = normalizeTonicSpelling(raw);
  if (spelling in TONIC_PITCH_CLASSES) {
    return TONIC_PITCH_CLASSES[spelling]!;
  }
  return null;
}

export const TONIC_OPTIONS = [
  "C",
  "C#",
  "Db",
  "D",
  "D#",
  "Eb",
  "E",
  "F",
  "F#",
  "Gb",
  "G",
  "G#",
  "Ab",
  "A",
  "A#",
  "Bb",
  "B",
];

export interface ParsedScaleDegree {
  normalizedDegree: number; // 1-7
  wrapOctaves: number;
  accidentalAdjustment: number;
}

const SCALE_DEGREE_RE = /^\s*(b+|♭+|#+|♯+)?\s*(\d+)\s*$/;

/**
 * Parses a scale-degree expression like "1", "b3", "#4", "bb7", "8" into
 * a normalized (1-7) degree, extended-octave wrap count, and accidental
 * semitone adjustment. Returns null if the expression is unsupported.
 */
export function parseScaleDegree(raw: string): ParsedScaleDegree | null {
  const match = SCALE_DEGREE_RE.exec(raw);
  if (!match) return null;
  const accidentalToken = match[1] ?? "";
  const degree = parseInt(match[2]!, 10);
  if (!Number.isFinite(degree) || degree < 1) return null;

  let accidentalAdjustment = 0;
  if (accidentalToken.length > 0) {
    const flatCount = (accidentalToken.match(/b|♭/g) ?? []).length;
    const sharpCount = (accidentalToken.match(/#|♯/g) ?? []).length;
    accidentalAdjustment = sharpCount - flatCount;
  }

  const normalizedDegree = ((degree - 1) % 7) + 1;
  const wrapOctaves = Math.floor((degree - 1) / 7);

  return { normalizedDegree, wrapOctaves, accidentalAdjustment };
}

export interface PitchResolution {
  midiPitch: number;
  outOfRange: boolean;
}

/**
 * Resolves a scale degree + octave to a MIDI pitch given a tonic pitch
 * class, scale, and base octave. baseOctave is the octave at which
 * scale degree 1 with octave 0 sounds the tonic (e.g. baseOctave 3 + F#
 * tonic => F#3 = MIDI 54).
 */
export function resolvePitch(
  parsedDegree: ParsedScaleDegree,
  noteOctave: number,
  tonicPitchClass: number,
  scale: ScaleName,
  baseOctave: number,
): PitchResolution {
  const intervals = SCALE_INTERVALS[scale];
  const baseTonicMidi = 12 * (baseOctave + 1) + tonicPitchClass;
  const degreeIndex = parsedDegree.normalizedDegree - 1;
  const interval = intervals[degreeIndex] ?? intervals[degreeIndex % intervals.length]!;

  const midiPitch =
    baseTonicMidi +
    interval +
    noteOctave * 12 +
    parsedDegree.wrapOctaves * 12 +
    parsedDegree.accidentalAdjustment;

  const outOfRange = midiPitch < 0 || midiPitch > 127;
  const clamped = Math.min(127, Math.max(0, midiPitch));
  return { midiPitch: clamped, outOfRange };
}

const NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Formats a MIDI pitch as scientific pitch notation, e.g. 60 -> "C4". */
export function midiPitchToName(midiPitch: number): string {
  const pitchClass = ((midiPitch % 12) + 12) % 12;
  const octave = Math.floor(midiPitch / 12) - 1;
  return `${NOTE_NAMES_SHARP[pitchClass]}${octave}`;
}

/** Sanitizes a tonic + scale name into a lowercase-hyphen filename fragment. */
export function tonicScaleToFilenameFragment(tonic: string, scale: ScaleName): string {
  const tonicPart = normalizeTonicSpelling(tonic)
    .replace(/#/g, "-sharp")
    .replace(/b/g, "-flat")
    .toLowerCase();
  const scalePart = SCALE_LABELS[scale].toLowerCase().replace(/\s+/g, "-");
  return `${tonicPart}-${scalePart}`;
}
