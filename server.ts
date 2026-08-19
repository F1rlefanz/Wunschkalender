import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import { createDatabase } from './src/server/database';
import { migrateFromJson } from './src/server/migration';
import { ensureManagerAccount } from './src/server/seed';
import { createStore } from './src/server/store';
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from './src/server/passwords';

const DB_FILE = path.join(process.cwd(), 'data.sqlite');
const LEGACY_JSON = path.join(process.cwd(), 'db.json');

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

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer);

  app.use(express.json());

  io.on('connection', (socket) => {
    socket.emit('init', {
      wishes: store.listWishes(),
      monthlyComments: store.listMonthlyComments(),
      settings: store.getSettings(),
    });
  });

  const broadcastUsers = () => io.emit('users_updated', store.listUsers());

  // ----- Benutzer -----

  app.get('/api/users', (_req, res) => {
    res.json(store.listUsers());
  });

  app.post('/api/login', async (req, res) => {
    const { userId, password } = req.body ?? {};
    const user = typeof userId === 'string' ? store.findUserWithHash(userId) : undefined;

    // Bewusst dieselbe Antwort fuer unbekanntes Konto und falsches Passwort:
    // Der Server gibt keine Auskunft darueber, wer existiert.
    if (!user || !(await verifyPassword(user.passwordHash, String(password ?? '')))) {
      return res.status(401).json({ success: false, message: 'Anmeldung fehlgeschlagen.' });
    }

    res.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
  });

  app.post('/api/users', async (req, res) => {
    const { name, role, password } = req.body ?? {};
    if (typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Name fehlt.' });
    }
    if (store.findUserByName(name)) {
      return res.status(409).json({
        error: `Der Name "${name.trim()}" ist bereits vergeben. Namen muessen eindeutig sein.`,
      });
    }

    try {
      const passwordHash = await hashPassword(String(password ?? ''));
      const user = store.createUser({
        name,
        role: role === 'Manager' ? 'Manager' : 'Employee',
        passwordHash,
      });
      broadcastUsers();
      res.json({ success: true, user });
    } catch (fehler) {
      res.status(400).json({ error: (fehler as Error).message });
    }
  });

  app.put('/api/users/:id', (req, res) => {
    // Nimmt bewusst kein `password` mehr entgegen: Frueher umging dieses Feld
    // die Pruefung des alten Passworts, die /password vornimmt.
    const { name, role } = req.body ?? {};

    if (typeof name === 'string' && name.trim() !== '') {
      const belegt = store.findUserByName(name);
      if (belegt && belegt.id !== req.params.id) {
        return res.status(409).json({ error: `Der Name "${name.trim()}" ist bereits vergeben.` });
      }
    }

    const geaendert = store.updateUser(req.params.id, {
      name: typeof name === 'string' ? name : undefined,
      role: role === 'Manager' || role === 'Employee' ? role : undefined,
    });
    if (!geaendert) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });

    broadcastUsers();
    res.json({ success: true });
  });

  app.put('/api/users/:id/password', async (req, res) => {
    const { oldPassword, newPassword } = req.body ?? {};
    const user = store.findUserWithHash(req.params.id);
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });

    if (!(await verifyPassword(user.passwordHash, String(oldPassword ?? '')))) {
      return res.status(401).json({ success: false, message: 'Altes Passwort ist falsch.' });
    }

    try {
      store.setPasswordHash(user.id, await hashPassword(String(newPassword ?? '')));
      res.json({ success: true });
    } catch (fehler) {
      res.status(400).json({ success: false, message: (fehler as Error).message });
    }
  });

  /** Die Leitung setzt ein neues Passwort — ersetzt den entfernten Reset-Weg. */
  app.put('/api/users/:id/reset-password', async (req, res) => {
    const { newPassword } = req.body ?? {};
    if (!store.findUserById(req.params.id)) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    }

    try {
      store.setPasswordHash(req.params.id, await hashPassword(String(newPassword ?? '')));
      res.json({ success: true });
    } catch (fehler) {
      res.status(400).json({ success: false, message: (fehler as Error).message });
    }
  });

  app.delete('/api/users/:id', (req, res) => {
    if (!store.deleteUser(req.params.id)) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    }
    broadcastUsers();
    // Wuensche und Hinweise sind per ON DELETE CASCADE mitgegangen; die Clients
    // brauchen deshalb einen frischen Stand.
    io.emit('init', {
      wishes: store.listWishes(),
      monthlyComments: store.listMonthlyComments(),
      settings: store.getSettings(),
    });
    res.json({ success: true });
  });

  // ----- Einstellungen -----

  app.get('/api/settings', (_req, res) => {
    res.json(store.getSettings());
  });

  app.post('/api/settings', (req, res) => {
    const { bookingDeadlineDay } = req.body ?? {};
    if (!Number.isInteger(bookingDeadlineDay) || bookingDeadlineDay < 1 || bookingDeadlineDay > 31) {
      return res.status(400).json({ error: 'bookingDeadlineDay muss eine Zahl zwischen 1 und 31 sein.' });
    }
    const settings = store.setBookingDeadlineDay(bookingDeadlineDay);
    io.emit('settings_updated', settings);
    res.json(settings);
  });

  // ----- Wuensche -----

  app.get('/api/wishes', (_req, res) => {
    res.json(store.listWishes());
  });

  app.post('/api/wishes', (req, res) => {
    const { userId, date, shiftType, comment } = req.body ?? {};
    if (!userId || !date || !shiftType) {
      return res.status(400).json({ error: 'userId, date und shiftType sind erforderlich.' });
    }
    if (!store.findUserById(userId)) {
      return res.status(400).json({ error: 'Unbekannter Benutzer.' });
    }

    const wish = store.addWish({ userId, date, shiftType, comment: comment ?? '' });
    io.emit('wish_added', wish);
    res.json(wish);
  });

  app.delete('/api/wishes/:id', (req, res) => {
    if (!store.findWish(req.params.id)) {
      return res.status(404).json({ error: 'Wunsch nicht gefunden.' });
    }
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
    const { userId, month, text } = req.body ?? {};
    if (!userId || !month) {
      return res.status(400).json({ error: 'userId und month sind erforderlich.' });
    }
    if (!store.findUserById(userId)) {
      return res.status(400).json({ error: 'Unbekannter Benutzer.' });
    }

    const vorher = store.listMonthlyComments().some((c) => c.userId === userId && c.month === month);
    const comment = store.saveMonthlyComment({ userId, month, text: text ?? '' });
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

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server laeuft auf Port ${PORT} (Mindestlaenge fuer Passwoerter: ${MIN_PASSWORD_LENGTH})`);
  });
}

startServer();
