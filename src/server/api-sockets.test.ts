import { afterEach, beforeEach, expect, test } from 'vitest';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import { io as verbinde, type Socket } from 'socket.io-client';
import { erzeugeApp } from './app';
import { createDatabase } from './database';
import { createStore, type Store } from './store';
import { hashPassword } from './passwords';
import type { Database } from 'better-sqlite3';
import type http from 'http';

const PASSWORT = 'Test-Passwort-1';

let db: Database;
let store: Store;
let httpServer: http.Server;
let adresse: string;

beforeEach(async () => {
  db = createDatabase(':memory:');
  store = createStore(db);
  store.createUser({ name: 'Max Mustermann', role: 'Employee', passwordHash: await hashPassword(PASSWORT) });
  store.createUser({ name: 'Anna Leitung', role: 'Manager', passwordHash: await hashPassword(PASSWORT) });

  const bausteine = await erzeugeApp({
    db,
    sitzungsgeheimnis: 'geheimnis-nur-fuer-tests',
    betrieb: { proxyHops: 0, hsts: false, warnung: null },
    auslieferung: 'keine',
  });
  httpServer = bausteine.httpServer;

  await new Promise<void>((fertig) => httpServer.listen(0, '127.0.0.1', fertig));
  const port = (httpServer.address() as AddressInfo).port;
  adresse = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise<void>((fertig) => httpServer.close(() => fertig()));
  db.close();
});

/**
 * Baut den Socket auf und liefert ihn sofort zurueck, zusammen mit einem
 * Versprechen auf Verbindung oder Fehler.
 *
 * Wichtig ist die Reihenfolge: Der Socket kommt synchron zurueck, damit ein
 * Aufrufer weitere Listener (z. B. auf 'init') VOR dem `await` auf die
 * Verbindung anhaengen kann. Server-seitig sendet `io.on('connection', ...)`
 * das 'init'-Ereignis unmittelbar nach dem Verbindungsaufbau — beim Client
 * treffen 'connect' und 'init' im selben Verarbeitungsschritt ein. Ein
 * Listener, der erst nach einem `await` auf 'connect' angehaengt wird, kommt
 * zu spaet: 'init' ist dann schon verstrichen, und die Zusicherung wartet
 * ewig (siehe Bericht, Fund 1).
 */
function starteVerbindung(cookie?: string): { socket: Socket; verbunden: Promise<boolean> } {
  const socket = verbinde(adresse, {
    transports: ['websocket', 'polling'],
    extraHeaders: cookie ? { Cookie: cookie } : {},
    reconnection: false,
  });
  const verbunden = new Promise<boolean>((aufloesen) => {
    socket.on('connect', () => aufloesen(true));
    socket.on('connect_error', () => aufloesen(false));
  });
  return { socket, verbunden };
}

test('ohne Sitzung kommt kein Socket zustande', async () => {
  // io.engine.use weist nichts ab — dafuer gibt es das zusaetzliche io.use.
  const { socket, verbunden } = starteVerbindung();
  const ergebnis = await verbunden;
  socket.close();
  expect(ergebnis).toBe(false);
});

test('mit Sitzung kommt der Socket zustande und bekommt init', async () => {
  const agent = request.agent(httpServer);
  const anmeldung = await agent.post('/api/login').send({ name: 'Max Mustermann', password: PASSWORT });
  expect(anmeldung.status).toBe(200);
  const cookie = (anmeldung.headers['set-cookie'] as unknown as string[])[0].split(';')[0];

  const { socket, verbunden } = starteVerbindung(cookie);
  // Der 'init'-Listener muss VOR dem Warten auf 'connect' stehen, siehe
  // Kommentar an starteVerbindung.
  const init = new Promise<any>((aufloesen) => socket.on('init', aufloesen));

  expect(await verbunden).toBe(true);
  const initDaten = await init;
  expect(initDaten).toHaveProperty('wishes');
  expect(initDaten).toHaveProperty('settings');
  socket.close();
});

