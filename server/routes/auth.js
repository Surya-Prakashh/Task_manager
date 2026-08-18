import express from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const DEFAULT_CATEGORIES = [
  { name: 'Work', color: '#6366f1', icon: 'briefcase' },
  { name: 'Personal', color: '#ec4899', icon: 'user' },
  { name: 'Study', color: '#8b5cf6', icon: 'book' },
  { name: 'Health', color: '#10b981', icon: 'activity' },
  { name: 'Finance', color: '#f59e0b', icon: 'dollar-sign' }
];

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const trimmedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existing = await db.getOne('SELECT id FROM users WHERE email = $1', [trimmedEmail]);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = randomUUID();

    // Insert user
    await db.execute(
      'INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4)',
      [userId, trimmedEmail, passwordHash, name.trim()]
    );

    // Seed default categories for new user
    for (const cat of DEFAULT_CATEGORIES) {
      await db.execute(
        'INSERT INTO categories (id, user_id, name, color, icon) VALUES ($1, $2, $3, $4, $5)',
        [randomUUID(), userId, cat.name, cat.color, cat.icon]
      );
    }

    const user = { id: userId, email: trimmedEmail, name: name.trim() };
    const token = generateToken(user);

    res.status(201).json({
      message: 'Account registered successfully',
      user,
      token
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const trimmedEmail = email.toLowerCase().trim();
    const user = await db.getOne('SELECT * FROM users WHERE email = $1', [trimmedEmail]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const userPayload = { id: user.id, email: user.email, name: user.name };
    const token = generateToken(userPayload);

    res.json({
      message: 'Login successful',
      user: userPayload,
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get Current User Profile
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

export default router;
