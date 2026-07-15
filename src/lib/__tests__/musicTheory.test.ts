import { describe, expect, it } from "vitest";
import {
  midiPitchToName,
  normalizeScaleName,
  parseScaleDegree,
  resolvePitch,
  tonicToPitchClass,
} from "../musicTheory";

describe("F# major scale-degree conversion", () => {
  it("resolves scale degree 1 at base octave 3 to F#3 (MIDI 54)", () => {
    const parsed = parseScaleDegree("1")!;
    const { midiPitch } = resolvePitch(parsed, 0, tonicToPitchClass("F#")!, "major", 3);
    expect(midiPitch).toBe(54);
    expect(midiPitchToName(midiPitch)).toBe("F#3");
  });

  it("resolves scale degree 1 with octave 1 to F#4 (MIDI 66)", () => {
    const parsed = parseScaleDegree("1")!;
    const { midiPitch } = resolvePitch(parsed, 1, tonicToPitchClass("F#")!, "major", 3);
    expect(midiPitch).toBe(66);
  });

  it("resolves scale degree 7 to E#4 (MIDI 65) at octave 0 in base octave 3", () => {
    const parsed = parseScaleDegree("7")!;
    const { midiPitch } = resolvePitch(parsed, 0, tonicToPitchClass("F#")!, "major", 3);
    expect(midiPitch).toBe(65);
    expect(midiPitchToName(midiPitch)).toBe("F4");
  });
});

describe("flat tonic aliases", () => {
  it.each([
    ["Db", 1],
    ["Eb", 3],
    ["Fb", 4],
    ["Gb", 6],
    ["Ab", 8],
    ["Bb", 10],
    ["Cb", 11],
  ])("%s resolves to pitch class %i", (tonic, expected) => {
    expect(tonicToPitchClass(tonic)).toBe(expected);
  });
});

describe("sharp tonic aliases", () => {
  it.each([
    ["C#", 1],
    ["D#", 3],
    ["E#", 5],
    ["F#", 6],
    ["G#", 8],
    ["A#", 10],
    ["B#", 0],
  ])("%s resolves to pitch class %i", (tonic, expected) => {
    expect(tonicToPitchClass(tonic)).toBe(expected);
  });

  it("rejects unsupported tonic spellings", () => {
    expect(tonicToPitchClass("H#")).toBeNull();
  });
});

describe("octave displacement", () => {
  it("shifts pitch by 12 semitones per octave step", () => {
    const parsed = parseScaleDegree("3")!;
    const base = resolvePitch(parsed, 0, tonicToPitchClass("C")!, "major", 4).midiPitch;
    const up = resolvePitch(parsed, 2, tonicToPitchClass("C")!, "major", 4).midiPitch;
    const down = resolvePitch(parsed, -1, tonicToPitchClass("C")!, "major", 4).midiPitch;
    expect(up).toBe(base + 24);
    expect(down).toBe(base - 12);
  });
});

describe("scale degrees above 7", () => {
  it("wraps degree 8 to normalized degree 1 with one wrap octave", () => {
    const parsed = parseScaleDegree("8")!;
    expect(parsed.normalizedDegree).toBe(1);
    expect(parsed.wrapOctaves).toBe(1);
  });

  it("wraps degree 10 to normalized degree 3 with one wrap octave", () => {
    const parsed = parseScaleDegree("10")!;
    expect(parsed.normalizedDegree).toBe(3);
    expect(parsed.wrapOctaves).toBe(1);
  });

  it("resolves degree 8 exactly one octave above degree 1", () => {
    const d1 = parseScaleDegree("1")!;
    const d8 = parseScaleDegree("8")!;
    const p1 = resolvePitch(d1, 0, tonicToPitchClass("C")!, "major", 4).midiPitch;
    const p8 = resolvePitch(d8, 0, tonicToPitchClass("C")!, "major", 4).midiPitch;
    expect(p8).toBe(p1 + 12);
  });
});

describe("accidental scale degrees", () => {
  it("lowers pitch by one semitone per flat", () => {
    expect(parseScaleDegree("b3")).toEqual({ normalizedDegree: 3, wrapOctaves: 0, accidentalAdjustment: -1 });
    expect(parseScaleDegree("♭3")).toEqual({ normalizedDegree: 3, wrapOctaves: 0, accidentalAdjustment: -1 });
    expect(parseScaleDegree("bb7")).toEqual({
      normalizedDegree: 7,
      wrapOctaves: 0,
      accidentalAdjustment: -2,
    });
  });

  it("raises pitch by one semitone per sharp", () => {
    expect(parseScaleDegree("#4")).toEqual({ normalizedDegree: 4, wrapOctaves: 0, accidentalAdjustment: 1 });
    expect(parseScaleDegree("♯4")).toEqual({ normalizedDegree: 4, wrapOctaves: 0, accidentalAdjustment: 1 });
    expect(parseScaleDegree("##1")).toEqual({ normalizedDegree: 1, wrapOctaves: 0, accidentalAdjustment: 2 });
  });

  it("ignores whitespace", () => {
    expect(parseScaleDegree(" # 4 ")).toEqual({
      normalizedDegree: 4,
      wrapOctaves: 0,
      accidentalAdjustment: 1,
    });
  });

  it("rejects unsupported expressions", () => {
    expect(parseScaleDegree("x5")).toBeNull();
    expect(parseScaleDegree("")).toBeNull();
    expect(parseScaleDegree("3b")).toBeNull();
  });
});

describe("invalid MIDI pitches", () => {
  it("flags pitches below 0 as out of range and clamps", () => {
    const parsed = parseScaleDegree("1")!;
    const result = resolvePitch(parsed, -10, tonicToPitchClass("C")!, "major", 0);
    expect(result.outOfRange).toBe(true);
    expect(result.midiPitch).toBe(0);
  });

  it("flags pitches above 127 as out of range and clamps", () => {
    const parsed = parseScaleDegree("1")!;
    const result = resolvePitch(parsed, 10, tonicToPitchClass("C")!, "major", 8);
    expect(result.outOfRange).toBe(true);
    expect(result.midiPitch).toBe(127);
  });

  it("does not flag pitches within range", () => {
    const parsed = parseScaleDegree("1")!;
    const result = resolvePitch(parsed, 0, tonicToPitchClass("C")!, "major", 4);
    expect(result.outOfRange).toBe(false);
  });
});

describe("scale name normalization", () => {
  it.each([
    ["major", "major"],
    ["Major", "major"],
    ["minor", "minor"],
    ["natural minor", "naturalMinor"],
    ["harmonic minor", "harmonicMinor"],
    ["melodic minor", "melodicMinor"],
    ["dorian", "dorian"],
    ["phrygian", "phrygian"],
    ["lydian", "lydian"],
    ["mixolydian", "mixolydian"],
    ["locrian", "locrian"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeScaleName(input)).toBe(expected);
  });

  it("rejects unsupported scale names", () => {
    expect(normalizeScaleName("bebop")).toBeNull();
  });
});
