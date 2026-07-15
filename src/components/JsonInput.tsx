import { forwardRef } from "react";
import type { MelodySummary, ParseResult, ParseWarning } from "../types/melody";

interface JsonInputProps {
  value: string;
  onChange: (value: string) => void;
  onPasteFromClipboard: () => void;
  onClear: () => void;
  onLoadExample: () => void;
  parseResult: ParseResult | null;
  summary: MelodySummary | null;
  warnings: ParseWarning[];
  clipboardBannerVisible: boolean;
  onLoadClipboardBanner: () => void;
  onDismissClipboardBanner: () => void;
}

function formatBeatsBars(beats: number, bars: number): string {
  return `${beats.toFixed(2)} beats (${bars.toFixed(2)} bars)`;
}

const JsonInput = forwardRef<HTMLTextAreaElement, JsonInputProps>(function JsonInput(
  {
    value,
    onChange,
    onPasteFromClipboard,
    onClear,
    onLoadExample,
    parseResult,
    summary,
    warnings,
    clipboardBannerVisible,
    onLoadClipboardBanner,
    onDismissClipboardBanner,
  },
  ref,
) {
  return (
    <section className="card" aria-labelledby="json-input-heading">
      <div className="card-header">
        <h2 id="json-input-heading">Melody JSON</h2>
        <div className="button-row">
          <button type="button" onClick={onPasteFromClipboard}>
            Paste from Clipboard
          </button>
          <button type="button" onClick={onLoadExample}>
            Example Data
          </button>
          <button type="button" className="secondary" onClick={onClear} disabled={value.length === 0}>
            Clear
          </button>
        </div>
      </div>

      {clipboardBannerVisible && (
        <div className="banner" role="status">
          <span>Compatible melody data found in clipboard.</span>
          <div className="banner-actions">
            <button type="button" onClick={onLoadClipboardBanner}>
              Load Clipboard Data
            </button>
            <button
              type="button"
              className="text-button"
              onClick={onDismissClipboardBanner}
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <label className="sr-only" htmlFor="json-textarea">
        Hooktheory clipboard JSON
      </label>
      <textarea
        id="json-textarea"
        ref={ref}
        className="json-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste Hooktheory clipboard JSON here…"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />

      <div className="status-area" aria-live="polite">
        {!parseResult && <p className="status-neutral">Paste melody JSON to get started.</p>}
        {parseResult && !parseResult.ok && (
          <p className="status-error" role="alert">
            <strong>Error:</strong> {parseResult.error!.message}
            {parseResult.error!.path && <span className="status-path"> (at {parseResult.error!.path})</span>}
          </p>
        )}
        {parseResult && parseResult.ok && summary && (
          <div className="status-success">
            <p>
              <strong>{summary.noteCount} notes detected</strong>
              {summary.usedModern ? " · modern payload" : " · legacy payload"}
            </p>
            <dl className="summary-grid">
              <div>
                <dt>Key</dt>
                <dd>
                  {summary.detectedTonic ?? "—"} {summary.detectedScale ?? ""}
                </dd>
              </div>
              <div>
                <dt>Length</dt>
                <dd>{formatBeatsBars(summary.lengthBeats, summary.lengthBars)}</dd>
              </div>
              <div>
                <dt>Earliest note</dt>
                <dd>tick {summary.earliestNoteTick}</dd>
              </div>
              <div>
                <dt>Latest note</dt>
                <dd>tick {summary.latestNoteTick}</dd>
              </div>
            </dl>
          </div>
        )}
        {warnings.length > 0 && (
          <ul className="warning-list">
            {warnings.map((w) => (
              <li key={w.code}>{w.message}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
});

export default JsonInput;
