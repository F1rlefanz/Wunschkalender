/**
 * Startet die **gebaute** Anwendung gegen eine frische Testdatenbank.
 *
 * Bewusst `auslieferung: 'statisch'` statt Vite: So laeuft im Browser genau das
 * Bundle, das auch ausgeliefert wird. Dafuer muss `npm run build` vorher
 * gelaufen sein.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { erzeugeApp } from '../src/server/app';
import { createDatabase } from '../src/server/database';
import { createStore } from '../src/server/store';
import { hashPassword } from '../src/server/passwords';
import { GESPERRTER_MONAT, KONTEN, OFFENER_MONAT } from './hilfe';

const PORT = Number(process.env.E2E_PORT) || 3100;

async function start() {
  const dist = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    throw new Error('dist/index.html fehlt — bitte zuerst `npm run build` ausfuehren.');
  }

  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'wunschkalender-e2e-'));
  const db = createDatabase(path.join(ordner, 'test.sqlite'));
  const store = createStore(db);

  const hash = await hashPassword(KONTEN.leitung.passwort);
  store.createUser({ name: KONTEN.leitung.name, role: 'Manager', passwordHash: hash });
  store.createUser({ name: KONTEN.mitarbeit.name, role: 'Employee', passwordHash: hash });
  store.createUser({ name: KONTEN.zweite.name, role: 'Employee', passwordHash: hash });

  // Ausdrueckliche Stichtage: Damit haengt kein Browsertest daran, welcher Tag
  // heute ist.
  store.setStichtag(OFFENER_MONAT, '2099-12-31');
  store.setStichtag(GESPERRTER_MONAT, '2020-01-01');
  // Fuer den Jahreswechsel-Test in Task 9.
  store.setStichtag('2098-12', '2099-12-31');
  store.setStichtag('2099-01', '2099-12-31');

  const { httpServer } = await erzeugeApp({
    db,
    sitzungsgeheimnis: 'geheimnis-nur-fuer-e2e',
    betrieb: { proxyHops: 0, hsts: false, warnung: null },
    auslieferung: 'statisch',
    distPfad: dist,
  });

  httpServer.listen(PORT, '127.0.0.1', () => {
    console.log(`E2E-Server laeuft auf http://127.0.0.1:${PORT} (Daten in ${ordner})`);
  });

  const aufraeumen = () => {
    db.close();
    fs.rmSync(ordner, { recursive: true, force: true });
    process.exit(0);
  };
  process.on('SIGTERM', aufraeumen);
  process.on('SIGINT', aufraeumen);
}

start();
