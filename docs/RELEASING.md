# Releasing Melody Clipboard

This document covers pushing the repository to GitHub for the first time,
and the process for cutting a new release.

## First repository push

If you're starting from this local project directory with no Git history
yet:

```bash
git init
git add .
git commit -m "Initial public release"
git branch -M main
git remote add origin https://github.com/dlln147/melody-clipboard.git
git push -u origin main
```

If the repository already has history or a remote configured, adapt
accordingly (e.g. `git remote set-url origin ...` instead of `git remote
add`, or skip `git init`/the initial commit).

## Creating a release

1. **Set the version** (this updates `package.json`, `src-tauri/tauri.conf.json`,
   and `src-tauri/Cargo.toml` together):

   ```bash
   npm run version:set -- 1.0.0
   npm run version:check
   ```

2. **Run the full check suite locally** before tagging anything:

   ```bash
   npm run lint
   npm run typecheck
   npm run format:check
   npm test
   npm run build

   cd src-tauri
   cargo fmt -- --check
   cargo clippy --all-targets -- -D warnings
   cargo test
   cd ..
   ```

3. **Commit, tag, and push:**

   ```bash
   git add .
   git commit -m "Release v1.0.0"
   git tag v1.0.0
   git push origin main
   git push origin v1.0.0
   ```

   Pushing the `v1.0.0` tag triggers `.github/workflows/release.yml`.

