import { describe, expect, test } from 'vitest';
import { createDatabase } from './database';
import { verifyPassword } from './passwords';
import { ensureManagerAccount } from './seed';

describe('ensureManagerAccount', () => {
  test('legt ein Leitungskonto an, wenn es noch keines gibt', async () => {
    const db = createDatabase(':memory:');

    const ergebnis = await ensureManagerAccount(db);

    expect(ergebnis.created).toBe(true);
    const zeile: any = db.prepare("SELECT name, role FROM users WHERE role = 'Manager'").get();
    expect(zeile.role).toBe('Manager');
  });

  test('nennt das erzeugte Passwort genau einmal zurueck', async () => {
    const db = createDatabase(':memory:');

    const ergebnis = await ensureManagerAccount(db);

    expect(ergebnis.password).toBeTruthy();
    const zeile: any = db.prepare("SELECT password_hash FROM users WHERE role = 'Manager'").get();
    expect(await verifyPassword(zeile.password_hash, ergebnis.password!)).toBe(true);
  });

  test('erzeugt bei jedem Lauf ein anderes Passwort', async () => {
    const a = await ensureManagerAccount(createDatabase(':memory:'));
    const b = await ensureManagerAccount(createDatabase(':memory:'));

    expect(a.password).not.toBe(b.password);
  });

  test('legt keines an, wenn bereits eine Leitung existiert', async () => {
    const db = createDatabase(':memory:');
    db.prepare(
      "INSERT INTO users (id, name, role, password_hash) VALUES ('x', 'Vorhandene Leitung', 'Manager', 'h')",
    ).run();

    const ergebnis = await ensureManagerAccount(db);

    expect(ergebnis.created).toBe(false);
    expect(ergebnis.password).toBeUndefined();
    expect(db.prepare('SELECT count(*) AS n FROM users').get()).toEqual({ n: 1 });
  });

  test('legt eines an, wenn es zwar Mitarbeitende, aber keine Leitung gibt', async () => {
    // Sonst waere die Installation unbedienbar: Ohne Leitung kann niemand
    // Konten anlegen oder Einstellungen aendern.
    const db = createDatabase(':memory:');
    db.prepare(
      "INSERT INTO users (id, name, role, password_hash) VALUES ('x', 'Nur Mitarbeiter', 'Employee', 'h')",
    ).run();

    const ergebnis = await ensureManagerAccount(db);

    expect(ergebnis.created).toBe(true);
    expect(db.prepare("SELECT count(*) AS n FROM users WHERE role = 'Manager'").get()).toEqual({
      n: 1,
    });
  });

  test('weicht aus, wenn der vorgesehene Name schon vergeben ist', async () => {
    // Der Name traegt die Anmeldung und ist eindeutig; eine Kollision darf den
    // Serverstart nicht scheitern lassen.
    const db = createDatabase(':memory:');
    db.prepare(
      "INSERT INTO users (id, name, role, password_hash) VALUES ('x', 'Leitung', 'Employee', 'h')",
    ).run();

    const ergebnis = await ensureManagerAccount(db);

    expect(ergebnis.created).toBe(true);
    expect(ergebnis.name).not.toBe('Leitung');
  });
});
