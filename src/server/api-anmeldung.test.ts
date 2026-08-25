import { afterEach, beforeEach, expect, test } from 'vitest';
import request from 'supertest';
import { sign } from 'cookie-signature';
import { anmelden, erzeugeTestumgebung, PASSWORT, SITZUNGSGEHEIMNIS, type Testumgebung } from './testhilfe';

/** Baut ein Sitzungscookie mit einer selbst gewaehlten Kennung, so wie ein
 *  Angreifer es bei einer Session-Fixation-Attacke der Zielperson unterschieben
 *  wuerde — signiert mit demselben Geheimnis wie die Testumgebung. Das
 *  Geheimnis kommt bewusst aus `testhilfe.ts` statt aus einem eigenen
 *  Literal: Driften beide auseinander, verifiziert die Signatur nicht mehr —
 *  `express-session` vergibt dann ohnehin eine neue Kennung, und der Test
 *  bliebe lautlos gruen, ohne noch etwas zu pruefen. */
function faelscheCookie(sid: string): string {
  const signiert = 's:' + sign(sid, SITZUNGSGEHEIMNIS);
  return `wunschkalender.sid=${encodeURIComponent(signiert)}`;
}

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

test('eine dem Opfer untergeschobene, im Speicher bereits vorhandene Sitzung bleibt nach der Anmeldung wirkungslos', async () => {
  // Session-Fixation: Ein Angreifer erzeugt vorab eine echte, im Sitzungs-
  // speicher liegende (aber nicht angemeldete) Sitzung und unterschiebt der
  // Zielperson deren signiertes Cookie (etwa per Link). Meldet die Zielperson
  // sich mit genau diesem Cookie an, darf die Kennung dabei NICHT dieselbe
  // bleiben — sonst kennt der Angreifer die Kennung der jetzt authentifizierten
  // Sitzung. `regenerate` vergibt deshalb bei jeder Anmeldung eine frische
  // Kennung. (Ein bloss erfundenes, im Speicher unbekanntes Cookie taugt fuer
  // diese Gegenprobe nicht: `express-session` erzeugt dafuer ohnehin schon
  // beim Nachschlagen eine neue Kennung, unabhaengig vom App-Code.)
  const untergeschobeneKennung = 'von-angreifer-vorbereitete-kennung';
  const untergeschobenesCookie = faelscheCookie(untergeschobeneKennung);
  const ablauf = Date.now() + 60_000;
  u.db
    .prepare(
      `INSERT INTO sessions (sid, sess, expire, user_id) VALUES (?, ?, ?, NULL)`,
    )
    .run(untergeschobeneKennung, JSON.stringify({ cookie: { originalMaxAge: 60_000 } }), ablauf);

  // Die Zielperson meldet sich an, traegt dabei aber das untergeschobene Cookie.
  const anmeldung = await request(u.app)
    .post('/api/login')
    .set('Cookie', untergeschobenesCookie)
    .send({ name: u.leitung.name, password: PASSWORT });
  expect(anmeldung.status).toBe(200);
  const neuesCookie = (anmeldung.headers['set-cookie'] as unknown as string[])[0].split(';')[0];

  // Ohne `regenerate` waere die neue, angemeldete Sitzung dieselbe Kennung
  // wie die untergeschobene — hier muss sie sich unterscheiden.
  expect(neuesCookie.split('=')[1]).not.toBe(untergeschobenesCookie.split('=')[1]);

  // Belegt, dass die untergeschobene Sitzung wirklich geladen und von
  // `regenerate` verbraucht wurde, statt bloss an einer falschen Signatur
  // gescheitert zu sein: `Store.prototype.regenerate` (express-session)
  // zerstoert die alte Sitzung im Speicher, bevor es eine neue Kennung
  // vergibt. Driftet das Testgeheimnis einmal auseinander, faellt schon die
  // Signaturpruefung durch, die Zeile bliebe unberuehrt stehen — und diese
  // Zusicherung faengt genau das ab, statt lautlos zahnlos zu werden.
  const zeileNochDa = u.db
    .prepare('SELECT 1 FROM sessions WHERE sid = ?')
    .get(untergeschobeneKennung);
  expect(zeileNochDa).toBeUndefined();

  // Der Angreifer, der die untergeschobene Kennung von Anfang an kennt, darf
  // damit keinen Zugriff bekommen.
  const angreiferZugriff = await request(u.app).get('/api/wishes').set('Cookie', untergeschobenesCookie);
  expect(angreiferZugriff.status).toBe(401);
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
