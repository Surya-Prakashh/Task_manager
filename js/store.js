// ==========================================
// TaskFlow Data Store & State Management (with Cloud Sync)
// ==========================================
import { api } from './api.js';

const STORAGE_KEYS = {
  TASKS: 'taskflow_tasks_v1',
  CATEGORIES: 'taskflow_categories_v1',
  SETTINGS: 'taskflow_settings_v1'
};

export const DEFAULT_CATEGORIES = [
  { id: 'work', name: 'Work', color: '#6366f1', icon: 'briefcase' },
  { id: 'personal', name: 'Personal', color: '#ec4899', icon: 'user' },
  { id: 'study', name: 'Study', color: '#8b5cf6', icon: 'book' },
  { id: 'health', name: 'Health', color: '#10b981', icon: 'activity' },
  { id: 'finance', name: 'Finance', color: '#f59e0b', icon: 'dollar-sign' }
];

export const SAMPLE_TASKS = [
  {
    id: 'sample-1',
    title: 'Complete Project Architecture Review 🚀',
    description: 'Review the high-level diagrams, verify API contracts, and sync with the lead engineer.',
    category: 'Work',
    priority: 'urgent',
    status: 'in-progress',
    dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    dueTime: '15:00',
    reminder: true,
    pinned: true,
    subtasks: [
      { id: 'st-1', title: 'Check data flow latency metrics', completed: true },
      { id: 'st-2', title: 'Audit offline storage & cache layer', completed: true },
      { id: 'st-3', title: 'Sign off on security compliance checklist', completed: false }
    ],
    tags: ['Architecture', 'Review'],
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    completedAt: null,
    order: 0
  },
  {
    id: 'sample-2',
    title: 'Grocery shopping for healthy meal prep 🥗',
    description: 'Pick up fresh avocados, spinach, Greek yogurt, salmon, and blueberries from the farmers market.',
    category: 'Health',
    priority: 'medium',
    status: 'todo',
    dueDate: new Date().toISOString().slice(0, 10),
    dueTime: '18:30',
    reminder: true,
    pinned: false,
    subtasks: [
      { id: 'st-4', title: 'Organic greens & vegetables', completed: false },
      { id: 'st-5', title: 'Almond milk and nuts', completed: false }
    ],
    tags: ['Health', 'Groceries'],
    createdAt: new Date().toISOString(),
    completedAt: null,
    order: 1
  },
  {
    id: 'sample-3',
    title: 'Monthly budget reconciliation & investment review 📈',
    description: 'Download bank statements, balance accounts in spreadsheet, and review retirement contributions.',
    category: 'Finance',
    priority: 'high',
    status: 'todo',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    dueTime: '20:00',
    reminder: false,
    pinned: false,
    subtasks: [],
    tags: ['Finance', 'Monthly'],
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    completedAt: null,
    order: 2
  },
  {
    id: 'sample-4',
    title: 'Finish reading "Deep Work" Chapter 4 📖',
    description: 'Take notes on attention management strategies and implement time blocking in daily calendar.',
    category: 'Study',
    priority: 'low',
    status: 'completed',
    dueDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    dueTime: '21:00',
    reminder: false,
    pinned: false,
    subtasks: [
      { id: 'st-6', title: 'Highlight key quotes', completed: true },
      { id: 'st-7', title: 'Write summary reflections', completed: true }
    ],
    tags: ['Reading', 'Habits'],
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    completedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    order: 3
  }
];

export class Store {
  constructor() {
    this.tasks = [];
    this.categories = [];
    this.settings = {
      theme: 'dark',
      soundEnabled: true,
      confettiEnabled: true,
      notificationsEnabled: true,
      defaultView: 'list'
    };
    this.filter = {
      view: 'all',
      priority: 'all',
      searchQuery: '',
      sortBy: 'manual'
    };
    this.listeners = [];
    this.isCloudSynced = false;
    this.isPersistentStorageGranted = false;
    this.storageEstimate = null;
  }

