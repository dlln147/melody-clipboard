use crate::error::AppError;
use crate::models::NormalizedMelody;
use midly::num::{u15, u24, u28, u4, u7};
use midly::{
    Format, Header, MetaMessage, MidiMessage, Smf, Timing, Track, TrackEvent, TrackEventKind,
};

const EXPECTED_PPQ: u16 = 480;
const CHANNEL: u8 = 0;
const PROGRAM_ACOUSTIC_GRAND_PIANO: u8 = 0;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum EventKind {
    NoteOff,
    NoteOn,
}

#[derive(Debug, Clone, Copy)]
struct AbsoluteEvent {
    tick: i64,
    kind: EventKind,
    pitch: u8,
    velocity: u8,
}

/// Independently validates a NormalizedMelody. The frontend already
/// validates its own parsing, but the backend never trusts caller-supplied
/// structured data for a file-writing operation.
pub fn validate_melody(melody: &NormalizedMelody) -> Result<(), AppError> {
    if melody.ppq != EXPECTED_PPQ {
        return Err(AppError::InvalidMelody(format!(
            "ppq must be {EXPECTED_PPQ}, got {}",
            melody.ppq
        )));
    }
    if !melody.tempo_bpm.is_finite() || melody.tempo_bpm <= 0.0 {
        return Err(AppError::InvalidMelody(
            "tempoBpm must be a positive number".into(),
        ));
    }
    if melody.time_signature_numerator == 0 {
        return Err(AppError::InvalidMelody(
            "timeSignatureNumerator must be positive".into(),
        ));
    }
    if melody.time_signature_denominator == 0
        || !melody.time_signature_denominator.is_power_of_two()
    {
        return Err(AppError::InvalidMelody(
            "timeSignatureDenominator must be a power of two (2, 4, 8, 16, ...)".into(),
        ));
    }
    if melody.velocity > 127 {
        return Err(AppError::InvalidMelody(
            "velocity must be between 0 and 127".into(),
        ));
    }
    for (i, note) in melody.notes.iter().enumerate() {
        if note.start_tick < 0 {
            return Err(AppError::InvalidMelody(format!(
                "notes[{i}].startTick must not be negative"
            )));
        }
        if note.duration_ticks <= 0 {
            return Err(AppError::InvalidMelody(format!(
                "notes[{i}].durationTicks must be positive"
            )));
        }
        if note.midi_pitch < 0 || note.midi_pitch > 127 {
            return Err(AppError::InvalidMelody(format!(
                "notes[{i}].midiPitch must be between 0 and 127, got {}",
                note.midi_pitch
            )));
        }
    }
    Ok(())
}

fn micros_per_quarter_note(bpm: f64) -> u32 {
    (60_000_000.0 / bpm).round() as u32
}

fn time_signature_denominator_exponent(denominator: u8) -> u8 {
    denominator.trailing_zeros() as u8
}

fn build_conductor_track(melody: &NormalizedMelody) -> Track<'static> {
    let mut events: Vec<TrackEvent<'static>> = Vec::new();

    events.push(TrackEvent {
        delta: u28::from(0),
        kind: TrackEventKind::Meta(MetaMessage::TrackName(b"Conductor")),
    });

    if melody.include_tempo_meta {
        let micros = micros_per_quarter_note(melody.tempo_bpm);
        events.push(TrackEvent {
            delta: u28::from(0),
            kind: TrackEventKind::Meta(MetaMessage::Tempo(u24::from(micros))),
        });
    }

    if melody.include_time_signature_meta {
        let exponent = time_signature_denominator_exponent(melody.time_signature_denominator);
        events.push(TrackEvent {
            delta: u28::from(0),
            kind: TrackEventKind::Meta(MetaMessage::TimeSignature(
                melody.time_signature_numerator,
                exponent,
                24,
                8,
            )),
        });
    }

    events.push(TrackEvent {
        delta: u28::from(0),
        kind: TrackEventKind::Meta(MetaMessage::EndOfTrack),
    });

    events
}

