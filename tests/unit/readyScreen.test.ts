/**
 * Start-Screen (Roadmap M5b).
 *
 * Der Kern ist die Tap-Sperre: Der Start-Knopf sitzt an derselben Bildschirmstelle wie
 * das „Bestätigen & verstecken" davor. Ohne Sperre reicht der zweite Tap eines
 * Doppeltaps durch, und die Show startet, während das Handy noch in einer Hand liegt.
 *
 * Geprüft wird hier, nicht im E2E-Test: Dort hängt das Ergebnis an der Latenz des
 * Runners — ein simulierter zweiter Klick kann unter Last später als 400 ms landen und
 * der Test würde grün werden, obwohl er nichts belegt.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { READY_ARM_MS } from '@/config/rules';
import { createFsm, type Fsm } from '@/core/fsm';
import { createSessionStore, type SessionStore } from '@/core/session';
import { createReadyScreen } from '@/ui/screens/ReadyScreen';
import type { ScreenContext } from '@/ui/router';

function makeContext(): { ctx: ScreenContext; fsm: Fsm; session: SessionStore } {
  const session = createSessionStore();
  session.addPlayer((index) => `Spieler ${index}`);
  session.addPlayer((index) => `Spieler ${index}`);
  const players = session.state.players.map((player) => player.id);

  const fsm = createFsm({ players });
  fsm.send({ type: 'start' });
  fsm.send({ type: 'begin' });
  for (let i = 0; i < players.length; i++) {
    fsm.send({ type: 'tap' });
    fsm.send({ type: 'confirm', sips: 3 });
  }

  const ctx = {
    fsm,
    session,
    dev: false,
    router: { register: () => undefined, go: async () => undefined, current: null, refresh: async () => undefined },
  } as unknown as ScreenContext;

  return { ctx, fsm, session };
}

beforeEach(() => {
  localStorage.clear();
});

describe('ReadyScreen', () => {
  it('steht in READY, bevor gezogen wurde', () => {
    const { fsm } = makeContext();
    expect(fsm.state).toBe('READY');
    expect(fsm.context.round).toBeNull();
  });

  it('ist beim Mounten gesperrt und der Knopf tot', () => {
    const { ctx } = makeContext();
    const screen = createReadyScreen(ctx);

    expect(screen.el.classList.contains('is-locked')).toBe(true);
    const start = screen.el.querySelector<HTMLButtonElement>('.ready__start');
    expect(start?.disabled).toBe(true);
  });

  it('ein Tap waehrend der Sperre startet die Show nicht', () => {
    vi.useFakeTimers();
    const { ctx, fsm } = makeContext();
    const screen = createReadyScreen(ctx);
    document.body.append(screen.el);
    screen.activate?.();

    const start = screen.el.querySelector<HTMLButtonElement>('.ready__start')!;
    // Knapp vor Ablauf — genau das Fenster, in dem ein Doppeltap landet.
    vi.advanceTimersByTime(READY_ARM_MS - 1);
    start.click();

    expect(fsm.state).toBe('READY');
    expect(fsm.context.round).toBeNull();
    vi.useRealTimers();
  });

  it('danach startet der Knopf die Show und zieht genau einmal', () => {
    vi.useFakeTimers();
    const { ctx, fsm } = makeContext();
    const screen = createReadyScreen(ctx);
    document.body.append(screen.el);
    screen.activate?.();

    vi.advanceTimersByTime(READY_ARM_MS);
    expect(screen.el.classList.contains('is-locked')).toBe(false);

    screen.el.querySelector<HTMLButtonElement>('.ready__start')!.click();

    expect(fsm.state).toBe('ARENA');
    expect(fsm.drawCount).toBe(1);
    vi.useRealTimers();
  });

  it('zweimal tippen zieht trotzdem nur einmal', () => {
    vi.useFakeTimers();
    const { ctx, fsm } = makeContext();
    const screen = createReadyScreen(ctx);
    document.body.append(screen.el);
    screen.activate?.();
    vi.advanceTimersByTime(READY_ARM_MS);

    const start = screen.el.querySelector<HTMLButtonElement>('.ready__start')!;
    start.click();
    start.click();

    expect(fsm.drawCount).toBe(1);
    vi.useRealTimers();
  });

  it('zeigt keinen Einsatz — auch nicht als Summe (Audit A1)', () => {
    const { ctx } = makeContext();
    const screen = createReadyScreen(ctx);

    // Beide haben 3 gesetzt, Summe 6. Keine dieser Zahlen darf auftauchen.
    const text = screen.el.textContent ?? '';
    expect(text).not.toMatch(/\b[36]\b/);
    expect(screen.el.querySelector('.stepper__value')).toBeNull();
  });

  it('nennt Modus und Dauer, damit man vor dem Start noch umsteuern kann', () => {
    const { ctx } = makeContext();
    const screen = createReadyScreen(ctx);
    const chips = screen.el.querySelectorAll('.chip');
    expect(chips).toHaveLength(2);
  });

  it('raeumt seinen Timer beim Verlassen auf', () => {
    vi.useFakeTimers();
    const { ctx } = makeContext();
    // Gegen die eigene Bilanz messen: Der Store haelt eigene Timer, die uns nichts angehen.
    const before = vi.getTimerCount();

    const screen = createReadyScreen(ctx);
    screen.activate?.();
    expect(vi.getTimerCount()).toBe(before + 1);

    // Ohne Aufraeumen wuerde der Timer den Knopf eines laengst ersetzten Screens entsperren.
    screen.destroy?.();
    expect(vi.getTimerCount()).toBe(before);
    vi.useRealTimers();
  });
});
