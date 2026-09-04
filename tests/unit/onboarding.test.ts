/**
 * Onboarding-Hinweise (Roadmap M5.8, Audit A5).
 *
 * Der Kern der Sache ist nicht das Aussehen, sondern dass die Hinweise **einmal**
 * kommen: Ein Tooltip, der in jeder Runde wieder aufpoppt, ist kein Onboarding mehr,
 * sondern eine Störung (GDD §2: Zero Friction).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY_ONBOARDING } from '@/config/rules';
import { createCoachmark, hasSeenCoachmark, resetCoachmarks } from '@/ui/components/coachmark';

beforeEach(() => {
  localStorage.clear();
});

describe('Coachmark', () => {
  it('erscheint beim ersten Mal', () => {
    const coach = createCoachmark('bet');
    expect(coach.el).not.toBeNull();
    expect(coach.el?.textContent?.length).toBeGreaterThan(10);
  });

  it('kommt nach dem Wegtippen nicht wieder', () => {
    const first = createCoachmark('bet');
    document.body.append(first.el!);
    first.dismiss();

    expect(hasSeenCoachmark('bet')).toBe(true);
    expect(createCoachmark('bet').el).toBeNull();
  });

  it('haelt die beiden Hinweise auseinander', () => {
    createCoachmark('bet').dismiss();
    expect(hasSeenCoachmark('bet')).toBe(true);
    expect(hasSeenCoachmark('pass')).toBe(false);
    expect(createCoachmark('pass').el).not.toBeNull();
  });

  it('verschwindet von selbst', () => {
    vi.useFakeTimers();
    const coach = createCoachmark('pass', { autoDismissMs: 1000 });
    document.body.append(coach.el!);

    expect(hasSeenCoachmark('pass')).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(hasSeenCoachmark('pass')).toBe(true);
    vi.useRealTimers();
  });

  it('faengt keine Taps ab und blockiert nichts', () => {
    const coach = createCoachmark('bet');
    // Kein Modal: keine Rolle, die den Rest der Seite inaktiv macht.
    expect(coach.el?.getAttribute('role')).toBe('note');
    expect(coach.el?.hasAttribute('aria-modal')).toBe(false);
  });

  it('"Session zuruecksetzen" bringt die Hinweise zurueck', () => {
    createCoachmark('bet').dismiss();
    createCoachmark('pass').dismiss();

    resetCoachmarks();

    expect(hasSeenCoachmark('bet')).toBe(false);
    expect(hasSeenCoachmark('pass')).toBe(false);
  });

  it('ueberlebt einen blockierten localStorage', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('SecurityError');
    };
    try {
      // Kein Absturz — der Hinweis erscheint dann eben jedes Mal.
      expect(() => createCoachmark('bet')).not.toThrow();
      expect(hasSeenCoachmark('bet')).toBe(false);
    } finally {
      Storage.prototype.getItem = original;
    }
  });

  it('schreibt unter einem versionierten Schluessel', () => {
    createCoachmark('bet').dismiss();
    expect(localStorage.getItem(`${STORAGE_KEY_ONBOARDING}.bet`)).toBe('1');
  });
});
