import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { ResolvedNote } from "../types/melody";
import { midiPitchToName } from "../lib/musicTheory";

interface MelodyPreviewProps {
  notes: ResolvedNote[];
  ppq: number;
  timeSignatureNumerator: number;
}

const PX_PER_BEAT = 32;
const ROW_HEIGHT = 10;
const NOTE_INSET = 1;

export default function MelodyPreview({ notes, ppq, timeSignatureNumerator }: MelodyPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; label: string } | null>(null);

  const { minPitch, maxPitch, totalBeats } = useMemo(() => {
    if (notes.length === 0) {
      return { minPitch: 60, maxPitch: 72, totalBeats: 4 };
    }
    const pitches = notes.map((n) => n.midiPitch);
    const endTicks = notes.map((n) => n.startTick + n.durationTicks);
    const maxTick = Math.max(...endTicks);
    return {
      minPitch: Math.min(...pitches) - 2,
      maxPitch: Math.max(...pitches) + 2,
      totalBeats: Math.max(4, Math.ceil(maxTick / ppq)),
    };
  }, [notes, ppq]);

  const pitchRange = maxPitch - minPitch + 1;
  const width = Math.max(320, totalBeats * PX_PER_BEAT);
  const height = Math.max(160, pitchRange * ROW_HEIGHT);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "#17171a";
    ctx.fillRect(0, 0, width, height);

    for (let beat = 0; beat <= totalBeats; beat++) {
      const x = beat * PX_PER_BEAT + 0.5;
      const isBar = beat % timeSignatureNumerator === 0;
      ctx.strokeStyle = isBar ? "#3a3a40" : "#232326";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    ctx.fillStyle = "#5ed1ac";
    for (const note of notes) {
      const x = (note.startTick / ppq) * PX_PER_BEAT;
      const w = Math.max(2, (note.durationTicks / ppq) * PX_PER_BEAT - NOTE_INSET);
      const row = maxPitch - note.midiPitch;
      const y = row * ROW_HEIGHT + NOTE_INSET;
      const h = ROW_HEIGHT - NOTE_INSET * 2;
      ctx.fillRect(x, y, w, h);
    }
  }, [notes, width, height, totalBeats, ppq, timeSignatureNumerator, minPitch, maxPitch]);

  function handleMouseMove(e: ReactMouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const tick = (x / PX_PER_BEAT) * ppq;
    const row = Math.floor(y / ROW_HEIGHT);
    const pitch = maxPitch - row;
    const hit = notes.find(
      (n) => n.midiPitch === pitch && tick >= n.startTick && tick <= n.startTick + n.durationTicks,
    );
    setHover(hit ? { x, y, label: midiPitchToName(hit.midiPitch) } : null);
  }

  return (
    <section className="card" aria-labelledby="preview-heading">
      <div className="card-header">
        <h2 id="preview-heading">Preview</h2>
      </div>
      {notes.length === 0 ? (
        <p className="status-neutral">No notes to preview yet.</p>
      ) : (
        <div className="preview-scroll">
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHover(null)}
            role="img"
            aria-label={`Piano roll preview of ${notes.length} notes`}
          />
          {hover && (
            <div className="preview-tooltip" style={{ left: hover.x + 8, top: hover.y - 4 }}>
              {hover.label}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
