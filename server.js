import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import db, { initDB, closeDB } from './server/db.js';
import authRoutes from './server/routes/auth.js';
import tasksRoutes from './server/routes/tasks.js';
import categoriesRoutes from './server/routes/categories.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database on startup
initDB().catch(err => {
  console.error('Database initialization error at startup:', err);
});

// Security Middlewares (configured to allow inline PWA scripts and Google fonts)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// REST API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/categories', categoriesRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    app: 'TaskFlow',
    database: db.isPostgres ? 'postgresql' : 'sqlite',
    persistentStorage: true
  });
});

// Serve Static Frontend Assets (when running local Node server)
if (!process.env.VERCEL) {
  app.use(express.static(__dirname));

  // Fallback to index.html for SPA/PWA routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });
}

// Start Server (only when not in Vercel serverless environment)
let server = null;
if (!process.env.VERCEL) {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TaskFlow Server is running on http://localhost:${PORT} [DB: ${db.isPostgres ? 'PostgreSQL' : 'SQLite'}]`);
  });
}

// Graceful Shutdown Handler for Persistent Database Durability
async function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Flushing persistent database and shutting down...`);
  if (server) {
    server.close(async () => {
      await closeDB();
      console.log('✅ Server and persistent database closed gracefully.');
      process.exit(0);
    });
  } else {
    await closeDB();
    process.exit(0);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export default app;
