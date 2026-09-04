/**
 * Einstellungen (GDD §6.6, Roadmap M1.9).
 *
 * Ton, Musik, Haptik, Dauer, Modus, Wunder, reduzierte Effekte, Sprache, Session-Reset.
 * Jede Aenderung wird sofort persistiert (SessionStore schreibt in localStorage).
 */

import {
  DURATION_MS,
  DURATION_PRESETS,
  GAME_MODES,
  type DurationPreset,
  type GameMode,
  type Locale,
} from '@/config/rules';
import { setAudioEnabled } from '@/audio/AudioManager';
import { LOCALES, setLocale, t } from '@/core/i18n';
import { createButton } from '@/ui/components/button';
import { openSheet, type SheetHandle } from '@/ui/components/sheet';
import { resetCoachmarks } from '@/ui/components/coachmark';
import { showToast } from '@/ui/components/toast';
import { setHapticsEnabled } from '@/ui/haptics';
import type { ScreenContext } from '@/ui/router';

function createRow(label: string, control: HTMLElement): HTMLElement {
  const row = document.createElement('div');
  row.className = 'settings__row';

  const text = document.createElement('span');
  text.className = 'settings__label';
  text.textContent = label;

  row.append(text, control);
  return row;
}

function createSwitch(checked: boolean, label: string, onChange: (value: boolean) => void): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'switch';
  button.setAttribute('role', 'switch');
  button.setAttribute('aria-label', label);

  const knob = document.createElement('span');
  knob.className = 'switch__knob';
  button.append(knob);

  const render = (value: boolean): void => {
    button.setAttribute('aria-checked', String(value));
    button.classList.toggle('is-on', value);
  };

  let value = checked;
  render(value);

  button.addEventListener('click', () => {
    value = !value;
    render(value);
    onChange(value);
  });

  return button;
}

function createSegmented<T extends string>(
  values: readonly T[],
  active: T,
  labelOf: (value: T) => string,
  onChange: (value: T) => void
): HTMLElement {
  const group = document.createElement('div');
  group.className = 'segmented';
  group.setAttribute('role', 'radiogroup');

  const buttons = new Map<T, HTMLButtonElement>();
  let current = active;

  const render = (): void => {
    for (const [value, button] of buttons) {
      const isActive = value === current;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-checked', String(isActive));
    }
  };

  for (const value of values) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'segmented__option';
    button.setAttribute('role', 'radio');
    button.textContent = labelOf(value);
    button.addEventListener('click', () => {
      current = value;
      render();
      onChange(value);
    });
    buttons.set(value, button);
    group.append(button);
  }

  render();
  return group;
}

function createSlider(value: number, label: string, onChange: (value: number) => void): HTMLElement {
  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'slider';
  input.min = '0';
  input.max = '100';
  input.step = '5';
  input.value = String(Math.round(value * 100));
  input.setAttribute('aria-label', label);
  input.addEventListener('input', () => onChange(Number(input.value) / 100));
  return input;
}

