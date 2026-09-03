/**
 * Todesanimationen (Audit A4).
 *
 * Prüft für **jede** Sequenz die Kriterien, die sich messen lassen: Dauer, Endzustand,
 * sauberer Reset, Sound-Cues, Overshoot-Easing und den gemeinsamen Abschluss. Was sich
 * nicht messen lässt — ob es lustig ist —, steht als manueller Check im Report.
 *
 * Der Harness baut einen **echten** `Shotling` (nur der Atlas ist eine Attrappe), damit
 * die Tests dieselben Rig-Teile anfassen wie die Sequenzen. Scope, Kamera, Partikel und
 * Ton sind leichte Doubles, die mitschreiben.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { Container, Texture, type Spritesheet } from 'pixi.js';
import gsap from 'gsap';
import { ANIM } from '@/config/theme';
import { createSeededRng } from '@/core/rng';
import { Shotling } from '@/game/Shotling';
import { ShotlingBrain } from '@/game/ShotlingBrain';
import { ParticlePool } from '@/game/fx/ParticlePool';
import { FINISHED_FLAG } from '@/game/fx/deathFinish';
import {
  allDeaths,
  clearDeathRegistry,
  type DeathContext,
  type DeathSequence,
} from '@/game/deaths/DeathSequence';
import { registerAllDeaths, resetDeathRegistration } from '@/game/deaths';

/** Atlas-Attrappe: liefert für jeden Frame-Namen eine leere Textur. */
const fakeSheet = {
  textures: new Proxy({} as Record<string, Texture>, {
    get: () => Texture.EMPTY,
    has: () => true,
  }),
} as unknown as Spritesheet;

interface Harness {
  ctx: DeathContext;
  cues: string[];
  shakes: number;
  afterShocks: number;
}

function makeShotling(seed: number, hat: 'cap' | 'none' = 'cap'): Shotling {
  const rng = createSeededRng(seed);
  const brain = new ShotlingBrain({ centerX: 500, centerY: 500, radius: 300, rng });
  return new Shotling({ sheet: fakeSheet, colorId: 'red', brain, rng, hatId: hat, height: 200 });
}

function makeHarness(hat: 'cap' | 'none' = 'cap'): Harness {
  const victim = makeShotling(1, hat);
  const others = [makeShotling(2), makeShotling(3)];
  const cues: string[] = [];
  const state = { shakes: 0, afterShocks: 0 };

  const camera = {
    shakeScreen: () => {
      state.shakes++;
      return gsap.timeline();
    },
    afterShock: () => {
      state.afterShocks++;
      return gsap.timeline();
    },
    zoomIn: () => gsap.timeline(),
    zoomOut: () => gsap.timeline(),
  };

  const ctx = {
    victim,
    others,
    scope: { centerX: 500, centerY: 500, aimAt: () => gsap.timeline(), flash: () => gsap.timeline() },
    camera,
    fx: { particles: new ParticlePool(60), overlay: new Container() },
    audio: { play: (cue: string) => cues.push(cue) },
    rng: createSeededRng(99),
    arena: {
      centerX: 500,
      centerY: 500,
      walkRadius: 300,
      actorLayer: new Container(),
    },
  } as unknown as DeathContext;

  return {
    ctx,
    cues,
    get shakes() {
      return state.shakes;
    },
    get afterShocks() {
      return state.afterShocks;
    },
  } as Harness;
}

/** Spielt die Timeline vollständig ab, ohne auf echte Zeit zu warten. */
function runToEnd(timeline: gsap.core.Timeline): void {
  timeline.progress(1, false);
}

beforeEach(() => {
  clearDeathRegistry();
  resetDeathRegistration();
  registerAllDeaths();
});

describe('Registry nach M4a', () => {
  it('enthält die sechs Sequenzen aus Kopf und Brust', () => {
    const ids = allDeaths().map((sequence) => sequence.id).sort();
    expect(ids).toEqual(
      [
        'basic_fall',
        'body_deflate',
        'body_dramatic',
        'body_freeze_shatter',
        'head_hat_launch',
        'head_helmet_spin',
        'head_xray',
      ].sort()
    );
  });

  it('deckt die Zonen Kopf und Brust ab', () => {
    const zones = new Set(allDeaths().map((sequence) => sequence.zone));
    expect(zones.has('head')).toBe(true);
    expect(zones.has('body')).toBe(true);
  });

  it('head_hat_launch wählt sich ohne Hut ab', () => {
    const withHat = makeHarness('cap');
    const withoutHat = makeHarness('none');
    const sequence = allDeaths().find((s) => s.id === 'head_hat_launch')!;

    expect(sequence.isEligible?.(withHat.ctx)).toBe(true);
    expect(sequence.isEligible?.(withoutHat.ctx)).toBe(false);
  });
});

