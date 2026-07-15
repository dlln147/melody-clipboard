import type { ChangeEvent } from "react";
import type { MelodySettings, ScaleName } from "../types/melody";
import { SCALE_LABELS, TONIC_OPTIONS } from "../lib/musicTheory";

interface SongSettingsProps {
  settings: MelodySettings;
  onChange: (patch: Partial<MelodySettings>) => void;
}

const SCALE_NAMES = Object.keys(SCALE_LABELS) as ScaleName[];
const BASE_OCTAVES = Array.from({ length: 9 }, (_, i) => i - 1); // -1..7
const TIME_SIG_DENOMINATORS = [1, 2, 4, 8, 16, 32];

export default function SongSettings({ settings, onChange }: SongSettingsProps) {
  const handleNumber = (key: keyof MelodySettings) => (e: ChangeEvent<HTMLInputElement>) => {
    const num = Number(e.target.value);
    if (Number.isFinite(num)) onChange({ [key]: num } as Partial<MelodySettings>);
  };

  return (
    <section className="card" aria-labelledby="song-settings-heading">
      <div className="card-header">
        <h2 id="song-settings-heading">Song Settings</h2>
      </div>

      <div className="settings-grid">
        <div className="field">
          <label htmlFor="tonic-select">Tonic</label>
          <select
            id="tonic-select"
            value={settings.tonic}
            onChange={(e) => onChange({ tonic: e.target.value })}
          >
            {TONIC_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="scale-select">Scale</label>
          <select
            id="scale-select"
            value={settings.scale}
            onChange={(e) => onChange({ scale: e.target.value as ScaleName })}
          >
            {SCALE_NAMES.map((s) => (
              <option key={s} value={s}>
                {SCALE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="base-octave-select">Base Octave</label>
          <select
            id="base-octave-select"
            value={settings.baseOctave}
            onChange={(e) => onChange({ baseOctave: Number(e.target.value) })}
          >
            {BASE_OCTAVES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="tempo-input">Tempo (BPM)</label>
          <input
            id="tempo-input"
            type="number"
            min={1}
            max={999}
            value={settings.tempoBpm}
            onChange={handleNumber("tempoBpm")}
          />
        </div>

        <div className="field field-inline">
          <label htmlFor="time-sig-num">Time Signature</label>
          <div className="time-sig-inputs">
            <input
              id="time-sig-num"
              type="number"
              min={1}
              max={32}
              aria-label="Time signature numerator"
              value={settings.timeSignatureNumerator}
              onChange={handleNumber("timeSignatureNumerator")}
            />
            <span aria-hidden="true">/</span>
            <select
              aria-label="Time signature denominator"
              value={settings.timeSignatureDenominator}
              onChange={(e) => onChange({ timeSignatureDenominator: Number(e.target.value) })}
            >
              {TIME_SIG_DENOMINATORS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="velocity-input">Velocity</label>
          <input
            id="velocity-input"
            type="number"
            min={0}
            max={127}
            value={settings.velocity}
            onChange={handleNumber("velocity")}
          />
        </div>
      </div>

      <div className="toggle-list">
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.startAtBeatOne}
            onChange={(e) => onChange({ startAtBeatOne: e.target.checked })}
          />
          Start at beat one
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.respectKeyChanges}
            onChange={(e) => onChange({ respectKeyChanges: e.target.checked })}
          />
          Respect embedded key changes
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.includeTempoMeta}
            onChange={(e) => onChange({ includeTempoMeta: e.target.checked })}
          />
          Include tempo metadata
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.includeTimeSignatureMeta}
            onChange={(e) => onChange({ includeTimeSignatureMeta: e.target.checked })}
          />
          Include time-signature metadata
        </label>
      </div>
    </section>
  );
}