  async init() {
    // 1. Request Browser Persistent Storage (StorageManager API)
    await this.initPersistentStorage();

    // 2. Load Local Cache
    this.loadLocalData();

    // 3. If logged in, fetch from Cloud DB and sync
    if (api.isLoggedIn()) {
      await this.syncWithCloud();
    }
  }

  async initPersistentStorage() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persisted();
        if (isPersisted) {
          this.isPersistentStorageGranted = true;
          console.log('🔒 Browser storage is permanently persistent');
        } else {
          const granted = await navigator.storage.persist();
          this.isPersistentStorageGranted = granted;
          if (granted) {
            console.log('✅ Browser persistent storage permission granted');
          } else {
            console.log('ℹ️ Browser is using standard storage mode');
          }
        }
      }

      if (navigator.storage && navigator.storage.estimate) {
        this.storageEstimate = await navigator.storage.estimate();
      }
    } catch (err) {
      console.warn('StorageManager persistent storage check warning:', err);
    }
  }

  async getStorageMetrics() {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        this.storageEstimate = await navigator.storage.estimate();
      }
      if (navigator.storage && navigator.storage.persisted) {
        this.isPersistentStorageGranted = await navigator.storage.persisted();
      }
    } catch (e) {}

    return {
      isPersisted: this.isPersistentStorageGranted,
      usageBytes: this.storageEstimate?.usage || 0,
      quotaBytes: this.storageEstimate?.quota || 0,
      usageKB: Math.round((this.storageEstimate?.usage || 0) / 1024),
      usageMB: ((this.storageEstimate?.usage || 0) / (1024 * 1024)).toFixed(2),
      quotaMB: Math.round((this.storageEstimate?.quota || 0) / (1024 * 1024)),
      tasksCount: this.tasks.length,
      categoriesCount: this.categories.length
    };
  }

  loadLocalData() {
    const rawTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (rawTasks) {
      try {
        this.tasks = JSON.parse(rawTasks);
      } catch (e) {
        this.tasks = [...SAMPLE_TASKS];
      }
    } else {
      this.tasks = [...SAMPLE_TASKS];
      this.saveLocalTasks();
    }

    const rawCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (rawCategories) {
      try {
        this.categories = JSON.parse(rawCategories);
      } catch (e) {
        this.categories = [...DEFAULT_CATEGORIES];
      }
    } else {
      this.categories = [...DEFAULT_CATEGORIES];
      this.saveLocalCategories();
    }

    const rawSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (rawSettings) {
      try {
        this.settings = { ...this.settings, ...JSON.parse(rawSettings) };
      } catch (e) {}
    }
  }

  async syncWithCloud() {
    try {
      // Sync tasks
      const serverTasks = await api.syncTasks(this.tasks);
      this.tasks = serverTasks;
      this.saveLocalTasks();

      // Fetch categories
      const serverCategories = await api.fetchCategories();
      if (serverCategories && serverCategories.length > 0) {
        this.categories = serverCategories;
        this.saveLocalCategories();
      }

      this.isCloudSynced = true;
      this.notify();
    } catch (err) {
      console.warn('Cloud sync offline / failed, using local storage:', err);
      this.isCloudSynced = false;
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => fn(this));
  }

  saveLocalTasks() {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(this.tasks));
    this.notify();
  }

  saveLocalCategories() {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(this.categories));
    this.notify();
  }

  saveSettings() {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    this.notify();
  }

  // --- Task CRUD Operations ---

  async addTask(taskData) {
    const newTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: taskData.title.trim(),
      description: (taskData.description || '').trim(),
      category: taskData.category || 'Personal',
      priority: taskData.priority || 'medium',
      status: taskData.status || 'todo',
      dueDate: taskData.dueDate || '',
      dueTime: taskData.dueTime || '',
      reminder: Boolean(taskData.reminder),
      pinned: Boolean(taskData.pinned),
      subtasks: taskData.subtasks || [],
      tags: taskData.tags || [],
      createdAt: new Date().toISOString(),
      completedAt: taskData.status === 'completed' ? new Date().toISOString() : null,
      order: this.tasks.length
    };

    this.tasks.unshift(newTask);
    this.saveLocalTasks();

    // Sync with backend if logged in
    if (api.isLoggedIn()) {
      try {
        const created = await api.createTask(newTask);
        if (created) {
          const idx = this.tasks.findIndex(t => t.id === newTask.id);
          if (idx !== -1) {
            this.tasks[idx] = created;
            this.saveLocalTasks();
          }
        }
      } catch (err) {
        console.warn('Task created locally, backend sync queued');
      }
    }

    return newTask;
  }

  async updateTask(id, updates) {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index === -1) return null;

    const oldTask = this.tasks[index];
    const updated = { ...oldTask, ...updates };

    if (updates.status) {
      if (updates.status === 'completed' && oldTask.status !== 'completed') {
        updated.completedAt = new Date().toISOString();
      } else if (updates.status !== 'completed') {
        updated.completedAt = null;
      }
    }

    this.tasks[index] = updated;
    this.saveLocalTasks();

    if (api.isLoggedIn()) {
      try {
        await api.updateTask(id, updated);
      } catch (err) {
        console.warn('Update saved locally, backend sync queued');
      }
    }

    return updated;
  }

  async deleteTask(id) {
    const deletedTask = this.tasks.find(t => t.id === id);
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.saveLocalTasks();

    if (api.isLoggedIn()) {
      try {
        await api.deleteTask(id);
      } catch (err) {
        console.warn('Deleted locally, backend sync queued');
      }
    }

    return deletedTask;
  }

  toggleTaskStatus(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return null;

    const nextStatus = task.status === 'completed' ? 'todo' : 'completed';
    return this.updateTask(id, { status: nextStatus });
  }

  togglePin(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return null;
    return this.updateTask(id, { pinned: !task.pinned });
  }

  toggleSubtask(taskId, subtaskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return null;

    const subtasks = task.subtasks.map(st => {
      if (st.id === subtaskId) {
        return { ...st, completed: !st.completed };
      }
      return st;
    });

    return this.updateTask(taskId, { subtasks });
  }

  // --- Category CRUD ---

  async addCategory(name, color = '#6366f1', icon = 'tag') {
    const trimmed = name.trim();
    if (!trimmed || this.categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      return null;
    }
    const cat = {
      id: 'cat_' + Date.now(),
      name: trimmed,
      color: color,
      icon: icon
    };
    this.categories.push(cat);
    this.saveLocalCategories();

    if (api.isLoggedIn()) {
      try {
        const created = await api.createCategory(cat);
        if (created) {
          const idx = this.categories.findIndex(c => c.id === cat.id);
          if (idx !== -1) {
            this.categories[idx] = created;
            this.saveLocalCategories();
          }
        }
      } catch (err) {}
    }

    return cat;
  }

  async deleteCategory(catId) {
    this.categories = this.categories.filter(c => c.id !== catId);
    this.saveLocalCategories();

    if (api.isLoggedIn()) {
      try {
        await api.deleteCategory(catId);
      } catch (err) {}
    }
  }

  // --- Filter & Search Logic ---

  setFilter(updates) {
    this.filter = { ...this.filter, ...updates };
    this.notify();
  }

  getFilteredTasks() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const query = this.filter.searchQuery.toLowerCase().trim();

    return this.tasks.filter(task => {
      if (query) {
        const matchesTitle = (task.title || '').toLowerCase().includes(query);
        const matchesDesc = (task.description || '').toLowerCase().includes(query);
        const matchesTags = (task.tags || []).some(tag => tag.toLowerCase().includes(query));
        const matchesCat = (task.category || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesTags && !matchesCat) {
          return false;
        }
      }

      if (this.filter.priority !== 'all' && task.priority !== this.filter.priority) {
        return false;
      }

      const view = this.filter.view;
      if (view === 'today') return task.dueDate === todayStr;
      if (view === 'upcoming') return task.dueDate && task.dueDate > todayStr && task.status !== 'completed';
      if (view === 'urgent') return (task.priority === 'urgent' || task.priority === 'high') && task.status !== 'completed';
      if (view === 'completed') return task.status === 'completed';
      if (view === 'overdue') return task.dueDate && task.dueDate < todayStr && task.status !== 'completed';
      if (view.startsWith('category:')) {
        const catName = view.replace('category:', '');
        return (task.category || '').toLowerCase() === catName.toLowerCase();
      }

      return true;
    }).sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }

      const sortBy = this.filter.sortBy;
      if (sortBy === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate) || (a.dueTime || '').localeCompare(b.dueTime || '');
      }
      if (sortBy === 'priority') {
        const weights = { urgent: 4, high: 3, medium: 2, low: 1 };
        return (weights[b.priority] || 0) - (weights[a.priority] || 0);
      }
      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      if (sortBy === 'createdAt') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }

      return (a.order || 0) - (b.order || 0);
    });
  }

  getAnalytics() {
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.status === 'completed').length;
    const pending = total - completed;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const todayStr = new Date().toISOString().slice(0, 10);
    const overdue = this.tasks.filter(t => t.dueDate && t.dueDate < todayStr && t.status !== 'completed').length;
    const todayDue = this.tasks.filter(t => t.dueDate === todayStr).length;

    const categoryCounts = {};
    this.categories.forEach(c => { categoryCounts[c.name] = { total: 0, completed: 0, color: c.color }; });
    this.tasks.forEach(t => {
      if (!categoryCounts[t.category]) {
        categoryCounts[t.category] = { total: 0, completed: 0, color: '#94a3b8' };
      }
      categoryCounts[t.category].total++;
      if (t.status === 'completed') categoryCounts[t.category].completed++;
    });

    const priorityCounts = { urgent: 0, high: 0, medium: 0, low: 0 };
    this.tasks.forEach(t => {
      if (priorityCounts[t.priority] !== undefined) {
        priorityCounts[t.priority]++;
      }
    });

    let streak = 0;
    const completedDates = new Set(
      this.tasks
        .filter(t => t.completedAt)
        .map(t => t.completedAt.slice(0, 10))
    );

    let checkDate = new Date();
    const checkDateStr = checkDate.toISOString().slice(0, 10);
    if (!completedDates.has(checkDateStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (completedDates.has(checkDate.toISOString().slice(0, 10))) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    const weekData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const count = this.tasks.filter(t => t.completedAt && t.completedAt.slice(0, 10) === dateStr).length;
      weekData.push({ date: dateStr, day: dayName, count });
    }

    return {
      total,
      completed,
      pending,
      rate,
      overdue,
      todayDue,
      streak,
      categoryCounts,
      priorityCounts,
      weekData
    };
  }

  exportDataAsJSON() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      tasks: this.tasks,
      categories: this.categories,
      settings: this.settings
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskflow_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportDataAsCSV() {
    const headers = ['ID', 'Title', 'Description', 'Category', 'Priority', 'Status', 'DueDate', 'DueTime', 'SubtasksTotal', 'SubtasksDone', 'CreatedAt', 'CompletedAt'];
    const rows = this.tasks.map(t => [
      `"${t.id}"`,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${t.category}"`,
      `"${t.priority}"`,
      `"${t.status}"`,
      `"${t.dueDate || ''}"`,
      `"${t.dueTime || ''}"`,
      (t.subtasks || []).length,
      (t.subtasks || []).filter(st => st.completed).length,
      `"${t.createdAt}"`,
      `"${t.completedAt || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskflow_tasks_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importDataFromJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.tasks)) {
        this.tasks = data.tasks;
        this.saveLocalTasks();
      }
      if (Array.isArray(data.categories)) {
        this.categories = data.categories;
        this.saveLocalCategories();
      }
      return { success: true, count: this.tasks.length };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  resetToDefault() {
    this.tasks = [...SAMPLE_TASKS];
    this.categories = [...DEFAULT_CATEGORIES];
    this.saveLocalTasks();
    this.saveLocalCategories();
  }
}

export const store = new Store();
