/**
 * Toast — kurze Rueckmeldung, die nichts blockiert.
 * Genutzt fuer Validierung in der Lobby, PWA-Updates und Asset-Fehler (Roadmap M5.9).
 */

export type ToastVariant = 'info' | 'danger' | 'success';

export interface ToastOptions {
  variant?: ToastVariant;
  durationMs?: number;
  /** Optionaler Button, z. B. "Neu laden" beim PWA-Update. */
  action?: { label: string; onClick: () => void };
}

const DEFAULT_DURATION = 3200;
let host: HTMLElement | null = null;
let currentTimer: ReturnType<typeof setTimeout> | undefined;

function ensureHost(): HTMLElement {
  if (host?.isConnected) return host;
  host = document.createElement('div');
  host.className = 'toast-host';
  // aria-live, damit Screenreader die Meldung mitbekommen, ohne den Fokus zu verlieren.
  host.setAttribute('aria-live', 'polite');
  host.setAttribute('role', 'status');
  document.body.append(host);
  return host;
}

export function showToast(message: string, options: ToastOptions = {}): void {
  const container = ensureHost();
  container.replaceChildren();
  if (currentTimer !== undefined) clearTimeout(currentTimer);

  const toast = document.createElement('div');
  toast.className = `toast toast--${options.variant ?? 'info'}`;

  const text = document.createElement('span');
  text.className = 'toast__text';
  text.textContent = message;
  toast.append(text);

  if (options.action) {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'toast__action';
    action.textContent = options.action.label;
    action.addEventListener('click', () => {
      options.action?.onClick();
      dismiss(toast);
    });
    toast.append(action);
  }

  container.append(toast);
  toast.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], {
    duration: 180,
    easing: 'cubic-bezier(.34,1.56,.64,1)',
  });

  currentTimer = globalThis.setTimeout(() => dismiss(toast), options.durationMs ?? DEFAULT_DURATION);
}

function dismiss(toast: HTMLElement): void {
  if (!toast.isConnected) return;
  toast
    .animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(8px)' }], {
      duration: 160,
      fill: 'forwards',
    })
    .finished.finally(() => toast.remove());
}
