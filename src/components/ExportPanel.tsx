export type StatusKind = "idle" | "success" | "error";

interface ExportPanelProps {
  canExport: boolean;
  exporting: boolean;
  onExport: () => void;
  onCopySummary: () => void;
  statusMessage: string | null;
  statusKind: StatusKind;
}

export default function ExportPanel({
  canExport,
  exporting,
  onExport,
  onCopySummary,
  statusMessage,
  statusKind,
}: ExportPanelProps) {
  return (
    <footer className="footer">
      <div className="button-row">
        <button type="button" className="primary" onClick={onExport} disabled={!canExport || exporting}>
          {exporting ? "Exporting…" : "Export MIDI"}
        </button>
        <button type="button" className="secondary" onClick={onCopySummary} disabled={!canExport}>
          Copy Conversion Summary
        </button>
      </div>
      <div className="footer-status" role="status" aria-live="polite">
        {statusMessage && (
          <p
            className={
              statusKind === "error" ? "status-error" : statusKind === "success" ? "status-success-text" : ""
            }
          >
            {statusKind === "error" ? <strong>Error: </strong> : null}
            {statusMessage}
          </p>
        )}
      </div>
    </footer>
  );
}
