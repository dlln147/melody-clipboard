# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-07-14

### Added

- Convert supported Hooktheory clipboard melody data (legacy and modern
  payload formats) to Standard MIDI Files
- Automatic tonic and scale detection from embedded key data, with manual
  override and embedded key-change support
- Scale-degree-to-MIDI conversion, including extended degrees (8+),
  accidentals, and all seven diatonic modes plus harmonic/melodic minor
- Lightweight canvas piano-roll melody preview
- Configurable base octave, tempo, time signature, and MIDI velocity
- Native `.mid` export via the OS save dialog
- macOS (Apple Silicon and Intel) and Windows (x64) desktop support
- Fully offline operation with no network requests or telemetry

[Unreleased]: https://github.com/dlln147/melody-clipboard/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/dlln147/melody-clipboard/releases/tag/v1.0.0
