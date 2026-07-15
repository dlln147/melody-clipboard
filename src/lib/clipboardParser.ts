import type {
  HooktheoryClipboardData,
  LegacyKey,
  LegacyNote,
  ModernKey,
  ModernNote,
} from "../types/hooktheory";
import type { ParseResult, ParseWarning, SourceKey, SourceMelody, SourceNote } from "../types/melody";
import { PPQ } from "../types/melody";
import { normalizeScaleName, parseScaleDegree, tonicToPitchClass } from "./musicTheory";
import { isFiniteNumber, isNonEmptyString, makeError, makeWarning } from "./validation";

function legacyBeatToTick(beat: number): number {
  return Math.round((beat - 1) * PPQ);
}

function fail(message: string, path?: string): ParseResult {
  return { ok: false, error: makeError(message, path), warnings: [] };
}

/** Parses raw clipboard text into a normalized SourceMelody, or a descriptive error. */
export function parseClipboardJson(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return fail("Paste Hooktheory clipboard JSON to get started.");
  }

  let root: unknown;
  try {
    root = JSON.parse(trimmed);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return fail(`Invalid JSON: ${detail}`);
  }

  if (typeof root !== "object" || root === null || Array.isArray(root)) {
    return fail("Expected a JSON object at the top level.");
  }

  const data = root as HooktheoryClipboardData;
  const warnings: ParseWarning[] = [];

  let source: SourceMelody | null = null;

  if (data.modern && typeof data.modern === "object") {
    const modernResult = tryParseModern(data.modern.payload);
    if (modernResult.ok) {
      source = modernResult.source!;
    } else if (data.modern.payload !== undefined) {
      warnings.push(
        makeWarning(
          "modernInvalidFallback",
          `Modern payload was invalid (${modernResult.error!.message}), falling back to legacy data.`,
        ),
      );
    }
  }

  if (!source) {
    const legacyResult = tryParseLegacy(data);
    if (!legacyResult.ok) {
      return legacyResult.error
        ? { ok: false, error: legacyResult.error, warnings }
        : fail("No note data found. Expected a 'notes' array or a 'modern' payload.");
    }
    source = legacyResult.source!;
  }

  warnings.push(...collectSourceWarnings(source));

  return { ok: true, source, warnings };
}

interface InternalParseResult {
  ok: boolean;
  source?: SourceMelody;
  error?: { message: string; path?: string };
}

function tryParseModern(payload: unknown): InternalParseResult {
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, error: { message: "missing payload" } };
  }
  const p = payload as { notes?: unknown; keys?: unknown };
  if (!Array.isArray(p.notes)) {
    return { ok: false, error: { message: "payload.notes is not an array" } };
  }

  const notes: SourceNote[] = [];
  for (let i = 0; i < p.notes.length; i++) {
    const raw = p.notes[i] as ModernNote;
    const path = `modern.payload.notes[${i}]`;
    if (typeof raw !== "object" || raw === null) {
      return { ok: false, error: { message: "note is not an object", path } };
    }
    if (!isFiniteNumber(raw.startTick)) {
      return {
        ok: false,
        error: { message: "startTick must be a finite number", path: `${path}.startTick` },
      };
    }
    if (!isFiniteNumber(raw.durationTicks)) {
      return {
        ok: false,
        error: { message: "durationTicks must be a finite number", path: `${path}.durationTicks` },
      };
    }
    if (raw.durationTicks <= 0) {
      return {
        ok: false,
        error: { message: "durationTicks must be positive", path: `${path}.durationTicks` },
      };
    }
    if (raw.startTick < 0) {
      return { ok: false, error: { message: "startTick must not be negative", path: `${path}.startTick` } };
    }
    const isRest = raw.isRest === true;
    if (!isRest) {
      if (!isNonEmptyString(raw.sd)) {
        return { ok: false, error: { message: "sd is required for non-rest notes", path: `${path}.sd` } };
      }
      if (!parseScaleDegree(raw.sd)) {
        return { ok: false, error: { message: `Unsupported scale degree "${raw.sd}"`, path: `${path}.sd` } };
      }
    }
    const octave = raw.octave ?? 0;
    if (!isFiniteNumber(octave)) {
      return { ok: false, error: { message: "octave must be a finite number", path: `${path}.octave` } };
    }
    const voice = raw.voice ?? 1;
    if (!isFiniteNumber(voice)) {
      return { ok: false, error: { message: "voice must be a finite number", path: `${path}.voice` } };
    }
    notes.push({
      sd: isRest ? "1" : raw.sd,
      octave,
      startTick: Math.round(raw.startTick),
      durationTicks: Math.round(raw.durationTicks),
      isRest,
      voice,
    });
  }

  const keys: SourceKey[] = [];
  if (p.keys !== undefined) {
    if (!Array.isArray(p.keys)) {
      return { ok: false, error: { message: "payload.keys is not an array" } };
    }
    for (let i = 0; i < p.keys.length; i++) {
      const raw = p.keys[i] as ModernKey;
      const path = `modern.payload.keys[${i}]`;
      if (typeof raw !== "object" || raw === null) {
        return { ok: false, error: { message: "key is not an object", path } };
      }
      if (!isFiniteNumber(raw.startTick)) {
        return {
          ok: false,
          error: { message: "startTick must be a finite number", path: `${path}.startTick` },
        };
      }
      if (!isNonEmptyString(raw.tonic) || tonicToPitchClass(raw.tonic) === null) {
        return { ok: false, error: { message: `Unsupported tonic "${raw.tonic}"`, path: `${path}.tonic` } };
      }
      if (!isNonEmptyString(raw.scale) || normalizeScaleName(raw.scale) === null) {
        return { ok: false, error: { message: `Unsupported scale "${raw.scale}"`, path: `${path}.scale` } };
      }
      keys.push({ startTick: Math.round(raw.startTick), tonic: raw.tonic, scale: raw.scale });
    }
  }

  return { ok: true, source: { notes, keys, usedModern: true } };
}

