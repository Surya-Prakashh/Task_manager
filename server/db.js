import pg from 'pg';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const isPostgres = Boolean(connectionString);

let pgPool = null;
let sqliteDb = null;

if (isPostgres) {
  const { Pool } = pg;
  pgPool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  console.log('🐘 PostgreSQL client initialized (Vercel / Cloud Database mode)');
} else {
  const dataDir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : (process.env.VERCEL ? path.join('/tmp', 'data') : path.join(__dirname, '..', 'data'));

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'taskflow.db');
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('synchronous = NORMAL');
  sqliteDb.pragma('foreign_keys = ON');
  sqliteDb.pragma('busy_timeout = 5000');
  console.log('📦 Local SQLite persistent storage initialized at:', dbPath);
}

// Convert $1, $2 to ? for SQLite fallback
function formatQueryForSQLite(sql) {
  return sql.replace(/\$(\d+)/g, '?');
}

let initPromise = null;

export async function initDB() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (isPostgres) {
        // 1. Users Table
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // 2. Categories Table
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#6366f1',
            icon TEXT DEFAULT 'tag',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // 3. Tasks Table
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            category TEXT DEFAULT 'Personal',
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'todo',
            due_date TEXT,
            due_time TEXT,
            reminder INTEGER DEFAULT 0,
            pinned INTEGER DEFAULT 0,
            subtasks TEXT DEFAULT '[]',
            tags TEXT DEFAULT '[]',
            task_order INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP WITH TIME ZONE
          );
        `);

        console.log('✅ PostgreSQL database tables verified/initialized successfully');
      } else {
        // 1. Users Table
        sqliteDb.exec(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // 2. Categories Table
        sqliteDb.exec(`
          CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#6366f1',
            icon TEXT DEFAULT 'tag',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          );
        `);

        // 3. Tasks Table
        sqliteDb.exec(`
          CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            category TEXT DEFAULT 'Personal',
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'todo',
            due_date TEXT,
            due_time TEXT,
            reminder INTEGER DEFAULT 0,
            pinned INTEGER DEFAULT 0,
            subtasks TEXT DEFAULT '[]',
            tags TEXT DEFAULT '[]',
            task_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          );
        `);

        console.log('✅ SQLite database tables verified/initialized successfully');
      }
    } catch (err) {
      console.error('Error during database initialization:', err);
      initPromise = null; // Allow retry on failure
      throw err;
    }
  })();

  return initPromise;
}

// Unified Database Access Helpers
export const db = {
  isPostgres,

  async query(sql, params = []) {
    await initDB();
    if (isPostgres) {
      const res = await pgPool.query(sql, params);
      return res;
    } else {
      const sqliteSql = formatQueryForSQLite(sql);
      const stmt = sqliteDb.prepare(sqliteSql);
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        const rows = stmt.all(...params);
        return { rows, rowCount: rows.length };
      } else {
        const info = stmt.run(...params);
        return { rows: [], rowCount: info.changes, changes: info.changes };
      }
    }
  },

  async getOne(sql, params = []) {
    await initDB();
    if (isPostgres) {
      const res = await pgPool.query(sql, params);
      return res.rows[0] || null;
    } else {
      const sqliteSql = formatQueryForSQLite(sql);
      const row = sqliteDb.prepare(sqliteSql).get(...params);
      return row || null;
    }
  },

  async getAll(sql, params = []) {
    await initDB();
    if (isPostgres) {
      const res = await pgPool.query(sql, params);
      return res.rows;
    } else {
      const sqliteSql = formatQueryForSQLite(sql);
      return sqliteDb.prepare(sqliteSql).all(...params);
    }
  },

  async execute(sql, params = []) {
    await initDB();
    if (isPostgres) {
      const res = await pgPool.query(sql, params);
      return { rowCount: res.rowCount };
    } else {
      const sqliteSql = formatQueryForSQLite(sql);
      const info = sqliteDb.prepare(sqliteSql).run(...params);
      return { rowCount: info.changes, changes: info.changes };
    }
  }
};

export async function closeDB() {
  try {
    if (isPostgres && pgPool) {
      await pgPool.end();
      console.log('🐘 PostgreSQL pool closed safely.');
    } else if (sqliteDb) {
      sqliteDb.pragma('wal_checkpoint(TRUNCATE)');
      sqliteDb.close();
      console.log('📦 SQLite database closed safely with WAL checkpoint.');
    }
  } catch (err) {
    console.error('Error during database close:', err);
  }
}

export default db;
