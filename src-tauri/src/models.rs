use serde::{Deserialize, Serialize};

/// A single resolved note, in the coordinate space the frontend already
/// resolved (tonic, scale, octave, and key changes all applied).
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedNote {
    pub start_tick: i64,
    pub duration_ticks: i64,
    pub midi_pitch: i32,
    pub voice: i32,
}

/// The full melody model handed from TypeScript to Rust. The backend
/// re-validates every field independently of whatever the frontend already
/// checked.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedMelody {
    pub ppq: u16,
    pub tempo_bpm: f64,
    pub time_signature_numerator: u8,
    pub time_signature_denominator: u8,
    pub velocity: u8,
    pub include_tempo_meta: bool,
    pub include_time_signature_meta: bool,
    pub notes: Vec<NormalizedNote>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportSummary {
    pub path: String,
    pub note_count: usize,
    pub duration_ticks: i64,
    pub duration_beats: f64,
    pub file_size_bytes: u64,
}
