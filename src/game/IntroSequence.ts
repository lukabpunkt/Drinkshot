/**
 * Der Auftakt vor der Show (GDD §3.5).
 *
 * Man sieht den Schützen von vorne — genauer: sein Zielfernrohr, das einen anschaut, und
 * dahinter einen Chibi-Kopf mit Helm. Dann fährt die Kamera **in die Linse hinein**, die
 * Blende öffnet sich, und man ist in der bekannten Scope-Sicht. Die Männchen stehen
 * derweil aufgereiht und rühren sich nicht, bis ein Warnschuss vor ihren Füßen einschlägt.
 *
 * **Kein Gewehr.** Das ist keine Sparmaßnahme, sondern Vorgabe: „Kein Blut, kein Gewehr
 * sichtbar" (Art Direction §1) und „keine echten Waffen-Darstellungen" (GDD §9,
 * Nicht-Ziele). Zwei Stummelarme greifen den Linsenring von der Seite — das liest als
 * Fernrohr. Ein Zylinder unter der Linse läse als Waffe und darf deshalb nicht gezeichnet
 * werden.
 *
 * **Warum im `overlay` und nicht in der Welt:** Die Welt ist auf einem 390er Display mit
 * 0,39 skaliert; ein bildschirmfüllender Schütze bräuchte dort über 2000 Welteinheiten
 * Höhe. Und der Push muss exakt auf dem Scope-Kreis landen, der in CSS-Pixeln definiert
 * ist. Also wird hier in Bildschirmpixeln gerechnet.
 */

import gsap from 'gsap';
import { Container, Graphics, Sprite, type Spritesheet } from 'pixi.js';
import { CHOREO, INTRO } from '@/config/choreo';
import { UI_COLORS } from '@/config/theme';
import * as audio from '@/audio/AudioManager';
import type { Camera } from './Camera';
import type { Scope } from './Scope';
import { dirtFountain, runDust } from './fx/MuzzleFlash';
import type { ParticlePool } from './fx/ParticlePool';

export interface IntroSequenceOptions {
  /** Bildschirmraum-Container (`ArenaAppHandle.overlay`). */
  overlay: Container;
  sheet: Spritesheet;
  scope: Scope;
  camera: Camera;
  particles: ParticlePool;
  /** Wo der Warnschuss einschlägt, in **Welt**koordinaten. */
  warningShot: { x: number; y: number };
  /** Taut die Männchen auf und lässt sie losstieben. */
  onScatter: () => void;
  lowEffects: boolean;
  /** Bei „Bewegung reduzieren": Schnitt statt Kamerafahrt, keine Kamerawackler. */
  reducedMotion: boolean;
  /**
   * `full` zeigt den Schützen, `short` beginnt direkt bei der Reihe.
   *
   * Steht schon im Konstruktor, damit der Kurzteil den Schützen gar nicht erst baut —
   * er läuft in **jeder** Runde ab der zweiten, und fünf Sprites plus zwei Graphics für
   * etwas, das nie sichtbar wird, wären jedes Mal umsonst.
   */
}

/** Der Linsen-Innenradius im lokalen Maßstab — alles andere skaliert dagegen. */
const LENS_R = INTRO.lensRadiusPx;

export class IntroSequence {
  private readonly options: IntroSequenceOptions;
  private readonly layer = new Container();
  private readonly backdrop = new Graphics();
  private readonly push = new Container();
  private readonly sniper = new Container();
  private readonly lensRing = new Graphics();
  private readonly irisDisc = new Graphics();
  private timeline: gsap.core.Timeline | undefined;

  /**
   * Normalisierter Fortschritt der Fahrt statt eines Tweens direkt auf `scale`.
   * So übersteht der Push einen Resize mitten in der Bewegung — dasselbe Muster wie
   * `Camera.apply()`.
   */
  private readonly progress = { value: 0 };
  private scaleStart = 1;
  private scaleEnd = 1;

