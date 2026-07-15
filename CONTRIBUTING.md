# Contributing to Melody Clipboard

Thanks for considering a contribution! This project is a small, focused
utility — the goal is to keep it that way.

## Before you start

For anything beyond a small fix (new features, UI changes, dependency
changes), please open an issue first to discuss the approach. It's much
easier to align before writing code than after.

## Development setup

See the [README's Development section](README.md#development) for
prerequisites and setup. In short:

```bash
npm install
npm run tauri dev
```

## Making changes

- Keep the diff focused on the change you're making. Avoid unrelated
  formatting or refactors in the same PR.
- Match the existing code style — conversion logic lives in `src/lib/` and
  `src-tauri/src/`, UI components in `src/components/`. See
  [`README.md`](README.md#project-layout)-adjacent comments in the source for
  the architecture.
- If you change scale-degree conversion, tick math, or MIDI encoding, add or
  update the corresponding unit test — this project has fairly thorough test
  coverage on the conversion logic and we'd like to keep it that way.

## Before opening a pull request

Run the full check suite locally and make sure it passes:

```bash
npm run lint
npm run typecheck
npm run format:check
npm run test
npm run build

cd src-tauri
cargo fmt -- --check
cargo clippy --all-targets -- -D warnings
cargo test
```

If you changed the app version, run `npm run version:check` to confirm
`package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`
agree (usually you shouldn't need to touch the version in a regular PR —
version bumps happen as part of the release process, see
[`docs/RELEASING.md`](docs/RELEASING.md)).

## Pull requests

- Describe what changed and why.
- Link any related issue.
- Keep commits reasonably clean; squash-merge is fine if your branch has a
  lot of "fix typo" commits.

## Reporting bugs / requesting features

Use the issue templates — they'll prompt you for the details that make bugs
actionable (OS, app version, steps to reproduce, and — for parsing issues —
a sanitized JSON sample if you're able to share one).

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). Please read
it before participating.
