import { afterEach, beforeEach, expect, test } from 'vitest';
import { anmelden, erzeugeTestumgebung, PASSWORT, type Testumgebung } from './testhilfe';

let u: Testumgebung;

beforeEach(async () => {
  u = await erzeugeTestumgebung();
});

afterEach(() => u.schliessen());

test('Mitarbeitende koennen niemanden anlegen', async () => {
  const agent = await anmelden(u.app, u.mitarbeit.name);
  const antwort = await agent
    .post('/api/users')
    .send({ name: 'Neu Hier', role: 'Employee', password: PASSWORT });
  expect(antwort.status).toBe(403);
});

test('Mitarbeitende koennen sich nicht selbst befoerdern', async () => {
  // Der gefaehrlichste Weg der Anwendung: Ohne requireManager waere
  // PUT /api/users/:id die Selbstbefoerderung.
  const agent = await anmelden(u.app, u.mitarbeit.name);
  const antwort = await agent.put(`/api/users/${u.mitarbeit.id}`).send({ role: 'Manager' });
  expect(antwort.status).toBe(403);
  expect(u.store.findUserById(u.mitarbeit.id)?.role).toBe('Employee');
});

test('die Leitung legt an, aendert und loescht', async () => {
  const agent = await anmelden(u.app, u.leitung.name);

  const angelegt = await agent
    .post('/api/users')
    .send({ name: 'Neu Hier', role: 'Employee', password: PASSWORT });
  expect(angelegt.status).toBe(200);
  const id = angelegt.body.user.id;

  const geaendert = await agent.put(`/api/users/${id}`).send({ name: 'Umbenannt' });
  expect(geaendert.status).toBe(200);
  expect(u.store.findUserById(id)?.name).toBe('Umbenannt');

  const geloescht = await agent.delete(`/api/users/${id}`);
  expect(geloescht.status).toBe(200);
  expect(u.store.findUserById(id)).toBeUndefined();
});

test('die Leitung darf eine Rolle aendern', async () => {
  // Das Gegenstueck zur Selbstbefoerderung: Der Weg existiert, aber nur fuer sie.
  const agent = await anmelden(u.app, u.leitung.name);
  const antwort = await agent.put(`/api/users/${u.mitarbeit.id}`).send({ role: 'Manager' });
  expect(antwort.status).toBe(200);
  expect(u.store.findUserById(u.mitarbeit.id)?.role).toBe('Manager');
});

test('doppelte Namen weist der Server ab', async () => {
  const agent = await anmelden(u.app, u.leitung.name);
  const antwort = await agent
    .post('/api/users')
    .send({ name: u.mitarbeit.name, role: 'Employee', password: PASSWORT });
  expect(antwort.status).toBe(409);
});

test('kein Passwort-Hash verlaesst den Server', async () => {
  const agent = await anmelden(u.app, u.mitarbeit.name);
  const antwort = await agent.get('/api/users');
  expect(antwort.status).toBe(200);
  expect(JSON.stringify(antwort.body)).not.toContain('passwordHash');
  expect(JSON.stringify(antwort.body)).not.toContain('$argon2');
});

test('mit der Person verschwinden ihre Wuensche und Hinweise', async () => {
  // Das haelt das Schema selbst ein (ON DELETE CASCADE), nicht der Endpunkt.
  u.store.addWish({ userId: u.mitarbeit.id, date: '2027-03-05', shiftType: 'Früh', comment: '' });
  u.store.saveMonthlyComment({ userId: u.mitarbeit.id, month: '2027-03', text: 'Urlaub' });

  const agent = await anmelden(u.app, u.leitung.name);
  await agent.delete(`/api/users/${u.mitarbeit.id}`).expect(200);

  expect(u.store.listWishes()).toEqual([]);
  expect(u.store.listMonthlyComments()).toEqual([]);
});

test('ein zu kurzes Passwort kommt nicht durch', async () => {
  const agent = await anmelden(u.app, u.leitung.name);
  const antwort = await agent.post('/api/users').send({ name: 'Kurz', role: 'Employee', password: 'abc' });
  expect(antwort.status).toBe(400);
});
