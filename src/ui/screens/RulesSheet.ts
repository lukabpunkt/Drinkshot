/**
 * Regeln-Sheet (GDD §6.7, Roadmap M1.9).
 * 4 Cards, horizontal wischbar, max. 30 Woerter pro Card.
 */

import { t } from '@/core/i18n';
import { openSheet, type SheetHandle } from '@/ui/components/sheet';

const CARD_COUNT = 4;

export function openRulesSheet(): SheetHandle {
  const content = document.createElement('div');
  content.className = 'rules';

  const track = document.createElement('div');
  track.className = 'rules__track';
  track.tabIndex = 0;
  track.setAttribute('role', 'group');

  const dots = document.createElement('div');
  dots.className = 'rules__dots';
  dots.setAttribute('aria-hidden', 'true');

  for (let index = 1; index <= CARD_COUNT; index++) {
    const card = document.createElement('article');
    card.className = 'rules__card';
    card.dataset.index = String(index);
    card.setAttribute('aria-label', t('rules.cardPosition', { index, count: CARD_COUNT }));

    const number = document.createElement('span');
    number.className = 'rules__number';
    number.textContent = String(index);

    const title = document.createElement('h3');
    title.className = 'rules__title';
    title.textContent = t(`rules.card${index}Title`);

    const body = document.createElement('p');
    body.className = 'rules__body';
    body.textContent = t(`rules.card${index}Body`);

    card.append(number, title, body);
    track.append(card);

    const dot = document.createElement('span');
    dot.className = 'rules__dot';
    if (index === 1) dot.classList.add('is-active');
    dots.append(dot);
  }

  // Aktiven Punkt anhand der Scroll-Position markieren.
  track.addEventListener('scroll', () => {
    const index = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    for (const [position, dot] of [...dots.children].entries()) {
      dot.classList.toggle('is-active', position === index);
    }
  });

  content.append(track, dots);

  return openSheet({ title: t('rules.headline'), content, className: 'sheet__panel--tall' });
}
