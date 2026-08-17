import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { initDB } from './server/db.js';
import authRoutes from './server/routes/auth.js';
import tasksRoutes from './server/routes/tasks.js';
import categoriesRoutes from './server/routes/categories.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database
initDB();

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
  res.json({ status: 'ok', timestamp: new Date().toISOString(), app: 'TaskFlow' });
});

// Serve Static Frontend Assets (PWA)
app.use(express.static(__dirname));

// Fallback to index.html for SPA/PWA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TaskFlow Production Server is running on http://localhost:${PORT}`);
});
