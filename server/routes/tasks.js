import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply auth to all task routes
router.use(authenticateToken);

// Helper: Safely parse JSON or return existing object/array
function safeJsonParse(data, fallback = []) {
  if (!data) return fallback;
  if (typeof data === 'object') return data;
  try {
    return JSON.parse(data);
  } catch (e) {
    return fallback;
  }
}

// Helper: Format DB row to frontend task object
function formatTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: row.category || 'Personal',
    priority: row.priority || 'medium',
    status: row.status || 'todo',
    dueDate: row.due_date,
    dueTime: row.due_time,
    reminder: Boolean(row.reminder),
    pinned: Boolean(row.pinned),
    subtasks: safeJsonParse(row.subtasks, []),
    tags: safeJsonParse(row.tags, []),
    order: Number(row.task_order || 0),
    createdAt: row.created_at,
    completedAt: row.completed_at
  };
}

// GET all tasks for authenticated user
router.get('/', async (req, res) => {
  try {
    const rows = await db.getAll(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY task_order ASC, created_at DESC',
      [req.user.id]
    );
    const tasks = rows.map(formatTask);
    res.json({ tasks });
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST create task
router.post('/', async (req, res) => {
  try {
    const { title, description, category, priority, status, dueDate, dueTime, reminder, pinned, subtasks, tags, order } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const taskId = req.body.id || randomUUID();
    const taskStatus = status || 'todo';
    const completedAt = taskStatus === 'completed' ? new Date().toISOString() : null;

    await db.execute(
      `INSERT INTO tasks (
        id, user_id, title, description, category, priority, status,
        due_date, due_time, reminder, pinned, subtasks, tags, task_order, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        taskId,
        req.user.id,
        title.trim(),
        (description || '').trim(),
        category || 'Personal',
        priority || 'medium',
        taskStatus,
        dueDate || null,
        dueTime || null,
        reminder ? 1 : 0,
        pinned ? 1 : 0,
        JSON.stringify(subtasks || []),
        JSON.stringify(tags || []),
        order || 0,
        completedAt
      ]
    );

    const created = await db.getOne('SELECT * FROM tasks WHERE id = $1', [taskId]);
    res.status(201).json({ task: formatTask(created) });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT update task
router.put('/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const task = await db.getOne('SELECT * FROM tasks WHERE id = $1 AND user_id = $2', [taskId, req.user.id]);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { title, description, category, priority, status, dueDate, dueTime, reminder, pinned, subtasks, tags, order } = req.body;

    let completedAt = task.completed_at;
    if (status && status !== task.status) {
      completedAt = status === 'completed' ? new Date().toISOString() : null;
    }

    await db.execute(
      `UPDATE tasks SET
        title = $1,
        description = $2,
        category = $3,
        priority = $4,
        status = $5,
        due_date = $6,
        due_time = $7,
        reminder = $8,
        pinned = $9,
        subtasks = $10,
        tags = $11,
        task_order = $12,
        completed_at = $13
      WHERE id = $14 AND user_id = $15`,
      [
        title !== undefined ? title.trim() : task.title,
        description !== undefined ? description.trim() : task.description,
        category !== undefined ? category : task.category,
        priority !== undefined ? priority : task.priority,
        status !== undefined ? status : task.status,
        dueDate !== undefined ? (dueDate || null) : task.due_date,
        dueTime !== undefined ? (dueTime || null) : task.due_time,
        reminder !== undefined ? (reminder ? 1 : 0) : task.reminder,
        pinned !== undefined ? (pinned ? 1 : 0) : task.pinned,
        subtasks !== undefined ? JSON.stringify(subtasks) : (typeof task.subtasks === 'string' ? task.subtasks : JSON.stringify(task.subtasks || [])),
        tags !== undefined ? JSON.stringify(tags) : (typeof task.tags === 'string' ? task.tags : JSON.stringify(task.tags || [])),
        order !== undefined ? order : task.task_order,
        completedAt,
        taskId,
        req.user.id
      ]
    );

    const updated = await db.getOne('SELECT * FROM tasks WHERE id = $1', [taskId]);
    res.json({ task: formatTask(updated) });
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE task
router.delete('/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const result = await db.execute('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [taskId, req.user.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// POST Batch Sync (Merge local and server tasks)
router.post('/sync', async (req, res) => {
  try {
    const { localTasks } = req.body;
    if (Array.isArray(localTasks) && localTasks.length > 0) {
      const syncQuery = `
        INSERT INTO tasks (
          id, user_id, title, description, category, priority, status,
          due_date, due_time, reminder, pinned, subtasks, tags, task_order, created_at, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          priority = EXCLUDED.priority,
          status = EXCLUDED.status,
          due_date = EXCLUDED.due_date,
          due_time = EXCLUDED.due_time,
          reminder = EXCLUDED.reminder,
          pinned = EXCLUDED.pinned,
          subtasks = EXCLUDED.subtasks,
          tags = EXCLUDED.tags,
          task_order = EXCLUDED.task_order,
          completed_at = EXCLUDED.completed_at
      `;

      for (const t of localTasks) {
        const taskId = t.id || randomUUID();
        await db.execute(syncQuery, [
          taskId,
          req.user.id,
          t.title || 'Untitled Task',
          t.description || '',
          t.category || 'Personal',
          t.priority || 'medium',
          t.status || 'todo',
          t.dueDate || null,
          t.dueTime || null,
          t.reminder ? 1 : 0,
          t.pinned ? 1 : 0,
          JSON.stringify(t.subtasks || []),
          JSON.stringify(t.tags || []),
          t.order || 0,
          t.createdAt || new Date().toISOString(),
          t.completedAt || null
        ]);
      }
    }

    const rows = await db.getAll(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY task_order ASC, created_at DESC',
      [req.user.id]
    );
    res.json({ tasks: rows.map(formatTask) });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Failed to synchronize tasks' });
  }
});

export default router;
