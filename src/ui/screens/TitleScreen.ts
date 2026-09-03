/**
 * Title-Screen (GDD §6.0, Roadmap M1.3).
 *
 * Logo mit Wobble, drei Buttons, Sound-Toggle. Der erste Tap auf "Spielen" entsperrt
 * den AudioContext (iOS-Pflicht). Beim allerersten Start erscheint einmalig der
 * 18+-Hinweis; das Flag liegt in localStorage.
 *
 * TODO(M5): laufendes Maennchen im Loop, das erschossen wird (echte Arena-Mini-Instanz).
 */

import { STORAGE_KEY_DISCLAIMER } from '@/config/rules';
import { unlockAudio } from '@/audio/AudioManager';
import { t } from '@/core/i18n';
import { createButton, setButtonLabel } from '@/ui/components/button';
import { openSheet } from '@/ui/components/sheet';
import { vibrate } from '@/ui/haptics';
import type { ScreenContext, ScreenInstance } from '@/ui/router';
import { openRulesSheet } from './RulesSheet';
import { openSettingsSheet } from './SettingsSheet';

const ICON_SOUND_ON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 8.5a5 5 0 0 1 0 7"/></svg>';
const ICON_SOUND_OFF =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="m17 9.5 4 5M21 9.5l-4 5"/></svg>';

function hasSeenDisclaimer(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY_DISCLAIMER) === '1';
  } catch {
    return false;
  }
}

function markDisclaimerSeen(): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY_DISCLAIMER, '1');
  } catch {
    // Privater Modus: der Hinweis erscheint dann eben jedes Mal.
  }
}

function showDisclaimer(): void {
  const content = document.createElement('div');
  content.className = 'disclaimer';

  const body = document.createElement('p');
  body.className = 'disclaimer__body';
  body.textContent = t('disclaimer.body');

  const accept = createButton({
    label: t('disclaimer.accept'),
    variant: 'primary',
    className: 'btn--block',
  });

  content.append(body, accept);

  const sheet = openSheet({
    title: t('disclaimer.headline'),
    content,
    className: 'sheet__panel--compact',
    onClose: markDisclaimerSeen,
  });

  accept.addEventListener('click', () => sheet.close());
}

export function createTitleScreen(ctx: ScreenContext): ScreenInstance {
  const el = document.createElement('section');
  el.className = 'screen screen--title';

  const logo = document.createElement('h1');
  logo.className = 'title__logo';
  logo.textContent = t('app.name').toUpperCase();

  const tagline = document.createElement('p');
  tagline.className = 'title__tagline';
  tagline.textContent = t('app.tagline');

  const actions = document.createElement('div');
  actions.className = 'title__actions';

  const play = createButton({
    label: t('title.play'),
    variant: 'primary',
    wobble: true,
    className: 'btn--block',
    onClick: () => {
      // Erster Tap entsperrt Audio — muss synchron im Event passieren (iOS).
      unlockAudio();
      vibrate('tap');
      ctx.fsm.send({ type: 'start' });
    },
  });

  const rules = createButton({
    label: t('title.rules'),
    variant: 'secondary',
    className: 'btn--block',
    onClick: () => openRulesSheet(),
  });

  const settings = createButton({
    label: t('title.settings'),
    variant: 'ghost',
    className: 'btn--block',
    onClick: () => openSettingsSheet(ctx),
  });

  actions.append(play, rules, settings);

  /* --- Sound-Toggle: prominent, weil Mobile-Autoplay-Policy (GDD §6.0) --- */
  const soundToggle = createButton({
    label: '',
    variant: 'ghost',
    className: 'title__sound',
    icon: ICON_SOUND_ON,
  });

  const renderSound = (): void => {
    const on = ctx.session.state.settings.sound;
    const label = on ? t('title.soundOn') : t('title.soundOff');
    setButtonLabel(soundToggle, label);
    soundToggle.setAttribute('aria-label', label);
    soundToggle.setAttribute('aria-pressed', String(on));
    const icon = soundToggle.querySelector('.btn__icon');
    if (icon) icon.innerHTML = on ? ICON_SOUND_ON : ICON_SOUND_OFF;
  };

  soundToggle.addEventListener('click', () => {
    unlockAudio();
    ctx.session.setSettings({ sound: !ctx.session.state.settings.sound });
    renderSound();
  });

  renderSound();

  const version = document.createElement('p');
  version.className = 'title__version';
  version.textContent = `v${__APP_VERSION__}`;

  el.append(logo, tagline, actions, soundToggle, version);

  return {
    el,
    activate() {
      if (!hasSeenDisclaimer()) showDisclaimer();
      else play.focus({ preventScroll: true });
    },
  };
}
