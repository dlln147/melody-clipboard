#!/usr/bin/env node
/**
 * Keeps the app version in sync across package.json, src-tauri/tauri.conf.json,
 * and src-tauri/Cargo.toml.
 *
 * Usage:
 *   node scripts/version.mjs check            Verify all three files agree
 *   node scripts/version.mjs check --tag v1.2.3   Also verify against a git tag
 *   node scripts/version.mjs set 1.2.3        Write 1.2.3 to all three files
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_JSON = path.join(rootDir, "package.json");
const TAURI_CONF = path.join(rootDir, "src-tauri", "tauri.conf.json");
const CARGO_TOML = path.join(rootDir, "src-tauri", "Cargo.toml");

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

function readPackageVersion() {
  const json = JSON.parse(readFileSync(PACKAGE_JSON, "utf8"));
  return json.version;
}

function writePackageVersion(version) {
  const json = JSON.parse(readFileSync(PACKAGE_JSON, "utf8"));
  json.version = version;
  writeFileSync(PACKAGE_JSON, JSON.stringify(json, null, 2) + "\n");
}

function readTauriVersion() {
  const json = JSON.parse(readFileSync(TAURI_CONF, "utf8"));
  return json.version;
}

function writeTauriVersion(version) {
  const json = JSON.parse(readFileSync(TAURI_CONF, "utf8"));
  json.version = version;
  writeFileSync(TAURI_CONF, JSON.stringify(json, null, 2) + "\n");
}

function readCargoVersion() {
  const toml = readFileSync(CARGO_TOML, "utf8");
  const packageSection = toml.slice(0, toml.indexOf("\n[", 1) === -1 ? toml.length : toml.indexOf("\n[", 1));
  const match = /^version\s*=\s*"([^"]+)"/m.exec(packageSection);
  if (!match) throw new Error(`Could not find [package] version in ${CARGO_TOML}`);
  return match[1];
}

function writeCargoVersion(version) {
  const toml = readFileSync(CARGO_TOML, "utf8");
  const packageEnd = toml.indexOf("\n[", 1) === -1 ? toml.length : toml.indexOf("\n[", 1);
  const packageSection = toml.slice(0, packageEnd);
  const rest = toml.slice(packageEnd);
  const updated = packageSection.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
  if (updated === packageSection) {
    throw new Error(`Could not find [package] version in ${CARGO_TOML}`);
  }
  writeFileSync(CARGO_TOML, updated + rest);
}

function normalizeTag(tag) {
  return tag.startsWith("v") ? tag.slice(1) : tag;
}

function check(expectedTag) {
  const versions = {
    "package.json": readPackageVersion(),
    "src-tauri/tauri.conf.json": readTauriVersion(),
    "src-tauri/Cargo.toml": readCargoVersion(),
  };

  const unique = new Set(Object.values(versions));
  let ok = unique.size === 1;

  if (expectedTag) {
    const expected = normalizeTag(expectedTag);
    if (![...unique].every((v) => v === expected)) {
      ok = false;
      console.error(`Tag ${expectedTag} (version ${expected}) does not match project version(s).`);
    }
  }

  for (const [file, version] of Object.entries(versions)) {
    console.log(`${ok ? "  " : "✗ "}${file}: ${version}`);
  }

  if (!ok) {
    console.error("\nVersion mismatch. Run `npm run version:set -- <version>` to synchronize.");
    process.exit(1);
  }

  console.log(`\nAll files agree on version ${versions["package.json"]}.`);
}

function set(version) {
  if (!SEMVER_RE.test(version)) {
    console.error(`"${version}" is not a valid semantic version (expected e.g. 1.2.3).`);
    process.exit(1);
  }
  writePackageVersion(version);
  writeTauriVersion(version);
  writeCargoVersion(version);
  console.log(
    `Set version to ${version} in package.json, src-tauri/tauri.conf.json, and src-tauri/Cargo.toml.`,
  );
  console.log("Run `npm install` afterwards so package-lock.json / Cargo.lock pick up the change if needed.");
}

const [, , command, ...args] = process.argv;

if (command === "check") {
  const tagIndex = args.indexOf("--tag");
  const tag = tagIndex !== -1 ? args[tagIndex + 1] : undefined;
  check(tag);
} else if (command === "set") {
  const version = args[0];
  if (!version) {
    console.error("Usage: node scripts/version.mjs set <version>");
    process.exit(1);
  }
  set(version);
} else {
  console.error(
    "Usage:\n  node scripts/version.mjs check [--tag vX.Y.Z]\n  node scripts/version.mjs set <version>",
  );
  process.exit(1);
}