  constructor(options: IntroSequenceOptions) {
    this.options = options;

    this.layer.eventMode = 'none';
    options.overlay.addChildAt(this.layer, 0);

    this.buildSniper();

    /*
     * Die geschlossene Blende. Etwas heller als der Hintergrund, sonst wäre die Linse ein
     * Loch statt einer Glasfläche — auf fast schwarzem Grund sieht man den Unterschied
     * gerade noch, und genau das macht sie zur Linse.
     */
    this.irisDisc.circle(0, 0, LENS_R).fill(UI_COLORS.bgPanel);
    this.irisDisc
      .arc(0, 0, LENS_R * 0.72, Math.PI * 1.12, Math.PI * 1.48)
      .stroke({ width: LENS_R * 0.14, color: UI_COLORS.scopeGlass, alpha: 0.18, cap: 'round' });

    // Der Ring: dicke Fassung aussen, feine Glaskante innen.
    this.lensRing
      .circle(0, 0, LENS_R + 9)
      .stroke({ width: 20, color: UI_COLORS.ink })
      .circle(0, 0, LENS_R)
      .stroke({ width: 3, color: UI_COLORS.scopeGlass, alpha: 0.45 });

    this.push.addChild(this.sniper, this.irisDisc, this.lensRing);
    this.layer.addChild(this.backdrop, this.push);
    this.resize();
  }

  /**
   * Baut den Schützen aus Teilen, die der Atlas ohnehin schon hält.
   *
   * Kein `Shotling`: Der bräuchte eine Spielerfarbe (es gibt keine dunkle), ein
   * `ShotlingBrain` und trüge ein Farbsymbol auf der Brust, an das der Rig gar keinen
   * Zugriff gibt. Vier Sprites von Hand sind ehrlicher und ein einziger Draw-Batch.
   */
  private buildSniper(): void {
    const { sheet } = this.options;
    const part = (frame: string, scale: number, x: number, y: number, anchorY = 0.5): Sprite => {
      const sprite = new Sprite(sheet.textures[frame]);
      sprite.anchor.set(0.5, anchorY);
      sprite.scale.set(scale);
      sprite.position.set(x, y);
      sprite.tint = UI_COLORS.sniper;
      return sprite;
    };

    /*
     * Die Anordnung ist das Ganze: Der Kopf muss **über** dem Linsenring hervorschauen,
     * sonst sieht man nur einen Helm auf einem Kreis. Der Ring liegt auf Augenhöhe — er
     * schaut ja hindurch —, der Torso beginnt darunter.
     */
    const torso = part('torso', 2.0, 0, 40, 0);
    const head = part('head', 1.9, 0, -70);
    const helmet = part('hats/helmet', 1.9, 0, -158, 1);

    /*
     * Zwei Stummelarme fächern von hinter der Linse nach unten aussen — zwei Hände an
     * einem Ring. **Kein Zylinder nach unten:** Der läse als Waffe, und das ist
     * ausdrücklich ausgeschlossen (Art Direction §1, GDD §9).
     */
    const armL = part('arm', 2.2, -LENS_R * 0.75, LENS_R * 0.55, 0.12);
    const armR = part('arm', 2.2, LENS_R * 0.75, LENS_R * 0.55, 0.12);
    armL.rotation = 0.5;
    armR.rotation = -0.5;

    this.sniper.addChild(torso, armL, armR, head, helmet);
  }

  /** Muss bei jedem Layout-Wechsel gerufen werden. */
  resize(): void {
    const { scope } = this.options;
    const width = scope.centerX * 2;
    const height = scope.centerY * 2;

    this.backdrop.clear();
    this.backdrop.rect(0, 0, width, height).fill(UI_COLORS.scopeVignette);

    // Am Ende der Fahrt deckt die Linse exakt den Scope-Kreis.
    this.scaleEnd = scope.radius / LENS_R;
    this.scaleStart = this.scaleEnd / INTRO.pushFactor;
    this.applyPush();
  }

  private applyPush(): void {
    const { scope } = this.options;
    const scale = this.scaleStart + (this.scaleEnd - this.scaleStart) * this.progress.value;
    this.push.scale.set(scale);
    this.push.position.set(scope.centerX, scope.centerY);
  }

