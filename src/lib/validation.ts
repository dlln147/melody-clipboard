import type { ParseError, ParseWarning } from "../types/melody";

export function makeError(message: string, path?: string): ParseError {
  return path ? { message, path } : { message };
}

export function makeWarning(code: string, message: string): ParseWarning {
  return { code, message };
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
