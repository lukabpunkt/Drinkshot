/**
 * Result (GDD §3.7 / §6.5, Roadmap M1.8).
 *
 * Der zweite Comedy-Moment des Spiels: Hier werden **alle** Einsaetze oeffentlich —
 * "Du hast 1 gesetzt und wurdest trotzdem getroffen?!". Deshalb liegt die Tabelle
 * mit Chance-Spalte direkt unter dem Reveal.
 */

import { MIN_PLAYERS } from '@/config/rules';
import { colorById, hex, MOTION, UI_COLORS } from '@/config/theme';
import { plural, t } from '@/core/i18n';
import * as audio from '@/audio/AudioManager';
import type { RoundResult } from '@/core/session';
import { countUp, growBar, prefersReducedMotion } from '@/ui/animate';
import { createPlayerBadge } from '@/ui/components/badge';
import { createButton } from '@/ui/components/button';
import { vibrate } from '@/ui/haptics';
import type { ScreenContext, ScreenInstance } from '@/ui/router';
import { openModeSheet } from './SettingsSheet';

const CONFETTI_COUNT = 40;

/**
 * Zonen-Icons (Roadmap M4.5). Jedes zeigt, **wo** getroffen wurde — die Silhouette eines
 * Shotlings mit markierter Stelle, damit man es ohne Text versteht.
 */
const ZONE_ICONS: Record<string, string> = {
  // Kopf mit Einschlag-Stern daneben
  head: '<circle cx="10" cy="8" r="5"/><path d="M6 20c0-3.3 1.8-5 4-5s4 1.7 4 5"/><path d="m18 4 1.2 2.4L22 6.8l-2 1.9.5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-1.9 2.8-.4z"/>',
  // Torso mit Treffer in der Mitte
  body: '<circle cx="12" cy="5" r="3"/><path d="M8 10h8v7H8z"/><circle cx="12" cy="13.5" r="1.8" fill="currentColor"/><path d="M9 17v4M15 17v4"/>',
  // Ein Bein hervorgehoben
  leg: '<circle cx="12" cy="4.5" r="2.6"/><path d="M9 9h6v6H9z"/><path d="M10.5 15v6"/><path d="M13.5 15v6" stroke-dasharray="2 2"/>',
  // Von hinten getroffen
  butt: '<circle cx="12" cy="4.5" r="2.6"/><path d="M9 9h6v5H9z"/><path d="M8 14.5c0 2.5 1.8 4 4 4s4-1.5 4-4"/><path d="M19 12l3 3m0-3-3 3"/>',
  // Danebengeschossen: Ziel plus abgelenkter Pfeil
  miss: '<circle cx="9" cy="12" r="6"/><circle cx="9" cy="12" r="2"/><path d="M15 5 22 12"/><path d="M19 5h3v3"/>',
  // Wunder: Stern mit Strahlen
  miracle:
    '<path d="m12 3 2 4.4 4.8.6-3.6 3.3 1 4.8L12 13.7 7.8 16.1l1-4.8L5.2 8l4.8-.6z"/><path d="M4 19.5 5.5 21M20 19.5 18.5 21M12 19.5V22"/>',
};

