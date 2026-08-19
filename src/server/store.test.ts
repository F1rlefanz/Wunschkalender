import { beforeEach, describe, expect, test } from 'vitest';
import type { Database } from 'better-sqlite3';
import { createDatabase } from './database';
import { createStore, type Store } from './store';

let db: Database;
let store: Store;

beforeEach(() => {
  db = createDatabase(':memory:');
  store = createStore(db);
  db.prepare(
    "INSERT INTO users (id, name, role, password_hash) VALUES ('u1', 'Anna Schmidt', 'Manager', 'h')",
  ).run();
  db.prepare(
    "INSERT INTO users (id, name, role, password_hash) VALUES ('u2', 'Max Mustermann', 'Employee', 'h')",
  ).run();
});

describe('Wuensche', () => {
  test('gibt die Felder so zurueck, wie die Oberflaeche sie erwartet', () => {
    // Die Datenbank schreibt user_id/shift_type, der Client liest userId/shiftType.
    // Faellt diese Uebersetzung aus, bleibt der Kalender leer, ohne zu klagen.
    const angelegt = store.addWish({
      userId: 'u2',
      date: '2026-08-19',
      shiftType: 'Frei',
      comment: 'Arzt',
    });

    expect(angelegt).toMatchObject({
      userId: 'u2',
      date: '2026-08-19',
      shiftType: 'Frei',
      comment: 'Arzt',
    });
    expect(angelegt.id).toBeTruthy();
    expect(store.listWishes()[0]).toMatchObject({ userId: 'u2', shiftType: 'Frei' });
  });

  test('loescht einen Wunsch', () => {
    const w = store.addWish({ userId: 'u2', date: '2026-08-19', shiftType: 'Frei', comment: '' });

    store.deleteWish(w.id);

    expect(store.listWishes()).toHaveLength(0);
  });

  test('findet einen Wunsch, um seinen Eigentuemer zu pruefen', () => {
    const w = store.addWish({ userId: 'u2', date: '2026-08-19', shiftType: 'Frei', comment: '' });

    expect(store.findWish(w.id)?.userId).toBe('u2');
    expect(store.findWish('gibtsnicht')).toBeUndefined();
  });
});

describe('Monatshinweise', () => {
  test('aktualisiert einen bestehenden Hinweis, statt einen zweiten anzulegen', () => {
    store.saveMonthlyComment({ userId: 'u2', month: '2026-08', text: 'erste Fassung' });
    store.saveMonthlyComment({ userId: 'u2', month: '2026-08', text: 'zweite Fassung' });

    const alle = store.listMonthlyComments();
    expect(alle).toHaveLength(1);
    expect(alle[0].text).toBe('zweite Fassung');
  });

  test('haelt Hinweise verschiedener Monate auseinander', () => {
    store.saveMonthlyComment({ userId: 'u2', month: '2026-08', text: 'August' });
    store.saveMonthlyComment({ userId: 'u2', month: '2026-09', text: 'September' });

    expect(store.listMonthlyComments()).toHaveLength(2);
  });
});

describe('Benutzer', () => {
  test('gibt niemals den Passwort-Hash heraus', () => {
    const benutzer: any[] = store.listUsers();

    expect(benutzer[0]).not.toHaveProperty('password_hash');
    expect(benutzer[0]).not.toHaveProperty('password');
    expect(benutzer[0]).toMatchObject({ id: 'u1', name: 'Anna Schmidt', role: 'Manager' });
  });

  test('findet einen Benutzer ueber seinen Namen, ohne auf Leerzeichen hereinzufallen', () => {
    expect(store.findUserByName('  Anna Schmidt  ')?.id).toBe('u1');
    expect(store.findUserByName('Unbekannt')).toBeUndefined();
  });
});

describe('Einstellungen', () => {
  test('liefert eine Vorgabe, solange nichts gespeichert ist', () => {
    expect(store.getSettings().bookingDeadlineDay).toBe(15);
  });

  test('speichert eine geaenderte Frist als Zahl, nicht als Text', () => {
    store.setBookingDeadlineDay(20);

    expect(store.getSettings().bookingDeadlineDay).toBe(20);
  });
});