fn build_melody_track(melody: &NormalizedMelody) -> Track<'static> {
    let mut absolute: Vec<AbsoluteEvent> = Vec::with_capacity(melody.notes.len() * 2);

    for note in &melody.notes {
        let pitch = note.midi_pitch as u8;
        absolute.push(AbsoluteEvent {
            tick: note.start_tick,
            kind: EventKind::NoteOn,
            pitch,
            velocity: melody.velocity,
        });
        absolute.push(AbsoluteEvent {
            tick: note.start_tick + note.duration_ticks,
            kind: EventKind::NoteOff,
            pitch,
            velocity: 0,
        });
    }

    // Earlier tick first; Note Off before Note On at the same tick; lower
    // pitch first as a stable final tie-breaker. This prevents overlapping
    // repeated notes from producing stuck or incorrectly shortened notes.
    absolute.sort_by(|a, b| {
        a.tick
            .cmp(&b.tick)
            .then(a.kind.cmp(&b.kind))
            .then(a.pitch.cmp(&b.pitch))
    });

    let mut events: Vec<TrackEvent<'static>> = Vec::with_capacity(absolute.len() + 3);

    events.push(TrackEvent {
        delta: u28::from(0),
        kind: TrackEventKind::Meta(MetaMessage::TrackName(b"Melody")),
    });
    events.push(TrackEvent {
        delta: u28::from(0),
        kind: TrackEventKind::Midi {
            channel: u4::from(CHANNEL),
            message: MidiMessage::ProgramChange {
                program: u7::from(PROGRAM_ACOUSTIC_GRAND_PIANO),
            },
        },
    });

    let mut previous_tick: i64 = 0;
    for event in &absolute {
        let delta = (event.tick - previous_tick).max(0) as u32;
        previous_tick = event.tick;
        let message = match event.kind {
            EventKind::NoteOn => MidiMessage::NoteOn {
                key: u7::from(event.pitch),
                vel: u7::from(event.velocity),
            },
            EventKind::NoteOff => MidiMessage::NoteOff {
                key: u7::from(event.pitch),
                vel: u7::from(event.velocity),
            },
        };
        events.push(TrackEvent {
            delta: u28::from(delta),
            kind: TrackEventKind::Midi {
                channel: u4::from(CHANNEL),
                message,
            },
        });
    }

    events.push(TrackEvent {
        delta: u28::from(0),
        kind: TrackEventKind::Meta(MetaMessage::EndOfTrack),
    });

    events
}

