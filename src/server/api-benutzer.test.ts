import { afterEach, beforeEach, expect, test } from 'vitest';
import request from 'supertest';
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

test('das eigene Passwort laesst sich mit dem alten aendern', async () => {
  const agent = await anmelden(u.app, u.mitarbeit.name);
  const antwort = await agent
    .put(`/api/users/${u.mitarbeit.id}/password`)
    .send({ oldPassword: PASSWORT, newPassword: 'Neues-Passwort-2' });
  expect(antwort.status).toBe(200);

  // Der Beweis, dass wirklich gewechselt wurde: das alte oeffnet nicht mehr.
  const mitAlt = await request(u.app)
    .post('/api/login')
    .send({ name: u.mitarbeit.name, password: PASSWORT });
  expect(mitAlt.status).toBe(401);

  const mitNeu = await request(u.app)
    .post('/api/login')
    .send({ name: u.mitarbeit.name, password: 'Neues-Passwort-2' });
  expect(mitNeu.status).toBe(200);
});

test('ohne das richtige alte Passwort aendert sich nichts', async () => {
  const agent = await anmelden(u.app, u.mitarbeit.name);
  const antwort = await agent
    .put(`/api/users/${u.mitarbeit.id}/password`)
    .send({ oldPassword: 'falsch-aber-lang', newPassword: 'Neues-Passwort-2' });
  expect(antwort.status).toBe(401);

  // Und das alte gilt weiterhin.
  await request(u.app)
    .post('/api/login')
    .send({ name: u.mitarbeit.name, password: PASSWORT })
    .expect(200);
});

test('fremde Passwoerter aendert auch die Leitung nicht ueber diesen Weg', async () => {
  // Dafuer gibt es reset-password. Ohne diese Pruefung waere /password ein
  // Weg, ein fremdes Konto zu uebernehmen, wenn man sein eigenes Passwort kennt.
  const agent = await anmelden(u.app, u.leitung.name);
  const antwort = await agent
    .put(`/api/users/${u.mitarbeit.id}/password`)
    .send({ oldPassword: PASSWORT, newPassword: 'Neues-Passwort-2' });
  expect(antwort.status).toBe(403);
});

test('die aendernde Sitzung bleibt nach dem Passwortwechsel gueltig', async () => {
  // Sonst meldete die Oberflaeche Erfolg, waehrend der Server schon 401 gibt.
  const agent = await anmelden(u.app, u.mitarbeit.name);
  await agent
    .put(`/api/users/${u.mitarbeit.id}/password`)
    .send({ oldPassword: PASSWORT, newPassword: 'Neues-Passwort-2' })
    .expect(200);

  const danach = await agent.get('/api/wishes');
  expect(danach.status).toBe(200);
});

test('nur die Leitung darf ein Passwort zuruecksetzen', async () => {
  const mitarbeit = await anmelden(u.app, u.mitarbeit.name);
  const verboten = await mitarbeit
    .put(`/api/users/${u.leitung.id}/reset-password`)
    .send({ newPassword: 'Neues-Passwort-2' });
  expect(verboten.status).toBe(403);

  const leitung = await anmelden(u.app, u.leitung.name);
  const erlaubt = await leitung
    .put(`/api/users/${u.mitarbeit.id}/reset-password`)
    .send({ newPassword: 'Neues-Passwort-2' });
  expect(erlaubt.status).toBe(200);

  await request(u.app)
    .post('/api/login')
    .send({ name: u.mitarbeit.name, password: 'Neues-Passwort-2' })
    .expect(200);
});

test('das Zuruecksetzen bei unbekannter Kennung meldet 404', async () => {
  const leitung = await anmelden(u.app, u.leitung.name);
  const antwort = await leitung
    .put('/api/users/gibt-es-nicht/reset-password')
    .send({ newPassword: 'Neues-Passwort-2' });
  expect(antwort.status).toBe(404);
});
