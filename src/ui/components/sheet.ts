/**
 * Bottom-Sheet (Art Direction §4.5).
 *
 * `bg.panel`, 28 px Radius oben, Drag-Handle, Slide-up 260 ms.
 * Schliesst per Tap auf das Backdrop, per Escape oder per Runterziehen.
 * Fokus bleibt waehrend der Anzeige im Sheet (A11y).
 */

import { t } from '@/core/i18n';
import { safeAnimate } from '@/ui/animate';

export interface SheetOptions {
  title: string;
  content: HTMLElement;
  onClose?: () => void;
  /** Zusaetzliche Klasse fuer den Panel-Container. */
  className?: string;
}

export interface SheetHandle {
  close: () => void;
  el: HTMLElement;
}

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function openSheet(options: SheetOptions): SheetHandle {
  const previousFocus = document.activeElement as HTMLElement | null;

  const root = document.createElement('div');
  root.className = 'sheet';

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet__backdrop';

  const panel = document.createElement('div');
  panel.className = 'sheet__panel';
  if (options.className) panel.classList.add(options.className);
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', options.title);

  const handle = document.createElement('div');
  handle.className = 'sheet__handle';
  handle.setAttribute('aria-hidden', 'true');

  const header = document.createElement('div');
  header.className = 'sheet__header';

  const heading = document.createElement('h2');
  heading.className = 'sheet__title';
  heading.textContent = options.title;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'sheet__close';
  closeButton.setAttribute('aria-label', t('common.close'));
  closeButton.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 18 18M18 6 6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>';

  header.append(heading, closeButton);

  const body = document.createElement('div');
  body.className = 'sheet__body';
  body.append(options.content);

  panel.append(handle, header, body);
  root.append(backdrop, panel);
  document.body.append(root);

  let closed = false;

  const close = (): void => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeyDown, true);
    /*
     * `safeAnimate` statt `.finished`: Im Hintergrund-Tab hält Chrome Animationen an und
     * das Versprechen löst nie auf — das Sheet bliebe für immer offen, der Fokus käme nie
     * zurück und `onClose` liefe nicht.
     */
    void safeAnimate(
      panel,
      [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }],
      { duration: 180, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' },
      { respectReducedMotion: false }
    ).then(() => {
      root.remove();
      previousFocus?.focus?.();
      options.onClose?.();
    });
    backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' });
  };

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    // Fokus-Falle: Tab laeuft im Sheet im Kreis.
    const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (item) => !item.hasAttribute('disabled')
    );
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  backdrop.addEventListener('click', close);
  closeButton.addEventListener('click', close);
  document.addEventListener('keydown', onKeyDown, true);

  /* --- Runterziehen zum Schliessen --- */
  let dragStartY: number | null = null;
  handle.addEventListener('pointerdown', (event) => {
    dragStartY = event.clientY;
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', (event) => {
    if (dragStartY === null) return;
    const delta = Math.max(0, event.clientY - dragStartY);
    panel.style.transform = `translateY(${delta}px)`;
  });
  const endDrag = (event: PointerEvent): void => {
    if (dragStartY === null) return;
    const delta = Math.max(0, event.clientY - dragStartY);
    dragStartY = null;
    panel.style.transform = '';
    if (delta > 90) close();
  };
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);

  panel.querySelector<HTMLElement>(FOCUSABLE)?.focus();

  return { close, el: panel };
}

/**
 * Ja/Nein-Dialog im Sheet-Look — genutzt fuer "Runde abbrechen?" (Roadmap M1.11).
 */
export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
}

export function confirmSheet(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    let answer = false;

    const content = document.createElement('div');
    content.className = 'confirm';

    if (options.body) {
      const text = document.createElement('p');
      text.className = 'confirm__body';
      text.textContent = options.body;
      content.append(text);
    }

    const actions = document.createElement('div');
    actions.className = 'confirm__actions';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn--secondary';
    cancel.textContent = options.cancelLabel;

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'btn btn--danger';
    confirm.textContent = options.confirmLabel;

    actions.append(cancel, confirm);
    content.append(actions);

    const sheet = openSheet({
      title: options.title,
      content,
      className: 'sheet__panel--compact',
      onClose: () => resolve(answer),
    });

    cancel.addEventListener('click', () => sheet.close());
    confirm.addEventListener('click', () => {
      answer = true;
      sheet.close();
    });
  });
}
