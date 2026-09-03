/**
 * Result (GDD §3.7 / §6.5, Roadmap M1.8).
 *
 * Der zweite Comedy-Moment des Spiels: Hier werden **alle** Einsaetze oeffentlich —
 * "Du hast 1 gesetzt und wurdest trotzdem getroffen?!". Deshalb liegt die Tabelle
 * mit Chance-Spalte direkt unter dem Reveal.
 */

import { MIN_PLAYERS } from '@/config/rules';
import { colorById, hex } from '@/config/theme';
import { plural, t } from '@/core/i18n';
import type { RoundResult } from '@/core/session';
import { createPlayerBadge } from '@/ui/components/badge';
import { createButton } from '@/ui/components/button';
import { vibrate } from '@/ui/haptics';
import type { ScreenContext, ScreenInstance } from '@/ui/router';
import { openModeSheet } from './SettingsSheet';

const CONFETTI_COUNT = 40;

const ZONE_ICONS: Record<string, string> = {
  head: '<circle cx="12" cy="9" r="5.5"/><path d="M6 21c.7-3.6 3-5.5 6-5.5s5.3 1.9 6 5.5"/>',
  body: '<path d="M12 3.5 15.5 6h2.8L20 10l-2.5 1.2V21h-11v-9.8L4 10l1.7-4h2.8z"/>',
  leg: '<path d="M10 3h4v7l3 11h-4l-1.8-7L9 21H5l3-9z"/>',
  butt: '<path d="M5 9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 9c0 4-3.1 7-7 7s-7-3-7-7z"/>',
  miss: '<circle cx="12" cy="12" r="8"/><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/>',
  miracle: '<path d="m12 3.5 2.4 5.2 5.6.7-4.2 3.9 1.1 5.6-4.9-2.8-4.9 2.8 1.1-5.6L4 9.4l5.6-.7z"/>',
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

  const victim = ctx.session.playerById(round.victimId);
  const victimColor = victim ? colorById(victim.colorId) : colorById('red');
  el.style.setProperty('--result-color', hex(victimColor.hex));

  const confetti = document.createElement('div');
  confetti.className = 'result__confetti';
  confetti.setAttribute('aria-hidden', 'true');

  /* --- Reveal --- */
  const reveal = document.createElement('div');
  reveal.className = 'result__reveal';

  const zone = document.createElement('p');
  zone.className = 'result__zone';
  zone.innerHTML = zoneIcon(round.zone);
  const zoneText = document.createElement('span');
  zoneText.textContent = t(`result.zone.${round.zone}`);
  zone.append(zoneText);

  if (victim) {
    reveal.append(createPlayerBadge({ colorId: victim.colorId, size: 'lg' }));
  }

  const headline = document.createElement('h1');
  headline.className = 'result__headline';
  headline.setAttribute('aria-live', 'polite');
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
  details.append(summary, createBetsTable(round, ctx));

  /* --- Scoreboard --- */
  const scoreboard = createScoreboard(ctx);

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

  actions.append(next, changePlayers, changeMode);

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
      spawnConfetti(confetti, hex(victimColor.hex), hex(victimColor.shade));
      headline.animate(
        [
          { transform: 'scale(0.7)', opacity: 0 },
          { transform: 'scale(1.12)', opacity: 1, offset: 0.6 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' }
      );
    },
  };
}

/* ------------------------------------------------------------------ */

function headlineText(round: RoundResult, ctx: ScreenContext): string {
  if (round.zone === 'miracle') return t('result.miracle');

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

function createBetsTable(round: RoundResult, ctx: ScreenContext): HTMLElement {
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
    if (bet.playerId === round.victimId) row.classList.add('is-victim');

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
    betCell.textContent = String(bet.sips);

    const chanceCell = document.createElement('td');
    chanceCell.className = 'bets__num';
    chanceCell.textContent = `${Math.round((round.odds[bet.playerId] ?? 0) * 100)} %`;

    row.append(nameCell, betCell, chanceCell);
    body.append(row);
  }

  table.append(head, body);
  return table;
}

function createScoreboard(ctx: ScreenContext): HTMLElement {
  const wrapper = document.createElement('section');
  wrapper.className = 'score';

  const title = document.createElement('h2');
  title.className = 'score__title';
  title.textContent = t('result.scoreboard');
  wrapper.append(title);

  const totals = ctx.session.scoreboard();
  const max = Math.max(1, ...Object.values(totals));

  for (const player of ctx.session.state.players) {
    const total = totals[player.id] ?? 0;
    const row = document.createElement('div');
    row.className = 'score__row';

    const name = document.createElement('span');
    name.className = 'score__name';
    name.textContent = player.name;

    const bar = document.createElement('span');
    bar.className = 'score__bar';
    bar.style.setProperty('--score-color', hex(colorById(player.colorId).hex));
    bar.style.setProperty('--score-fill', `${(total / max) * 100}%`);

    const value = document.createElement('span');
    value.className = 'score__value';
    value.textContent = String(total);

    row.append(name, bar, value);
    wrapper.append(row);
  }

  return wrapper;
}

/** CSS-Konfetti in der Farbe des Opfers (GDD §6.5). */
function spawnConfetti(host: HTMLElement, color: string, shade: string): void {
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < CONFETTI_COUNT; index++) {
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