  /** Baut die Timeline für den gewählten Modus. */
  build(): gsap.core.Timeline {
    const { camera, particles, warningShot, onScatter, reducedMotion } = this.options;
    const timeline = gsap.timeline({ paused: true });
    this.timeline = timeline;

    this.layer.visible = true;
    /*
     * Der Scope ist ab dem ersten Frame vollständig gezeichnet. Während man den
     * Schützen von vorne sieht, schaut man aber nicht hindurch — sonst läge das
     * Fadenkreuz über seinem Gesicht.
     */
    this.options.scope.view.visible = false;
    timeline.to({}, { duration: INTRO.sniperHoldMs / 1000 });

    /*
     * Die Fahrt in die Linse — bei „Bewegung reduzieren" ein harter Schnitt.
     *
     * Der Schütze bleibt dabei sichtbar (ADR-59). Vorher fiel der ganze Auftakt weg,
     * sobald die Systemeinstellung gesetzt war; jetzt entfällt nur die Bewegung.
     */
    if (reducedMotion) {
      timeline.call(() => {
        this.progress.value = 1;
        this.applyPush();
      });
    } else {
      timeline.to(this.progress, {
        value: 1,
        duration: INTRO.pushMs / 1000,
        ease: 'power2.in',
        onUpdate: () => this.applyPush(),
      });
    }

    /* --- Blende auf: die Scheibe schrumpft, der Hintergrund verschwindet --- */
    // Die Blende ist eine reine Deckkraft-Blende, also auch bei reduzierter Bewegung ok.
    const iris = CHOREO.introIrisMs / 1000;
    timeline.call(() => audio.play('scope_open'), undefined, 'iris');
    timeline.to(this.irisDisc.scale, { x: 0, y: 0, duration: iris, ease: 'back.in(1.4)' }, 'iris');
    timeline.to(this.backdrop, { alpha: 0, duration: iris }, 'iris');
    timeline.to(this.sniper, { alpha: 0, duration: iris * 0.7 }, 'iris');
    timeline.to(this.lensRing, { alpha: 0, duration: iris * 0.8 }, `iris+=${iris * 0.2}`);
    timeline.call(() => {
      this.layer.visible = false;
    });
    // Die Blende gibt den Blick frei — ab hier schaut man durch sein Zielfernrohr.
    timeline.call(
      () => {
        this.options.scope.view.visible = true;
      },
      undefined,
      'iris'
    );

    /* --- Die Reihe steht, das Fadenkreuz sucht sie ab --- */
    timeline.to({}, { duration: INTRO.rowHoldMs / 1000 });

    /* --- Der Warnschuss: absichtlich daneben, damit sie ihn bemerken --- */
    timeline.call(() => {
      audio.play('gunshot');
      audio.play('hit_stop_thud', 0.02, -4);
      dirtFountain(particles, warningShot);
      if (!reducedMotion) camera.shakeScreen(140, 6);
    });
    timeline.to({}, { duration: INTRO.warningShotMs / 1000 });

    /* --- Und jetzt rennen sie --- */
    timeline.call(() => {
      onScatter();
      if (!this.options.lowEffects) runDust(particles, warningShot.x, warningShot.y);
    });
    timeline.to({}, { duration: INTRO.scatterMs / 1000 });

    return timeline;
  }

  play(): void {
    this.timeline?.play(0);
  }

  pause(): void {
    this.timeline?.pause();
  }

  resume(): void {
    this.timeline?.resume();
  }

  /**
   * Springt ans Ende, ohne die übersprungenen Callbacks nachzufeuern.
   *
   * `progress(1)` allein würde Knall, Erdfontäne und Auftauen im selben Frame auslösen —
   * dieselbe Falle wie bei `ShowDirector.skipToEnd()`. Der Endzustand wird deshalb von
   * Hand hergestellt.
   */
  skip(): void {
    this.options.scope.view.visible = true;
    this.timeline?.progress(1, true);
    this.timeline?.kill();
    this.timeline = undefined;
    this.layer.visible = false;
    this.options.onScatter();
  }

  destroy(): void {
    this.options.scope.view.visible = true;
    this.timeline?.kill();
    this.timeline = undefined;
    gsap.killTweensOf([this.progress, this.irisDisc.scale, this.backdrop, this.sniper, this.lensRing]);
    this.layer.destroy({ children: true });
  }
}
