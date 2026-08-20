import { describe, expect, test } from 'vitest';
import { istMonatGesperrt } from './sperrfrist';

/** Ein Zeitpunkt in Berliner Ortszeit, als UTC-Instant. */
const berlinerZeit = (text: string) => new Date(text);

const pruefe = (monat: string, jetzt: Date, stichtag = 15) =>
  istMonatGesperrt({ monat, stichtag, rolle: 'Employee', jetzt });

describe('Vergangenheit und Zukunft', () => {
  const jetzt = berlinerZeit('2026-08-10T12:00:00+02:00');

  test('sperrt einen vergangenen Monat', () => {
    expect(pruefe('2026-07', jetzt)).toBe(true);
  });

  test('sperrt den laufenden Monat', () => {
    // Entschieden in #33: Der Dienstplan des laufenden Monats haengt bereits.
    // Eine nachtraegliche Eintragung aendert daran nichts mehr.
    expect(pruefe('2026-08', jetzt)).toBe(true);
  });

  test('sperrt den laufenden Monat schon an seinem ersten Tag', () => {
    expect(pruefe('2026-08', berlinerZeit('2026-08-01T00:00:00+02:00'))).toBe(true);
  });

  test('laesst den uebernaechsten Monat offen, auch nach dem Stichtag', () => {
    expect(pruefe('2026-10', berlinerZeit('2026-08-20T12:00:00+02:00'))).toBe(false);
  });
});

describe('Stichtag fuer den Folgemonat', () => {
  test('ist vor dem Stichtag offen', () => {
    expect(pruefe('2026-09', berlinerZeit('2026-08-14T23:59:00+02:00'))).toBe(false);
  });

  test('schliesst am Stichtag selbst', () => {
    expect(pruefe('2026-09', berlinerZeit('2026-08-15T00:00:00+02:00'))).toBe(true);
  });

  test('bleibt nach dem Stichtag geschlossen', () => {
    expect(pruefe('2026-09', berlinerZeit('2026-08-28T12:00:00+02:00'))).toBe(true);
  });

  test('richtet sich nach dem eingestellten Stichtag', () => {
    const am20 = berlinerZeit('2026-08-20T12:00:00+02:00');
    expect(pruefe('2026-09', am20, 25)).toBe(false);
    expect(pruefe('2026-09', am20, 20)).toBe(true);
  });
});

describe('Jahreswechsel', () => {
  // Der eigentliche Fehler: Die alte Fassung verglich Jahr und Monat einzeln
  // (`getMonth() === now.getMonth() + 1` bei gleichem Jahr). Im Dezember ist der
  // Folgemonat aber der Januar des naechsten Jahres — die Bedingung war nie
  // erfuellt und der Januar blieb unbegrenzt offen.
  test('sperrt den Januar, wenn im Dezember der Stichtag erreicht ist', () => {
    expect(pruefe('2027-01', berlinerZeit('2026-12-20T12:00:00+01:00'))).toBe(true);
  });

  test('laesst den Januar vor dem Stichtag im Dezember offen', () => {
    expect(pruefe('2027-01', berlinerZeit('2026-12-05T12:00:00+01:00'))).toBe(false);
  });

  test('sperrt den Dezember, wenn der Januar laeuft', () => {
    expect(pruefe('2026-12', berlinerZeit('2027-01-05T12:00:00+01:00'))).toBe(true);
  });

  test('laesst den Februar im Dezember offen — er ist nicht der Folgemonat', () => {
    expect(pruefe('2027-02', berlinerZeit('2026-12-20T12:00:00+01:00'))).toBe(false);
  });
});

describe('Zeitzone der Station', () => {
  test('richtet sich nach Berliner Ortszeit, nicht nach der Zeit des Servers', () => {
    // 14.08. 23:30 UTC ist in Berlin bereits der 15.08. um 01:30 — der Stichtag
    // ist also erreicht. Ein Server, der in UTC rechnet, liesse hier noch zu.
    expect(pruefe('2026-09', new Date('2026-08-14T23:30:00Z'))).toBe(true);
  });

  test('sperrt kurz vor Mitternacht Berliner Zeit noch nicht', () => {
    // 14.08. 21:30 UTC ist in Berlin der 14.08. um 23:30 — noch offen.
    expect(pruefe('2026-09', new Date('2026-08-14T21:30:00Z'))).toBe(false);
  });
});

describe('Rollen und Randfaelle', () => {
  test('sperrt die Leitung nie — sie plant', () => {
    const langeVorbei = berlinerZeit('2027-05-01T12:00:00+02:00');
    expect(istMonatGesperrt({ monat: '2026-01', stichtag: 15, rolle: 'Manager', jetzt: langeVorbei })).toBe(false);
  });

  test('sperrt einen unlesbaren Monat, statt ihn durchzulassen', () => {
    // Im Zweifel lieber eine Eintragung zu viel ablehnen als eine Sperre
    // stillschweigend umgehen.
    const jetzt = berlinerZeit('2026-08-20T12:00:00+02:00');
    expect(pruefe('Unsinn', jetzt)).toBe(true);
    expect(pruefe('2026-13', jetzt)).toBe(true);
    expect(pruefe('2026-9', jetzt)).toBe(true);
  });
});
