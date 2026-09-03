#!/usr/bin/env node
/**
 * Einzelne Sounds → ein howler-Audio-Sprite (OGG + MP3) + `src/audio/sprite.json`.
 *
 * Quelle: `assets-src/audio-src/*.wav`
 * Ziel:   `public/audio/drinkshot.{ogg,mp3}` + `src/audio/sprite.json`
 *
 * TODO(M3): Sprite-Bau (ffmpeg oder audiosprite) nach der Sound-Liste in docs/01-GDD.md §7.
 */

import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const SRC_DIR = 'assets-src/audio-src';

async function main() {
  if (!existsSync(SRC_DIR)) {
    console.log('build:audio — kein Quellordner. Die Sounds entstehen in Meilenstein M3.');
    return;
  }

  const files = (await readdir(SRC_DIR)).filter((f) => /\.(wav|mp3|ogg)$/i.test(f));
  if (files.length === 0) {
    console.log('build:audio — noch keine Sound-Quellen. Die Sounds entstehen in Meilenstein M3.');
    return;
  }

  console.error(`build:audio — ${files.length} Quellen gefunden, Sprite-Bau ist noch TODO (M3).`);
  process.exitCode = 1;
}

await main();
