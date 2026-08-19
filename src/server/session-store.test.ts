import { beforeEach, describe, expect, test } from 'vitest';
import type { Database } from 'better-sqlite3';
import { createDatabase } from './database';
import { SqliteSessionStore } from './session-store';

let db: Database;
let store: SqliteSessionStore;

/** express-session arbeitet mit Rueckrufen; hier als Zusage verpackt. */
const get = (sid: string) =>
  new Promise<any>((resolve, reject) =>
    store.get(sid, (err, session) => (err ? reject(err) : resolve(session))),
  );
const set = (sid: string, session: any) =>
  new Promise<void>((resolve, reject) =>
    store.set(sid, session, (err) => (err ? reject(err) : resolve())),
  );
const destroy = (sid: string) =>
  new Promise<void>((resolve, reject) =>
    store.destroy(sid, (err) => (err ? reject(err) : resolve())),
  );

const sitzung = (userId: string, maxAge = 60_000) => ({
  cookie: { maxAge, originalMaxAge: maxAge },
  userId,
});

beforeEach(() => {
  db = createDatabase(':memory:');
  store = new SqliteSessionStore(db);
  db.prepare(
    "INSERT INTO users (id, name, role, password_hash) VALUES ('u1', 'Anna', 'Employee', 'h')",
  ).run();
  db.prepare(
    "INSERT INTO users (id, name, role, password_hash) VALUES ('u2', 'Max', 'Employee', 'h')",
  ).run();
});

describe('SqliteSessionStore', () => {
  test('gibt eine gespeicherte Sitzung wieder heraus', async () => {
    await set('sid-1', sitzung('u1'));

    expect(await get('sid-1')).toMatchObject({ userId: 'u1' });
  });

  test('meldet eine unbekannte Sitzung als nicht vorhanden, statt zu scheitern', async () => {
    expect(await get('gibtsnicht')).toBeFalsy();
  });

  test('ueberschreibt eine bestehende Sitzung, statt eine zweite anzulegen', async () => {
    await set('sid-1', sitzung('u1'));
    await set('sid-1', sitzung('u2'));

    expect(await get('sid-1')).toMatchObject({ userId: 'u2' });
    expect(db.prepare('SELECT count(*) AS n FROM sessions').get()).toEqual({ n: 1 });
  });

  test('entfernt eine Sitzung beim Abmelden', async () => {
    await set('sid-1', sitzung('u1'));

    await destroy('sid-1');

    expect(await get('sid-1')).toBeFalsy();
  });

  test('gibt eine abgelaufene Sitzung nicht mehr heraus', async () => {
    await set('sid-alt', sitzung('u1', -1000));

    expect(await get('sid-alt')).toBeFalsy();
  });

  test('raeumt abgelaufene Sitzungen weg', async () => {
    await set('sid-alt', sitzung('u1', -1000));
    await set('sid-neu', sitzung('u2'));

    store.pruneExpired();

    expect(db.prepare('SELECT count(*) AS n FROM sessions').get()).toEqual({ n: 1 });
  });
});

describe('Widerruf', () => {
  test('beendet alle Sitzungen einer Person auf einmal', async () => {
    // Der Fall: Konto geloescht oder Passwort nach Verdacht neu gesetzt.
    await set('handy', sitzung('u1'));
    await set('tablet', sitzung('u1'));
    await set('fremd', sitzung('u2'));

    const beendet = store.destroyByUser('u1');

    expect(beendet).toEqual(['handy', 'tablet']);
    expect(await get('handy')).toBeFalsy();
    expect(await get('tablet')).toBeFalsy();
    expect(await get('fremd')).toMatchObject({ userId: 'u2' });
  });

  test('kann eine Sitzung ausnehmen — die eigene beim Passwortwechsel', async () => {
    // Wer sein Passwort aendert, soll nicht sich selbst aussperren.
    await set('handy', sitzung('u1'));
    await set('tablet', sitzung('u1'));

    store.destroyByUser('u1', { except: 'handy' });

    expect(await get('handy')).toMatchObject({ userId: 'u1' });
    expect(await get('tablet')).toBeFalsy();
  });

  test('verschwindet mit dem Konto, ohne dass jemand aufraeumen muss', async () => {
    await set('handy', sitzung('u1'));

    db.prepare("DELETE FROM users WHERE id = 'u1'").run();

    expect(await get('handy')).toBeFalsy();
  });
});
