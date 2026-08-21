import { describe, expect, it } from 'vitest';
import {
  GRENZEN,
  anmeldungSchema,
  benutzerAendernSchema,
  benutzerAnlegenSchema,
  einstellungenSchema,
  monatParameterSchema,
  monatshinweisSchema,
  passwortAendernSchema,
  passwortZuruecksetzenSchema,
  pruefe,
  stichtagSchema,
  wunschSchema,
} from './validierung';

describe('pruefe', () => {
  it('gibt den geprueften Wert zurueck', () => {
    const ergebnis = pruefe(wunschSchema, { date: '2026-08-19', shiftType: 'Früh', comment: 'Kurs' });
    expect(ergebnis.art).toBe('gut');
    if (ergebnis.art === 'gut') expect(ergebnis.wert.comment).toBe('Kurs');
  });

  it('nennt das beanstandete Feld in der Meldung', () => {
    const ergebnis = pruefe(wunschSchema, { date: 'morgen', shiftType: 'Früh' });
    expect(ergebnis.art).toBe('fehler');
    if (ergebnis.art === 'fehler') expect(ergebnis.fehler).toContain('date');
  });

  it('weist einen Koerper ab, der gar kein Objekt ist', () => {
    for (const eingabe of [undefined, null, 'text', 42, []]) {
      expect(pruefe(wunschSchema, eingabe).art).toBe('fehler');
    }
  });
});

describe('Wunsch', () => {
  it('nimmt die vier Schichtarten an', () => {
    for (const shiftType of ['Früh', 'Spät', 'Nacht', 'Frei']) {
      expect(pruefe(wunschSchema, { date: '2026-01-01', shiftType }).art).toBe('gut');
    }
  });

  it('weist eine erfundene Schichtart ab', () => {
    expect(pruefe(wunschSchema, { date: '2026-01-01', shiftType: 'Zwischendienst' }).art).toBe('fehler');
  });

  it('ergaenzt einen fehlenden Kommentar zu einer leeren Zeichenkette', () => {
    const ergebnis = pruefe(wunschSchema, { date: '2026-01-01', shiftType: 'Frei' });
    expect(ergebnis.art === 'gut' && ergebnis.wert.comment).toBe('');
  });

  it('begrenzt die Laenge des Kommentars', () => {
    const zuLang = { date: '2026-01-01', shiftType: 'Frei', comment: 'x'.repeat(GRENZEN.wunschKommentar + 1) };
    expect(pruefe(wunschSchema, zuLang).art).toBe('fehler');
    const gerade = { ...zuLang, comment: 'x'.repeat(GRENZEN.wunschKommentar) };
    expect(pruefe(wunschSchema, gerade).art).toBe('gut');
  });

  it('uebernimmt keine unbekannten Felder', () => {
    // Sonst landete eine fremde userId in der Datenbank, obwohl der Server
    // sie aus der Sitzung nimmt.
    const ergebnis = pruefe(wunschSchema, {
      date: '2026-01-01',
      shiftType: 'Frei',
      userId: 'fremd',
      id: 'selbst-vergeben',
    });
    expect(ergebnis.art).toBe('fehler');
    if (ergebnis.art === 'fehler') expect(ergebnis.fehler).toContain('userId');
  });

  it('verlangt einen wirklichen Kalendertag', () => {
    const gut = ['2026-01-01', '2026-12-31', '2024-02-29'];
    const schlecht = ['2026-02-30', '2026-13-01', '2026-00-10', '2026-1-1', '2025-02-29', '2026-01-32', '20260101'];
    for (const date of gut) expect(pruefe(wunschSchema, { date, shiftType: 'Frei' }).art, date).toBe('gut');
    for (const date of schlecht) expect(pruefe(wunschSchema, { date, shiftType: 'Frei' }).art, date).toBe('fehler');
  });
});

describe('Monatshinweis', () => {
  it('verlangt einen Monat im Format YYYY-MM', () => {
    expect(pruefe(monatshinweisSchema, { month: '2026-08', text: 'Urlaub' }).art).toBe('gut');
    for (const month of ['2026-13', '2026-00', '2026-8', 'August', '2026-08-01']) {
      expect(pruefe(monatshinweisSchema, { month, text: '' }).art, month).toBe('fehler');
    }
  });

  it('begrenzt die Laenge des Hinweises', () => {
    const zuLang = { month: '2026-08', text: 'x'.repeat(GRENZEN.monatshinweis + 1) };
    expect(pruefe(monatshinweisSchema, zuLang).art).toBe('fehler');
  });

  it('ergaenzt fehlenden Text zu einer leeren Zeichenkette', () => {
    const ergebnis = pruefe(monatshinweisSchema, { month: '2026-08' });
    expect(ergebnis.art === 'gut' && ergebnis.wert.text).toBe('');
  });
});

