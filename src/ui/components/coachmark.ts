/**
 * Coachmark — der einmalige Hinweis in der ersten Runde (Roadmap M5.8).
 *
 * Zwei Stück, mehr nicht: Ein Trinkspiel wird im Stehen erklärt, nicht gelesen. Was
 * das Spiel wirklich braucht, ist genau zweimal Kontext — was der Einsatz bedeutet und
 * dass das Handy weitergegeben wird. Alles andere erklärt sich beim Zusehen (GDD §2:
 * Zero Friction).
 *
 * Gesehen-Flags liegen in localStorage. Schlägt der Zugriff fehl (privater Modus),
 * erscheint der Hinweis eben jedes Mal — das ist harmloser als ein Absturz.
 */

import { STORAGE_KEY_ONBOARDING } from '@/config/rules';
import { t } from '@/core/i18n';
import { safeAnimate } from '@/ui/animate';

export type CoachmarkId = 'bet' | 'pass';

function seenKey(id: CoachmarkId): string {
  return `${STORAGE_KEY_ONBOARDING}.${id}`;
}

export function hasSeenCoachmark(id: CoachmarkId): boolean {
  try {
    return globalThis.localStorage?.getItem(seenKey(id)) === '1';
  } catch {
    return false;
  }
}

function markSeen(id: CoachmarkId): void {
  try {
    globalThis.localStorage?.setItem(seenKey(id), '1');
  } catch {
    // Privater Modus — dann eben jedes Mal.
  }
}

/** Vergisst alle Hinweise. Hängt am "Session zurücksetzen" in den Einstellungen. */
export function resetCoachmarks(): void {
  try {
    for (const id of ['bet', 'pass'] as const) globalThis.localStorage?.removeItem(seenKey(id));
  } catch {
    // s. o.
  }
}

export interface CoachmarkHandle {
  el: HTMLElement | null;
  dismiss(): void;
}

/**
 * Baut den Hinweis, falls er noch nicht gesehen wurde — sonst `el: null`.
 *
 * Der Hinweis ist **kein** Modal: Er blockiert nichts, fängt keine Taps ab und
 * verschwindet beim ersten Antippen irgendwo oder nach `autoDismissMs`. Wer das Spiel
 * kennt, merkt ihn kaum; wer es nicht kennt, liest einen Satz.
 */
export function createCoachmark(
  id: CoachmarkId,
  options: { autoDismissMs?: number } = {}
): CoachmarkHandle {
  if (hasSeenCoachmark(id)) return { el: null, dismiss: () => undefined };

  const el = document.createElement('aside');
  el.className = `coachmark coachmark--${id}`;
  el.setAttribute('role', 'note');

  const text = document.createElement('p');
  text.className = 'coachmark__text';
  text.textContent = t(`onboarding.${id}`);
  el.append(text);

  let timer: ReturnType<typeof setTimeout> | undefined;

  const dismiss = (): void => {
    if (timer !== undefined) globalThis.clearTimeout(timer);
    timer = undefined;
    markSeen(id);
    if (!el.isConnected) return;
    void safeAnimate(el, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(6px)' }], {
      duration: 180,
    }).then(() => el.remove());
  };

  el.addEventListener('click', dismiss);
  if (options.autoDismissMs !== undefined) {
    timer = globalThis.setTimeout(dismiss, options.autoDismissMs);
  }

  return { el, dismiss };
}
