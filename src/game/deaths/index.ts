/**
 * Registrierung aller Todesanimationen.
 *
 * M4a liefert Kopf und Brust. Bein, Po, Miss und Miracle folgen in M4b/M4c und werden
 * hier eingetragen — die Registry prüft dabei auf doppelte IDs.
 */

import { registerDeath } from './DeathSequence';
import { basicFall } from './basic_fall';
import { headHelmetSpin } from './head/HelmetSpin';
import { headHatLaunch } from './head/HatLaunch';
import { headXray } from './head/Xray';
import { bodyDramatic } from './body/Dramatic';
import { bodyDeflate } from './body/Deflate';
import { bodyFreezeShatter } from './body/FreezeShatter';

let registered = false;

export function registerAllDeaths(): void {
  if (registered) return;
  registered = true;

  registerDeath(headHelmetSpin);
  registerDeath(headHatLaunch);
  registerDeath(headXray);
  registerDeath(bodyDramatic);
  registerDeath(bodyDeflate);
  registerDeath(bodyFreezeShatter);

  /*
   * `basic_fall` bleibt registriert, bis alle zwölf stehen. Sein Gewicht ist bewusst
   * niedrig: Er soll die Lücke füllen, nicht die Show prägen.
   */
  registerDeath(basicFall);

  // TODO(M4b): leg_hop, leg_spin, butt_rocket, butt_hotfoot, miss_then_hit
  // TODO(M4c): miracle_dodge
}

/** Nur für Tests: erlaubt erneutes Registrieren nach `clearDeathRegistry()`. */
export function resetDeathRegistration(): void {
  registered = false;
}
