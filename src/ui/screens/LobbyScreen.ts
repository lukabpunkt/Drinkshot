/**
 * Lobby (GDD §6.1, Roadmap M1.4).
 *
 * Spieler hinzufuegen, umbenennen, entfernen (2–8). Farben werden automatisch der Reihe
 * nach vergeben. Modus- und Dauer-Chip oeffnen ihre Sheets. Namen und Settings landen
 * sofort im localStorage — nach einem Reload steht alles wieder da (Audit A1).
 */

import { MAX_NAME_LENGTH, MAX_PLAYERS, MIN_PLAYERS } from '@/config/rules';
import { t } from '@/core/i18n';
import { eliminatedPlayerIds, type Player } from '@/core/session';
import { createButton, createChip } from '@/ui/components/button';
import { createPlayerBadge } from '@/ui/components/badge';
import { showToast } from '@/ui/components/toast';
import { vibrate } from '@/ui/haptics';
import type { ScreenContext, ScreenInstance } from '@/ui/router';
import { openDurationSheet, openModeSheet } from './SettingsSheet';

const ICON_REMOVE =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 18 18M18 6 6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>';

export function createLobbyScreen(ctx: ScreenContext): ScreenInstance {
  const el = document.createElement('section');
  el.className = 'screen screen--lobby';

  const header = document.createElement('header');
  header.className = 'lobby__header';

  const headline = document.createElement('h1');
  headline.className = 'lobby__headline';
  headline.textContent = t('lobby.headline');

  const count = document.createElement('p');
  count.className = 'lobby__count';

  header.append(headline, count);

  const list = document.createElement('ul');
  list.className = 'lobby__list';

  const addButton = createButton({
    label: t('lobby.addPlayer'),
    variant: 'secondary',
    className: 'btn--block lobby__add',
    onClick: () => {
      const player = ctx.session.addPlayer((index) => t('lobby.defaultName', { index }));
      if (player === null) {
        showToast(t('lobby.maxPlayers', { max: MAX_PLAYERS }), { variant: 'danger' });
        return;
      }
      vibrate('tap');
      render();
      // Frisch angelegte Zeile direkt zum Umbenennen anbieten.
      list.querySelector<HTMLInputElement>(`[data-player="${player.id}"] input`)?.focus();
    },
  });

  const chips = document.createElement('div');
  chips.className = 'lobby__chips';

  const modeChip = createChip({
    label: t('lobby.mode'),
    value: '',
    onClick: () => openModeSheet(ctx, render),
  });
  const durationChip = createChip({
    label: t('lobby.duration'),
    value: '',
    onClick: () => openDurationSheet(ctx, render),
  });
  chips.append(modeChip, durationChip);

  const hint = document.createElement('p');
  hint.className = 'lobby__hint';
  hint.setAttribute('aria-live', 'polite');

  const start = createButton({
    label: t('lobby.start'),
    variant: 'primary',
    wobble: true,
    className: 'btn--block lobby__start',
    onClick: () => {
      const players = ctx.session.activePlayers();
      if (players.length < MIN_PLAYERS) {
        showToast(t('lobby.tooFewPlayers'), { variant: 'danger' });
        return;
      }
      vibrate('confirm');
      ctx.fsm.setPlayers(players.map((player) => player.id));
      ctx.fsm.send({ type: 'begin' });
    },
  });

  const footer = document.createElement('div');
  footer.className = 'lobby__footer';
  footer.append(chips, hint, start);

  el.append(header, list, addButton, footer);

  /* ------------------------------------------------------------------ */

  function createRow(player: Player, index: number, eliminated: boolean): HTMLLIElement {
    const row = document.createElement('li');
    row.className = 'lobby__row';
    row.dataset.player = player.id;
    if (eliminated) row.classList.add('is-eliminated');

    row.append(createPlayerBadge({ colorId: player.colorId, size: 'md', eliminated }));

    const field = document.createElement('div');
    field.className = 'lobby__field';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'lobby__name';
    input.value = player.name;
    input.maxLength = MAX_NAME_LENGTH;
    input.placeholder = t('lobby.namePlaceholder');
    input.setAttribute('aria-label', t('lobby.nameLabel', { index }));
    input.autocomplete = 'off';
    input.addEventListener('change', () => {
      const name = input.value.trim() || t('lobby.defaultName', { index });
      input.value = name;
      ctx.session.renamePlayer(player.id, name);
    });
    // Enter bestaetigt und gibt den Fokus frei (Tastatur auf dem Handy schliesst sich).
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') input.blur();
    });
    field.append(input);

    if (eliminated) {
      const tag = document.createElement('span');
      tag.className = 'lobby__tag';
      tag.textContent = t('lobby.eliminated');
      field.append(tag);
    }

    row.append(field);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'lobby__remove';
    remove.innerHTML = ICON_REMOVE;
    remove.setAttribute('aria-label', t('lobby.removePlayer', { name: player.name }));
    remove.addEventListener('click', () => {
      ctx.session.removePlayer(player.id);
      vibrate('tap');
      render();
    });
    row.append(remove);

    return row;
  }

  function render(): void {
    const session = ctx.session.state;
    const eliminated = eliminatedPlayerIds(session);

    list.replaceChildren();
    session.players.forEach((player, index) => {
      list.append(createRow(player, index + 1, eliminated.has(player.id)));
    });

    count.textContent = t('lobby.playerCount', {
      count: session.players.length,
      max: MAX_PLAYERS,
    });

    addButton.disabled = session.players.length >= MAX_PLAYERS;

    const modeValue = modeChip.querySelector('.chip__value');
    if (modeValue) modeValue.textContent = t(`mode.${session.settings.mode}`);
    modeChip.setAttribute('aria-label', `${t('lobby.mode')}: ${t(`mode.${session.settings.mode}`)}`);

    const durationValue = durationChip.querySelector('.chip__value');
    if (durationValue) {
      durationValue.textContent = t(`settings.durationOption.${session.settings.duration}`);
    }

    const canStart = ctx.session.canStart();
    start.disabled = !canStart;
    hint.textContent = canStart ? '' : t('lobby.tooFewPlayers');
  }

  render();

  return {
    el,
    activate() {
      // Beim ersten Besuch zwei Spieler anlegen, damit nie ein leerer Screen dasteht.
      ctx.session.ensureMinimumPlayers((index) => t('lobby.defaultName', { index }));
      render();
    },
  };
}