4. **What the workflow does:**
   - `resolve` — figures out the release tag (the pushed tag, or an explicit
     tag input if run manually via `workflow_dispatch`).
   - `validate` — re-checks that the tag matches the version in
     `package.json`/`tauri.conf.json`/`Cargo.toml`, then runs the full
     frontend and Rust check/test suite. **The release is blocked if this
     job fails.**
   - `build` — a matrix job that builds three native installers in
     parallel, each on its own GitHub-hosted runner:
     - macOS Apple Silicon (`aarch64-apple-darwin`, on `macos-latest`)
     - macOS Intel (`x86_64-apple-darwin`, on `macos-latest`, cross-compiled)
     - Windows x64 (`x86_64-pc-windows-msvc`, on `windows-latest`)

     Each build uploads its installer(s) to a single **draft** GitHub
     Release for the tag (via [`tauri-apps/tauri-action`](https://github.com/tauri-apps/tauri-action)).
     Release notes are auto-generated from merged PRs/commits since the
     previous tag.

   - `checksums` — downloads every asset that was just uploaded and
     generates a `SHA256SUMS.txt` file (via `scripts/checksums.mjs`),
     uploaded to the same release.

5. **Inspect the draft release:**
   1. Open the [Releases page](https://github.com/dlln147/melody-clipboard/releases)
      and find the new **draft** release for your tag.
   2. Verify all expected installers are attached (see the filename table
      below) plus `SHA256SUMS.txt`.
   3. Download each installer and smoke-test it on the corresponding OS
      (paste the sample fixture, confirm detected key/notes, export a MIDI
      file, and confirm it imports into your DAW).
   4. Edit the auto-generated release notes if you want to add a summary.
   5. Click **Publish release** once you're satisfied.

Until you click **Publish**, nothing is publicly visible — draft releases
are only visible to people with write access to the repository.

### Expected filenames

Tauri's bundler names installers from the app's `productName` ("Melody
Clipboard") and version. The bundler itself uses a literal space
(`Melody Clipboard_1.0.0_...`), but GitHub's release-asset upload replaces
spaces with dots, so the filenames you'll actually see on the Releases page
are (confirmed against the real v1.0.0 release):

```text
Melody.Clipboard_1.0.0_aarch64.dmg           macOS, Apple Silicon
Melody.Clipboard_1.0.0_aarch64.app.tar.gz    macOS, Apple Silicon (updater artifact, not needed for a normal install)
Melody.Clipboard_1.0.0_x64.dmg               macOS, Intel
Melody.Clipboard_1.0.0_x64.app.tar.gz        macOS, Intel (updater artifact)
Melody.Clipboard_1.0.0_x64-setup.exe         Windows x64 (NSIS)
Melody.Clipboard_1.0.0_x64_en-US.msi         Windows x64 (MSI)
SHA256SUMS.txt                                checksums for all six installers above
```

These are the default names produced by `tauri-action` + GitHub, kept as-is
rather than renamed, since renaming after `tauri-action` uploads them would
mean re-implementing (and risking) its upload logic. If you want different
filenames, the `checksums` job's `gh release download` step is a safe place
to add a rename step in the future — download by the exact name reported by
`gh release view <tag> --json assets`, never by a wildcard.

## Failed releases

**Inspecting logs.** Open the failing run under the repo's **Actions** tab →
the `Release` workflow → the failed job. Each step's output is expanded on
failure.

**Rerunning a failed job.** From the failed workflow run page, use **Re-run
jobs → Re-run failed jobs** (top right). This is safe — `validate` re-runs
tests, and `build`/`checksums` re-upload to the same (still-draft) release
without creating a duplicate.

**Deleting a bad draft release.** If a release is in a broken state (wrong
notes, missing assets you don't want to just re-run for), delete the draft
from the Releases page (**Delete** in the release's `...` menu) — this does
**not** delete the underlying git tag.

**Replacing a bad version tag.** If you need to redo a tag before
publishing:

```bash
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0
# fix the issue, commit
git tag v1.0.0
git push origin v1.0.0
```

Only do this for a tag that was **never published** as a public release.
Once a tag has been published (even briefly) and someone may have already
pulled it, treat it as immutable — cut `v1.0.1` instead. Reusing a
previously-public tag for different content is confusing and breaks anyone
who already fetched it.

## Signing and notarization (optional, for later)

The release workflow builds **unsigned** installers by default — this is
expected and documented in the README's Downloads section. Signing is
optional and only activates when the corresponding secrets are configured
in the repository (**Settings → Secrets and variables → Actions**); the
unsigned pipeline is unaffected if they're absent.

### macOS: Developer ID signing + notarization

Requires an active [Apple Developer Program](https://developer.apple.com/programs/)
membership. Configure these repository secrets:

| Secret                       | Purpose                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `APPLE_CERTIFICATE`          | Base64-encoded Developer ID Application `.p12` certificate                                                      |
| `APPLE_CERTIFICATE_PASSWORD` | Password used when exporting the `.p12`                                                                         |
| `APPLE_SIGNING_IDENTITY`     | The certificate's identity string (e.g. `Developer ID Application: Your Name (TEAMID)`)                         |
| `APPLE_ID`                   | Apple ID email used for notarization                                                                            |
| `APPLE_PASSWORD`             | An [app-specific password](https://support.apple.com/en-us/102654) for that Apple ID (not your normal password) |
| `APPLE_TEAM_ID`              | Your Apple Developer Team ID                                                                                    |

`release.yml` already passes these through to `tauri-action` as environment
variables — once the secrets exist, macOS builds sign and notarize
automatically on the next tagged release. No workflow changes needed.

See the official [Tauri macOS signing guide](https://v2.tauri.app/distribute/sign/macos/)
for how to export the certificate and obtain each value.

### Windows: code signing

Requires a code-signing certificate (OV or EV) as a `.pfx` file. Configure:

| Secret                         | Purpose                           |
| ------------------------------ | --------------------------------- |
| `WINDOWS_CERTIFICATE`          | Base64-encoded `.pfx` certificate |
| `WINDOWS_CERTIFICATE_PASSWORD` | The certificate's export password |

Unlike macOS, Windows signing also requires a **static** thumbprint value —
`bundle.windows.certificateThumbprint` in `src-tauri/tauri.conf.json` — set
ahead of time (it's not a secret, just your certificate's public
fingerprint, safe to commit). To find it after importing your certificate
locally:

```powershell
Get-ChildItem -Path Cert:\CurrentUser\My
```

Once both the secrets and `certificateThumbprint` are set,
`release.yml`'s "Import Windows signing certificate" step (already
conditional on `WINDOWS_CERTIFICATE` being present) imports the certificate
into the runner's certificate store before `tauri-action` runs, and Tauri's
bundler signs the `.exe`/`.msi` with `signtool.exe` automatically.

See the official [Tauri Windows signing guide](https://v2.tauri.app/distribute/sign/windows/)
for certificate acquisition and Azure Trusted Signing as an alternative to a
traditional PFX certificate.
