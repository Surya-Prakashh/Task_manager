import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// GET all categories for authenticated user
router.get('/', async (req, res) => {
  try {
    const categories = await db.getAll(
      'SELECT id, name, color, icon FROM categories WHERE user_id = $1 ORDER BY created_at ASC',
      [req.user.id]
    );
    res.json({ categories });
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST create category
router.post('/', async (req, res) => {
  try {
    const { name, color, icon } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const trimmedName = name.trim();

    // Check duplicate
    const existing = await db.getOne(
      'SELECT id FROM categories WHERE user_id = $1 AND LOWER(name) = LOWER($2)',
      [req.user.id, trimmedName]
    );
    if (existing) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    const catId = randomUUID();
    await db.execute(
      'INSERT INTO categories (id, user_id, name, color, icon) VALUES ($1, $2, $3, $4, $5)',
      [catId, req.user.id, trimmedName, color || '#6366f1', icon || 'tag']
    );

    const created = await db.getOne('SELECT id, name, color, icon FROM categories WHERE id = $1', [catId]);
    res.status(201).json({ category: created });
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// DELETE category
router.delete('/:id', async (req, res) => {
  try {
    const catId = req.params.id;
    const result = await db.execute('DELETE FROM categories WHERE id = $1 AND user_id = $2', [catId, req.user.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
