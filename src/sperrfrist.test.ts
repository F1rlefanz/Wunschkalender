import { describe, expect, test } from 'vitest';
import {
  VORGABE_VORLAUF_TAGE,
  istMonatGesperrt,
  sperrfristFuerMonat,
  stichtagSatz,
} from './sperrfrist';

/** Ein Zeitpunkt in Berliner Ortszeit, als UTC-Instant. */
const berlinerZeit = (text: string) => new Date(text);

const frist = (
  monat: string,
  jetzt: Date,
  zusatz: { vorlaufTage?: number; stichtage?: Record<string, string> } = {},
) => sperrfristFuerMonat({ monat, rolle: 'Employee', jetzt, ...zusatz });

const gesperrt = (
  monat: string,
  jetzt: Date,
  zusatz: { vorlaufTage?: number; stichtage?: Record<string, string> } = {},
) => frist(monat, jetzt, zusatz).gesperrt;

describe('Automatischer Vorschlag', () => {
  // Der Vorlauf zaehlt vom ersten Tag des Monats zurueck: Der November beginnt
  // am 01.11., 56 Tage davor ist der 06.09.
  test('rechnet den Stichtag als Monatsanfang minus Vorlauf', () => {
    const jetzt = berlinerZeit('2026-08-21T12:00:00+02:00');
    expect(frist('2026-11', jetzt)).toMatchObject({
      stichtag: '2026-09-06',
      herkunft: 'automatisch',
      gesperrt: false,
    });
  });

  test('haelt den Monat bis einschliesslich zum Stichtag offen', () => {
    // "Wuensche eintragen bis 06.09." — der 06.09. zaehlt noch mit.
    expect(gesperrt('2026-11', berlinerZeit('2026-09-06T23:59:00+02:00'))).toBe(false);
    expect(gesperrt('2026-11', berlinerZeit('2026-09-07T00:00:00+02:00'))).toBe(true);
  });

  test('sperrt den laufenden Monat und alles davor von selbst', () => {
    // Kein Sonderfall mehr, sondern Folge der Regel: Der Stichtag des laufenden
    // Monats liegt immer Wochen in der Vergangenheit.
    const jetzt = berlinerZeit('2026-08-21T12:00:00+02:00');
    expect(gesperrt('2026-08', jetzt)).toBe(true);
    expect(gesperrt('2026-07', jetzt)).toBe(true);
    expect(gesperrt('2026-09', jetzt)).toBe(true);
    expect(gesperrt('2026-10', jetzt)).toBe(true);
  });

  test('richtet sich nach dem eingestellten Vorlauf', () => {
    const jetzt = berlinerZeit('2026-08-21T12:00:00+02:00');
    // Kuerzerer Vorlauf: Der Oktober waere dann noch offen (01.10. minus 14).
    expect(frist('2026-10', jetzt, { vorlaufTage: 14 })).toMatchObject({
      stichtag: '2026-09-17',
      gesperrt: false,
    });
  });

  test('bedeutet Vorlauf 0 den ersten Tag des Monats selbst', () => {
    expect(
      frist('2026-09', berlinerZeit('2026-09-01T12:00:00+02:00'), { vorlaufTage: 0 }),
    ).toMatchObject({
      stichtag: '2026-09-01',
      gesperrt: false,
    });
    expect(gesperrt('2026-09', berlinerZeit('2026-09-02T00:00:00+02:00'), { vorlaufTage: 0 })).toBe(
      true,
    );
  });

  test('benutzt ohne Angabe den Vorgabewert', () => {
    const jetzt = berlinerZeit('2026-08-21T12:00:00+02:00');
    expect(frist('2026-11', jetzt).stichtag).toBe(
      frist('2026-11', jetzt, { vorlaufTage: VORGABE_VORLAUF_TAGE }).stichtag,
    );
  });
});

describe('Gesetzter Stichtag', () => {
  const jetzt = berlinerZeit('2026-08-21T12:00:00+02:00');

  test('schlaegt den automatischen Vorschlag', () => {
    const stichtage = { '2026-11': '2026-08-28' };
    expect(frist('2026-11', jetzt, { stichtage })).toMatchObject({
      stichtag: '2026-08-28',
      herkunft: 'gesetzt',
      gesperrt: false,
    });
    expect(gesperrt('2026-11', berlinerZeit('2026-08-29T00:00:00+02:00'), { stichtage })).toBe(true);
  });

  test('oeffnet einen automatisch geschlossenen Monat wieder', () => {
    // Nachzuegler: Der September ist laengst automatisch zu, die Leitung setzt
    // ihn ausdruecklich noch einmal auf.
    expect(gesperrt('2026-09', jetzt)).toBe(true);
    expect(gesperrt('2026-09', jetzt, { stichtage: { '2026-09': '2026-08-25' } })).toBe(false);
  });

  test('bleibt unberuehrt, wenn sich der Vorlauf spaeter aendert', () => {
    const stichtage = { '2026-11': '2026-08-28' };
    for (const vorlaufTage of [0, 14, 56, 200]) {
      expect(frist('2026-11', jetzt, { stichtage, vorlaufTage }).stichtag).toBe('2026-08-28');
    }
  });

  test('gilt nur fuer den Monat, fuer den er gesetzt wurde', () => {
    const stichtage = { '2026-11': '2026-08-28' };
    expect(frist('2026-12', jetzt, { stichtage }).herkunft).toBe('automatisch');
  });

  test('faellt bei unlesbarem Datum auf den Vorschlag zurueck', () => {
    // Der Schemapruefer laesst so etwas nicht durch; steht es dennoch in der
    // Datenbank, ist der Vorschlag die richtige Rueckfallebene.
    expect(frist('2026-11', jetzt, { stichtage: { '2026-11': 'Unsinn' } })).toMatchObject({
      stichtag: '2026-09-06',
      herkunft: 'automatisch',
    });
  });
});

