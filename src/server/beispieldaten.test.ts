import { describe, expect, test } from 'vitest';
import { createDatabase } from './database';
import { verifyPassword } from './passwords';
import { ensureManagerAccount } from './seed';
import {
  BEISPIEL_KONTEN,
  BEISPIEL_PASSWORT,
  beispielmodusGewuenscht,
  richteBeispieldatenEin,
  traegtBeispielmarke,
} from './beispieldaten';

const HEUTE = new Date(2026, 10, 17); // 17. November 2026

describe('beispielmodusGewuenscht', () => {
  test('ist ohne Angabe aus', () => {
    expect(beispielmodusGewuenscht({})).toBe(false);
    expect(beispielmodusGewuenscht({ BEISPIELDATEN: '' })).toBe(false);
    expect(beispielmodusGewuenscht({ BEISPIELDATEN: '0' })).toBe(false);
    expect(beispielmodusGewuenscht({ BEISPIELDATEN: 'aus' })).toBe(false);
  });

  test('braucht eine ausdrueckliche Zustimmung', () => {
    for (const wert of ['an', '1', 'true', 'ja', 'AN']) {
      expect(beispielmodusGewuenscht({ BEISPIELDATEN: wert })).toBe(true);
    }
  });
});

describe('richteBeispieldatenEin', () => {
  test('tut ohne BEISPIELDATEN nichts', async () => {
    const db = createDatabase(':memory:');

    const befund = await richteBeispieldatenEin(db, {}, HEUTE);

    expect(befund.art).toBe('aus');
    const { n }: any = db.prepare('SELECT count(*) AS n FROM users').get();
    expect(n).toBe(0);
    expect(traegtBeispielmarke(db)).toBe(false);
  });

  test('fuellt eine leere Datenbank mit Konten, Wuenschen und Hinweisen', async () => {
    const db = createDatabase(':memory:');

    const befund = await richteBeispieldatenEin(db, { BEISPIELDATEN: 'an' }, HEUTE);

    expect(befund.art).toBe('angelegt');
    if (befund.art !== 'angelegt') return;
    expect(befund.konten).toBe(BEISPIEL_KONTEN.length);
    expect(befund.wuensche).toBeGreaterThan(0);
    expect(befund.hinweise).toBe(2);
    expect(traegtBeispielmarke(db)).toBe(true);
  });

  test('legt genau eine Stationsleitung an', async () => {
    const db = createDatabase(':memory:');

    await richteBeispieldatenEin(db, { BEISPIELDATEN: 'an' }, HEUTE);

    const { n }: any = db.prepare("SELECT count(*) AS n FROM users WHERE role = 'Manager'").get();
    expect(n).toBe(1);
  });

  test('alle Beispielkonten lassen sich mit dem genannten Passwort anmelden', async () => {
    const db = createDatabase(':memory:');

    await richteBeispieldatenEin(db, { BEISPIELDATEN: 'an' }, HEUTE);

    for (const konto of BEISPIEL_KONTEN) {
      const zeile: any = db.prepare('SELECT password_hash FROM users WHERE name = ?').get(konto.name);
      expect(await verifyPassword(zeile.password_hash, BEISPIEL_PASSWORT)).toBe(true);
    }
  });

  test('verteilt die Wuensche auf den laufenden und die beiden folgenden Monate', async () => {
    const db = createDatabase(':memory:');

    await richteBeispieldatenEin(db, { BEISPIELDATEN: 'an' }, HEUTE);

    const monate = (db.prepare('SELECT DISTINCT substr(date, 1, 7) AS m FROM wishes ORDER BY m').all() as any[])
      .map((z) => z.m);
    expect(monate).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  test('legt beim zweiten Start nichts doppelt an', async () => {
    const db = createDatabase(':memory:');

    await richteBeispieldatenEin(db, { BEISPIELDATEN: 'an' }, HEUTE);
    const befund = await richteBeispieldatenEin(db, { BEISPIELDATEN: 'an' }, HEUTE);

    expect(befund.art).toBe('vorhanden');
    const { n }: any = db.prepare('SELECT count(*) AS n FROM users').get();
    expect(n).toBe(BEISPIEL_KONTEN.length);
  });

  // Die eigentliche Sicherung: eine echte Aufstellung darf nicht mit Konten
  // ueberzogen werden, deren Passwort auf der Anmeldeseite steht.
  test('verweigert den Start, wenn schon echte Konten in der Datenbank stehen', async () => {
    const db = createDatabase(':memory:');
    await ensureManagerAccount(db);

    const befund = await richteBeispieldatenEin(db, { BEISPIELDATEN: 'an' }, HEUTE);

    expect(befund.art).toBe('verweigert');
    const namen = (db.prepare('SELECT name FROM users').all() as any[]).map((z) => z.name);
    expect(namen).not.toContain('Beate Beispiel');
    expect(traegtBeispielmarke(db)).toBe(false);
  });

  test('verweigert auch dann, wenn nur ein Mitarbeiterkonto vorhanden ist', async () => {
    const db = createDatabase(':memory:');
    db.prepare('INSERT INTO users (id, name, role, password_hash) VALUES (?, ?, ?, ?)').run(
      'x',
      'Echte Person',
      'Employee',
      'hash',
    );

    const befund = await richteBeispieldatenEin(db, { BEISPIELDATEN: 'an' }, HEUTE);

    expect(befund.art).toBe('verweigert');
    const { n }: any = db.prepare('SELECT count(*) AS n FROM users').get();
    expect(n).toBe(1);
  });

  test('das Leitungskonto des Erststarts kommt neben den Beispielkonten nicht dazu', async () => {
    const db = createDatabase(':memory:');

    await richteBeispieldatenEin(db, { BEISPIELDATEN: 'an' }, HEUTE);
    const seed = await ensureManagerAccount(db);

    expect(seed.created).toBe(false);
  });
});
