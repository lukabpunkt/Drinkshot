/**
 * Registrierung aller Todesanimationen.
 *
 * M3 liefert nur `basic_fall`. Die zwölf Sequenzen aus GDD §4.1 kommen in M4 dazu und
 * werden hier eingetragen — die Registry prüft dabei auf doppelte IDs.
 */

import { registerDeath } from './DeathSequence';
import { basicFall } from './basic_fall';

let registered = false;

export function registerAllDeaths(): void {
  if (registered) return;
  registered = true;
  registerDeath(basicFall);
  // TODO(M4): head_helmet_spin, head_hat_launch, head_xray, body_dramatic, body_deflate,
  //           body_freeze_shatter, leg_hop, leg_spin, butt_rocket, butt_hotfoot,
  //           miss_then_hit, miracle_dodge
}

/** Nur für Tests: erlaubt erneutes Registrieren nach `clearDeathRegistry()`. */
export function resetDeathRegistration(): void {
  registered = false;
}