describe('Jahreswechsel und Schaltjahr', () => {
  test('rechnet ueber den Jahreswechsel zurueck', () => {
    // 01.01.2027 minus 56 Tage ist der 06.11.2026.
    expect(frist('2027-01', berlinerZeit('2026-11-06T12:00:00+01:00'))).toMatchObject({
      stichtag: '2026-11-06',
      gesperrt: false,
    });
    expect(gesperrt('2027-01', berlinerZeit('2026-11-07T00:00:00+01:00'))).toBe(true);
  });

  test('zaehlt den 29. Februar eines Schaltjahres mit', () => {
    // 01.03.2028 minus 56 Tage: Der Februar 2028 hat 29 Tage, also der 05.01.
    expect(frist('2028-03', berlinerZeit('2028-01-05T12:00:00+01:00')).stichtag).toBe('2028-01-05');
  });
});

describe('Zeitzone der Station', () => {
  test('richtet sich nach Berliner Ortszeit, nicht nach der Zeit des Servers', () => {
    // 06.09. 23:30 UTC ist in Berlin bereits der 07.09. — der Stichtag ist
    // damit ueberschritten. Ein Server, der in UTC rechnet, liesse noch zu.
    expect(gesperrt('2026-11', new Date('2026-09-06T23:30:00Z'))).toBe(true);
  });

  test('sperrt kurz vor Mitternacht Berliner Zeit noch nicht', () => {
    // 06.09. 21:30 UTC ist in Berlin der 06.09. um 23:30 — noch offen.
    expect(gesperrt('2026-11', new Date('2026-09-06T21:30:00Z'))).toBe(false);
  });
});

describe('Rollen und Randfaelle', () => {
  const jetzt = berlinerZeit('2026-08-21T12:00:00+02:00');

  test('sperrt die Leitung nie — sie plant', () => {
    expect(sperrfristFuerMonat({ monat: '2026-01', rolle: 'Manager', jetzt }).gesperrt).toBe(false);
  });

  test('nennt der Leitung trotzdem den wirksamen Stichtag', () => {
    // Die Leitung muss lesen koennen, was fuer die Mitarbeitenden gilt — sonst
    // kann sie den Termin nicht ankuendigen.
    expect(sperrfristFuerMonat({ monat: '2026-11', rolle: 'Manager', jetzt })).toMatchObject({
      stichtag: '2026-09-06',
      herkunft: 'automatisch',
    });
  });

  test('sperrt einen unlesbaren Monat, statt ihn durchzulassen', () => {
    expect(frist('Unsinn', jetzt)).toMatchObject({ stichtag: null, gesperrt: true });
    expect(gesperrt('2026-13', jetzt)).toBe(true);
    expect(gesperrt('2026-9', jetzt)).toBe(true);
  });

  test('istMonatGesperrt ist die Kurzform derselben Entscheidung', () => {
    expect(istMonatGesperrt({ monat: '2026-11', rolle: 'Employee', jetzt })).toBe(false);
    expect(istMonatGesperrt({ monat: '2026-09', rolle: 'Employee', jetzt })).toBe(true);
  });
});

describe('Satz zum Stichtag', () => {
  const jetzt = berlinerZeit('2026-08-21T12:00:00+02:00');

  test('nennt im offenen Monat den letzten Tag', () => {
    expect(stichtagSatz(frist('2026-11', jetzt))).toBe('Wünsche bis 06.09.');
  });

  test('nennt im geschlossenen Monat den ersten Tag danach', () => {
    // Nicht "seit 06.09.": An diesem Tag war noch offen.
    expect(stichtagSatz(frist('2026-11', berlinerZeit('2026-09-20T12:00:00+02:00')))).toBe(
      'Geschlossen seit 07.09.',
    );
  });

  test('schweigt, wenn es keinen lesbaren Monat gibt', () => {
    expect(stichtagSatz(frist('Unsinn', jetzt))).toBe('');
  });
});
