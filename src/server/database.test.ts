import { describe, expect, test } from 'vitest';
import Database from 'better-sqlite3';
import { createDatabase } from './database';

describe('Schemaanpassung', () => {
  test('ergaenzt eine sessions-Tabelle aus einer aelteren Fassung', () => {
    // CREATE TABLE IF NOT EXISTS ruehrt eine vorhandene Tabelle nicht an. Ohne
    // ausdrueckliche Anpassung liefe der Server gegen ein veraltetes Schema und
    // scheiterte erst beim ersten Anmelden.
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, role TEXT NOT NULL, password_hash TEXT NOT NULL);
      CREATE TABLE sessions (sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expire INTEGER NOT NULL);
      INSERT INTO users (id, name, role, password_hash) VALUES ('u1', 'Anna', 'Manager', 'h');
      INSERT INTO sessions (sid, sess, expire) VALUES ('alt', '{}', 99999999999999);
    `);

    createDatabase(':memory:', db);

    const spalten = db
      .prepare('PRAGMA table_info(sessions)')
      .all()
      .map((s: any) => s.name);
    expect(spalten).toContain('user_id');
    // Die Benutzer muessen erhalten bleiben — nur Sitzungen sind wegwerfbar.
    expect(db.prepare('SELECT count(*) AS n FROM users').get()).toEqual({ n: 1 });
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
      expect.arrayContaining(['users', 'wishes', 'monthly_comments', 'settings', 'sessions']),
    );
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
