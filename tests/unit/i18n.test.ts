/**
 * i18n-Tests (CLAUDE.md: kein hardcodierter UI-String, DE/EN vollstaendig).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { detectLocale, flatKeys, getLocale, plural, setLocale, t } from '@/core/i18n';

afterEach(() => setLocale('de'));

describe('Wörterbücher', () => {
  it('DE und EN haben identische Keys', () => {
    const de = flatKeys('de');
    const en = flatKeys('en');
    expect(en.filter((key) => !de.includes(key))).toEqual([]);
    expect(de.filter((key) => !en.includes(key))).toEqual([]);
  });

  it('enthält keine leeren Strings', () => {
    for (const locale of ['de', 'en'] as const) {
      setLocale(locale);
      for (const key of flatKeys(locale)) {
        expect(t(key).trim(), `${locale}:${key}`).not.toBe('');
      }
    }
  });
});

describe('t()', () => {
  it('löst verschachtelte Keys auf', () => {
    setLocale('de');
    expect(t('title.play')).toBe('Spielen');
    setLocale('en');
    expect(t('title.play')).toBe('Play');
  });

  it('interpoliert Parameter', () => {
    setLocale('de');
    expect(t('result.drinks', { name: 'Rudi', sips: 5 })).toBe('Rudi trinkt 5!');
  });

  it('lässt unbekannte Platzhalter stehen', () => {
    setLocale('de');
    expect(t('result.drinks', { name: 'Rudi' })).toBe('Rudi trinkt {sips}!');
  });

  it('gibt Templates ohne Parameter unverändert zurück', () => {
    expect(t('title.rules')).toBe('Regeln');
  });

  it('markiert fehlende Keys mit [missing:…]', () => {
    expect(t('gibt.es.nicht')).toBe('[missing:gibt.es.nicht]');
    expect(t('title')).toBe('[missing:title]');
    expect(t('title.play.zu.tief')).toBe('[missing:title.play.zu.tief]');
  });

  it('fällt bei fehlendem EN-Key auf DE zurück', () => {
    setLocale('en');
    expect(t('app.name')).toBe('Drinkshot');
  });
});

describe('plural()', () => {
  it('wählt Singular und Plural', () => {
    setLocale('de');
    expect(plural('common.sips', 1)).toBe('Schluck');
    expect(plural('common.sips', 3)).toBe('Schlücke');
    expect(plural('common.sips', 0)).toBe('Schlücke');
    expect(plural('common.sips', -1)).toBe('Schluck');
  });
});

describe('Locale-Handling', () => {
  it('setLocale/getLocale und document.lang', () => {
    setLocale('en');
    expect(getLocale()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('detectLocale erkennt DE/EN, sonst DE', () => {
    expect(detectLocale('de-DE')).toBe('de');
    expect(detectLocale('en-GB')).toBe('en');
    expect(detectLocale('fr-FR')).toBe('de');
    expect(detectLocale()).toMatch(/^(de|en)$/);
  });
});
