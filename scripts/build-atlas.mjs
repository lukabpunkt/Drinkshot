#!/usr/bin/env node
/**
 * SVG → PNG-Atlas (@1x, @2x).
 *
 * Quellen: `assets-src/svg/shotling/`, `assets-src/svg/props/`, `assets-src/svg/scope/`
 * Ziel:    `public/atlas/<name>@1x|@2x.{png,json}`
 *
 * TODO(M2): Rendering per `sharp` + Packing per `free-tex-packer-core`
 *           nach Rig-Spec (docs/02-ART-DIRECTION.md §5.1). Atlas ≤ 2048² pro Aufloesung.
 */

import { readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const CATEGORIES = ['shotling', 'props', 'scope'];

async function main() {
  await mkdir('public/atlas', { recursive: true });

  let total = 0;
  for (const category of CATEGORIES) {
    const dir = `assets-src/svg/${category}`;
    if (!existsSync(dir)) continue;
    const files = (await readdir(dir, { recursive: true })).filter((f) => f.endsWith('.svg'));
    total += files.length;
    console.log(`  ${category}: ${files.length} SVG`);
  }

  if (total === 0) {
    console.log('build:atlas — noch keine SVG-Quellen. Die Assets entstehen in Meilenstein M2.');
    return;
  }

  console.error('build:atlas — Packing ist noch nicht implementiert (TODO M2).');
  process.exitCode = 1;
}

await main();
