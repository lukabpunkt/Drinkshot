#!/usr/bin/env node
/**
 * SVG → PNG-Atlas (@1x, @2x).
 *
 * Quellen: `assets-src/svg/<kategorie>/**.svg`
 * Ziel:    `public/atlas/<kategorie>@1x|@2x.{png,json}` (PIXI-Format)
 *
 * Regeln (docs/03-ARCHITEKTUR.md §7.3): eine Textur je Kategorie, damit die Arena mit
 * wenigen Draw-Batches auskommt. Atlas-Kante ≤ 2048 px je Auflösung (Audit A2).
 *
 * Frame-Namen entsprechen dem Pfad ohne Endung, z. B. `faces/scared`, `hats/party`, `head`.
 */

import { mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { packAsync } from 'free-tex-packer-core';

const SRC_ROOT = 'assets-src/svg';
const OUT_DIR = 'public/atlas';
const MAX_SIZE = 2048;

/** Welche Ordner werden zu welchem Atlas? */
const CATEGORIES = [
  { name: 'shotlings', dir: 'shotling' },
  { name: 'props', dir: 'props' },
  { name: 'scope', dir: 'scope' },
];

const SCALES = [
  { suffix: '@1x', factor: 1 },
  { suffix: '@2x', factor: 2 },
];

/** Alle SVGs eines Ordners, rekursiv, mit Pfad relativ zur Kategorie. */
async function collectSvgs(root) {
  const out = [];
  async function walk(dir, prefix) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, prefix ? `${prefix}/${entry.name}` : entry.name);
      } else if (entry.name.endsWith('.svg')) {
        const base = entry.name.slice(0, -4);
        out.push({ file: full, name: prefix ? `${prefix}/${base}` : base });
      }
    }
  }
  await walk(root, '');
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Rendert ein SVG in seiner Nenngröße mal `factor`. */
async function rasterize(file, factor) {
  const svg = await readFile(file);
  const meta = await sharp(svg).metadata();
  const width = Math.max(1, Math.round((meta.width ?? 1) * factor));
  const height = Math.max(1, Math.round((meta.height ?? 1) * factor));
  // `density` skaliert das SVG beim Rendern statt hinterher zu interpolieren — sonst
  // werden die Outlines bei @2x weich.
  return sharp(svg, { density: 72 * factor })
    .resize(width, height, { fit: 'fill' })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
}

async function buildCategory(category, scale) {
  const srcDir = path.join(SRC_ROOT, category.dir);
  if (!existsSync(srcDir)) return null;

  const svgs = await collectSvgs(srcDir);
  if (svgs.length === 0) return null;

  const images = await Promise.all(
    svgs.map(async ({ file, name }) => ({
      path: `${name}.png`,
      contents: await rasterize(file, scale.factor),
    }))
  );

  const files = await packAsync(images, {
    textureName: `${category.name}${scale.suffix}`,
    width: MAX_SIZE,
    height: MAX_SIZE,
    fixedSize: false,
    powerOfTwo: true,
    padding: 2,
    // 1 px Rand verhindert Bleeding zwischen Frames beim Skalieren.
    extrude: 1,
    allowRotation: false,
    allowTrim: true,
    detectIdentical: true,
    removeFileExtension: true,
    prependFolderName: true,
    exporter: 'Pixi',
    scale: 1,
  });

  await mkdir(OUT_DIR, { recursive: true });
  const written = [];
  for (const file of files) {
    const target = path.join(OUT_DIR, file.name);
    if (file.name.endsWith('.json')) {
      /*
       * `meta.scale` sagt PIXI, wieviele Texturpixel auf eine Welteinheit kommen.
       * Der Packer schreibt hier immer 1 — ohne Korrektur rendert der @2x-Atlas auf
       * Retina-Geraeten alles doppelt so gross, und zwar lautlos.
       */
      const sheet = JSON.parse(file.buffer.toString('utf8'));
      sheet.meta = { ...sheet.meta, scale: scale.factor };
      await writeFile(target, JSON.stringify(sheet, null, 2));
    } else {
      await writeFile(target, file.buffer);
    }
    written.push(target);
  }

  const png = written.find((f) => f.endsWith('.png'));
  const meta = png ? await sharp(png).metadata() : undefined;
  return {
    category: category.name,
    scale: scale.suffix,
    frames: svgs.length,
    size: meta ? `${meta.width}×${meta.height}` : '?',
    bytes: png ? (await readFile(png)).length : 0,
    files: written,
  };
}

async function main() {
  if (existsSync(OUT_DIR)) {
    // Alte Atlanten wegräumen, sonst bleiben umbenannte Frames als Leichen liegen.
    for (const entry of await readdir(OUT_DIR)) {
      if (entry.endsWith('.png') || entry.endsWith('.json')) {
        await rm(path.join(OUT_DIR, entry));
      }
    }
  }

  const results = [];
  for (const category of CATEGORIES) {
    for (const scale of SCALES) {
      const result = await buildCategory(category, scale);
      if (result) results.push(result);
    }
  }

  if (results.length === 0) {
    console.log('build:atlas — keine SVG-Quellen gefunden.');
    return;
  }

  let failed = false;
  for (const r of results) {
    const [w, h] = r.size.split('×').map(Number);
    const tooBig = w > MAX_SIZE || h > MAX_SIZE;
    if (tooBig) failed = true;
    console.log(
      `  ${r.category}${r.scale.padEnd(4)} ${String(r.frames).padStart(3)} Frames  ` +
        `${r.size.padStart(11)}  ${(r.bytes / 1024).toFixed(1).padStart(7)} KB${tooBig ? '  ← ZU GROSS' : ''}`
    );
  }

  if (failed) {
    console.error(`build:atlas — mindestens ein Atlas überschreitet ${MAX_SIZE} px (Audit A2).`);
    process.exitCode = 1;
  }
}

await main();
