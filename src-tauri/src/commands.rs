use crate::error::AppError;
use crate::midi::generate_midi_bytes;
use crate::models::{ExportSummary, NormalizedMelody};

#[tauri::command]
pub fn generate_midi(
    melody: NormalizedMelody,
    output_path: String,
) -> Result<ExportSummary, AppError> {
    let bytes = generate_midi_bytes(&melody)?;

    std::fs::write(&output_path, &bytes)?;

    let note_count = melody.notes.len();
    let duration_ticks = melody
        .notes
        .iter()
        .map(|n| n.start_tick + n.duration_ticks)
        .max()
        .unwrap_or(0);
    let duration_beats = duration_ticks as f64 / melody.ppq as f64;

    Ok(ExportSummary {
        path: output_path,
        note_count,
        duration_ticks,
        duration_beats,
        file_size_bytes: bytes.len() as u64,
    })
}
