import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

import JsonInput from "./components/JsonInput";
import SongSettings from "./components/SongSettings";
import MelodyPreview from "./components/MelodyPreview";
import ExportPanel, { type StatusKind } from "./components/ExportPanel";

import { parseClipboardJson } from "./lib/clipboardParser";
import { resolveMelody, toNormalizedMelody } from "./lib/previewModel";
import { SCALE_LABELS, tonicScaleToFilenameFragment } from "./lib/musicTheory";
import { loadPreferences, savePreference } from "./lib/preferences";
import { DEFAULT_SETTINGS, type ExportSummary, type MelodySettings, type ParseWarning } from "./types/melody";

import exampleFixtureRaw from "../fixtures/f-sharp-major-melody.json?raw";

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-");
}

export default function App() {
  const [rawJson, setRawJson] = useState("");
  const [settings, setSettings] = useState<MelodySettings>(DEFAULT_SETTINGS);
  const [clipboardBannerVisible, setClipboardBannerVisible] = useState(false);
  const [clipboardCandidate, setClipboardCandidate] = useState<string | null>(null);
  const [footerStatus, setFooterStatus] = useState<{ message: string | null; kind: StatusKind }>({
    message: null,
    kind: "idle",
  });
  const [exporting, setExporting] = useState(false);

  const autoDetectedRef = useRef(false);
  const lastExportDirRef = useRef<string | null>(null);
  const prefsLoadedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const parseResult = useMemo(
    () => (rawJson.trim().length > 0 ? parseClipboardJson(rawJson) : null),
    [rawJson],
  );

  const resolveResult = useMemo(() => {
    if (!parseResult?.ok || !parseResult.source) return null;
    return resolveMelody(parseResult.source, settings);
  }, [parseResult, settings]);

  const warnings: ParseWarning[] = useMemo(() => {
    const parseWarnings = parseResult?.warnings ?? [];
    const resolveWarnings = resolveResult?.warnings ?? [];
    return [...parseWarnings, ...resolveWarnings];
  }, [parseResult, resolveResult]);

  const canExport = Boolean(parseResult?.ok && resolveResult && resolveResult.notes.length > 0);

  // Auto-detect tonic/scale defaults the first time a melody successfully loads.
  useEffect(() => {
    if (!parseResult?.ok || !resolveResult) return;
    if (autoDetectedRef.current) return;
    const { detectedTonic, detectedScale } = resolveResult.summary;
    if (detectedTonic || detectedScale) {
      setSettings((prev) => ({
        ...prev,
        tonic: detectedTonic ?? prev.tonic,
        scale: detectedScale ?? prev.scale,
      }));
    }
    autoDetectedRef.current = true;
  }, [parseResult, resolveResult]);

  // Load persisted preferences once on mount.
  useEffect(() => {
    let cancelled = false;
    loadPreferences().then((prefs) => {
      if (cancelled) return;
      setSettings((prev) => ({
        ...prev,
        tempoBpm: prefs.tempoBpm ?? prev.tempoBpm,
        velocity: prefs.velocity ?? prev.velocity,
        baseOctave: prefs.baseOctave ?? prev.baseOctave,
        timeSignatureNumerator: prefs.timeSignatureNumerator ?? prev.timeSignatureNumerator,
        timeSignatureDenominator: prefs.timeSignatureDenominator ?? prev.timeSignatureDenominator,
        startAtBeatOne: prefs.startAtBeatOne ?? prev.startAtBeatOne,
        respectKeyChanges: prefs.respectKeyChanges ?? prev.respectKeyChanges,
      }));
      lastExportDirRef.current = prefs.lastExportDir ?? null;
      prefsLoadedRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist relevant settings whenever they change (after initial load).
  useEffect(() => {
    if (!prefsLoadedRef.current) return;
    savePreference("tempoBpm", settings.tempoBpm);
    savePreference("velocity", settings.velocity);
    savePreference("baseOctave", settings.baseOctave);
    savePreference("timeSignatureNumerator", settings.timeSignatureNumerator);
    savePreference("timeSignatureDenominator", settings.timeSignatureDenominator);
    savePreference("startAtBeatOne", settings.startAtBeatOne);
    savePreference("respectKeyChanges", settings.respectKeyChanges);
  }, [settings]);

  // Check the clipboard once, after the window is ready, without overwriting user input.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const text = await readText();
        if (cancelled || !text || rawJson.trim().length > 0) return;
        const result = parseClipboardJson(text);
        if (result.ok) {
          setClipboardCandidate(text);
          setClipboardBannerVisible(true);
        }
      } catch {
        // Clipboard access can fail (permissions, empty clipboard); ignore silently.
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSettingsChange = useCallback((patch: Partial<MelodySettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await readText();
      if (text) {
        setRawJson(text);
        autoDetectedRef.current = false;
      }
    } catch {
      setFooterStatus({ message: "Could not read from clipboard.", kind: "error" });
    }
  }, []);

  const handleClear = useCallback(() => {
    setRawJson("");
    autoDetectedRef.current = false;
    setFooterStatus({ message: null, kind: "idle" });
  }, []);

  const handleLoadExample = useCallback(() => {
    setRawJson(exampleFixtureRaw);
    autoDetectedRef.current = false;
  }, []);

  const handleLoadClipboardBanner = useCallback(() => {
    if (clipboardCandidate) {
      setRawJson(clipboardCandidate);
      autoDetectedRef.current = false;
    }
    setClipboardBannerVisible(false);
  }, [clipboardCandidate]);

  const handleDismissClipboardBanner = useCallback(() => {
    setClipboardBannerVisible(false);
  }, []);

  const handleExport = useCallback(async () => {
    if (!resolveResult || resolveResult.notes.length === 0) return;
    setExporting(true);
    try {
      const normalized = toNormalizedMelody(resolveResult.notes, settings);
      const fragment = tonicScaleToFilenameFragment(settings.tonic, settings.scale);
      const suggestedName = sanitizeFilename(`melody-${fragment}.mid`);
      const defaultPath = lastExportDirRef.current
        ? `${lastExportDirRef.current}/${suggestedName}`
        : suggestedName;

      const chosenPath = await save({
        defaultPath,
        filters: [{ name: "MIDI", extensions: ["mid"] }],
      });

      if (!chosenPath) {
        setExporting(false);
        return;
      }

      const summary = await invoke<ExportSummary>("generate_midi", {
        melody: normalized,
        outputPath: chosenPath,
      });

      setFooterStatus({
        message: `Exported ${summary.noteCount} notes (${summary.durationBeats.toFixed(2)} beats) to ${summary.path}`,
        kind: "success",
      });

      const lastSlash = Math.max(chosenPath.lastIndexOf("/"), chosenPath.lastIndexOf("\\"));
      if (lastSlash > 0) {
        const dir = chosenPath.slice(0, lastSlash);
        lastExportDirRef.current = dir;
        void savePreference("lastExportDir", dir);
      }
    } catch (err) {
      setFooterStatus({ message: err instanceof Error ? err.message : String(err), kind: "error" });
    } finally {
      setExporting(false);
    }
  }, [resolveResult, settings]);

  const handleCopySummary = useCallback(async () => {
    if (!resolveResult) return;
    const { summary } = resolveResult;
    const lines = [
      "Melody Clipboard summary",
      `Key: ${settings.tonic} ${SCALE_LABELS[settings.scale]}`,
      `Notes: ${summary.noteCount}`,
      `Length: ${summary.lengthBeats.toFixed(2)} beats (${summary.lengthBars.toFixed(2)} bars)`,
      `Tempo: ${settings.tempoBpm} BPM`,
      `Time signature: ${settings.timeSignatureNumerator}/${settings.timeSignatureDenominator}`,
    ];
    try {
      await writeText(lines.join("\n"));
      setFooterStatus({ message: "Conversion summary copied to clipboard.", kind: "success" });
    } catch {
      setFooterStatus({ message: "Could not copy summary to clipboard.", kind: "error" });
    }
  }, [resolveResult, settings]);

  const canExportRef = useRef(canExport);
  canExportRef.current = canExport;
  const handleExportRef = useRef(handleExport);
  handleExportRef.current = handleExport;
  const handleClearRef = useRef(handleClear);
  handleClearRef.current = handleClear;
  const handlePasteRef = useRef(handlePasteFromClipboard);
  handlePasteRef.current = handlePasteFromClipboard;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) {
        if (e.key === "Escape") {
          setClipboardBannerVisible(false);
          setFooterStatus({ message: null, kind: "idle" });
        }
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "v" && e.shiftKey) {
        e.preventDefault();
        void handlePasteRef.current();
      } else if (key === "e") {
        e.preventDefault();
        if (canExportRef.current) void handleExportRef.current();
      } else if (key === "l") {
        e.preventDefault();
        handleClearRef.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Melody Clipboard</h1>
        <p className="subtitle">Clipboard melody to MIDI</p>
      </header>

      <main className="app-main">
        <JsonInput
          ref={textareaRef}
          value={rawJson}
          onChange={setRawJson}
          onPasteFromClipboard={handlePasteFromClipboard}
          onClear={handleClear}
          onLoadExample={handleLoadExample}
          parseResult={parseResult}
          summary={resolveResult?.summary ?? null}
          warnings={warnings}
          clipboardBannerVisible={clipboardBannerVisible}
          onLoadClipboardBanner={handleLoadClipboardBanner}
          onDismissClipboardBanner={handleDismissClipboardBanner}
        />

        <SongSettings settings={settings} onChange={handleSettingsChange} />

        <MelodyPreview
          notes={resolveResult?.notes ?? []}
          ppq={480}
          timeSignatureNumerator={settings.timeSignatureNumerator}
        />
      </main>

      <ExportPanel
        canExport={canExport}
        exporting={exporting}
        onExport={handleExport}
        onCopySummary={handleCopySummary}
        statusMessage={footerStatus.message}
        statusKind={footerStatus.kind}
      />
    </div>
  );
}
