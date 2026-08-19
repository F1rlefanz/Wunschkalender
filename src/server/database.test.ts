import { describe, expect, test } from 'vitest';
import { createDatabase } from './database';

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
