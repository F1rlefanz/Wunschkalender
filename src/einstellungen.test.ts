import { describe, expect, test } from 'vitest';
import {
  ersterOffenerMonat,
  langesDatum,
  monatsname,
  pruefeVorlauf,
  vorlaufErklaerung,
} from './einstellungen';

const berlinerZeit = (text: string) => new Date(text);

describe('pruefeVorlauf', () => {
  test('nimmt eine Zahl im gueltigen Bereich an', () => {
    expect(pruefeVorlauf('56')).toEqual({ art: 'gut', wert: 56 });
  });

  test('nimmt die Raender an', () => {
    expect(pruefeVorlauf('0')).toEqual({ art: 'gut', wert: 0 });
    expect(pruefeVorlauf('365')).toEqual({ art: 'gut', wert: 365 });
  });

  test('uebergeht Leerzeichen um die Zahl', () => {
    expect(pruefeVorlauf('  42  ')).toEqual({ art: 'gut', wert: 42 });
  });

  test('lehnt eine leere Eingabe ab', () => {
    expect(pruefeVorlauf('   ').art).toBe('fehler');
  });

  test('lehnt Werte ausserhalb von 0 bis 365 ab', () => {
    expect(pruefeVorlauf('366').art).toBe('fehler');
    expect(pruefeVorlauf('-5').art).toBe('fehler');
  });

  test('lehnt ab, was keine ganze Zahl ist', () => {
    expect(pruefeVorlauf('56,5').art).toBe('fehler');
    expect(pruefeVorlauf('56.5').art).toBe('fehler');
    expect(pruefeVorlauf('acht Wochen').art).toBe('fehler');
    expect(pruefeVorlauf('56x').art).toBe('fehler');
  });

  test('nennt im Fehlerfall den erlaubten Bereich', () => {
    const ergebnis = pruefeVorlauf('999');
    expect(ergebnis.art === 'fehler' && ergebnis.meldung).toContain('0 und 365');
  });
});

describe('ersterOffenerMonat', () => {
  const jetzt = berlinerZeit('2026-08-21T12:00:00+02:00');

  test('ist bei acht Wochen Vorlauf der November', () => {
    // Oktober schloss am 06.08., November schliesst erst am 06.09.
    expect(ersterOffenerMonat(56, {}, jetzt)).toBe('2026-11');
  });

  test('rueckt bei kurzem Vorlauf naeher heran', () => {
    expect(ersterOffenerMonat(14, {}, jetzt)).toBe('2026-10');
    expect(ersterOffenerMonat(0, {}, jetzt)).toBe('2026-09');
  });

  test('uebergeht Monate mit eigenem Stichtag — dort gilt die Automatik nicht', () => {
    expect(ersterOffenerMonat(56, { '2026-11': '2026-08-28' }, jetzt)).toBe('2026-12');
  });

  test('rueckt bei langem Vorlauf weiter weg', () => {
    expect(ersterOffenerMonat(200, {}, jetzt)).toBe('2027-04');
  });

  test('rechnet ueber den Jahreswechsel', () => {
    expect(ersterOffenerMonat(56, {}, berlinerZeit('2026-11-20T12:00:00+01:00'))).toBe('2027-02');
  });
});

describe('vorlaufErklaerung', () => {
  const jetzt = berlinerZeit('2026-08-21T12:00:00+02:00');

  test('nennt die Wirkung an einem echten Monat, nicht abstrakt', () => {
    expect(vorlaufErklaerung(56, {}, jetzt)).toBe(
      'Ein Monat schließt 56 Tage vor seinem Beginn. November 2026 ist damit bis zum 06.09.2026 offen.',
    );
  });

  test('folgt dem geaenderten Vorlauf', () => {
    expect(vorlaufErklaerung(14, {}, jetzt)).toContain('Oktober 2026');
  });
});

describe('Datums- und Monatsnamen', () => {
  test('schreibt den Monat aus', () => {
    expect(monatsname('2026-11')).toBe('November 2026');
  });

  test('dreht ein Datum in die hier uebliche Schreibweise', () => {
    expect(langesDatum('2026-09-06')).toBe('06.09.2026');
  });
});
