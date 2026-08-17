import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// GET all categories for authenticated user
router.get('/', (req, res) => {
  try {
    const categories = db.prepare('SELECT id, name, color, icon FROM categories WHERE user_id = ? ORDER BY created_at ASC').all(req.user.id);
    res.json({ categories });
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST create category
router.post('/', (req, res) => {
  try {
    const { name, color, icon } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const trimmedName = name.trim();

    // Check duplicate
    const existing = db.prepare('SELECT id FROM categories WHERE user_id = ? AND LOWER(name) = LOWER(?)').get(req.user.id, trimmedName);
    if (existing) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    const catId = randomUUID();
    db.prepare(`
      INSERT INTO categories (id, user_id, name, color, icon)
      VALUES (?, ?, ?, ?, ?)
    `).run(catId, req.user.id, trimmedName, color || '#6366f1', icon || 'tag');

    const created = db.prepare('SELECT id, name, color, icon FROM categories WHERE id = ?').get(catId);
    res.status(201).json({ category: created });
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// DELETE category
router.delete('/:id', (req, res) => {
  try {
    const catId = req.params.id;
    const result = db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(catId, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
