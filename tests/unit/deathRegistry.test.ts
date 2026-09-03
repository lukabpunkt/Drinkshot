/**
 * Death-Registry-Tests — werden in M3/M4 geliefert
 * (docs/03-ARCHITECTURE.md §6, Audit A4).
 */

import { describe, it } from 'vitest';

describe('Death-Registry (M3/M4)', () => {
  it.todo('alle 12 DeathIds aus GDD §4.1 sind registriert');
  it.todo('No-Repeat-Fenster 4: über 1 000 Runden nie dieselbe ID in 4 Folge-Runden');
  it.todo('gewichtete Auswahl respektiert die Gewichte (miracle sehr klein)');
  it.todo('jede Sequenz dauert 1.5–4.5 s');
  it.todo('jede Sequenz endet mit victim.state === "dead" (außer miracle)');
  it.todo('nach Sequenz + Reset ist der Shotling wieder "idle"');
  it.todo('zu jeder Zone existiert ein Icon und ein Zonen-Text');
});
