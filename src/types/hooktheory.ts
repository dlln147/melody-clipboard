/**
 * Raw shapes for Hooktheory/Hookpad clipboard JSON.
 * These are intentionally permissive (unknown fields ignored) since the
 * parser is responsible for strict validation.
 */

export interface LegacyNote {
  beat: number;
  duration: number;
  sd: string;
  octave?: number;
  isRest?: boolean;
}

export interface LegacyKey {
  beat: number;
  scale: string;
  tonic: string;
}

export interface ModernNote {
  id?: string;
  sd: string;
  octave?: number;
  startTick: number;
  durationTicks: number;
  isRest?: boolean;
  voice?: number;
}

export interface ModernKey {
  id?: string;
  startTick: number;
  scale: string;
  tonic: string;
}

export interface ModernPayload {
  notes: ModernNote[];
  keys: ModernKey[];
  [key: string]: unknown;
}

export interface ModernBlock {
  version?: string;
  fp?: string;
  payload: ModernPayload;
}

export interface HooktheoryClipboardData {
  notes?: LegacyNote[];
  keys?: LegacyKey[];
  modern?: ModernBlock;
  fp?: string;
  [key: string]: unknown;
}
