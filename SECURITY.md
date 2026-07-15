# Security Policy

## Scope

Melody Clipboard is a local, offline desktop application. It makes no
network requests, has no backend, and does not collect telemetry. The
relevant attack surface is essentially:

- Parsing of pasted/clipboard JSON (frontend, `src/lib/clipboardParser.ts`)
- MIDI file generation from the normalized model (backend,
  `src-tauri/src/midi.rs`), which independently re-validates input rather
  than trusting the frontend
- The Tauri capability/permission configuration
  (`src-tauri/capabilities/default.json`), which should only grant the
  clipboard-read, clipboard-write, save-dialog, and local-preference-storage
  permissions the app actually uses

## Reporting a vulnerability

If you find a security issue — for example, a crafted clipboard payload that
crashes the app, corrupts output in an unsafe way, or a Tauri permission
that's broader than it needs to be — please report it privately rather than
opening a public issue:

1. Use GitHub's [private vulnerability reporting](https://github.com/dlln147/melody-clipboard/security/advisories/new)
   for this repository, if enabled.
2. If that's not available, open an issue with minimal detail asking to be
   contacted privately, and a maintainer will follow up.

Please include:

- A description of the issue and why it's a security concern (not just a
  correctness bug — those can go through the normal bug-report template).
- Steps to reproduce, including a sanitized input sample if the issue is
  parser-related.
- The app version and OS you tested on.

## Supported versions

Only the latest released version is supported with security fixes. Please
update to the latest release before reporting an issue.

## Out of scope

- Vulnerabilities that require the attacker to already have local code
  execution on the user's machine.
- Issues in third-party dependencies that don't have a demonstrated impact
  on this application specifically (please report those upstream).