function zoneIcon(zone: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
    ZONE_ICONS[zone] ?? ZONE_ICONS['body']
  }</svg>`;
}

export function createResultScreen(ctx: ScreenContext): ScreenInstance {
  const rounds = ctx.session.state.rounds;
  const round = rounds[rounds.length - 1];

  const el = document.createElement('section');
  el.className = 'screen screen--result';

  if (!round) {
    // Sollte nie passieren; lieber ein sauberer Ausweg als ein leerer Screen.
    const fallback = document.createElement('p');
    fallback.className = 'result__fallback';
    fallback.textContent = t('error.generic');
    el.append(
      fallback,
      createButton({
        label: t('result.changePlayers'),
        variant: 'secondary',
        className: 'btn--block',
        onClick: () => ctx.fsm.send({ type: 'changePlayers' }),
      })
    );
    return { el };
  }

  const isMiracle = round.zone === 'miracle';
  const isShowdown = round.mode === 'showdown';

  /*
   * Wer steht im Mittelpunkt? Normalerweise das Opfer — im Showdown der **Überlebende**.
   * Dort sind fast alle Opfer; die Geschichte ist, wer noch steht.
   */
  const heroId = isShowdown ? (round.winnerId ?? round.victimId) : round.victimId;
  const victim = ctx.session.playerById(heroId);
  const victimColor = victim ? colorById(victim.colorId) : colorById('red');

  /*
   * Beim Wunder wird nicht in der Farbe des Opfers gefeiert, sondern in Gold: Es ist der
   * seltenste Ausgang des Spiels (1 von 40 Runden) und soll sich auch so anfühlen.
   */
  el.style.setProperty('--result-color', hex(isMiracle ? UI_COLORS.accent : victimColor.hex));
  if (isMiracle) el.classList.add('screen--result-miracle');

  /*
   * Alle laufenden Zähler und Balken. Verlässt man den Screen mitten im Hochzählen,
   * würden sonst verwaiste `requestAnimationFrame`-Schleifen weiterlaufen.
   */
  const cancels: (() => void)[] = [];

  const confetti = document.createElement('div');
  confetti.className = 'result__confetti';
  confetti.setAttribute('aria-hidden', 'true');

  /* --- Reveal --- */
  const reveal = document.createElement('div');
  reveal.className = 'result__reveal';
  /*
   * Zone, Kopfzeile und Unterzeile gehören zusammen — „Kopfschuss! Anna trinkt 3 Schlucke."
   * Steht `aria-live` nur auf der Kopfzeile, fehlt der Treffer und bei Double Tap das
   * zweite Opfer. `role="status"` liefert die Rolle für Browser ohne `aria-live`-Mapping.
   */
  reveal.setAttribute('role', 'status');
  reveal.setAttribute('aria-live', 'polite');
  reveal.setAttribute('aria-atomic', 'true');

  const zone = document.createElement('p');
  zone.className = 'result__zone';
  const shots = 1 + round.extraVictimIds.length;
  if (isShowdown) {
    /*
     * Eine einzelne Trefferzone sagt bei fünf Schüssen nichts — die Zahl der Schüsse
     * schon.
     */
    zone.innerHTML = zoneIcon('miss');
    const zoneText = document.createElement('span');
    zoneText.textContent = t('result.showdownShots', { count: shots });
    zone.append(zoneText);
  } else {
    zone.innerHTML = zoneIcon(round.zone);
    const zoneText = document.createElement('span');
    zoneText.textContent = t(`result.zone.${round.zone}`);
    zone.append(zoneText);
  }

  if (isMiracle) {
    const badge = document.createElement('p');
    badge.className = 'result__legend';
    badge.textContent = t('result.miracleBadge');
    reveal.append(badge);
  } else if (isShowdown && round.winnerId !== undefined) {
    const badge = document.createElement('p');
    badge.className = 'result__legend result__crown';
    badge.textContent = t('result.survivorBadge');
    reveal.append(badge);
  }

  if (victim) {
    reveal.append(createPlayerBadge({ colorId: victim.colorId, size: 'lg' }));
  }

  const headline = document.createElement('h1');
  headline.className = 'result__headline';
  headline.textContent = headlineText(round, ctx);

  const sub = document.createElement('p');
  sub.className = 'result__sub';
  sub.textContent = subText(round, ctx);
  sub.hidden = sub.textContent === '';

  reveal.append(zone, headline, sub);

  /* --- Einsatz-Tabelle --- */
  const details = document.createElement('details');
  details.className = 'result__details';
  details.open = true;

  const summary = document.createElement('summary');
  summary.className = 'result__summary';
  summary.textContent = t('result.allBets');
  details.append(summary, createBetsTable(round, ctx, cancels));

  /* --- Scoreboard --- */
  const scoreboard = createScoreboard(ctx, cancels);

  /* --- Aktionen --- */
  const actions = document.createElement('div');
  actions.className = 'result__actions';

  const canContinue = ctx.session.activePlayers().length >= MIN_PLAYERS;

  const next = createButton({
    label: t('result.nextRound'),
    variant: 'primary',
    wobble: canContinue,
    className: 'btn--block',
    disabled: !canContinue,
    onClick: () => {
      vibrate('tap');
      ctx.fsm.setPlayers(ctx.session.activePlayers().map((player) => player.id));
      ctx.fsm.send({ type: 'nextRound' });
    },
  });

  const changePlayers = createButton({
    label: t('result.changePlayers'),
    variant: 'secondary',
    className: 'btn--block',
    onClick: () => ctx.fsm.send({ type: 'changePlayers' }),
  });

  const changeMode = createButton({
    label: t('result.changeMode'),
    variant: 'ghost',
    className: 'btn--block',
    onClick: () => openModeSheet(ctx),
  });

  const home = createButton({
    label: t('nav.home'),
    variant: 'ghost',
    className: 'btn--block',
    onClick: () => ctx.fsm.send({ type: 'quit' }),
  });

  actions.append(next, changePlayers, changeMode, home);

  if (!canContinue) {
    const note = document.createElement('p');
    note.className = 'result__note';
    note.textContent = t('result.needMorePlayers');
    actions.prepend(note);
  }

  el.append(confetti, reveal, details, scoreboard, actions);

  return {
    el,
    activate() {
      vibrate('reveal');
      if (isMiracle) {
        audio.play('miracle_choir');
        spawnConfetti(confetti, hex(UI_COLORS.accent), hex(UI_COLORS.accentShade), 70);
      } else {
        audio.play('fanfare_result');
        spawnConfetti(confetti, hex(victimColor.hex), hex(victimColor.shade));
      }
      headline.animate(
        [
          { transform: 'scale(0.7)', opacity: 0 },
          { transform: 'scale(1.12)', opacity: 1, offset: 0.6 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' }
      );
    },
    destroy() {
      for (const cancel of cancels) cancel();
    },
  };
}

/* ------------------------------------------------------------------ */

function headlineText(round: RoundResult, ctx: ScreenContext): string {
  if (round.zone === 'miracle') return t('result.miracle');

  if (round.mode === 'showdown' && round.winnerId !== undefined) {
    const winner = ctx.session.playerById(round.winnerId);
    return t('result.survives', { name: winner?.name ?? '' });
  }

  const victim = ctx.session.playerById(round.victimId);
  const name = victim?.name ?? '';

  if (round.mode === 'distributor') {
    const sips = round.drinkers[0]?.sips ?? 0;
    return t('result.drinksDistributor', { name, sips: plural('common.sipsCount', sips) });
  }

  const own = round.drinkers.find((drinker) => drinker.playerId === round.victimId)?.sips ?? 0;
  return t('result.drinks', { name, sips: plural('common.sipsCount', own) });
}

function subText(round: RoundResult, ctx: ScreenContext): string {
  if (round.zone === 'miracle') return '';

  if (round.mode === 'distributor') {
    const sips = round.drinkers[0]?.sips ?? 0;
    return t('result.everyoneElseDrinks', { sips: plural('common.sipsCount', sips) });
  }

  if (round.mode === 'doubleTap') {
    const others = round.drinkers.filter((drinker) => drinker.playerId !== round.victimId);
    return others
      .map((drinker) => {
        const name = ctx.session.playerById(drinker.playerId)?.name ?? '';
        return t('result.drinks', { name, sips: plural('common.sipsCount', drinker.sips) });
      })
      .join(' ');
  }

  if (round.mode === 'showdown') {
    if (round.winnerId === undefined) return '';
    const winner = ctx.session.playerById(round.winnerId);
    return t('result.showdownSub', {
      name: winner?.name ?? '',
      sips: plural('common.sipsCount', round.sipsToDistribute ?? 0),
    });
  }

  if (round.mode === 'suddenDeath') {
    if (round.winnerId !== undefined) {
      const name = ctx.session.playerById(round.winnerId)?.name ?? '';
      return t('result.winner', {
        name,
        sips: plural('common.sipsCount', round.sipsToDistribute ?? 0),
      });
    }
    const name = ctx.session.playerById(round.victimId)?.name ?? '';
    return t('result.eliminated', { name });
  }

  return '';
}

function createBetsTable(
  round: RoundResult,
  ctx: ScreenContext,
  cancels: (() => void)[]
): HTMLElement {
  const table = document.createElement('table');
  table.className = 'bets';

  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const key of ['result.tableName', 'result.tableBet', 'result.tableChance']) {
    const cell = document.createElement('th');
    cell.textContent = t(key);
    if (key !== 'result.tableName') cell.className = 'bets__num';
    headRow.append(cell);
  }
  head.append(headRow);

  const body = document.createElement('tbody');
  // Absteigend nach Einsatz — die Mutigen stehen oben, das erzeugt das Gespraech.
  const sorted = [...round.bets].sort((a, b) => b.sips - a.sips);

  for (const bet of sorted) {
    const player = ctx.session.playerById(bet.playerId);
    const row = document.createElement('tr');
    /*
     * Normalerweise hebt die Tabelle das Opfer hervor. Im Showdown sind fast alle Opfer —
     * hervorgehoben wird deshalb der Überlebende.
     */
    if (round.mode === 'showdown') {
      if (bet.playerId === round.winnerId) row.classList.add('is-winner');
    } else if (bet.playerId === round.victimId) {
      row.classList.add('is-victim');
    }

    const nameCell = document.createElement('td');
    nameCell.className = 'bets__name';
    if (player) {
      nameCell.append(createPlayerBadge({ colorId: player.colorId, size: 'sm' }));
      const label = document.createElement('span');
      label.textContent = player.name;
      nameCell.append(label);
    }

    const betCell = document.createElement('td');
    betCell.className = 'bets__num';
    const delay = body.childElementCount * MOTION.staggerMs;
    cancels.push(countUp(betCell, bet.sips, { delayMs: delay }));

    const chanceCell = document.createElement('td');
    chanceCell.className = 'bets__num';
    cancels.push(
      countUp(chanceCell, Math.round((round.odds[bet.playerId] ?? 0) * 100), {
        delayMs: delay,
        format: (n) => `${n} %`,
      })
    );

    row.append(nameCell, betCell, chanceCell);
    body.append(row);
  }

  table.append(head, body);
  return table;
}

function createScoreboard(ctx: ScreenContext, cancels: (() => void)[]): HTMLElement {
  const wrapper = document.createElement('section');
  wrapper.className = 'score';

  const title = document.createElement('h2');
  title.className = 'score__title';
  title.textContent = t('result.scoreboard');
  wrapper.append(title);

  const totals = ctx.session.scoreboard();
  const max = Math.max(1, ...Object.values(totals));

  ctx.session.state.players.forEach((player, index) => {
    const total = totals[player.id] ?? 0;
    const row = document.createElement('div');
    row.className = 'score__row';

    const name = document.createElement('span');
    name.className = 'score__name';
    name.textContent = player.name;

    const delay = index * MOTION.staggerMs;

    const bar = document.createElement('span');
    bar.className = 'score__bar';
    bar.style.setProperty('--score-color', hex(colorById(player.colorId).hex));
    growBar(bar, (total / max) * 100, delay);

    const value = document.createElement('span');
    value.className = 'score__value';
    cancels.push(countUp(value, total, { delayMs: delay }));

    row.append(name, bar, value);
    wrapper.append(row);
  });

  return wrapper;
}

/** CSS-Konfetti in der Farbe des Opfers, beim Wunder in Gold (GDD §6.5). */
function spawnConfetti(host: HTMLElement, color: string, shade: string, count = CONFETTI_COUNT): void {
  if (prefersReducedMotion()) return;
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < count; index++) {
    const piece = document.createElement('i');
    piece.className = 'result__confettiPiece';
    piece.style.setProperty('--x', `${Math.round(Math.random() * 100)}%`);
    piece.style.setProperty('--delay', `${Math.round(Math.random() * 700)}ms`);
    piece.style.setProperty('--spin', `${Math.round(Math.random() * 720 - 360)}deg`);
    piece.style.setProperty('--piece-color', index % 2 === 0 ? color : shade);
    fragment.append(piece);
  }
  host.replaceChildren(fragment);
}