/// Generates Standard MIDI File (format 1) bytes from a validated,
/// normalized melody model.
pub fn generate_midi_bytes(melody: &NormalizedMelody) -> Result<Vec<u8>, AppError> {
    validate_melody(melody)?;

    let header = Header {
        format: Format::Parallel,
        timing: Timing::Metrical(u15::from(melody.ppq)),
    };

    let tracks = vec![build_conductor_track(melody), build_melody_track(melody)];

    let smf = Smf { header, tracks };

    let mut buffer = Vec::new();
    smf.write_std(&mut buffer)
        .map_err(|e| AppError::Io(format!("failed to encode MIDI: {e}")))?;
    Ok(buffer)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::NormalizedNote;

    fn note(start_tick: i64, duration_ticks: i64, midi_pitch: i32, voice: i32) -> NormalizedNote {
        NormalizedNote {
            start_tick,
            duration_ticks,
            midi_pitch,
            voice,
        }
    }

    fn base_melody(notes: Vec<NormalizedNote>) -> NormalizedMelody {
        NormalizedMelody {
            ppq: 480,
            tempo_bpm: 120.0,
            time_signature_numerator: 4,
            time_signature_denominator: 4,
            velocity: 100,
            include_tempo_meta: true,
            include_time_signature_meta: true,
            notes,
        }
    }

    #[test]
    fn tempo_conversion_120_bpm() {
        assert_eq!(micros_per_quarter_note(120.0), 500_000);
    }

    #[test]
    fn tempo_conversion_rounds() {
        // 100 BPM -> 600000 exactly; 90 BPM -> 666666.67 -> rounds to 666667
        assert_eq!(micros_per_quarter_note(100.0), 600_000);
        assert_eq!(micros_per_quarter_note(90.0), 666_667);
    }

    #[test]
    fn time_signature_denominator_exponents() {
        assert_eq!(time_signature_denominator_exponent(2), 1);
        assert_eq!(time_signature_denominator_exponent(4), 2);
        assert_eq!(time_signature_denominator_exponent(8), 3);
        assert_eq!(time_signature_denominator_exponent(16), 4);
    }

    #[test]
    fn rejects_non_power_of_two_denominator() {
        let melody = {
            let mut m = base_melody(vec![note(0, 480, 60, 1)]);
            m.time_signature_denominator = 6;
            m
        };
        let err = validate_melody(&melody).unwrap_err();
        assert!(matches!(err, AppError::InvalidMelody(_)));
    }

    #[test]
    fn rejects_invalid_midi_pitches() {
        let too_high = base_melody(vec![note(0, 480, 128, 1)]);
        assert!(validate_melody(&too_high).is_err());

        let too_low = base_melody(vec![note(0, 480, -1, 1)]);
        assert!(validate_melody(&too_low).is_err());

        let valid = base_melody(vec![note(0, 480, 127, 1), note(0, 480, 0, 1)]);
        assert!(validate_melody(&valid).is_ok());
    }

    #[test]
    fn rejects_zero_or_negative_duration() {
        let zero = base_melody(vec![note(0, 0, 60, 1)]);
        assert!(validate_melody(&zero).is_err());

        let negative = base_melody(vec![note(0, -10, 60, 1)]);
        assert!(validate_melody(&negative).is_err());
    }

    #[test]
    fn rejects_wrong_ppq() {
        let mut melody = base_melody(vec![note(0, 480, 60, 1)]);
        melody.ppq = 96;
        assert!(validate_melody(&melody).is_err());
    }

    #[test]
    fn event_sorting_note_off_before_note_on_at_same_tick() {
        // Two notes: first ends exactly when the second begins, at the same
        // pitch. The Off event must sort before the On event so the note
        // isn't perceived as a single stuck/held note.
        let melody = base_melody(vec![note(0, 480, 60, 1), note(480, 480, 60, 1)]);
        let bytes = generate_midi_bytes(&melody).unwrap();
        let smf = Smf::parse(&bytes).unwrap();
        let melody_track = &smf.tracks[1];

        let midi_events: Vec<_> = melody_track
            .iter()
            .filter(|e| matches!(e.kind, TrackEventKind::Midi { .. }))
            .collect();

        // program change, then NoteOn@0, NoteOff@480, NoteOn@480, NoteOff@960
        assert_eq!(midi_events.len(), 5);
        assert!(matches!(
            midi_events[1].kind,
            TrackEventKind::Midi {
                message: MidiMessage::NoteOn { .. },
                ..
            }
        ));
        assert!(matches!(
            midi_events[2].kind,
            TrackEventKind::Midi {
                message: MidiMessage::NoteOff { .. },
                ..
            }
        ));
        assert!(matches!(
            midi_events[3].kind,
            TrackEventKind::Midi {
                message: MidiMessage::NoteOn { .. },
                ..
            }
        ));
        // The NoteOff and second NoteOn share the same absolute tick (480),
        // so the delta between them must be zero.
        assert_eq!(midi_events[3].delta.as_int(), 0);
    }

    #[test]
    fn simultaneous_notes_are_preserved() {
        let melody = base_melody(vec![
            note(0, 480, 60, 1),
            note(0, 480, 64, 1),
            note(0, 480, 67, 1),
        ]);
        let bytes = generate_midi_bytes(&melody).unwrap();
        let smf = Smf::parse(&bytes).unwrap();
        let note_ons = smf.tracks[1]
            .iter()
            .filter(|e| {
                matches!(
                    e.kind,
                    TrackEventKind::Midi {
                        message: MidiMessage::NoteOn { .. },
                        ..
                    }
                )
            })
            .count();
        assert_eq!(note_ons, 3);
    }

    #[test]
    fn repeated_notes_sharing_end_start_tick_do_not_merge() {
        // Two back-to-back notes at the same pitch with no gap: the encoder
        // must emit a full Off/On pair rather than merging into one note.
        let melody = base_melody(vec![note(0, 240, 60, 1), note(240, 240, 60, 1)]);
        let bytes = generate_midi_bytes(&melody).unwrap();
        let smf = Smf::parse(&bytes).unwrap();
        let note_events: Vec<_> = smf.tracks[1]
            .iter()
            .filter(|e| {
                matches!(
                    e.kind,
                    TrackEventKind::Midi {
                        message: MidiMessage::NoteOn { .. } | MidiMessage::NoteOff { .. },
                        ..
                    }
                )
            })
            .collect();
        assert_eq!(note_events.len(), 4);
    }

    #[test]
    fn delta_time_conversion_is_relative_to_previous_event() {
        let melody = base_melody(vec![note(120, 240, 60, 1), note(600, 240, 62, 1)]);
        let bytes = generate_midi_bytes(&melody).unwrap();
        let smf = Smf::parse(&bytes).unwrap();
        let melody_track = &smf.tracks[1];
        let midi_events: Vec<_> = melody_track
            .iter()
            .filter(|e| matches!(e.kind, TrackEventKind::Midi { .. }))
            .collect();
        // program change @0, NoteOn@120 (delta 120), NoteOff@360 (delta 240),
        // NoteOn@600 (delta 240), NoteOff@840 (delta 240)
        assert_eq!(midi_events[0].delta.as_int(), 0);
        assert_eq!(midi_events[1].delta.as_int(), 120);
        assert_eq!(midi_events[2].delta.as_int(), 240);
        assert_eq!(midi_events[3].delta.as_int(), 240);
        assert_eq!(midi_events[4].delta.as_int(), 240);
    }
}
