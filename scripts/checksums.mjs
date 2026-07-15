#!/usr/bin/env node
/**
 * Computes SHA-256 checksums for release files and writes SHA256SUMS.txt,
 * in the standard `sha256sum` output format (verifiable with
 * `shasum -a 256 -c SHA256SUMS.txt` or `sha256sum -c SHA256SUMS.txt`).
 *
 * Usage:
 *   node scripts/checksums.mjs <file...>          Write ./SHA256SUMS.txt
 *   node scripts/checksums.mjs --out <path> <file...>
 */
import { createHash } from "node:crypto";
import { createReadStream, writeFileSync } from "node:fs";
import path from "node:path";

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function main() {
  const args = process.argv.slice(2);
  let outPath = "SHA256SUMS.txt";
  const outIndex = args.indexOf("--out");
  if (outIndex !== -1) {
    outPath = args[outIndex + 1];
    args.splice(outIndex, 2);
  }

  const files = args;
  if (files.length === 0) {
    console.error("Usage: node scripts/checksums.mjs [--out <path>] <file...>");
    process.exit(1);
  }

  const lines = [];
  for (const file of files) {
    const digest = await sha256File(file);
    lines.push(`${digest}  ${path.basename(file)}`);
  }

  const content = lines.join("\n") + "\n";
  writeFileSync(outPath, content);
  process.stdout.write(content);
  console.error(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
