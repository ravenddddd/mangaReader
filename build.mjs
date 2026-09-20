#!/usr/bin/env node
/**
 * Bundles the plugin into dist/, which is what gets packaged for Stash.
 *
 * One file, because that is what Stash loads: the plugin's imports are inlined
 * into `mangaReader.js` by esbuild, so the modules this repository is made of
 * never exist at runtime and there is no load order to get wrong.
 *
 * The rest of what a plugin needs at runtime is copied in beside it — the
 * manifest, the stylesheet and the README. The manifest's version is left
 * exactly as it is: the repository that publishes it appends the source commit,
 * in both the manifest and the package index, because Stash decides whether an
 * update is available by comparing those two.
 *
 * Nothing here maps `ui.assets`, unlike mangaTools: this plugin serves no file
 * that is not bundled, so there is no directory to copy in and no manifest key
 * that could name a missing one.
 *
 * Packaging into a zip, and the index Stash reads, are not this file's business
 * either — the publishing repository does that for every plugin at once, from
 * whatever this leaves in dist/.
 */
import { buildSync } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const ROOT = import.meta.dirname;
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");

/** The plugin's ID: its entry point's name, and the name of the bundle */
const ID = "mangaReader";

/** Copied as they are: a file the manifest names, or the README */
const FILES = ["mangaReader.yml", "mangaReader.css", "README.md"];

const entry = ["tsx", "ts"]
  .map((extension) => path.join(SRC, `${ID}.${extension}`))
  .find((candidate) => fs.existsSync(candidate));

if (!entry) {
  console.error(`no entry point: expected src/${ID}.tsx or src/${ID}.ts`);
  process.exit(1);
}

// Rebuilt from scratch: a file deleted from src/ would otherwise linger in dist/
// and be packaged.
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

buildSync({
  entryPoints: [entry],
  outfile: path.join(DIST, `${ID}.js`),
  bundle: true,
  // A plain script, not a module: Stash loads plugin files with a <script> tag,
  // so a module's top-level `import`/`export` would not parse there.
  format: "iife",
  target: "es2019",
  minify: false,
  sourcemap: false,
  logLevel: "warning",
  // The same tsconfig the type-checker reads, so both agree on the JSX transform
  // and the target rather than restating either here.
  tsconfig: path.join(ROOT, "tsconfig.json"),
});

for (const file of FILES) {
  fs.copyFileSync(path.join(ROOT, file), path.join(DIST, file));
}

console.log(`built dist/${ID}.js and copied ${FILES.join(", ")}`);
