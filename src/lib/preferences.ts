import { load, type Store } from "@tauri-apps/plugin-store";

export interface PersistedPreferences {
  tempoBpm: number;
  velocity: number;
  baseOctave: number;
  timeSignatureNumerator: number;
  timeSignatureDenominator: number;
  startAtBeatOne: boolean;
  respectKeyChanges: boolean;
  lastExportDir: string | null;
}

const STORE_FILE = "preferences.json";
let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(STORE_FILE, { defaults: {}, autoSave: true });
  }
  return storePromise;
}

/** Loads persisted preferences. Returns an empty object if none are stored yet. */
export async function loadPreferences(): Promise<Partial<PersistedPreferences>> {
  try {
    const store = await getStore();
    const entries = await store.entries();
    const result: Partial<PersistedPreferences> = {};
    for (const [key, value] of entries) {
      (result as Record<string, unknown>)[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

/** Persists a single preference value. Silently no-ops if storage is unavailable. */
export async function savePreference<K extends keyof PersistedPreferences>(
  key: K,
  value: PersistedPreferences[K],
): Promise<void> {
  try {
    const store = await getStore();
    await store.set(key, value);
  } catch {
    // Preferences are best-effort; ignore storage failures.
  }
}