test('das Abmelden trennt den offenen Socket', async () => {
  // Nach dem Upgrade laeuft keine Middleware mehr: Wer eine Sitzung beendet,
  // muss die Sockets ausdruecklich trennen.
  const agent = request.agent(httpServer);
  const anmeldung = await agent.post('/api/login').send({ name: 'Max Mustermann', password: PASSWORT });
  const cookie = (anmeldung.headers['set-cookie'] as unknown as string[])[0].split(';')[0];

  const { socket, verbunden } = starteVerbindung(cookie);
  try {
    const getrennt = new Promise<void>((aufloesen) => socket.on('disconnect', () => aufloesen()));
    await verbunden;

    await agent.post('/api/logout').expect(200);
    await getrennt;

    expect(socket.connected).toBe(false);
  } finally {
    socket.close();
  }
});

test('das Zuruecksetzen des Passworts durch die Leitung trennt den offenen Socket', async () => {
  const maxAgent = request.agent(httpServer);
  const maxAnmeldung = await maxAgent.post('/api/login').send({ name: 'Max Mustermann', password: PASSWORT });
  const maxCookie = (maxAnmeldung.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
  const max = store.findUserByName('Max Mustermann')!;

  const leitungAgent = request.agent(httpServer);
  await leitungAgent.post('/api/login').send({ name: 'Anna Leitung', password: PASSWORT }).expect(200);

  const { socket, verbunden } = starteVerbindung(maxCookie);
  try {
    const getrennt = new Promise<void>((aufloesen) => socket.on('disconnect', () => aufloesen()));
    await verbunden;

    await leitungAgent
      .put(`/api/users/${max.id}/reset-password`)
      .send({ newPassword: 'Neues-Passwort-2' })
      .expect(200);
    await getrennt;

    expect(socket.connected).toBe(false);
  } finally {
    socket.close();
  }
});

test('das eigene Aendern des Passworts trennt die ANDERE Sitzung, nicht die aendernde', async () => {
  // { except: req.sessionID } ist ausdruecklich gewollt: Wer selbst das
  // Passwort aendert, soll nicht die eigene, gerade benutzte Sitzung
  // verlieren — wohl aber jede andere.
  const geraetA = request.agent(httpServer);
  const anmeldungA = await geraetA.post('/api/login').send({ name: 'Max Mustermann', password: PASSWORT });
  const cookieA = (anmeldungA.headers['set-cookie'] as unknown as string[])[0].split(';')[0];

  const geraetB = request.agent(httpServer);
  const anmeldungB = await geraetB.post('/api/login').send({ name: 'Max Mustermann', password: PASSWORT });
  const cookieB = (anmeldungB.headers['set-cookie'] as unknown as string[])[0].split(';')[0];

  const verbindungA = starteVerbindung(cookieA);
  const verbindungB = starteVerbindung(cookieB);
  try {
    await Promise.all([verbindungA.verbunden, verbindungB.verbunden]);

    const getrenntB = new Promise<void>((aufloesen) => verbindungB.socket.on('disconnect', () => aufloesen()));

    // Aendert ueber Geraet A das eigene Passwort.
    await geraetA
      .put(`/api/users/${store.findUserByName('Max Mustermann')!.id}/password`)
      .send({ oldPassword: PASSWORT, newPassword: 'Neues-Passwort-2' })
      .expect(200);

    await getrenntB;
    expect(verbindungB.socket.connected).toBe(false);

    // Der aendernden Sitzung (A) bleibt der Socket erhalten. Kein Ereignis
    // dafuer abzuwarten — stattdessen kurz nachpruefen, dass er nicht doch
    // noch getrennt wird.
    await new Promise((r) => setTimeout(r, 300));
    expect(verbindungA.socket.connected).toBe(true);
  } finally {
    verbindungA.socket.close();
    verbindungB.socket.close();
  }
});

test('das Loeschen einer Person durch die Leitung trennt den offenen Socket', async () => {
  const maxAgent = request.agent(httpServer);
  const maxAnmeldung = await maxAgent.post('/api/login').send({ name: 'Max Mustermann', password: PASSWORT });
  const maxCookie = (maxAnmeldung.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
  const max = store.findUserByName('Max Mustermann')!;

  const leitungAgent = request.agent(httpServer);
  await leitungAgent.post('/api/login').send({ name: 'Anna Leitung', password: PASSWORT }).expect(200);

  const { socket, verbunden } = starteVerbindung(maxCookie);
  try {
    const getrennt = new Promise<void>((aufloesen) => socket.on('disconnect', () => aufloesen()));
    await verbunden;

    await leitungAgent.delete(`/api/users/${max.id}`).expect(200);
    await getrennt;

    expect(socket.connected).toBe(false);
  } finally {
    socket.close();
  }
});
