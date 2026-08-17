import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply auth to all task routes
router.use(authenticateToken);

// Helper: Format DB row to frontend task object
function formatTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    dueDate: row.due_date,
    dueTime: row.due_time,
    reminder: Boolean(row.reminder),
    pinned: Boolean(row.pinned),
    subtasks: JSON.parse(row.subtasks || '[]'),
    tags: JSON.parse(row.tags || '[]'),
    order: row.task_order,
    createdAt: row.created_at,
    completedAt: row.completed_at
  };
}

// GET all tasks for authenticated user
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY task_order ASC, created_at DESC').all(req.user.id);
    const tasks = rows.map(formatTask);
    res.json({ tasks });
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST create task
router.post('/', (req, res) => {
  try {
    const { title, description, category, priority, status, dueDate, dueTime, reminder, pinned, subtasks, tags, order } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const taskId = randomUUID();
    const taskStatus = status || 'todo';
    const completedAt = taskStatus === 'completed' ? new Date().toISOString() : null;

    db.prepare(`
      INSERT INTO tasks (
        id, user_id, title, description, category, priority, status,
        due_date, due_time, reminder, pinned, subtasks, tags, task_order, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
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
    );

    const created = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    res.status(201).json({ task: formatTask(created) });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT update task
router.put('/:id', (req, res) => {
  try {
    const taskId = req.params.id;
    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(taskId, req.user.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { title, description, category, priority, status, dueDate, dueTime, reminder, pinned, subtasks, tags, order } = req.body;

    let completedAt = task.completed_at;
    if (status && status !== task.status) {
      completedAt = status === 'completed' ? new Date().toISOString() : null;
    }

    db.prepare(`
      UPDATE tasks SET
        title = ?,
        description = ?,
        category = ?,
        priority = ?,
        status = ?,
        due_date = ?,
        due_time = ?,
        reminder = ?,
        pinned = ?,
        subtasks = ?,
        tags = ?,
        task_order = ?,
        completed_at = ?
      WHERE id = ? AND user_id = ?
    `).run(
      title !== undefined ? title.trim() : task.title,
      description !== undefined ? description.trim() : task.description,
      category !== undefined ? category : task.category,
      priority !== undefined ? priority : task.priority,
      status !== undefined ? status : task.status,
      dueDate !== undefined ? (dueDate || null) : task.due_date,
      dueTime !== undefined ? (dueTime || null) : task.due_time,
      reminder !== undefined ? (reminder ? 1 : 0) : task.reminder,
      pinned !== undefined ? (pinned ? 1 : 0) : task.pinned,
      subtasks !== undefined ? JSON.stringify(subtasks) : task.subtasks,
      tags !== undefined ? JSON.stringify(tags) : task.tags,
      order !== undefined ? order : task.task_order,
      completedAt,
      taskId,
      req.user.id
    );

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    res.json({ task: formatTask(updated) });
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE task
router.delete('/:id', (req, res) => {
  try {
    const taskId = req.params.id;
    const result = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(taskId, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// POST Batch Sync (Merge local and server tasks)
router.post('/sync', (req, res) => {
  try {
    const { localTasks } = req.body;
    if (Array.isArray(localTasks) && localTasks.length > 0) {
      const insertOrUpdate = db.prepare(`
        INSERT INTO tasks (
          id, user_id, title, description, category, priority, status,
          due_date, due_time, reminder, pinned, subtasks, tags, task_order, created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          category = excluded.category,
          priority = excluded.priority,
          status = excluded.status,
          due_date = excluded.due_date,
          due_time = excluded.due_time,
          reminder = excluded.reminder,
          pinned = excluded.pinned,
          subtasks = excluded.subtasks,
          tags = excluded.tags,
          task_order = excluded.task_order,
          completed_at = excluded.completed_at
      `);

      const syncTransaction = db.transaction((tasksList) => {
        for (const t of tasksList) {
          insertOrUpdate.run(
            t.id.startsWith('task_') ? randomUUID() : t.id,
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
          );
        }
      });

      syncTransaction(localTasks);
    }

    const rows = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY task_order ASC, created_at DESC').all(req.user.id);
    res.json({ tasks: rows.map(formatTask) });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Failed to synchronize tasks' });
  }
});

export default router;