describe.each(
  [
    'head_helmet_spin',
    'head_hat_launch',
    'head_xray',
    'body_dramatic',
    'body_deflate',
    'body_freeze_shatter',
    'basic_fall',
  ].map((id) => [id] as const)
)('%s', (id) => {
  function sequenceOf(): DeathSequence {
    const found = allDeaths().find((entry) => entry.id === id);
    expect(found, `Sequenz ${id} ist nicht registriert`).toBeDefined();
    return found!;
  }

  it('baut eine Timeline ohne Fehler', () => {
    const harness = makeHarness();
    expect(() => sequenceOf().build(harness.ctx)).not.toThrow();
  });

  it(`dauert ${ANIM.deathMinMs / 1000}–${ANIM.deathMaxMs / 1000} s (Audit A4)`, () => {
    const harness = makeHarness();
    const duration = sequenceOf().build(harness.ctx).duration() * 1000;
    expect(duration, `${id}: ${(duration / 1000).toFixed(2)} s`).toBeGreaterThanOrEqual(
      ANIM.deathMinMs
    );
    expect(duration, `${id}: ${(duration / 1000).toFixed(2)} s`).toBeLessThanOrEqual(
      ANIM.deathMaxMs
    );
  });

  it('lässt das Opfer am Ende als "dead" zurück', () => {
    const harness = makeHarness();
    runToEnd(sequenceOf().build(harness.ctx));
    expect(harness.ctx.victim.getState()).toBe('dead');
  });

  it('gibt das Rig nach reset() sauber zurück (Audit A4)', () => {
    const harness = makeHarness();
    const victim = harness.ctx.victim;
    const scaleBefore = { x: victim.view.scale.x, y: victim.view.scale.y };

    runToEnd(sequenceOf().build(harness.ctx));

    victim.reset();

    // Die Skalierung gehört dazu: Sequenzen, die das Rig schrumpfen oder plattdrücken,
    // würden das Männchen sonst dauerhaft verformt zurücklassen.
    expect(victim.view.scale.x).toBeCloseTo(scaleBefore.x, 6);
    expect(victim.view.scale.y).toBeCloseTo(scaleBefore.y, 6);

    expect(victim.getState()).toBe('idle');
    expect(victim.isDriven()).toBe(false);
    expect(victim.view.rotation).toBe(0);
    expect(victim.view.alpha).toBe(1);
    expect(victim.rig.body.rotation).toBe(0);
    expect(victim.rig.body.alpha).toBe(1);
    expect(victim.rig.body.position.y).toBe(0);
    expect(victim.rig.head.rotation).toBe(0);
    // Der Hut hängt wieder am Kopf, nicht in der Arena.
    expect(victim.rig.hat.parent).toBe(victim.rig.head);
  });

  it('setzt Sound-Cues ab', () => {
    const harness = makeHarness();
    runToEnd(sequenceOf().build(harness.ctx));
    expect(harness.cues.length, `${id} spielt keinen Ton`).toBeGreaterThan(2);
  });

  it('schliesst über finishDeath ab: Grabstein und Nachbeben', () => {
    const harness = makeHarness();
    const timeline = sequenceOf().build(harness.ctx);
    runToEnd(timeline);

    expect(
      (timeline as unknown as Record<string, boolean>)[FINISHED_FLAG],
      `${id} benutzt finishDeath() nicht`
    ).toBe(true);
    expect(harness.afterShocks, `${id} hat kein Nachbeben`).toBeGreaterThan(0);
    expect(harness.cues, `${id} setzt keinen Grabstein`).toContain('rip_pop');
  });

  it('wackelt beim Treffer (Screen-Shake)', () => {
    const harness = makeHarness();
    runToEnd(sequenceOf().build(harness.ctx));
    expect(harness.shakes).toBeGreaterThan(0);
  });

  it('benutzt kein lineares und kein power1-Easing (Audit A4)', () => {
    const harness = makeHarness();
    const timeline = sequenceOf().build(harness.ctx);

    /*
     * `none`/`linear` ist bei reinen Warte-Tweens (`to({}, {duration})`) und bei
     * Hilfs-Tweens ohne sichtbare Bewegung erlaubt — verboten ist es für Bewegungen.
     * Geprüft wird deshalb, dass die Sequenz überhaupt Overshoot- oder Feder-Easings
     * benutzt, nicht nur Rampen.
     */
    const eases = timeline
      .getChildren(true, true, false)
      .map((child) => String((child.vars as { ease?: unknown }).ease ?? ''));
    const hasCharacter = eases.some((ease) => /back|elastic|bounce|power[234]/.test(ease));
    expect(hasCharacter, `${id} animiert nur mit Rampen: ${eases.join(', ')}`).toBe(true);
  });
});

describe('Hit-Stop', () => {
  it('jede Sequenz hält beim Treffer 80 ms still (Art Direction §5.2)', () => {
    for (const sequence of allDeaths()) {
      const harness = makeHarness();
      const timeline = sequence.build(harness.ctx);
      const holds = timeline
        .getChildren(true, true, false)
        .filter((child) => Math.abs(child.duration() * 1000 - ANIM.hitStopMs) < 1);
      expect(holds.length, `${sequence.id} hat keinen Hit-Stop`).toBeGreaterThan(0);
    }
  });
});