export function openSettingsSheet(ctx: ScreenContext): SheetHandle {
  const settings = ctx.session.state.settings;

  const content = document.createElement('div');
  content.className = 'settings';

  content.append(
    createRow(
      t('settings.sound'),
      createSwitch(settings.sound, t('settings.sound'), (value) => {
        setAudioEnabled(value);
        ctx.session.setSettings({ sound: value });
      })
    ),
    createRow(
      t('settings.music'),
      createSlider(settings.music, t('settings.music'), (value) =>
        ctx.session.setSettings({ music: value })
      )
    ),
    createRow(
      t('settings.haptics'),
      createSwitch(settings.haptics, t('settings.haptics'), (value) => {
        setHapticsEnabled(value);
        ctx.session.setSettings({ haptics: value });
      })
    ),
    createRow(
      t('settings.duration'),
      createSegmented<DurationPreset>(
        DURATION_PRESETS,
        settings.duration,
        (preset) => t(`settings.durationOption.${preset}`),
        (preset) => {
          ctx.session.setSettings({ duration: preset });
          ctx.fsm.setDuration(preset);
        }
      )
    ),
    createRow(
      t('settings.miracles'),
      createSwitch(settings.miracles, t('settings.miracles'), (value) =>
        ctx.session.setSettings({ miracles: value })
      )
    ),
    createRow(
      t('settings.lowEffects'),
      createSwitch(settings.lowEffects, t('settings.lowEffects'), (value) =>
        ctx.session.setSettings({ lowEffects: value })
      )
    ),
    createRow(
      t('settings.language'),
      createSegmented<Locale>(
        LOCALES,
        settings.locale,
        (locale) => locale.toUpperCase(),
        (locale) => {
          ctx.session.setSettings({ locale });
          setLocale(locale);
          handle.close();
          void ctx.router.refresh();
        }
      )
    )
  );

  const modeSection = document.createElement('div');
  modeSection.className = 'settings__section';

  const modeTitle = document.createElement('h3');
  modeTitle.className = 'settings__sectionTitle';
  modeTitle.textContent = t('settings.mode');
  modeSection.append(modeTitle, createModePicker(ctx));
  content.append(modeSection);

  const reset = createButton({
    label: t('settings.resetSession'),
    variant: 'danger',
    className: 'btn--block settings__reset',
    onClick: () => {
      ctx.session.reset();
      // Wer die Session zurücksetzt, will von vorne anfangen — inklusive der Hinweise.
      resetCoachmarks();
      showToast(t('settings.resetDone'), { variant: 'success' });
      handle.close();
      void ctx.router.refresh();
    },
  });
  content.append(reset);

  const handle = openSheet({
    title: t('settings.headline'),
    content,
    className: 'sheet__panel--tall',
  });
  return handle;
}

/**
 * Modus-Auswahl mit Ein-Satz-Erklaerung (GDD §3.6).
 * Wird auch direkt vom Result-Screen geoeffnet ("Modus ändern").
 */
export function createModePicker(ctx: ScreenContext): HTMLElement {
  const list = document.createElement('div');
  list.className = 'modes';
  list.setAttribute('role', 'radiogroup');
  list.setAttribute('aria-label', t('settings.mode'));

  const buttons = new Map<GameMode, HTMLButtonElement>();

  const render = (): void => {
    const active = ctx.session.state.settings.mode;
    for (const [mode, button] of buttons) {
      const isActive = mode === active;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-checked', String(isActive));
    }
  };

  for (const mode of GAME_MODES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'modes__option';
    button.setAttribute('role', 'radio');

    const name = document.createElement('span');
    name.className = 'modes__name';
    name.textContent = t(`mode.${mode}`);

    const hint = document.createElement('span');
    hint.className = 'modes__hint';
    hint.textContent = t(`mode.${mode}Hint`);

    button.append(name, hint);
    button.addEventListener('click', () => {
      ctx.session.setSettings({ mode });
      ctx.fsm.setMode(mode);
      render();
    });

    buttons.set(mode, button);
    list.append(button);
  }

  render();
  return list;
}

/** Nur der Modus, als eigenes Sheet — Button "Modus ändern" auf dem Result-Screen. */
export function openModeSheet(ctx: ScreenContext, onChange?: () => void): SheetHandle {
  return openSheet({
    title: t('settings.mode'),
    content: createModePicker(ctx),
    className: 'sheet__panel--compact',
    ...(onChange ? { onClose: onChange } : {}),
  });
}

/** Dauer-Auswahl als eigenes Sheet — Chip in der Lobby. */
export function openDurationSheet(ctx: ScreenContext, onChange?: () => void): SheetHandle {
  const content = createSegmented<DurationPreset>(
    DURATION_PRESETS,
    ctx.session.state.settings.duration,
    (preset) =>
      `${t(`settings.durationOption.${preset}`)} · ${t('settings.durationSeconds', {
        seconds: Math.round(DURATION_MS[preset] / 1000),
      })}`,
    (preset) => {
      ctx.session.setSettings({ duration: preset });
      ctx.fsm.setDuration(preset);
      onChange?.();
    }
  );
  content.classList.add('segmented--stacked');

  return openSheet({
    title: t('settings.duration'),
    content,
    className: 'sheet__panel--compact',
  });
}
