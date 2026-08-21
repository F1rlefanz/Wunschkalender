import express, { type NextFunction, type Request, type Response } from 'express';
import session from 'express-session';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import { createDatabase } from './src/server/database';
import { migrateFromJson } from './src/server/migration';
import { ensureManagerAccount } from './src/server/seed';
import { createStore } from './src/server/store';
import { SqliteSessionStore } from './src/server/session-store';
import { resolveSessionSecret } from './src/server/session-secret';
import { leseBetriebsmodus } from './src/server/betriebsmodus';
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from './src/server/passwords';
import { istMonatGesperrt, monatVon } from './src/sperrfrist';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import {
  anmeldungSchema,
  benutzerAendernSchema,
  benutzerAnlegenSchema,
  einstellungenSchema,
  monatParameterSchema,
  stichtagSchema,
  monatshinweisSchema,
  passwortAendernSchema,
  passwortZuruecksetzenSchema,
  pruefe,
  wunschSchema,
} from './src/server/validierung';

const DB_FILE = path.join(process.cwd(), 'data.sqlite');
const LEGACY_JSON = path.join(process.cwd(), 'db.json');
const SECRET_FILE = path.join(process.cwd(), 'sitzungsgeheimnis');

/** Zehn Jahre. "Kein Ablauf" gaebe ein Cookie, das beim Schliessen des Browsers stirbt. */
const COOKIE_MAX_AGE = 10 * 365 * 24 * 60 * 60 * 1000;

