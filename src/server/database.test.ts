import { describe, expect, test } from 'vitest';
import Database from 'better-sqlite3';
import { createDatabase, SCHEMA_STAND } from './database';

/** Eine Datenbank, wie sie eine Fassung vor der Nummerierung hinterlassen hat. */
function alteDatenbank() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, role TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE wishes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL, shift_type TEXT NOT NULL, comment TEXT NOT NULL DEFAULT '');
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE sessions (sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expire INTEGER NOT NULL);
    INSERT INTO users (id, name, role, password_hash) VALUES ('u1', 'Anna', 'Manager', 'h');
    INSERT INTO wishes (id, user_id, date, shift_type) VALUES ('w1', 'u1', '2026-08-19', 'Frei');
    INSERT INTO settings (key, value) VALUES ('bookingDeadlineDay', '15');
    INSERT INTO sessions (sid, sess, expire) VALUES ('alt', '{}', 99999999999999);
  `);
  return db;
}

describe('Schemaschritte', () => {
  test('zieht eine Datenbank aus einer aelteren Fassung hoch, ohne Daten zu verlieren', () => {
    const db = alteDatenbank();

    createDatabase(':memory:', db);

    const spalten = db
      .prepare('PRAGMA table_info(sessions)')
      .all()
      .map((s: any) => s.name);
    expect(spalten).toContain('user_id');
    // Benutzerdaten muessen erhalten bleiben — nur Sitzungen sind wegwerfbar.
    expect(db.prepare('SELECT count(*) AS n FROM users').get()).toEqual({ n: 1 });
    expect(db.prepare('SELECT count(*) AS n FROM wishes').get()).toEqual({ n: 1 });
    // Die spaeter angelegten Tabellen fehlen einer alten Datenbank noch.
    expect(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'stichtage'").get()).toEqual({
      n: 1,
    });
    // Der ueberholte Schluessel bleibt nicht als Leiche liegen.
    expect(
      db.prepare("SELECT count(*) AS n FROM settings WHERE key = 'bookingDeadlineDay'").get(),
    ).toEqual({ n: 0 });
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_STAND);
  });

  test('aendert beim zweiten Start nichts mehr', () => {
    const db = alteDatenbank();
    createDatabase(':memory:', db);
    db.prepare("INSERT INTO sessions (sid, sess, expire, user_id) VALUES ('neu', '{}', 9999999999, 'u1')").run();

    createDatabase(':memory:', db);

    // Wuerde Schritt 1 erneut laufen, waere die Sitzung weg — sie ueberlebt,
    // weil `user_version` den erreichten Stand kennt.
    expect(db.prepare('SELECT count(*) AS n FROM sessions').get()).toEqual({ n: 1 });
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_STAND);
  });

  test('haelt eine Datenbank auf einem halben Schritt nicht fest', () => {
    // Ein abgebrochener Schritt darf keinen Zwischenstand hinterlassen: Die
    // Nummer wird mit demselben Federstrich gesetzt wie die Aenderung.
    const db = new Database(':memory:');
    db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, role TEXT NOT NULL, password_hash TEXT NOT NULL)");
    // Eine `settings`-Tabelle mit fremdem Zuschnitt: Der Schritt kommt bis zum
    // Aufraeumen der Einstellungen und scheitert dort an der fehlenden Spalte.
    db.exec('CREATE TABLE settings (schluessel TEXT PRIMARY KEY, wert TEXT NOT NULL)');

    expect(() => createDatabase(':memory:', db)).toThrow();

    expect(db.pragma('user_version', { simple: true })).toBe(0);
    // Kein halber Stand: Was der Schritt vor dem Fehler angelegt hat, ist zurueckgerollt.
    expect(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'wishes'").get()).toEqual({
      n: 0,
    });
  });
});

describe('createDatabase', () => {
  test('legt alle benoetigten Tabellen an', () => {
    const db = createDatabase(':memory:');

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row: any) => row.name);

    expect(tables).toEqual(
      expect.arrayContaining(['users', 'wishes', 'monthly_comments', 'settings', 'stichtage', 'sessions']),
    );
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_STAND);
  });

  test('loescht Wuensche und Hinweise mit, wenn ein Benutzer entfernt wird', () => {
    const db = createDatabase(':memory:');
    db.prepare(
      "INSERT INTO users (id, name, role, password_hash) VALUES ('u1', 'Anna', 'Employee', 'x')",
    ).run();
    db.prepare(
      "INSERT INTO wishes (id, user_id, date, shift_type) VALUES ('w1', 'u1', '2026-08-19', 'Frei')",
    ).run();
    db.prepare(
      "INSERT INTO monthly_comments (id, user_id, month, text) VALUES ('c1', 'u1', '2026-08', 'Urlaub')",
    ).run();

    db.prepare("DELETE FROM users WHERE id = 'u1'").run();

    expect(db.prepare('SELECT count(*) AS n FROM wishes').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM monthly_comments').get()).toEqual({ n: 0 });
  });

  test('weist Wuensche fuer einen unbekannten Benutzer ab', () => {
    const db = createDatabase(':memory:');

    expect(() =>
      db
        .prepare(
          "INSERT INTO wishes (id, user_id, date, shift_type) VALUES ('w1', 'gibtsnicht', '2026-08-19', 'Frei')",
        )
        .run(),
    ).toThrow(/FOREIGN KEY/i);
  });
});
