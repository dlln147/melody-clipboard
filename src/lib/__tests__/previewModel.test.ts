import { describe, expect, it } from "vitest";
import { parseClipboardJson } from "../clipboardParser";
import { resolveMelody, toNormalizedMelody } from "../previewModel";
import { DEFAULT_SETTINGS, type MelodySettings } from "../../types/melody";

const settings: MelodySettings = { ...DEFAULT_SETTINGS, tonic: "F#", scale: "major", baseOctave: 3 };

describe("key changes", () => {
  it("uses the key in effect at each note's start tick", () => {
    const source = parseClipboardJson(
      JSON.stringify({
        notes: [
          { beat: 1, duration: 1, sd: "1", octave: 0 },
          { beat: 3, duration: 1, sd: "1", octave: 0 },
        ],
        keys: [
          { beat: 1, scale: "major", tonic: "C" },
          { beat: 3, scale: "minor", tonic: "D" },
        ],
      }),
    ).source!;

    const { notes } = resolveMelody(source, {
      ...settings,
      baseOctave: 4,
      startAtBeatOne: false,
      respectKeyChanges: true,
    });
    expect(notes[0]!.midiPitch).toBe(60); // C4
    expect(notes[1]!.midiPitch).toBe(62); // D4
  });

  it("ignores embedded key changes when respectKeyChanges is disabled", () => {
    const source = parseClipboardJson(
      JSON.stringify({
        notes: [
          { beat: 1, duration: 1, sd: "1", octave: 0 },
          { beat: 3, duration: 1, sd: "1", octave: 0 },
        ],
        keys: [
          { beat: 1, scale: "major", tonic: "C" },
          { beat: 3, scale: "minor", tonic: "D" },
        ],
      }),
    ).source!;

    const { notes } = resolveMelody(source, {
      ...settings,
      tonic: "C",
      scale: "major",
      baseOctave: 4,
      startAtBeatOne: false,
      respectKeyChanges: false,
    });
    expect(notes[0]!.midiPitch).toBe(60);
    expect(notes[1]!.midiPitch).toBe(60);
  });
});

describe("start-at-beat-one normalization", () => {
  it("shifts the first note to tick 0 while preserving relative gaps", () => {
    const source = parseClipboardJson(
      JSON.stringify({
        notes: [
          { beat: 2.5, duration: 0.25, sd: "1", octave: 0 },
          { beat: 3, duration: 0.5, sd: "3", octave: 0 },
        ],
        keys: [{ beat: 1, scale: "major", tonic: "C" }],
      }),
    ).source!;

    const { notes } = resolveMelody(source, { ...settings, startAtBeatOne: true });
    expect(notes[0]!.startTick).toBe(0);
    // source ticks: 720 and 960 -> offset by 720 -> 0 and 240
    expect(notes[1]!.startTick).toBe(240);
  });

  it("preserves exact source timing when disabled", () => {
    const source = parseClipboardJson(
      JSON.stringify({
        notes: [{ beat: 2.5, duration: 0.25, sd: "1", octave: 0 }],
        keys: [{ beat: 1, scale: "major", tonic: "C" }],
      }),
    ).source!;

    const { notes } = resolveMelody(source, { ...settings, startAtBeatOne: false });
    expect(notes[0]!.startTick).toBe(720);
  });
});

describe("f-sharp-major-melody fixture resolution", () => {
  it("resolves the fixture notes to expected pitches", async () => {
    const fixture = await import("../../../fixtures/f-sharp-major-melody.json?raw");
    const parsed = parseClipboardJson(fixture.default);
    expect(parsed.ok).toBe(true);

    const { notes, summary } = resolveMelody(parsed.source!, {
      ...settings,
      startAtBeatOne: false,
    });

    expect(notes[0]!.midiPitch).toBe(54); // F#3
    expect(notes[2]!.midiPitch).toBe(66); // F#4
    expect(notes[3]!.midiPitch).toBe(65); // E#4 (spelled F4)
    expect(summary.noteCount).toBe(54);
  });

  it("moves the first note to tick 0 with start-at-beat-one enabled", async () => {
    const fixture = await import("../../../fixtures/f-sharp-major-melody.json?raw");
    const parsed = parseClipboardJson(fixture.default);
    const { notes } = resolveMelody(parsed.source!, { ...settings, startAtBeatOne: true });
    expect(notes[0]!.startTick).toBe(0);
  });

  it("produces a normalized melody consumable by the Rust backend", async () => {
    const fixture = await import("../../../fixtures/f-sharp-major-melody.json?raw");
    const parsed = parseClipboardJson(fixture.default);
    const { notes } = resolveMelody(parsed.source!, { ...settings, startAtBeatOne: true });
    const normalized = toNormalizedMelody(notes, settings);
    expect(normalized.ppq).toBe(480);
    expect(normalized.notes).toHaveLength(54);
  });
});
