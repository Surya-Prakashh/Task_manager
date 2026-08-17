// ==========================================
// TaskFlow Client-Side API & Auth Service
// ==========================================

const API_BASE = '/api';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('taskflow_token') || null;
    this.currentUser = null;
    const storedUser = localStorage.getItem('taskflow_user');
    if (storedUser) {
      try {
        this.currentUser = JSON.parse(storedUser);
      } catch (e) {}
    }
  }

  isLoggedIn() {
    return Boolean(this.token && this.currentUser);
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = this.getHeaders();
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers || {})
        }
      });

      if (response.status === 401 || response.status === 403) {
        // Token expired
        this.logout();
        throw new Error('Session expired. Please log in again.');
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }
      return data;
    } catch (err) {
      console.warn(`API Error [${endpoint}]:`, err.message);
      throw err;
    }
  }

  // --- Auth Methods ---

  async register(name, email, password) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });

    this.setSession(data.token, data.user);
    return data;
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    this.setSession(data.token, data.user);
    return data;
  }

  logout() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('taskflow_token');
    localStorage.removeItem('taskflow_user');
  }

  setSession(token, user) {
    this.token = token;
    this.currentUser = user;
    localStorage.setItem('taskflow_token', token);
    localStorage.setItem('taskflow_user', JSON.stringify(user));
  }

  async verifyAuth() {
    if (!this.token) return null;
    try {
      const data = await this.request('/auth/me');
      this.currentUser = data.user;
      localStorage.setItem('taskflow_user', JSON.stringify(data.user));
      return data.user;
    } catch (err) {
      this.logout();
      return null;
    }
  }

  // --- Tasks API ---

  async fetchTasks() {
    const data = await this.request('/tasks');
    return data.tasks || [];
  }

  async createTask(task) {
    const data = await this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(task)
    });
    return data.task;
  }

  async updateTask(id, updates) {
    const data = await this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return data.task;
  }

  async deleteTask(id) {
    return await this.request(`/tasks/${id}`, { method: 'DELETE' });
  }

  async syncTasks(localTasks) {
    const data = await this.request('/tasks/sync', {
      method: 'POST',
      body: JSON.stringify({ localTasks })
    });
    return data.tasks || [];
  }

  // --- Categories API ---

  async fetchCategories() {
    const data = await this.request('/categories');
    return data.categories || [];
  }

  async createCategory(category) {
    const data = await this.request('/categories', {
      method: 'POST',
      body: JSON.stringify(category)
    });
    return data.category;
  }

  async deleteCategory(id) {
    return await this.request(`/categories/${id}`, { method: 'DELETE' });
  }
}

export const api = new ApiService();
