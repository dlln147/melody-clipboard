import { describe, expect, it } from "vitest";
import { parseClipboardJson } from "../clipboardParser";

describe("legacy beat-to-tick conversion", () => {
  it("converts beat 2.5 to tick 720 and duration 0.25 to 120 ticks", () => {
    const result = parseClipboardJson(
      JSON.stringify({
        notes: [{ beat: 2.5, duration: 0.25, sd: "1", octave: 0, isRest: false }],
        keys: [{ beat: 1, scale: "major", tonic: "F#" }],
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.source!.notes[0]!.startTick).toBe(720);
    expect(result.source!.notes[0]!.durationTicks).toBe(120);
  });

  it("converts beat 1 to tick 0", () => {
    const result = parseClipboardJson(
      JSON.stringify({
        notes: [{ beat: 1, duration: 1, sd: "1", octave: 0, isRest: false }],
        keys: [{ beat: 1, scale: "major", tonic: "C" }],
      }),
    );
    expect(result.source!.notes[0]!.startTick).toBe(0);
  });
});

describe("modern tick preservation", () => {
  it("uses modern startTick/durationTicks verbatim when the payload is valid", () => {
    const result = parseClipboardJson(
      JSON.stringify({
        notes: [{ beat: 1, duration: 1, sd: "1", octave: 0, isRest: false }],
        keys: [{ beat: 1, scale: "major", tonic: "C" }],
        modern: {
          payload: {
            notes: [{ sd: "1", octave: 0, startTick: 720, durationTicks: 120, isRest: false, voice: 1 }],
            keys: [{ startTick: 0, scale: "major", tonic: "F#" }],
          },
        },
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.source!.usedModern).toBe(true);
    expect(result.source!.notes[0]!.startTick).toBe(720);
    expect(result.source!.notes[0]!.durationTicks).toBe(120);
  });

  it("falls back to legacy data when the modern payload is invalid", () => {
    const result = parseClipboardJson(
      JSON.stringify({
        notes: [{ beat: 1, duration: 1, sd: "1", octave: 0, isRest: false }],
        keys: [{ beat: 1, scale: "major", tonic: "C" }],
        modern: { payload: { notes: "not-an-array" } },
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.source!.usedModern).toBe(false);
    expect(result.warnings.some((w) => w.code === "modernInvalidFallback")).toBe(true);
  });
});

describe("rests", () => {
  it("parses rest items without requiring sd and marks isRest", () => {
    const result = parseClipboardJson(
      JSON.stringify({
        notes: [
          { beat: 1, duration: 1, isRest: true },
          { beat: 2, duration: 1, sd: "1", octave: 0, isRest: false },
        ],
        keys: [{ beat: 1, scale: "major", tonic: "C" }],
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.source!.notes[0]!.isRest).toBe(true);
    expect(result.warnings.some((w) => w.code === "restsSkipped")).toBe(true);
  });
});

describe("malformed JSON", () => {
  it("rejects empty input", () => {
    const result = parseClipboardJson("");
    expect(result.ok).toBe(false);
    expect(result.error!.message.length).toBeGreaterThan(0);
  });

  it("rejects whitespace-only input", () => {
    const result = parseClipboardJson("   \n\t  ");
    expect(result.ok).toBe(false);
  });

  it("rejects syntactically invalid JSON without a raw stack trace", () => {
    const result = parseClipboardJson("{ notes: [ }");
    expect(result.ok).toBe(false);
    expect(result.error!.message).not.toMatch(/at Object|node_modules|\.ts:\d+:\d+/);
  });

  it("rejects a non-object JSON root", () => {
    const result = parseClipboardJson("[1,2,3]");
    expect(result.ok).toBe(false);
  });
});

describe("empty note arrays", () => {
  it("accepts an empty notes array without throwing", () => {
    const result = parseClipboardJson(JSON.stringify({ notes: [], keys: [] }));
    expect(result.ok).toBe(true);
    expect(result.source!.notes).toHaveLength(0);
  });

  it("rejects input with neither notes nor a modern payload", () => {
    const result = parseClipboardJson(JSON.stringify({ foo: "bar" }));
    expect(result.ok).toBe(false);
  });
});

describe("validation rejections", () => {
  it("rejects negative durations", () => {
    const result = parseClipboardJson(
      JSON.stringify({ notes: [{ beat: 1, duration: -1, sd: "1" }], keys: [] }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects zero-duration notes", () => {
    const result = parseClipboardJson(
      JSON.stringify({ notes: [{ beat: 1, duration: 0, sd: "1" }], keys: [] }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects non-finite numbers", () => {
    const result = parseClipboardJson(
      JSON.stringify({ notes: [{ beat: "NaN", duration: 1, sd: "1" }], keys: [] }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects invalid scale degrees with the offending value named", () => {
    const result = parseClipboardJson(
      JSON.stringify({ notes: [{ beat: 1, duration: 1, sd: "x5" }], keys: [] }),
    );
    expect(result.ok).toBe(false);
    expect(result.error!.message).toContain("x5");
  });

  it("rejects unsupported tonic values", () => {
    const result = parseClipboardJson(
      JSON.stringify({
        notes: [{ beat: 1, duration: 1, sd: "1" }],
        keys: [{ beat: 1, scale: "major", tonic: "H#" }],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects unsupported scales", () => {
    const result = parseClipboardJson(
      JSON.stringify({
        notes: [{ beat: 1, duration: 1, sd: "1" }],
        keys: [{ beat: 1, scale: "bebop", tonic: "C" }],
      }),
    );
    expect(result.ok).toBe(false);
  });
});

describe("f-sharp-major-melody fixture", () => {
  it("parses the fixture, preferring the modern payload", async () => {
    const fixture = await import("../../../fixtures/f-sharp-major-melody.json?raw");
    const result = parseClipboardJson(fixture.default);
    expect(result.ok).toBe(true);
    expect(result.source!.usedModern).toBe(true);
    expect(result.source!.keys[0]!.tonic).toBe("F#");
    expect(result.source!.keys[0]!.scale).toBe("major");
    expect(result.source!.notes[0]!.startTick).toBe(720);
    expect(result.source!.notes[0]!.durationTicks).toBe(120);
    const nonRest = result.source!.notes.filter((n) => !n.isRest);
    expect(nonRest).toHaveLength(54);
  });
});
