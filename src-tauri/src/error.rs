use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Invalid melody data: {0}")]
    InvalidMelody(String),
    #[error("Failed to write MIDI file: {0}")]
    Io(String),
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(err.to_string())
    }
}

/// Tauri commands must return errors that implement `Serialize` so they can
/// cross the IPC boundary as plain, user-facing messages rather than a
/// serialized Rust debug representation.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
