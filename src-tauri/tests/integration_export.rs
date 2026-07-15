//! Integration test: generate a Standard MIDI File from the F# major
//! fixture melody (fixtures/f-sharp-major-melody.json) and parse it back
//! with `midly` to confirm the output is structurally valid and matches
//! the expected note data.

use melody_clipboard_lib::midi::generate_midi_bytes;
use melody_clipboard_lib::models::{NormalizedMelody, NormalizedNote};
use midly::{MetaMessage, MidiMessage, Smf, Timing, TrackEventKind};

/// (start_tick, duration_ticks, midi_pitch) for all 54 non-rest notes in
/// fixtures/f-sharp-major-melody.json's modern payload, with pitches
/// resolved against F# major at base octave 3 (baseTonicMidi = 54).
const FIXTURE_NOTES: &[(i64, i64, i32)] = &[
    (720, 120, 54),
    (840, 120, 54),
    (960, 240, 66),
    (1200, 240, 65),
    (1440, 120, 65),
    (1560, 360, 66),
    (1920, 480, 59),
    (2640, 120, 54),
    (2760, 120, 54),
    (2880, 240, 66),
    (3120, 240, 65),
    (3360, 240, 66),
    (3600, 480, 59),
    (4440, 120, 61),
    (4560, 240, 61),
    (4800, 240, 70),
    (5040, 120, 70),
    (5160, 360, 70),
    (5520, 480, 70),
    (6000, 120, 66),
    (6120, 360, 66),
    (6480, 120, 61),
    (6600, 360, 61),
    (6960, 480, 70),
    (7440, 480, 70),
    (7920, 480, 68),
    (8400, 480, 66),
    (8880, 240, 65),
    (9120, 240, 66),
    (9360, 480, 59),
    (10320, 480, 66),
    (10800, 240, 65),
    (11040, 240, 66),
    (11280, 480, 59),
    (12120, 120, 61),
    (12240, 240, 61),
    (12480, 240, 70),
    (12720, 120, 70),
    (12840, 360, 70),
    (13200, 120, 70),
    (13320, 120, 71),
    (13440, 240, 70),
    (13680, 120, 66),
    (13800, 360, 66),
    (14160, 120, 61),
    (14280, 360, 61),
    (14640, 480, 73),
    (15120, 240, 68),
    (15360, 240, 66),
    (15600, 240, 66),
    (16080, 240, 61),
    (16320, 360, 70),
    (16680, 120, 68),
    (16800, 240, 66),
];

fn fixture_melody() -> NormalizedMelody {
    NormalizedMelody {
        ppq: 480,
        tempo_bpm: 120.0,
        time_signature_numerator: 4,
        time_signature_denominator: 4,
        velocity: 100,
        include_tempo_meta: true,
        include_time_signature_meta: true,
        notes: FIXTURE_NOTES
            .iter()
            .map(|&(start_tick, duration_ticks, midi_pitch)| NormalizedNote {
                start_tick,
                duration_ticks,
                midi_pitch,
                voice: 1,
            })
            .collect(),
    }
}

#[test]
fn exports_a_valid_midi_file_with_expected_header() {
    let bytes = generate_midi_bytes(&fixture_melody()).expect("generation should succeed");
    let smf = Smf::parse(&bytes).expect("midly should parse the generated file");

    assert_eq!(smf.header.format, midly::Format::Parallel);
    assert_eq!(
        smf.tracks.len(),
        2,
        "expected a conductor track and a melody track"
    );
    match smf.header.timing {
        Timing::Metrical(ppq) => assert_eq!(ppq.as_int(), 480),
        Timing::Timecode(..) => panic!("expected metrical timing"),
    }
}

#[test]
fn conductor_track_has_tempo_and_time_signature() {
    let bytes = generate_midi_bytes(&fixture_melody()).expect("generation should succeed");
    let smf = Smf::parse(&bytes).expect("parse");
    let conductor = &smf.tracks[0];

    let has_track_name = conductor
        .iter()
        .any(|e| matches!(&e.kind, TrackEventKind::Meta(MetaMessage::TrackName(name)) if *name == b"Conductor"));
    assert!(has_track_name, "conductor track should be named Conductor");

    let tempo = conductor.iter().find_map(|e| match &e.kind {
        TrackEventKind::Meta(MetaMessage::Tempo(t)) => Some(t.as_int()),
        _ => None,
    });
    assert_eq!(
        tempo,
        Some(500_000),
        "120 BPM should encode as 500000 microseconds/quarter"
    );

    let time_sig = conductor.iter().find_map(|e| match &e.kind {
        TrackEventKind::Meta(MetaMessage::TimeSignature(num, den, ..)) => Some((*num, *den)),
        _ => None,
    });
    assert_eq!(
        time_sig,
        Some((4, 2)),
        "4/4 should encode numerator 4, denominator exponent 2"
    );

    assert!(matches!(
        conductor.last().unwrap().kind,
        TrackEventKind::Meta(MetaMessage::EndOfTrack)
    ));
}

#[test]
fn melody_track_matches_expected_note_count_pitches_starts_and_durations() {
    let bytes = generate_midi_bytes(&fixture_melody()).expect("generation should succeed");
    let smf = Smf::parse(&bytes).expect("parse");
    let melody_track = &smf.tracks[1];

    let has_track_name = melody_track
        .iter()
        .any(|e| matches!(&e.kind, TrackEventKind::Meta(MetaMessage::TrackName(name)) if *name == b"Melody"));
    assert!(has_track_name);

    let has_program_change = melody_track.iter().any(|e| {
        matches!(
            &e.kind,
            TrackEventKind::Midi { message: MidiMessage::ProgramChange { program }, .. } if program.as_int() == 0
        )
    });
    assert!(
        has_program_change,
        "expected an Acoustic Grand Piano program change"
    );

    // Walk events accumulating absolute tick, reconstructing (start, duration, pitch)
    // triples from paired NoteOn/NoteOff events.
    let mut absolute_tick: i64 = 0;
    let mut open: std::collections::HashMap<u8, i64> = std::collections::HashMap::new();
    let mut resolved: Vec<(i64, i64, i32)> = Vec::new();

    for event in melody_track.iter() {
        absolute_tick += event.delta.as_int() as i64;
        if let TrackEventKind::Midi { message, .. } = &event.kind {
            match message {
                MidiMessage::NoteOn { key, vel } if vel.as_int() > 0 => {
                    open.insert(key.as_int(), absolute_tick);
                }
                MidiMessage::NoteOff { key, .. } => {
                    if let Some(start) = open.remove(&key.as_int()) {
                        resolved.push((start, absolute_tick - start, key.as_int() as i32));
                    }
                }
                _ => {}
            }
        }
    }

    resolved.sort_by_key(|(start, _, pitch)| (*start, *pitch));
    let mut expected: Vec<(i64, i64, i32)> = FIXTURE_NOTES.to_vec();
    expected.sort_by_key(|(start, _, pitch)| (*start, *pitch));

    assert_eq!(resolved.len(), 54, "expected 54 non-rest notes");
    assert_eq!(resolved, expected);

    assert!(matches!(
        melody_track.last().unwrap().kind,
        TrackEventKind::Meta(MetaMessage::EndOfTrack)
    ));
}

#[test]
fn every_track_ends_with_end_of_track_event() {
    let bytes = generate_midi_bytes(&fixture_melody()).expect("generation should succeed");
    let smf = Smf::parse(&bytes).expect("parse");
    for track in &smf.tracks {
        assert!(matches!(
            track.last().unwrap().kind,
            TrackEventKind::Meta(MetaMessage::EndOfTrack)
        ));
    }
}
