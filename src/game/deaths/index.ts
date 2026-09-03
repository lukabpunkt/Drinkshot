/**
 * Registrierung aller Todesanimationen.
 *
 * Alle zwölf Sequenzen aus GDD §4.1 plus `basic_fall`. Die Registry prüft beim Eintragen
 * auf doppelte IDs; die Auswahl steckt in `pickDeath`.
 */

import { registerDeath } from './DeathSequence';
import { basicFall } from './basic_fall';
import { headHelmetSpin } from './head/HelmetSpin';
import { headHatLaunch } from './head/HatLaunch';
import { headXray } from './head/Xray';
import { bodyDramatic } from './body/Dramatic';
import { bodyDeflate } from './body/Deflate';
import { bodyFreezeShatter } from './body/FreezeShatter';
import { legHop } from './leg/Hop';
import { legSpin } from './leg/Spin';
import { buttRocket } from './butt/Rocket';
import { buttHotfoot } from './butt/Hotfoot';
import { missThenHit } from './miss/MissThenHit';
import { miracleDodge } from './miracle/Dodge';

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
  registerDeath(legHop);
  registerDeath(legSpin);
  registerDeath(buttRocket);
  registerDeath(buttHotfoot);
  registerDeath(missThenHit);
  registerDeath(miracleDodge);

  /*
   * `basic_fall` bleibt registriert, bis alle zwölf stehen. Sein Gewicht ist bewusst
   * niedrig: Er soll die Lücke füllen, nicht die Show prägen.
   */
  registerDeath(basicFall);

}

/** Nur für Tests: erlaubt erneutes Registrieren nach `clearDeathRegistry()`. */
export function resetDeathRegistration(): void {
  registered = false;
}
