import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

// Simulated Vercel KV storage (In-Memory)
const memoryStore = {
  wishes: [
    {
      id: '1',
      employeeName: 'Max Mustermann',
      date: new Date().toISOString().split('T')[0],
      comment: 'Arzttermin',
      shiftType: 'Frei',
    }
  ] as any[],
  monthlyComments: [] as any[],
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post('/api/verify-password', (req, res) => {
    const { password } = req.body;
    // Simple Gatekeeper demo password
    if (password === 'demo123') {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: 'Falsches Passwort' });
    }
  });

  // Simulated Vercel Serverless Function: get.ts
  app.get('/api/wishes', (req, res) => {
    res.json(memoryStore.wishes);
  });

  // Simulated Vercel Serverless Function: post.ts
  app.post('/api/wishes', (req, res) => {
    const wish = req.body;
    wish.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    memoryStore.wishes.push(wish);
    res.json(wish);
  });

  app.get('/api/monthly-comments', (req, res) => {
    const month = req.query.month as string;
    const employeeName = req.query.employeeName as string;
    let comments = memoryStore.monthlyComments;
    if (month) comments = comments.filter(c => c.month === month);
    if (employeeName) comments = comments.filter(c => c.employeeName === employeeName);
    res.json(comments);
  });

  app.post('/api/monthly-comments', (req, res) => {
    const { employeeName, month, text } = req.body;
    const existingIndex = memoryStore.monthlyComments.findIndex(c => c.employeeName === employeeName && c.month === month);
    if (existingIndex >= 0) {
      memoryStore.monthlyComments[existingIndex].text = text;
      res.json(memoryStore.monthlyComments[existingIndex]);
    } else {
      const newComment = { id: Date.now().toString(), employeeName, month, text };
      memoryStore.monthlyComments.push(newComment);
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
