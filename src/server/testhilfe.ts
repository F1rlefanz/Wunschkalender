import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { Database } from 'better-sqlite3';
import type express from 'express';
import { expect } from 'vitest';
import { erzeugeApp } from './app';
import { createDatabase } from './database';
import { hashPassword } from './passwords';
import { createStore, type Store } from './store';
import type { User } from '../types';

/** Mindestens 8 Zeichen, sonst weist `hashPassword` es ab. */
export const PASSWORT = 'Test-Passwort-1';

export interface Testumgebung {
  app: express.Express;
  db: Database;
  store: Store;
  leitung: User;
  mitarbeit: User;
  schliessen(): void;
}

/**
 * Argon2 rechnet pro Aufruf bewusst lange. Einmal je Testlauf reicht: Die
 * Konten unterscheiden sich in Rolle und Name, nicht im Passwort.
 */
let hashZwischenspeicher: string | null = null;

export async function erzeugeTestumgebung(): Promise<Testumgebung> {
  hashZwischenspeicher ??= await hashPassword(PASSWORT);

  const db = createDatabase(':memory:');
  const store = createStore(db);
  const leitung = store.createUser({
    name: 'Anna Leitung',
    role: 'Manager',
    passwordHash: hashZwischenspeicher,
  });
  const mitarbeit = store.createUser({
    name: 'Max Mustermann',
    role: 'Employee',
    passwordHash: hashZwischenspeicher,
  });

  const { app } = await erzeugeApp({
    db,
    sitzungsgeheimnis: 'geheimnis-nur-fuer-tests',
    betrieb: { proxyHops: 0, hsts: false, warnung: null },
    auslieferung: 'keine',
  });

  return { app, db, store, leitung, mitarbeit, schliessen: () => db.close() };
}

/** Ein Agent haelt das Sitzungscookie ueber mehrere Anfragen hinweg. */
export async function anmelden(app: express.Express, name: string): Promise<TestAgent> {
  const agent = request.agent(app);
  const antwort = await agent.post('/api/login').send({ name, password: PASSWORT });
  expect(antwort.status).toBe(200);
  return agent;
}
