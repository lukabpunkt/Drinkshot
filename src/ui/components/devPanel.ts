/**
 * Dev-Panel (`?dev=1`, Architektur §9).
 *
 * Bewusst ein eigenes Mini-Panel statt lil-gui: keine zusätzliche Abhängigkeit im Bundle,
 * und es wird nur geladen, wenn `?dev=1` in der URL steht.
 *
 * M2: FPS/Frame-Time-Overlay, Spieleranzahl, Speed, Low-Effects-Toggle.
 * TODO(M3): Seed-Eingabe + "Play Show", Slow-Mo-Faktor, Filter-Toggle.
 * TODO(M4): Death-Preview-Dropdown.
 */

import { frameMedian, type ArenaAppHandle } from '@/game/ArenaApp';
import { MAX_PLAYERS, MIN_PLAYERS } from '@/config/rules';

export interface DevPanelOptions {
  host: HTMLElement;
  app: ArenaAppHandle;
  initialCount: number;
  lowEffects: boolean;
  onCountChange: (count: number) => void;
  onSpeedChange: (multiplier: number) => void;
  onLowEffectsChange: (value: boolean) => void;
}

export interface DevPanel {
  setLowEffects(value: boolean): void;
  destroy(): void;
}

/** Wie oft die Frame-Statistik aktualisiert wird. */
const REFRESH_MS = 500;

export function createDevPanel(options: DevPanelOptions): DevPanel {
  const el = document.createElement('div');
  el.className = 'dev';

  const stats = document.createElement('pre');
  stats.className = 'dev__stats';

  const controls = document.createElement('div');
  controls.className = 'dev__controls';

  const count = createSlider('Shotlings', MIN_PLAYERS, MAX_PLAYERS, 1, options.initialCount, (value) => {
    options.onCountChange(value);
  });

  const speed = createSlider('Speed ×', 0, 20, 1, 10, (value) => {
    options.onSpeedChange(value / 10);
  });

  const low = document.createElement('label');
  low.className = 'dev__row';
  const lowInput = document.createElement('input');
  lowInput.type = 'checkbox';
  lowInput.checked = options.lowEffects;
  lowInput.addEventListener('change', () => options.onLowEffectsChange(lowInput.checked));
  const lowText = document.createElement('span');
  lowText.textContent = 'Low-Effects';
  low.append(lowInput, lowText);

  controls.append(count.el, speed.el, low);
  el.append(stats, controls);
  options.host.append(el);

  const timer = globalThis.setInterval(() => {
    const times = options.app.frameTimes();
    if (times.length === 0) return;
    const median = frameMedian(times);
    const sorted = [...times].sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
    const draws = options.app.drawCalls();
    stats.textContent =
      `fps  ${(1000 / Math.max(median, 0.001)).toFixed(0).padStart(3)}\n` +
      `p50  ${median.toFixed(1).padStart(5)} ms\n` +
      `p95  ${p95.toFixed(1).padStart(5)} ms\n` +
      `draw ${String(draws).padStart(5)}\n` +
      `mode ${lowInput.checked ? 'LOW' : 'FULL'}`;
  }, REFRESH_MS);

  return {
    setLowEffects(value) {
      lowInput.checked = value;
    },
    destroy() {
      clearInterval(timer);
      el.remove();
    },
  };
}

function createSlider(
  label: string,
  min: number,
  max: number,
  step: number,
  value: number,
  onChange: (value: number) => void
): { el: HTMLElement } {
  const row = document.createElement('label');
  row.className = 'dev__row';

  const text = document.createElement('span');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);

  const render = (): void => {
    text.textContent = `${label} ${input.value}`;
  };
  render();

  input.addEventListener('input', () => {
    render();
    onChange(Number(input.value));
  });

  row.append(text, input);
  return { el: row };
}
