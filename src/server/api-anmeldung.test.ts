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

test('falsches Passwort und unbekanntes Konto sind nicht unterscheidbar', async () => {
  // Wer den Unterschied sieht, kann Namen durchprobieren.
  const falsch = await request(u.app)
    .post('/api/login')
    .send({ name: u.leitung.name, password: 'ganz-falsch-aber-lang' });
  const unbekannt = await request(u.app)
    .post('/api/login')
    .send({ name: 'Gibt Es Nicht', password: 'ganz-falsch-aber-lang' });

  expect(falsch.status).toBe(401);
  expect(unbekannt.status).toBe(401);
  expect(falsch.body).toEqual(unbekannt.body);
});

test('unbekannte Felder im Koerper weist das Schema ab', async () => {
  // strictObject: Was nicht im Schema steht, wandert sonst in die Datenbank.
  const antwort = await request(u.app)
    .post('/api/login')
    .send({ name: u.leitung.name, password: PASSWORT, role: 'Manager' });
  expect(antwort.status).toBe(400);
});

test('eine gefaelschte Sitzungskennung oeffnet nichts', async () => {
  // Gegen Session-Fixation: `regenerate` vergibt bei der Anmeldung eine neue,
  // signierte Kennung. Eine veraenderte faellt an der Signatur durch.
  const agent = request.agent(u.app);

  const anmeldung = await agent.post('/api/login').send({ name: u.leitung.name, password: PASSWORT });
  expect(anmeldung.status).toBe(200);
  const echtesCookie = (anmeldung.headers['set-cookie'] as unknown as string[])[0].split(';')[0];

  // Zur Gegenprobe: das echte Cookie oeffnet.
  await request(u.app).get('/api/wishes').set('Cookie', echtesCookie).expect(200);

  const gefaelscht = echtesCookie.replace(/=s%3A[^.]+/, '=s%3Afremde-kennung');
  expect(gefaelscht).not.toBe(echtesCookie);
  const antwort = await request(u.app).get('/api/wishes').set('Cookie', gefaelscht);
  expect(antwort.status).toBe(401);
});

test('/api/me sagt vor der Anmeldung 401 und danach, wer man ist', async () => {
  const ohne = await request(u.app).get('/api/me');
  expect(ohne.status).toBe(401);

  const agent = await anmelden(u.app, u.mitarbeit.name);
  const mit = await agent.get('/api/me');
  expect(mit.status).toBe(200);
  expect(mit.body.user.name).toBe(u.mitarbeit.name);
  expect(mit.body.user.role).toBe('Employee');
  expect(mit.body.user.passwordHash).toBeUndefined();
});

test('nach dem Abmelden ist die Sitzung wertlos', async () => {
  const agent = await anmelden(u.app, u.mitarbeit.name);
  await agent.post('/api/logout').expect(200);
  const danach = await agent.get('/api/wishes');
  expect(danach.status).toBe(401);
});

test('eine geloeschte Person kommt mit alter Sitzung nicht mehr hinein', async () => {
  // requireAuth prueft nicht nur das Cookie, sondern ob es die Person noch gibt.
  const agent = await anmelden(u.app, u.mitarbeit.name);
  await agent.get('/api/wishes').expect(200);

  u.store.deleteUser(u.mitarbeit.id);

  const danach = await agent.get('/api/wishes');
  expect(danach.status).toBe(401);
});

test('nach zehn Fehlversuchen bremst der Server das Konto', async () => {
  for (let i = 0; i < 10; i++) {
    await request(u.app).post('/api/login').send({ name: u.leitung.name, password: 'falsch-aber-lang' });
  }
  const elfter = await request(u.app)
    .post('/api/login')
    .send({ name: u.leitung.name, password: 'falsch-aber-lang' });
  expect(elfter.status).toBe(429);
});

test('erfolgreiche Anmeldungen zaehlen nicht gegen die Bremse', async () => {
  // skipSuccessfulRequests: Wer sein Passwort kennt, merkt von der Bremse nichts.
  for (let i = 0; i < 15; i++) {
    await request(u.app).post('/api/login').send({ name: u.mitarbeit.name, password: PASSWORT }).expect(200);
  }
});
