import { describe, expect, test } from 'vitest';
import { pruefeStichtag, stichtagErklaerung } from './einstellungen';

describe('pruefeStichtag', () => {
  test('nimmt einen Tag im gueltigen Bereich an', () => {
    expect(pruefeStichtag('15')).toEqual({ art: 'gut', wert: 15 });
  });

  test('nimmt die Raender an', () => {
    expect(pruefeStichtag('1')).toEqual({ art: 'gut', wert: 1 });
    expect(pruefeStichtag('31')).toEqual({ art: 'gut', wert: 31 });
  });

  test('uebergeht Leerzeichen um die Zahl', () => {
    expect(pruefeStichtag('  20  ')).toEqual({ art: 'gut', wert: 20 });
  });

  test('lehnt eine leere Eingabe ab', () => {
    expect(pruefeStichtag('   ').art).toBe('fehler');
  });

  test('lehnt Werte ausserhalb von 1 bis 31 ab', () => {
    expect(pruefeStichtag('0').art).toBe('fehler');
    expect(pruefeStichtag('32').art).toBe('fehler');
    expect(pruefeStichtag('-5').art).toBe('fehler');
  });

  test('lehnt ab, was keine ganze Zahl ist', () => {
    expect(pruefeStichtag('15,5').art).toBe('fehler');
    expect(pruefeStichtag('15.5').art).toBe('fehler');
    expect(pruefeStichtag('fuenfzehn').art).toBe('fehler');
    expect(pruefeStichtag('15x').art).toBe('fehler');
  });

  test('nennt im Fehlerfall den erlaubten Bereich', () => {
    const ergebnis = pruefeStichtag('99');
    // Eine Meldung, die den Bereich verschweigt, laesst die Leitung raten.
    expect(ergebnis.art === 'fehler' && ergebnis.meldung).toContain('1 und 31');
  });
});

describe('stichtagErklaerung', () => {
  test('sagt, was der Stichtag bewirkt', () => {
    expect(stichtagErklaerung(15)).toBe(
      'Ab dem 15. eines Monats können Mitarbeitende den Folgemonat nicht mehr ändern.',
    );
  });

  test('erklaert bei Tagen jenseits des kuerzesten Monats den Ersatztag', () => {
    // Sonst wirkt ein Stichtag 31 im Februar wie ein Fehler.
    expect(stichtagErklaerung(31)).toBe(
      'Ab dem 31. eines Monats können Mitarbeitende den Folgemonat nicht mehr ändern.'
        + ' In Monaten ohne diesen Tag gilt der letzte Tag des Monats.',
    );
  });

  test('haengt den Zusatz nicht an, wenn es den Tag in jedem Monat gibt', () => {
    expect(stichtagErklaerung(28)).not.toContain('letzte Tag');
  });
});
