import { afterEach, beforeEach, expect, test } from 'vitest';
import request from 'supertest';
import { anmelden, erzeugeTestumgebung, PASSWORT, type Testumgebung } from './testhilfe';

let u: Testumgebung;

beforeEach(async () => {
  u = await erzeugeTestumgebung();
});

afterEach(() => u.schliessen());

test('ohne Sitzung ist /api/wishes verschlossen', async () => {
  const antwort = await request(u.app).get('/api/wishes');
  expect(antwort.status).toBe(401);
});

test('mit richtigem Passwort kommt man hinein', async () => {
  const agent = await anmelden(u.app, u.mitarbeit.name);
  const antwort = await agent.get('/api/wishes');
  expect(antwort.status).toBe(200);
  expect(antwort.body).toEqual([]);
});

test('das Passwort im Klartext taucht nirgends in der Antwort auf', async () => {
  const antwort = await request(u.app)
    .post('/api/login')
    .send({ name: u.leitung.name, password: PASSWORT });
  expect(antwort.status).toBe(200);
  expect(JSON.stringify(antwort.body)).not.toContain(PASSWORT);
  expect(JSON.stringify(antwort.body)).not.toContain('passwordHash');
});