describe('Anmeldung', () => {
  it('nimmt Name und Passwort an', () => {
    expect(pruefe(anmeldungSchema, { name: 'Anna', password: 'geheim123' }).art).toBe('gut');
  });

  it('weist fehlende oder falsch getypte Angaben ab', () => {
    expect(pruefe(anmeldungSchema, { name: 'Anna' }).art).toBe('fehler');
    expect(pruefe(anmeldungSchema, { name: { $ne: null }, password: 'x' }).art).toBe('fehler');
    expect(pruefe(anmeldungSchema, { name: 'Anna', password: 'x'.repeat(GRENZEN.passwort + 1) }).art).toBe('fehler');
  });
});

describe('Benutzer', () => {
  it('setzt eine fehlende Rolle auf Employee', () => {
    const ergebnis = pruefe(benutzerAnlegenSchema, { name: 'Anna', password: 'geheim123' });
    expect(ergebnis.art === 'gut' && ergebnis.wert.role).toBe('Employee');
  });

  it('weist eine erfundene Rolle ab, statt sie stillschweigend zu Employee zu machen', () => {
    expect(pruefe(benutzerAnlegenSchema, { name: 'Anna', role: 'Chefarzt', password: 'geheim123' }).art).toBe('fehler');
  });

  it('verlangt einen Namen mit Inhalt und begrenzt seine Laenge', () => {
    expect(pruefe(benutzerAnlegenSchema, { name: '   ', password: 'geheim123' }).art).toBe('fehler');
    expect(pruefe(benutzerAnlegenSchema, { name: 'x'.repeat(GRENZEN.name + 1), password: 'geheim123' }).art).toBe('fehler');
  });

  it('kuerzt umschliessende Leerzeichen im Namen', () => {
    const ergebnis = pruefe(benutzerAnlegenSchema, { name: '  Anna  ', password: 'geheim123' });
    expect(ergebnis.art === 'gut' && ergebnis.wert.name).toBe('Anna');
  });

  it('laesst beim Aendern einzelne Felder zu, aber kein Passwort', () => {
    expect(pruefe(benutzerAendernSchema, { name: 'Anna' }).art).toBe('gut');
    expect(pruefe(benutzerAendernSchema, { role: 'Manager' }).art).toBe('gut');
    // Das Feld umging frueher die Pruefung des alten Passworts.
    expect(pruefe(benutzerAendernSchema, { name: 'Anna', password: 'neu' }).art).toBe('fehler');
  });

  it('verlangt beim Passwortwechsel altes und neues Passwort', () => {
    expect(pruefe(passwortAendernSchema, { oldPassword: 'alt12345', newPassword: 'neu12345' }).art).toBe('gut');
    expect(pruefe(passwortAendernSchema, { newPassword: 'neu12345' }).art).toBe('fehler');
    expect(pruefe(passwortZuruecksetzenSchema, { newPassword: 'neu12345' }).art).toBe('gut');
    expect(pruefe(passwortZuruecksetzenSchema, {}).art).toBe('fehler');
  });
});

describe('Einstellungen', () => {
  it('nimmt nur ganze Tage von 1 bis 31 an', () => {
    expect(pruefe(einstellungenSchema, { vorlaufTage: 56 }).art).toBe('gut');
    expect(pruefe(einstellungenSchema, { vorlaufTage: 0 }).art).toBe('gut');
    for (const tage of [-1, 366, 1.5, '56', null]) {
      expect(pruefe(einstellungenSchema, { vorlaufTage: tage }).art, String(tage)).toBe('fehler');
    }
  });

  it('nimmt als Stichtag nur einen echten Kalendertag an', () => {
    expect(pruefe(stichtagSchema, { datum: '2026-08-28' }).art).toBe('gut');
    for (const wert of ['2026-02-30', '2026-8-28', '28.08.2026', '', 20260828, null]) {
      expect(pruefe(stichtagSchema, { datum: wert }).art, String(wert)).toBe('fehler');
    }
  });

  it('weist einen unbrauchbaren Monat im Pfad ab', () => {
    expect(pruefe(monatParameterSchema, '2026-11').art).toBe('gut');
    for (const wert of ['2026-13', '2026-1', '2026', 'Unsinn', null]) {
      expect(pruefe(monatParameterSchema, wert).art, String(wert)).toBe('fehler');
    }
  });
});
