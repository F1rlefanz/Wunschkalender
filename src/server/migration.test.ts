import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDatabase } from './database';
import { verifyPassword } from './passwords';
import { migrateFromJson } from './migration';

let dir: string;
let jsonPath: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wk-migration-'));
  jsonPath = path.join(dir, 'db.json');
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const beispieldaten = {
  settings: { bookingDeadlineDay: 15 },
  users: [
    { id: 'u1', name: 'Anna Schmidt', role: 'Manager', password: 'password' },
    { id: 'u2', name: 'Max Mustermann', role: 'Employee', password: 'password' },
  ],
  wishes: [{ id: 'w1', userId: 'u2', date: '2026-08-19', shiftType: 'Frei', comment: 'Arzt' }],
  monthlyComments: [{ id: 'c1', userId: 'u2', month: '2026-08', text: 'Bitte kein Nachtdienst' }],
};

function schreibeJson(daten: unknown) {
  fs.writeFileSync(jsonPath, JSON.stringify(daten), 'utf-8');
}

describe('migrateFromJson', () => {
  test('tut nichts, wenn es keine db.json gibt', async () => {
    const db = createDatabase(':memory:');

    const ergebnis = await migrateFromJson(db, jsonPath);

    expect(ergebnis.migrated).toBe(false);
  });

  test('uebertraegt Benutzer, Wuensche und Hinweise', async () => {
    const db = createDatabase(':memory:');
    schreibeJson(beispieldaten);

    const ergebnis = await migrateFromJson(db, jsonPath);

    expect(ergebnis.migrated).toBe(true);
    expect(db.prepare('SELECT count(*) AS n FROM users').get()).toEqual({ n: 2 });
    expect(db.prepare('SELECT count(*) AS n FROM wishes').get()).toEqual({ n: 1 });
    expect(db.prepare('SELECT count(*) AS n FROM monthly_comments').get()).toEqual({ n: 1 });
  });

  test('laesst den ueberholten Stichtag-Schluessel liegen, statt ihn mitzuschleppen', async () => {
    // `bookingDeadlineDay` war ein Tag des Monats; inzwischen ist der Stichtag
    // ein Datum je Monat. Ein alter Wert liesse sich nicht umrechnen.
    const db = createDatabase(':memory:');
    schreibeJson(beispieldaten);

    await migrateFromJson(db, jsonPath);

    const zeile = db.prepare("SELECT value FROM settings WHERE key = 'bookingDeadlineDay'").get();
    expect(zeile).toBeUndefined();
  });

  test('hasht Klartext-Passwoerter und speichert sie nicht im Klartext', async () => {
    const db = createDatabase(':memory:');
    schreibeJson(beispieldaten);

    await migrateFromJson(db, jsonPath);

    const zeile: any = db.prepare("SELECT password_hash FROM users WHERE id = 'u1'").get();
    expect(zeile.password_hash).not.toBe('password');
    expect(await verifyPassword(zeile.password_hash, 'password')).toBe(true);
  });

  test('uebernimmt auch Alt-Passwoerter unterhalb der heutigen Mindestlaenge', async () => {
    // Bestandsdaten duerfen nicht an einer Regel scheitern, die es zum
    // Zeitpunkt ihrer Entstehung noch nicht gab.
    const db = createDatabase(':memory:');
    schreibeJson({
      ...beispieldaten,
      users: [{ id: 'u1', name: 'Anna Schmidt', role: 'Manager', password: 'kurz' }],
      wishes: [],
      monthlyComments: [],
    });

    const ergebnis = await migrateFromJson(db, jsonPath);

    expect(ergebnis.migrated).toBe(true);
    const zeile: any = db.prepare("SELECT password_hash FROM users WHERE id = 'u1'").get();
    expect(await verifyPassword(zeile.password_hash, 'kurz')).toBe(true);
  });

  test('warnt vor uebernommenen Konten mit dem bekannten Demo-Passwort', async () => {
    const db = createDatabase(':memory:');
    schreibeJson(beispieldaten);

    const ergebnis = await migrateFromJson(db, jsonPath);

    expect(ergebnis.warnings.join(' ')).toMatch(/Anna Schmidt/);
  });

  test('laeuft kein zweites Mal, auch wenn die Datei noch da ist', async () => {
    const db = createDatabase(':memory:');
    schreibeJson(beispieldaten);

    await migrateFromJson(db, jsonPath);
    const zweiterLauf = await migrateFromJson(db, jsonPath);

    expect(zweiterLauf.migrated).toBe(false);
    expect(db.prepare('SELECT count(*) AS n FROM users').get()).toEqual({ n: 2 });
  });

  test('bricht bei doppelten Namen ab und nennt sie', async () => {
    const db = createDatabase(':memory:');
    schreibeJson({
      ...beispieldaten,
      users: [
        { id: 'u1', name: 'Anna Schmidt', role: 'Manager', password: 'password' },
        { id: 'u2', name: 'Anna Schmidt', role: 'Employee', password: 'password' },
      ],
    });

    await expect(migrateFromJson(db, jsonPath)).rejects.toThrow(/Anna Schmidt/);
  });

  test('kommt mit einer unvollstaendigen Datei zurecht, statt zu scheitern', async () => {
    // Eine aeltere db.json kann Felder gar nicht enthalten. Fehlende Abschnitte
    // sind kein Fehler — anders als eine beschaedigte Datei, siehe naechster Test.
    const db = createDatabase(':memory:');
    schreibeJson({ users: [{ id: 'u1', name: 'Allein', role: 'Manager', password: 'password' }] });

    const ergebnis = await migrateFromJson(db, jsonPath);

    expect(ergebnis.migrated).toBe(true);
    expect(db.prepare('SELECT count(*) AS n FROM users').get()).toEqual({ n: 1 });
    expect(db.prepare('SELECT count(*) AS n FROM wishes').get()).toEqual({ n: 0 });
  });

  test('kommt mit einer voellig leeren Datei zurecht', async () => {
    const db = createDatabase(':memory:');
    schreibeJson({});

    const ergebnis = await migrateFromJson(db, jsonPath);

    expect(ergebnis.migrated).toBe(true);
    expect(db.prepare('SELECT count(*) AS n FROM users').get()).toEqual({ n: 0 });
  });

  test('bricht bei beschaedigter Datei ab und laesst sie unangetastet', async () => {
    const db = createDatabase(':memory:');
    fs.writeFileSync(jsonPath, '{ das ist kein gueltiges JSON', 'utf-8');

    await expect(migrateFromJson(db, jsonPath)).rejects.toThrow();
    expect(fs.existsSync(jsonPath)).toBe(true);
  });

  test('importiert nichts halb, wenn die Daten mittendrin unbrauchbar sind', async () => {
    const db = createDatabase(':memory:');
    schreibeJson({
      ...beispieldaten,
      wishes: [{ id: 'w1', userId: 'gibtsnicht', date: '2026-08-19', shiftType: 'Frei' }],
    });

    await expect(migrateFromJson(db, jsonPath)).rejects.toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM users').get()).toEqual({ n: 0 });
  });

  test('bricht ab, wenn schon Benutzer da sind und zugleich eine db.json existiert', async () => {
    const db = createDatabase(':memory:');
    db.prepare(
      "INSERT INTO users (id, name, role, password_hash) VALUES ('x', 'Vorhanden', 'Manager', 'h')",
    ).run();
    schreibeJson(beispieldaten);

    await expect(migrateFromJson(db, jsonPath)).rejects.toThrow(/bereits/i);
  });
});