function tryParseLegacy(data: HooktheoryClipboardData): InternalParseResult {
  if (!Array.isArray(data.notes)) {
    return { ok: false, error: undefined };
  }

  const notes: SourceNote[] = [];
  for (let i = 0; i < data.notes.length; i++) {
    const raw = data.notes[i] as LegacyNote;
    const path = `notes[${i}]`;
    if (typeof raw !== "object" || raw === null) {
      return { ok: false, error: { message: "note is not an object", path } };
    }
    if (!isFiniteNumber(raw.beat)) {
      return { ok: false, error: { message: "beat must be a finite number", path: `${path}.beat` } };
    }
    if (!isFiniteNumber(raw.duration)) {
      return { ok: false, error: { message: "duration must be a finite number", path: `${path}.duration` } };
    }
    if (raw.duration <= 0) {
      return { ok: false, error: { message: "duration must be positive", path: `${path}.duration` } };
    }
    const isRest = raw.isRest === true;
    if (!isRest) {
      if (!isNonEmptyString(raw.sd)) {
        return { ok: false, error: { message: "sd is required for non-rest notes", path: `${path}.sd` } };
      }
      if (!parseScaleDegree(raw.sd)) {
        return { ok: false, error: { message: `Unsupported scale degree "${raw.sd}"`, path: `${path}.sd` } };
      }
    }
    const octave = raw.octave ?? 0;
    if (!isFiniteNumber(octave)) {
      return { ok: false, error: { message: "octave must be a finite number", path: `${path}.octave` } };
    }
    const startTick = legacyBeatToTick(raw.beat);
    if (startTick < 0) {
      return { ok: false, error: { message: "beat must not resolve before tick 0", path: `${path}.beat` } };
    }
    notes.push({
      sd: isRest ? "1" : raw.sd,
      octave,
      startTick,
      durationTicks: Math.round(raw.duration * PPQ),
      isRest,
      voice: 1,
    });
  }

  const keys: SourceKey[] = [];
  const rawKeys = Array.isArray(data.keys) ? data.keys : [];
  for (let i = 0; i < rawKeys.length; i++) {
    const raw = rawKeys[i] as LegacyKey;
    const path = `keys[${i}]`;
    if (typeof raw !== "object" || raw === null) {
      return { ok: false, error: { message: "key is not an object", path } };
    }
    if (!isFiniteNumber(raw.beat)) {
      return { ok: false, error: { message: "beat must be a finite number", path: `${path}.beat` } };
    }
    if (!isNonEmptyString(raw.tonic) || tonicToPitchClass(raw.tonic) === null) {
      return { ok: false, error: { message: `Unsupported tonic "${raw.tonic}"`, path: `${path}.tonic` } };
    }
    if (!isNonEmptyString(raw.scale) || normalizeScaleName(raw.scale) === null) {
      return { ok: false, error: { message: `Unsupported scale "${raw.scale}"`, path: `${path}.scale` } };
    }
    keys.push({ startTick: Math.max(0, legacyBeatToTick(raw.beat)), tonic: raw.tonic, scale: raw.scale });
  }

  return { ok: true, source: { notes, keys, usedModern: false } };
}

function collectSourceWarnings(source: SourceMelody): ParseWarning[] {
  const warnings: ParseWarning[] = [];

  if (source.notes.some((n) => n.isRest)) {
    warnings.push(makeWarning("restsSkipped", "Rest items were skipped when generating notes."));
  }

  if (source.keys.length === 0) {
    warnings.push(makeWarning("noKeyData", "No key data was found in the pasted JSON."));
  } else if (source.keys.length > 1) {
    warnings.push(makeWarning("embeddedKeyChanges", "Embedded key changes were found in the pasted data."));
  }

  const voices = new Set(source.notes.map((n) => n.voice));
  if (voices.size > 1) {
    warnings.push(makeWarning("multipleVoices", "Multiple voices were detected in the pasted data."));
  }

  const nonRest = source.notes.filter((n) => !n.isRest);
  if (nonRest.length > 0) {
    const earliest = Math.min(...nonRest.map((n) => n.startTick));
    if (earliest > 0) {
      warnings.push(makeWarning("beginsAfterBeatOne", "Melody begins after beat one."));
    }
  }

  return warnings;
}
