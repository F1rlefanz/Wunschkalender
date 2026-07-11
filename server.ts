import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import fs from 'fs';

const DB_FILE = path.join(process.cwd(), 'db.json');

// Simulated Vercel KV storage (File-based)
let memoryStore = {
  settings: {
    bookingDeadlineDay: 15, // Lock bookings for next month on the 15th of current month
  },
  users: [
    { id: 'u1', name: 'Max Mustermann', role: 'Employee', password: 'password' },
    { id: 'u2', name: 'Anna Schmidt', role: 'Manager', password: 'password' },
    { id: 'u3', name: 'Thomas Müller', role: 'Employee', password: 'password' },
    { id: 'u4', name: 'Laura Weber', role: 'Employee', password: 'password' },
    { id: 'u5', name: 'Jan Becker', role: 'Manager', password: 'password' },
  ] as any[],
  wishes: [] as any[],
  monthlyComments: [] as any[],
};

if (fs.existsSync(DB_FILE)) {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    memoryStore = JSON.parse(data);
  } catch (err) {
    console.error('Error reading db.json:', err);
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(memoryStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing db.json:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' }
  });

  app.use(express.json());

  // Socket.IO
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    // Send initial state on connection
    socket.emit('init', {
      wishes: memoryStore.wishes,
      monthlyComments: memoryStore.monthlyComments,
      settings: memoryStore.settings
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // API Routes
  app.get('/api/users', (req, res) => {
    // Return users without passwords
    const safeUsers = memoryStore.users.map(u => ({ id: u.id, name: u.name, role: u.role }));
    res.json(safeUsers);
  });

  app.post('/api/login', (req, res) => {
    const { userId, password } = req.body;
    const user = memoryStore.users.find(u => u.id === userId);
    
    if (user && user.password === password) {
      res.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
    } else {
      res.status(401).json({ success: false, message: 'Falsches Passwort' });
    }
  });

  app.post('/api/users', (req, res) => {
    const { name, role, password } = req.body;
    const newUser = {
      id: 'u' + Date.now(),
      name,
      role,
      password: password || 'start123'
    };
    memoryStore.users.push(newUser);
    saveDb();
    
    // Notify clients about user changes so they can update their view
    io.emit('users_updated', memoryStore.users.map(u => ({ id: u.id, name: u.name, role: u.role })));
    res.json({ success: true });
  });

  app.put('/api/users/:id', (req, res) => {
    const { name, role, password } = req.body;
    const userIndex = memoryStore.users.findIndex(u => u.id === req.params.id);
    if (userIndex >= 0) {
      if (name) memoryStore.users[userIndex].name = name;
      if (role) memoryStore.users[userIndex].role = role;
      if (password) memoryStore.users[userIndex].password = password;
      saveDb();
      io.emit('users_updated', memoryStore.users.map(u => ({ id: u.id, name: u.name, role: u.role })));
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  });

  app.put('/api/users/:id/password', (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userIndex = memoryStore.users.findIndex(u => u.id === req.params.id);
    if (userIndex >= 0) {
      if (memoryStore.users[userIndex].password === oldPassword) {
        memoryStore.users[userIndex].password = newPassword;
        saveDb();
        res.json({ success: true });
      } else {
        res.status(401).json({ success: false, message: 'Altes Passwort ist falsch' });
      }
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  });

  app.post('/api/forgot-password', (req, res) => {
    const { userId } = req.body;
    const user = memoryStore.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit
    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 15 * 60 * 1000; // 15 mins
    saveDb();

    // Return the token to simulate an email
    res.json({ success: true, simulatedEmailToken: token });
  });

  app.post('/api/reset-password', (req, res) => {
    const { userId, token, newPassword } = req.body;
    const user = memoryStore.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.resetToken !== token || Date.now() > (user.resetTokenExpiry || 0)) {
      return res.status(400).json({ success: false, message: 'Token ungültig oder abgelaufen' });
    }

    user.password = newPassword;
    delete user.resetToken;
    delete user.resetTokenExpiry;
    saveDb();

    res.json({ success: true });
  });

  app.delete('/api/users/:id', (req, res) => {
    memoryStore.users = memoryStore.users.filter(u => u.id !== req.params.id);
    saveDb();
    io.emit('users_updated', memoryStore.users.map(u => ({ id: u.id, name: u.name, role: u.role })));
    res.json({ success: true });
  });

  app.get('/api/settings', (req, res) => {
    res.json(memoryStore.settings);
  });

  app.post('/api/settings', (req, res) => {
    const { bookingDeadlineDay } = req.body;
    if (typeof bookingDeadlineDay === 'number') {
      memoryStore.settings.bookingDeadlineDay = bookingDeadlineDay;
      saveDb();
      io.emit('settings_updated', memoryStore.settings);
      res.json(memoryStore.settings);
    } else {
      res.status(400).json({ error: 'Invalid settings' });
    }
  });

  app.get('/api/wishes', (req, res) => {
    res.json(memoryStore.wishes);
  });

  app.post('/api/wishes', (req, res) => {
    const wish = req.body;
    wish.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    memoryStore.wishes.push(wish);
    saveDb();
    io.emit('wish_added', wish);
    res.json(wish);
  });

  app.delete('/api/wishes/:id', (req, res) => {
    const id = req.params.id;
    memoryStore.wishes = memoryStore.wishes.filter(w => w.id !== id);
    saveDb();
    io.emit('wish_deleted', id);
    res.json({ success: true });
  });

  app.get('/api/monthly-comments', (req, res) => {
    const month = req.query.month as string;
    const userId = req.query.userId as string;
    let comments = memoryStore.monthlyComments;
    if (month) comments = comments.filter(c => c.month === month);
    if (userId) comments = comments.filter(c => c.userId === userId);
    res.json(comments);
  });

  app.post('/api/monthly-comments', (req, res) => {
    const { userId, month, text } = req.body;
    const existingIndex = memoryStore.monthlyComments.findIndex(c => c.userId === userId && c.month === month);
    if (existingIndex >= 0) {
      memoryStore.monthlyComments[existingIndex].text = text;
      saveDb();
      io.emit('monthly_comment_updated', memoryStore.monthlyComments[existingIndex]);
      res.json(memoryStore.monthlyComments[existingIndex]);
    } else {
      const newComment = { id: Date.now().toString(), userId, month, text };
      memoryStore.monthlyComments.push(newComment);
      saveDb();
      io.emit('monthly_comment_added', newComment);
      res.json(newComment);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