async function startServer() {
  const db = createDatabase(DB_FILE);

  const migration = await migrateFromJson(db, LEGACY_JSON);
  if (migration.migrated) {
    console.log(
      `Migration abgeschlossen: ${migration.users} Benutzer, ${migration.wishes} Wuensche, ` +
        `${migration.comments} Hinweise aus db.json uebernommen.`,
    );
    for (const warnung of migration.warnings) console.warn(`  Achtung: ${warnung}`);
  }

  const seed = await ensureManagerAccount(db);
  if (seed.created) {
    console.log(
      [
        '',
        '  ┌────────────────────────────────────────────────┐',
        '  │  Erststart: Leitungskonto angelegt             │',
        '  │                                                │',
        `  │    Name:     ${(seed.name ?? '').padEnd(34)}│`,
        `  │    Passwort: ${(seed.password ?? '').padEnd(34)}│`,
        '  │                                                │',
        '  │  Bitte notieren und nach der ersten Anmeldung  │',
        '  │  im Profil aendern.                            │',
        '  │  Diese Meldung erscheint nur einmal.           │',
        '  └────────────────────────────────────────────────┘',
        '',
      ].join('\n'),
    );
  }

  const store = createStore(db);
  const sessionStore = new SqliteSessionStore(db);
  const secret = resolveSessionSecret(SECRET_FILE, process.env.SESSION_SECRET);
  if (secret.source === 'erzeugt') {
    console.log(`Sitzungsgeheimnis erzeugt und abgelegt unter ${SECRET_FILE}.`);
  }

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const httpServer = http.createServer(app);
  // Ohne cors-Option bedient Socket.IO nur die eigene Herkunft. Frueher stand
  // hier origin: '*' — damit konnte jede beliebige Website mitlesen.
  const io = new SocketIOServer(httpServer);

  // Wie die Anwendung erreichbar ist, sagt der Betrieb ueber die Umgebung —
  // die Vorgabe ist kein Proxy und kein HSTS. Siehe docs/betrieb.md.
  const betrieb = leseBetriebsmodus(process.env);
  // Hinter einem Reverse Proxy muss Express der Weiterleitung glauben, sonst
  // greift `secure: 'auto'` nie. Ohne Proxy waere dasselbe Vertrauen eine
  // Luecke: Dann faelscht jeder Aufrufer `X-Forwarded-Proto` selbst.
  app.set('trust proxy', betrieb.proxyHops > 0 ? betrieb.proxyHops : false);
  if (betrieb.hsts) {
    app.use((_req, res, next) => {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      next();
    });
  }
  // Ohne Grenze nimmt Express Nutzlasten bis 100 kB entgegen. Der groesste
  // echte Koerper hier sind ein paar hundert Zeichen Hinweistext.
  app.use(express.json({ limit: '16kb' }));

  const sessionMiddleware = session({
    name: 'wunschkalender.sid',
    secret: secret.secret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    // `proxy` liest express-session aus den eigenen Optionen, nicht aus app.set.
    proxy: betrieb.proxyHops > 0,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: 'auto',
      maxAge: COOKIE_MAX_AGE,
    },
  });
  app.use(sessionMiddleware);

  // ----- Sitzung und Sockets -----

  /** Trennt offene Socket-Verbindungen zu Sitzungen, die es nicht mehr gibt. */
  const trenneSockets = (sids: string[]) => {
    if (sids.length === 0) return;
    for (const socket of io.sockets.sockets.values()) {
      const sid = (socket.request as any).sessionID;
      if (sid && sids.includes(sid)) socket.disconnect(true);
    }
  };

  // Traegt die Sitzung an socket.request. Weist aber NICHTS ab: engine.use
  // bricht nur bei next(err) ab, und express-session ruft das nie auf.
  io.engine.use(sessionMiddleware);

  // Deshalb hier die eigentliche Abweisung.
  io.use((socket, next) => {
    const userId = (socket.request as any).session?.userId;
    if (!userId) return next(new Error('nicht angemeldet'));
    next();
  });

  io.on('connection', (socket) => {
    socket.emit('init', {
      wishes: store.listWishes(),
      monthlyComments: store.listMonthlyComments(),
      settings: store.getSettings(),
    });
  });

  const broadcastUsers = () => io.emit('users_updated', store.listUsers());
  const broadcastAll = () =>
    io.emit('init', {
      wishes: store.listWishes(),
      monthlyComments: store.listMonthlyComments(),
      settings: store.getSettings(),
    });

  // ----- Anmeldung -----

  /**
   * Zwei Bremsen statt einer: Die erste haelt das Durchprobieren vieler
   * Passwoerter zu *einem* Konto auf, auch wenn es von wechselnden Adressen
   * kommt. Die zweite haelt das Durchprobieren vieler *Konten* mit einem
   * beliebten Passwort von einer Adresse auf. Beide zaehlen nur
   * fehlgeschlagene Versuche — wer das Passwort kennt, merkt nichts davon.
   *
   * Der Preis der Kontobremse: Wer den Namen einer Kollegin kennt, kann sie
   * fuer eine Viertelstunde aussperren. Auf einer Station mit einer Handvoll
   * Konten ist das hinnehmbar; die Alternative — nur nach Adresse zu bremsen —
   * liesse ein Konto von wechselnden Adressen aus beliebig durchprobieren.
   */
  const ANMELDEFENSTER = 15 * 60 * 1000;
  const zuVieleVersuche = (_req: Request, res: Response) =>
    res.status(429).json({
      success: false,
      message: 'Zu viele Anmeldeversuche. Bitte in 15 Minuten noch einmal versuchen.',
    });

  const bremseProKonto = rateLimit({
    windowMs: ANMELDEFENSTER,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Ohne Namen im Koerper faellt der Versuch auf einen gemeinsamen
    // Schluessel zurueck; solche Anfragen scheitern ohnehin.
    keyGenerator: (req) =>
      typeof req.body?.name === 'string' ? `konto:${req.body.name.trim().toLowerCase()}` : 'konto:',
    handler: zuVieleVersuche,
  });

  const bremseProAdresse = rateLimit({
    windowMs: ANMELDEFENSTER,
    limit: 50,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // ipKeyGenerator fasst IPv6-Adressen zu ihrem Praefix zusammen. Ohne das
    // haette jemand mit einem /64-Netz beliebig viele Schluessel.
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
    handler: zuVieleVersuche,
  });

  app.post('/api/login', bremseProAdresse, bremseProKonto, async (req, res) => {
    const eingabe = pruefe(anmeldungSchema, req.body);
    // Auch hier keine genaue Begruendung: was fehlt, sagt der Server nicht.
    if (eingabe.art === 'fehler') {
      return res.status(400).json({ success: false, message: 'Anmeldung fehlgeschlagen.' });
    }
    const { name, password } = eingabe.wert;
    const user = store.findUserByName(name);

    // Bewusst dieselbe Antwort fuer unbekanntes Konto und falsches Passwort:
    // Der Server gibt keine Auskunft darueber, wer existiert.
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      return res.status(401).json({ success: false, message: 'Anmeldung fehlgeschlagen.' });
    }

    // Neue Sitzungskennung nach erfolgreicher Anmeldung (gegen Session-Fixation).
    req.session.regenerate((fehler) => {
      if (fehler) return res.status(500).json({ success: false, message: 'Anmeldung fehlgeschlagen.' });
      req.session.userId = user.id;
      req.session.save((speicherFehler) => {
        if (speicherFehler) {
          return res.status(500).json({ success: false, message: 'Anmeldung fehlgeschlagen.' });
        }
        res.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
      });
    });
  });

  app.post('/api/logout', (req, res) => {
    const sid = req.sessionID;
    req.session.destroy(() => {
      trenneSockets([sid]);
      res.clearCookie('wunschkalender.sid');
      res.json({ success: true });
    });
  });

  /** Sagt der Oberflaeche beim Start, wer angemeldet ist — Grundlage dafuer,
   *  dass ein Neuladen nicht mehr aus der Anwendung wirft. */
  app.get('/api/me', (req, res) => {
    const userId = req.session.userId;
    const user = userId ? store.findUserById(userId) : undefined;
    if (!user) return res.status(401).json({ user: null });
    res.json({ user });
  });

  // ----- Ab hier ist eine Anmeldung Pflicht -----

  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId || !store.findUserById(req.session.userId)) {
      return res.status(401).json({ error: 'Nicht angemeldet.' });
    }
    next();
  };

  const requireManager = (req: Request, res: Response, next: NextFunction) => {
    const user = req.session.userId ? store.findUserById(req.session.userId) : undefined;
    if (!user) return res.status(401).json({ error: 'Nicht angemeldet.' });
    if (user.role !== 'Manager') {
      return res.status(403).json({ error: 'Diese Aktion ist der Stationsleitung vorbehalten.' });
    }
    next();
  };

  app.use('/api', requireAuth);

  /**
   * Prueft die Sperrfrist serverseitig. Bisher stand sie nur in der Oberflaeche
   * und liess sich mit einem direkten Aufruf umgehen.
   */
  const sperrfristVerletzt = (req: Request, monat: string): string | null => {
    const user = store.findUserById(req.session.userId!)!;
    const { vorlaufTage, stichtage } = store.getSettings();
    if (!istMonatGesperrt({ monat, vorlaufTage, stichtage, rolle: user.role })) {
      return null;
    }
    return `Der Monat ${monat} ist fuer Eintragungen gesperrt.`;
  };

  // ----- Benutzer -----

  app.get('/api/users', (_req, res) => {
    res.json(store.listUsers());
  });

  app.post('/api/users', requireManager, async (req, res) => {
    const eingabe = pruefe(benutzerAnlegenSchema, req.body);
    if (eingabe.art === 'fehler') return res.status(400).json({ error: eingabe.fehler });
    const { name, role, password } = eingabe.wert;

    if (store.findUserByName(name)) {
      return res.status(409).json({
        error: `Der Name "${name.trim()}" ist bereits vergeben. Namen muessen eindeutig sein.`,
      });
    }

    try {
      const passwordHash = await hashPassword(password);
      const user = store.createUser({ name, role, passwordHash });
      broadcastUsers();
      res.json({ success: true, user });
    } catch (fehler) {
      res.status(400).json({ error: (fehler as Error).message });
    }
  });

  app.put('/api/users/:id', requireManager, (req, res) => {
    // Nimmt bewusst kein `password` mehr entgegen: Frueher umging dieses Feld
    // die Pruefung des alten Passworts, die /password vornimmt.
    const eingabe = pruefe(benutzerAendernSchema, req.body);
    if (eingabe.art === 'fehler') return res.status(400).json({ error: eingabe.fehler });
    const { name, role } = eingabe.wert;

    if (name !== undefined) {
      const belegt = store.findUserByName(name);
      if (belegt && belegt.id !== req.params.id) {
        return res.status(409).json({ error: `Der Name "${name.trim()}" ist bereits vergeben.` });
      }
    }

    const geaendert = store.updateUser(req.params.id, { name, role });
    if (!geaendert) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });

    broadcastUsers();
    res.json({ success: true });
  });

  /** Das eigene Passwort aendern. Nur fuer das eigene Konto. */
  app.put('/api/users/:id/password', async (req, res) => {
    if (req.params.id !== req.session.userId) {
      return res.status(403).json({ error: 'Nur das eigene Passwort laesst sich so aendern.' });
    }

    const eingabe = pruefe(passwortAendernSchema, req.body);
    if (eingabe.art === 'fehler') return res.status(400).json({ success: false, message: eingabe.fehler });
    const { oldPassword, newPassword } = eingabe.wert;
    const user = store.findUserWithHash(req.params.id)!;

    if (!(await verifyPassword(user.passwordHash, oldPassword))) {
      return res.status(401).json({ success: false, message: 'Altes Passwort ist falsch.' });
    }

    try {
      store.setPasswordHash(user.id, await hashPassword(newPassword));
      // Andere Geraete abmelden — aber nicht die Sitzung, die gerade aendert.
      // Sonst meldete die Oberflaeche Erfolg, waehrend der Server bereits 401 gibt.
      trenneSockets(sessionStore.destroyByUser(user.id, { except: req.sessionID }));
      res.json({ success: true });
    } catch (fehler) {
      res.status(400).json({ success: false, message: (fehler as Error).message });
    }
  });

  /** Die Leitung setzt ein neues Passwort — ersetzt den entfernten Reset-Weg. */
  app.put('/api/users/:id/reset-password', requireManager, async (req, res) => {
    const eingabe = pruefe(passwortZuruecksetzenSchema, req.body);
    if (eingabe.art === 'fehler') return res.status(400).json({ success: false, message: eingabe.fehler });
    const { newPassword } = eingabe.wert;

    if (!store.findUserById(req.params.id)) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    }

    try {
      store.setPasswordHash(req.params.id, await hashPassword(newPassword));
      trenneSockets(sessionStore.destroyByUser(req.params.id, { except: req.sessionID }));
      res.json({ success: true });
    } catch (fehler) {
      res.status(400).json({ success: false, message: (fehler as Error).message });
    }
  });

  app.delete('/api/users/:id', requireManager, (req, res) => {
    if (req.params.id === req.session.userId) {
      return res.status(400).json({ error: 'Das eigene Konto laesst sich nicht loeschen.' });
    }

    const sids = sessionStore.destroyByUser(req.params.id);
    if (!store.deleteUser(req.params.id)) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    }
    trenneSockets(sids);
    broadcastUsers();
    // Wuensche und Hinweise sind per ON DELETE CASCADE mitgegangen.
    broadcastAll();
    res.json({ success: true });
  });

  // ----- Einstellungen -----

  app.get('/api/settings', (_req, res) => {
    res.json(store.getSettings());
  });

  app.post('/api/settings', requireManager, (req, res) => {
    const eingabe = pruefe(einstellungenSchema, req.body);
    if (eingabe.art === 'fehler') return res.status(400).json({ error: eingabe.fehler });

    const settings = store.setVorlaufTage(eingabe.wert.vorlaufTage);
    io.emit('settings_updated', settings);
    res.json(settings);
  });

  // ----- Stichtage einzelner Monate -----
  //
  // Beide Wege senden dieselben vollstaendigen Einstellungen zurueck: Ein
  // Kanal, ein Listener in der Oberflaeche. Der Monat steht im Pfad und wird
  // genauso geprueft wie ein Feld im Koerper — er landet in der Datenbank.

  app.put('/api/stichtage/:monat', requireManager, (req, res) => {
    const monat = pruefe(monatParameterSchema, req.params.monat);
    if (monat.art === 'fehler') return res.status(400).json({ error: monat.fehler });

    const eingabe = pruefe(stichtagSchema, req.body);
    if (eingabe.art === 'fehler') return res.status(400).json({ error: eingabe.fehler });

    const settings = store.setStichtag(monat.wert, eingabe.wert.datum);
    io.emit('settings_updated', settings);
    res.json(settings);
  });

  app.delete('/api/stichtage/:monat', requireManager, (req, res) => {
    const monat = pruefe(monatParameterSchema, req.params.monat);
    if (monat.art === 'fehler') return res.status(400).json({ error: monat.fehler });

    // Zurueck zum automatischen Vorschlag.
    const settings = store.loescheStichtag(monat.wert);
    io.emit('settings_updated', settings);
    res.json(settings);
  });

  // ----- Wuensche -----

  app.get('/api/wishes', (_req, res) => {
    res.json(store.listWishes());
  });

  app.post('/api/wishes', (req, res) => {
    // Die userId stammt aus der Sitzung, niemals aus dem Koerper.
    const userId = req.session.userId!;
    const eingabe = pruefe(wunschSchema, req.body);
    if (eingabe.art === 'fehler') return res.status(400).json({ error: eingabe.fehler });
    const { date, shiftType, comment } = eingabe.wert;

    const gesperrt = sperrfristVerletzt(req, monatVon(date));
    if (gesperrt) return res.status(403).json({ error: gesperrt });

    const wish = store.addWish({ userId, date, shiftType, comment });
    io.emit('wish_added', wish);
    res.json(wish);
  });

  app.delete('/api/wishes/:id', (req, res) => {
    const wish = store.findWish(req.params.id);
    if (!wish) return res.status(404).json({ error: 'Wunsch nicht gefunden.' });

    const user = store.findUserById(req.session.userId!)!;
    if (wish.userId !== user.id && user.role !== 'Manager') {
      return res.status(403).json({ error: 'Nur eigene Wuensche lassen sich loeschen.' });
    }

    // Auch das Loeschen faellt unter die Sperrfrist. Nur das Anlegen zu pruefen
    // liesse eine Hintertuer: Ein bereits eingeplanter Wunsch verschwaende
    // nachtraeglich aus dem Monat, den die Leitung schon bearbeitet.
    const gesperrt = sperrfristVerletzt(req, monatVon(wish.date));
    if (gesperrt) return res.status(403).json({ error: gesperrt });

    store.deleteWish(req.params.id);
    io.emit('wish_deleted', req.params.id);
    res.json({ success: true });
  });

  // ----- Monatshinweise -----

  app.get('/api/monthly-comments', (req, res) => {
    const month = req.query.month as string | undefined;
    const userId = req.query.userId as string | undefined;
    let comments = store.listMonthlyComments();
    if (month) comments = comments.filter((c) => c.month === month);
    if (userId) comments = comments.filter((c) => c.userId === userId);
    res.json(comments);
  });

  app.post('/api/monthly-comments', (req, res) => {
    const userId = req.session.userId!;
    const eingabe = pruefe(monatshinweisSchema, req.body);
    if (eingabe.art === 'fehler') return res.status(400).json({ error: eingabe.fehler });
    const { month, text } = eingabe.wert;

    const gesperrt = sperrfristVerletzt(req, month);
    if (gesperrt) return res.status(403).json({ error: gesperrt });

    const vorher = store.listMonthlyComments().some((c) => c.userId === userId && c.month === month);
    const comment = store.saveMonthlyComment({ userId, month, text });
    io.emit(vorher ? 'monthly_comment_updated' : 'monthly_comment_added', comment);
    res.json(comment);
  });

  // ----- Auslieferung -----

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (betrieb.warnung) {
    console.warn(`WARNUNG: ${betrieb.warnung}`);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Server laeuft auf Port ${PORT} (Mindestlaenge fuer Passwoerter: ${MIN_PASSWORD_LENGTH}, ` +
        `Sitzungsgeheimnis: ${secret.source}, vertraute Proxys: ${betrieb.proxyHops}, ` +
        `HSTS: ${betrieb.hsts ? 'an' : 'aus'})`,
    );
  });
}

startServer();
