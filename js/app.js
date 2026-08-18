// ==========================================
// TaskFlow Master Controller & Application Logic
// ==========================================

import { store } from './store.js';
import { api } from './api.js';
import { sounds, notifications, fireConfetti } from './notifications.js';
import { FocusTimer } from './timer.js';
import { renderListView, renderKanbanView, renderCalendarView, renderAnalyticsView } from './views.js';

class App {
  constructor() {
    this.currentViewMode = 'list'; // 'list' | 'board' | 'calendar' | 'analytics'
    this.activeModalSubtasks = [];
    this.selectedCatColor = '#6366f1';
    this.deferredInstallPrompt = null;
    this.authMode = 'login'; // 'login' | 'register'
    this.crossDeviceSyncInterval = null;

    // Initialize Timer
    this.timer = new FocusTimer(
      (state) => this.handleTimerTick(state),
      (state) => this.handleTimerComplete(state)
    );

    this.dom = {};
  }

  async init() {
    this.cacheDom();
    this.applyTheme(store.settings.theme || 'dark');
    this.bindEvents();
    this.initPWA();
    this.updateAuthUI();

    // Initialize store & sync
    await store.init();
    this.render();

    // Start background reminder checker
    notifications.startReminderChecker(() => store.tasks);

    // Cross-Device Sync Setup
    this.setupCrossDeviceSync();

    // Subscribe to store updates
    store.subscribe(() => {
      this.render();
      this.updateSidebarStats();
    });

    this.updateSidebarStats();
  }

  setupCrossDeviceSync() {
    // 1. Sync on tab / device visibility change (e.g. switching back to browser or unlocking device)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && api.isLoggedIn()) {
        store.syncWithCloud();
      }
    });

    // 2. Sync on window focus
    window.addEventListener('focus', () => {
      if (api.isLoggedIn()) {
        store.syncWithCloud();
      }
    });

    // 3. Sync on network reconnection
    window.addEventListener('online', () => {
      if (api.isLoggedIn()) {
        this.showToast('📶 Back online! Syncing data...', 'info');
        store.syncWithCloud();
      }
    });

    // 4. Start periodic background polling if already logged in
    if (api.isLoggedIn()) {
      this.startCrossDeviceSync();
    }
  }

  cacheDom() {
    this.dom = {
      // Shell & Layout
      layout: document.getElementById('app-layout'),
      sidebar: document.getElementById('app-sidebar'),
      sidebarBackdrop: document.getElementById('sidebar-backdrop'),
      btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
      btnCloseSidebar: document.getElementById('btn-sidebar-close'),
      
      // Navigation & Filters
      navItems: document.querySelectorAll('.nav-item'),
      categoriesList: document.getElementById('sidebar-categories-list'),
      currentViewTitle: document.getElementById('current-view-title'),
      currentViewBadge: document.getElementById('current-view-badge'),
      viewModeTabs: document.querySelectorAll('.view-mode-tab'),
      mobileNavBtns: document.querySelectorAll('.mobile-nav-btn'),
      viewContentContainer: document.getElementById('view-content-container'),
      sortSelect: document.getElementById('sort-select'),
      priorityFilterSelect: document.getElementById('priority-filter-select'),
      filterControlsGroup: document.getElementById('filter-controls-group'),
      
      // Search
      searchInput: document.getElementById('global-search-input'),
      btnClearSearch: document.getElementById('btn-clear-search'),

      // Top Actions & Auth
      userAuthWrap: document.getElementById('user-auth-wrap'),
      btnAuthTrigger: document.getElementById('btn-auth-trigger'),
      authBtnLabel: document.getElementById('auth-btn-label'),
      userDropdownMenu: document.getElementById('user-dropdown-menu'),
      dropdownUserName: document.getElementById('dropdown-user-name'),
      dropdownUserEmail: document.getElementById('dropdown-user-email'),
      btnSyncNow: document.getElementById('btn-sync-now'),
      btnLogout: document.getElementById('btn-logout'),

      btnHeaderNewTask: document.getElementById('btn-header-new-task'),
      btnMobileFab: document.getElementById('btn-mobile-fab'),
      btnOpenFocusModal: document.getElementById('btn-open-focus-modal'),
      headerFocusTimerText: document.getElementById('header-focus-timer-text'),
      btnToggleNotifications: document.getElementById('btn-toggle-notifications'),
      btnThemeToggle: document.getElementById('btn-theme-toggle'),
      themeDropdown: document.getElementById('theme-menu-dropdown'),

      // Auth Modal
      authModalOverlay: document.getElementById('auth-modal-overlay'),
      authModalTitle: document.getElementById('auth-modal-title'),
      btnCloseAuthModal: document.getElementById('btn-close-auth-modal'),
      tabAuthLogin: document.getElementById('tab-auth-login'),
      tabAuthRegister: document.getElementById('tab-auth-register'),
      authForm: document.getElementById('auth-form'),
      authNameGroup: document.getElementById('auth-name-group'),
      authNameInput: document.getElementById('auth-name-input'),
      authEmailInput: document.getElementById('auth-email-input'),
      authPasswordInput: document.getElementById('auth-password-input'),
      btnAuthSubmit: document.getElementById('btn-auth-submit'),

      // Task Modal
      taskModalOverlay: document.getElementById('task-modal-overlay'),
      taskForm: document.getElementById('task-form'),
      modalTaskHeading: document.getElementById('modal-task-heading'),
      taskIdInput: document.getElementById('task-id-input'),
      taskTitleInput: document.getElementById('task-title-input'),
      taskDescInput: document.getElementById('task-desc-input'),
      taskCategorySelect: document.getElementById('task-category-select'),
      taskDueDateInput: document.getElementById('task-due-date-input'),
      taskDueTimeInput: document.getElementById('task-due-time-input'),
      taskReminderCheck: document.getElementById('task-reminder-check'),
      taskPinCheck: document.getElementById('task-pin-check'),
      taskTagsInput: document.getElementById('task-tags-input'),
      modalSubtasksList: document.getElementById('modal-subtasks-list'),
      modalSubtasksCount: document.getElementById('modal-subtasks-count'),
      newSubtaskInput: document.getElementById('new-subtask-input'),
      btnAddSubtaskItem: document.getElementById('btn-add-subtask-item'),
      btnCloseTaskModal: document.getElementById('btn-close-task-modal'),
      btnCancelTaskModal: document.getElementById('btn-cancel-task-modal'),

      // Category Modal
      categoryModalOverlay: document.getElementById('category-modal-overlay'),
      btnOpenCategoryModal: document.getElementById('btn-open-category-modal'),
      categoryForm: document.getElementById('category-form'),
      catNameInput: document.getElementById('cat-name-input'),
      catColorPalette: document.getElementById('cat-color-palette'),
      btnCloseCategoryModal: document.getElementById('btn-close-category-modal'),
      btnCancelCatModal: document.getElementById('btn-cancel-cat-modal'),

      // Backup Modal & Persistent Storage
      backupModalOverlay: document.getElementById('backup-modal-overlay'),
      btnExportMenu: document.getElementById('btn-export-menu'),
      btnCloseBackupModal: document.getElementById('btn-close-backup-modal'),
      btnActionExportJson: document.getElementById('btn-action-export-json'),
      btnActionExportCsv: document.getElementById('btn-action-export-csv'),
      importJsonFileInput: document.getElementById('import-json-file-input'),
      btnActionResetDefaults: document.getElementById('btn-action-reset-defaults'),
      storagePersistIcon: document.getElementById('storage-persist-icon'),
      storagePersistTitle: document.getElementById('storage-persist-title'),
      storagePersistBadge: document.getElementById('storage-persist-badge'),
      storagePersistDesc: document.getElementById('storage-persist-desc'),
      storageQuotaText: document.getElementById('storage-quota-text'),
      storageTasksCount: document.getElementById('storage-tasks-count'),

      // Shortcuts Modal
      shortcutsModalOverlay: document.getElementById('shortcuts-modal-overlay'),
      btnOpenShortcuts: document.getElementById('btn-open-shortcuts'),
      btnCloseShortcutsModal: document.getElementById('btn-close-shortcuts-modal'),

      // Focus Modal
      focusModalOverlay: document.getElementById('focus-modal-overlay'),
      btnCloseFocusModal: document.getElementById('btn-close-focus-modal'),
      focusModeBtns: document.querySelectorAll('.focus-mode-btn'),
      focusTaskTitleDisplay: document.getElementById('focus-task-title-display'),
      focusDigitsDisplay: document.getElementById('focus-digits-display'),
      focusSubStatus: document.getElementById('focus-sub-status'),
      focusSvgProgress: document.getElementById('focus-svg-progress'),
      btnFocusToggle: document.getElementById('btn-focus-toggle'),
      btnFocusReset: document.getElementById('btn-focus-reset'),
      focusPlayIcon: document.getElementById('focus-play-icon'),
      focusBtnLabel: document.getElementById('focus-btn-label'),
      focusSessionsCounter: document.getElementById('focus-sessions-counter'),

      // Toast & PWA
      toastContainer: document.getElementById('toast-container'),
      pwaInstallBanner: document.getElementById('pwa-install-banner'),
      btnPwaInstall: document.getElementById('btn-pwa-install'),
      btnPwaDismiss: document.getElementById('btn-pwa-dismiss'),

      // Sidebar Stats
      countAll: document.getElementById('count-all'),
      countToday: document.getElementById('count-today'),
      countUpcoming: document.getElementById('count-upcoming'),
      countUrgent: document.getElementById('count-urgent'),
      countOverdue: document.getElementById('count-overdue'),
      countCompleted: document.getElementById('count-completed'),
      sidebarStreakCount: document.getElementById('sidebar-streak-count'),
      sidebarProgressFill: document.getElementById('sidebar-progress-fill')
    };
  }

  // ==========================================
  // Event Bindings
  // ==========================================
  bindEvents() {
    // 1. Sidebar Toggle (Mobile)
    this.dom.btnToggleSidebar?.addEventListener('click', () => this.toggleSidebar(true));
    this.dom.btnCloseSidebar?.addEventListener('click', () => this.toggleSidebar(false));
    this.dom.sidebarBackdrop?.addEventListener('click', () => this.toggleSidebar(false));

    // 2. Smart Navigation Items
    this.dom.navItems.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-view-filter');
        this.dom.navItems.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        store.setFilter({ view: filter });
        this.toggleSidebar(false);
      });
    });

    // 3. View Mode Switchers
    this.dom.viewModeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.getAttribute('data-mode');
        this.setViewMode(mode);
      });
    });

    // Mobile Bottom Navigation
    this.dom.mobileNavBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-bottom-view');
        this.setViewMode(mode);
      });
    });

    // 4. Search Filter
    let searchTimeout;
    this.dom.searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const val = e.target.value;
      this.dom.btnClearSearch.style.display = val ? 'inline-flex' : 'none';
      searchTimeout = setTimeout(() => {
        store.setFilter({ searchQuery: val });
      }, 150);
    });

    this.dom.btnClearSearch.addEventListener('click', () => {
      this.dom.searchInput.value = '';
      this.dom.btnClearSearch.style.display = 'none';
      store.setFilter({ searchQuery: '' });
      this.dom.searchInput.focus();
    });

    // 5. Sort & Priority Selects
    this.dom.sortSelect.addEventListener('change', (e) => {
      store.setFilter({ sortBy: e.target.value });
    });

    this.dom.priorityFilterSelect.addEventListener('change', (e) => {
      store.setFilter({ priority: e.target.value });
    });

    // 6. User Auth & Sync Controls
    this.dom.btnAuthTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (api.isLoggedIn()) {
        const isHidden = this.dom.userDropdownMenu.style.display === 'none';
        this.dom.userDropdownMenu.style.display = isHidden ? 'flex' : 'none';
      } else {
        this.openAuthModal();
      }
    });

    this.dom.btnSyncNow?.addEventListener('click', async () => {
      this.dom.userDropdownMenu.style.display = 'none';
      this.showToast('Syncing with database...', 'info');
      const res = await store.syncWithCloud(true);
      if (res && res.success) {
        this.showToast(`✅ Cloud synced (${res.count} tasks)`, 'success');
      } else {
        this.showToast('⚠️ Sync completed with local cache', 'info');
      }
    });

    this.dom.btnLogout?.addEventListener('click', () => {
      this.stopCrossDeviceSync();
      api.logout();
      store.clearUserDataOnLogout();
      this.dom.userDropdownMenu.style.display = 'none';
      this.updateAuthUI();
      this.populateCategories();
      this.render();
      this.showToast('Signed out of cloud account', 'info');
    });

    document.addEventListener('click', (e) => {
      if (!this.dom.userAuthWrap.contains(e.target)) {
        this.dom.userDropdownMenu.style.display = 'none';
      }
    });

    // Auth Modal Tabs
    this.dom.tabAuthLogin.addEventListener('click', () => this.setAuthMode('login'));
    this.dom.tabAuthRegister.addEventListener('click', () => this.setAuthMode('register'));
    this.dom.btnCloseAuthModal.addEventListener('click', () => this.closeAuthModal());

    this.dom.authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAuthSubmit();
    });

    // 7. Modals Open/Close
    this.dom.btnHeaderNewTask.addEventListener('click', () => this.openTaskModal());
    this.dom.btnMobileFab?.addEventListener('click', () => this.openTaskModal());
    this.dom.btnCloseTaskModal.addEventListener('click', () => this.closeTaskModal());
    this.dom.btnCancelTaskModal.addEventListener('click', () => this.closeTaskModal());

    this.dom.btnOpenCategoryModal.addEventListener('click', () => this.openCategoryModal());
    this.dom.btnCloseCategoryModal.addEventListener('click', () => this.closeCategoryModal());
    this.dom.btnCancelCatModal.addEventListener('click', () => this.closeCategoryModal());

    this.dom.btnExportMenu.addEventListener('click', () => this.openBackupModal());
    this.dom.btnCloseBackupModal.addEventListener('click', () => this.closeBackupModal());

    this.dom.btnOpenShortcuts.addEventListener('click', () => this.openShortcutsModal());
    this.dom.btnCloseShortcutsModal.addEventListener('click', () => this.closeShortcutsModal());

    this.dom.btnOpenFocusModal.addEventListener('click', () => this.openFocusModal());
    this.dom.btnCloseFocusModal.addEventListener('click', () => this.closeFocusModal());

    // 8. Theme selector dropdown
    this.dom.btnThemeToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dom.themeDropdown.classList.toggle('show');
    });

    document.querySelectorAll('.theme-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        const theme = opt.getAttribute('data-theme-val');
        this.applyTheme(theme);
        this.dom.themeDropdown.classList.remove('show');
      });
    });

    document.addEventListener('click', (e) => {
      if (!this.dom.themeDropdown.contains(e.target) && e.target !== this.dom.btnThemeToggle) {
        this.dom.themeDropdown.classList.remove('show');
      }
    });

    // 9. Notifications Permission Toggle
    this.dom.btnToggleNotifications.addEventListener('click', async () => {
      const granted = await notifications.requestPermission();
      if (granted) {
        this.showToast('✅ Notifications enabled!', 'success');
        notifications.notify('TaskFlow Reminders Active', {
          body: 'You will receive reminders when your scheduled tasks are due.'
        });
      } else {
        this.showToast('⚠️ Notification permission denied or not supported', 'warning');
      }
    });

    // 10. Task Form Submission
    this.dom.taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleTaskFormSubmit();
    });

    // Subtask adder in modal
    this.dom.btnAddSubtaskItem.addEventListener('click', () => this.handleAddSubtaskInModal());
    this.dom.newSubtaskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleAddSubtaskInModal();
      }
    });

    // 11. Category Form & Color Palette
    this.dom.catColorPalette.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        this.dom.catColorPalette.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        this.selectedCatColor = swatch.getAttribute('data-color');
      });
    });

    this.dom.categoryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = this.dom.catNameInput.value.trim();
      if (name) {
        const cat = await store.addCategory(name, this.selectedCatColor);
        if (cat) {
          this.showToast(`Category "${name}" created!`, 'success');
          this.closeCategoryModal();
          this.populateCategories();
        } else {
          this.showToast('Category already exists!', 'warning');
        }
      }
    });

    // 12. Backup & Export Actions
    this.dom.btnActionExportJson.addEventListener('click', () => {
      store.exportDataAsJSON();
      this.showToast('JSON Backup downloaded!', 'success');
    });

    this.dom.btnActionExportCsv.addEventListener('click', () => {
      store.exportDataAsCSV();
      this.showToast('CSV export downloaded!', 'success');
    });

    this.dom.importJsonFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const res = store.importDataFromJSON(event.target.result);
        if (res.success) {
          this.showToast(`Successfully restored ${res.count} tasks!`, 'success');
          this.closeBackupModal();
        } else {
          this.showToast(`Import error: ${res.error}`, 'warning');
        }
      };
      reader.readAsText(file);
    });

    this.dom.btnActionResetDefaults.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all tasks to the sample demonstration data?')) {
        store.resetToDefault();
        this.showToast('Reset to starter tasks!', 'info');
        this.closeBackupModal();
      }
    });

    // 13. Focus Timer Controls
    this.dom.btnFocusToggle.addEventListener('click', () => {
      if (this.timer.isRunning) {
        this.timer.pause();
      } else {
        this.timer.start();
      }
    });

    this.dom.btnFocusReset.addEventListener('click', () => {
      this.timer.reset();
    });

    this.dom.focusModeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.dom.focusModeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-focus-mode');
        this.timer.setMode(mode);
      });
    });

    // 14. Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

      if (e.key === 'Escape') {
        this.closeAllModals();
        return;
      }

      if (isInput) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        this.openTaskModal();
      } else if (e.key === '/') {
        e.preventDefault();
        this.dom.searchInput.focus();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        this.openFocusModal();
      } else if (e.key === '?') {
        e.preventDefault();
        this.openShortcutsModal();
      } else if (e.key === '1') {
        this.setViewMode('list');
      } else if (e.key === '2') {
        this.setViewMode('board');
      } else if (e.key === '3') {
        this.setViewMode('calendar');
      } else if (e.key === '4') {
        this.setViewMode('analytics');
      }
    });
  }

  // ==========================================
  // Auth Modal & User UI
  // ==========================================
  updateAuthUI() {
    if (api.isLoggedIn()) {
      const user = api.currentUser;
      this.dom.authBtnLabel.textContent = `☁️ ${user.name || user.email.split('@')[0]}`;
      this.dom.dropdownUserName.textContent = user.name || 'TaskFlow User';
      this.dom.dropdownUserEmail.textContent = user.email;
    } else {
      this.dom.authBtnLabel.textContent = 'Sign In / Sync';
    }
  }

  openAuthModal() {
    this.dom.authForm.reset();
    this.setAuthMode('login');
    this.dom.authModalOverlay.classList.add('active');
    setTimeout(() => this.dom.authEmailInput.focus(), 50);
  }

  closeAuthModal() {
    this.dom.authModalOverlay.classList.remove('active');
  }

  setAuthMode(mode) {
    this.authMode = mode;
    if (mode === 'login') {
      this.dom.authModalTitle.textContent = 'Sign In to TaskFlow';
      this.dom.tabAuthLogin.classList.add('active');
      this.dom.tabAuthRegister.classList.remove('active');
      this.dom.authNameGroup.style.display = 'none';
      this.dom.authNameInput.removeAttribute('required');
      this.dom.btnAuthSubmit.textContent = 'Sign In';
    } else {
      this.dom.authModalTitle.textContent = 'Create Free Account';
      this.dom.tabAuthLogin.classList.remove('active');
      this.dom.tabAuthRegister.classList.add('active');
      this.dom.authNameGroup.style.display = 'flex';
      this.dom.authNameInput.setAttribute('required', 'true');
      this.dom.btnAuthSubmit.textContent = 'Create Account & Sync';
    }
  }

  async handleAuthSubmit() {
    const email = this.dom.authEmailInput.value.trim();
    const password = this.dom.authPasswordInput.value;
    const name = this.dom.authNameInput.value.trim();

    try {
      this.dom.btnAuthSubmit.disabled = true;
      this.dom.btnAuthSubmit.textContent = 'Connecting...';

      if (this.authMode === 'login') {
        await api.login(email, password);
        this.showToast('🎉 Logged in! Syncing database...', 'success');
      } else {
        await api.register(name, email, password);
        this.showToast('🎉 Account created! Syncing database...', 'success');
      }

      this.updateAuthUI();
      this.closeAuthModal();

      // Trigger cloud sync
      await store.syncWithCloud();
      this.showToast('✅ Cloud Database Synced!', 'success');
    } catch (err) {
      this.showToast(`⚠️ ${err.message}`, 'warning');
    } finally {
      this.dom.btnAuthSubmit.disabled = false;
      this.dom.btnAuthSubmit.textContent = this.authMode === 'login' ? 'Sign In' : 'Create Account & Sync';
    }
  }

  // ==========================================
  // Render & Routing
  // ==========================================
  render() {
    this.populateCategories();
    this.updateViewHeading();

    const tasks = store.getFilteredTasks();
    const categories = store.categories;

    const handlers = {
      onToggleStatus: async (id, isChecked) => {
        const updated = await store.toggleTaskStatus(id);
        if (updated && updated.status === 'completed') {
          sounds.playCompleteChime();
          if (store.settings.confettiEnabled) {
            fireConfetti();
          }
          this.showToast(`Completed: ${updated.title}`, 'success');
        }
        this.render();
        this.updateSidebarStats();
      },
      onToggleSubtask: (taskId, subtaskId) => {
        store.toggleSubtask(taskId, subtaskId);
        sounds.playClick();
        this.render();
        this.updateSidebarStats();
      },
      onTogglePin: async (id) => {
        const updated = await store.togglePin(id);
        if (updated) {
          this.showToast(updated.pinned ? '📌 Pinned task' : 'Unpinned task', 'info');
        }
        this.render();
        this.updateSidebarStats();
      },
      onEditTask: (task) => {
        this.openTaskModal(task);
      },
      onDeleteTask: async (id) => {
        const deleted = await store.deleteTask(id);
        if (deleted) {
          this.showToast(`Deleted: ${deleted.title}`, 'info');
        }
        this.render();
        this.updateSidebarStats();
      },
      onFocusTask: (task) => {
        this.timer.attachTask(task);
        this.openFocusModal();
      },
      onMoveTaskStatus: async (taskId, newStatus) => {
        const updated = await store.updateTask(taskId, { status: newStatus });
        if (updated && newStatus === 'completed') {
          sounds.playCompleteChime();
          fireConfetti();
        }
      },
      onNewTask: (defaults = {}) => {
        this.openTaskModal(null, defaults);
      }
    };

    if (this.currentViewMode === 'list') {
      renderListView(this.dom.viewContentContainer, tasks, categories, handlers);
    } else if (this.currentViewMode === 'board') {
      renderKanbanView(this.dom.viewContentContainer, tasks, categories, handlers);
    } else if (this.currentViewMode === 'calendar') {
      renderCalendarView(this.dom.viewContentContainer, store.tasks, categories, handlers);
    } else if (this.currentViewMode === 'analytics') {
      renderAnalyticsView(this.dom.viewContentContainer, store);
    }
  }

  setViewMode(mode) {
    this.currentViewMode = mode;
    
    this.dom.viewModeTabs.forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-mode') === mode);
      tab.setAttribute('aria-selected', tab.getAttribute('data-mode') === mode ? 'true' : 'false');
    });

    this.dom.mobileNavBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-bottom-view') === mode);
    });

    this.dom.filterControlsGroup.style.display = mode === 'analytics' ? 'none' : 'flex';
    this.render();
  }

  updateViewHeading() {
    const view = store.filter.view;
    let title = 'All Tasks';
    
    if (view === 'today') title = 'Today’s Tasks';
    else if (view === 'upcoming') title = 'Upcoming Deadlines';
    else if (view === 'urgent') title = 'Important & Urgent';
    else if (view === 'overdue') title = 'Overdue Tasks';
    else if (view === 'completed') title = 'Completed Tasks';
    else if (view.startsWith('category:')) title = `${view.replace('category:', '')} Tasks`;

    this.dom.currentViewTitle.textContent = title;
    const count = store.getFilteredTasks().length;
    this.dom.currentViewBadge.textContent = `${count} ${count === 1 ? 'task' : 'tasks'}`;
  }

  populateCategories() {
    this.dom.categoriesList.innerHTML = '';
    store.categories.forEach(cat => {
      const count = store.tasks.filter(t => (t.category || '').toLowerCase() === cat.name.toLowerCase() && t.status !== 'completed').length;
      const isSelected = store.filter.view === `category:${cat.name}`;

      const itemWrap = document.createElement('div');
      itemWrap.className = 'cat-item-wrap';
      itemWrap.innerHTML = `
        <button class="cat-item ${isSelected ? 'active' : ''}" data-cat="${cat.name}">
          <span class="cat-dot" style="background-color: ${cat.color}"></span>
          <span class="nav-text">${escapeHTML(cat.name)}</span>
          <span class="nav-count">${count}</span>
        </button>
        ${!['Work', 'Personal', 'Study', 'Health', 'Finance'].includes(cat.name) ? `
          <button class="btn-icon-sm btn-del-cat" title="Delete category" data-cat-id="${cat.id}">
            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        ` : ''}
      `;

      itemWrap.querySelector('.cat-item').addEventListener('click', () => {
        this.dom.navItems.forEach(b => b.classList.remove('active'));
        this.dom.categoriesList.querySelectorAll('.cat-item').forEach(b => b.classList.remove('active'));
        itemWrap.querySelector('.cat-item').classList.add('active');
        store.setFilter({ view: `category:${cat.name}` });
        this.toggleSidebar(false);
      });

      itemWrap.querySelector('.btn-del-cat')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete category "${cat.name}"?`)) {
          store.deleteCategory(cat.id);
          this.populateCategories();
        }
      });

      this.dom.categoriesList.appendChild(itemWrap);
    });

    this.dom.taskCategorySelect.innerHTML = store.categories.map(c => `
      <option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>
    `).join('');
  }

  updateSidebarStats() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const all = store.tasks.length;
    const today = store.tasks.filter(t => t.dueDate === todayStr).length;
    const upcoming = store.tasks.filter(t => t.dueDate && t.dueDate > todayStr && t.status !== 'completed').length;
    const urgent = store.tasks.filter(t => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'completed').length;
    const overdue = store.tasks.filter(t => t.dueDate && t.dueDate < todayStr && t.status !== 'completed').length;
    const completed = store.tasks.filter(t => t.status === 'completed').length;

    this.dom.countAll.textContent = all;
    this.dom.countToday.textContent = today;
    this.dom.countUpcoming.textContent = upcoming;
    this.dom.countUrgent.textContent = urgent;
    this.dom.countOverdue.textContent = overdue;
    this.dom.countCompleted.textContent = completed;

    const analytics = store.getAnalytics();
    this.dom.sidebarStreakCount.textContent = `${analytics.streak} Day Streak`;
    this.dom.sidebarProgressFill.style.width = `${analytics.rate}%`;
  }

  toggleSidebar(open) {
    this.dom.sidebar.classList.toggle('open', open);
    this.dom.sidebarBackdrop.classList.toggle('active', open);
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    store.settings.theme = theme;
    store.saveSettings();
  }

  // ==========================================
  // Task Modal Handlers
  // ==========================================
  openTaskModal(task = null, defaults = {}) {
    this.activeModalSubtasks = task && task.subtasks ? JSON.parse(JSON.stringify(task.subtasks)) : [];

    if (task) {
      this.dom.modalTaskHeading.textContent = 'Edit Task';
      this.dom.taskIdInput.value = task.id;
      this.dom.taskTitleInput.value = task.title;
      this.dom.taskDescInput.value = task.description || '';
      this.dom.taskCategorySelect.value = task.category || 'Personal';
      
      const priorityRadio = this.dom.taskForm.querySelector(`input[name="task-priority"][value="${task.priority}"]`);
      if (priorityRadio) priorityRadio.checked = true;

      this.dom.taskDueDateInput.value = task.dueDate || '';
      this.dom.taskDueTimeInput.value = task.dueTime || '';
      this.dom.taskReminderCheck.checked = Boolean(task.reminder);
      this.dom.taskPinCheck.checked = Boolean(task.pinned);
      this.dom.taskTagsInput.value = task.tags ? task.tags.join(', ') : '';
    } else {
      this.dom.modalTaskHeading.textContent = 'New Task';
      this.dom.taskIdInput.value = '';
      this.dom.taskForm.reset();
      
      if (defaults.dueDate) this.dom.taskDueDateInput.value = defaults.dueDate;
      if (defaults.category) this.dom.taskCategorySelect.value = defaults.category;
      
      const defPriorityRadio = this.dom.taskForm.querySelector('input[name="task-priority"][value="medium"]');
      if (defPriorityRadio) defPriorityRadio.checked = true;
    }

    this.renderModalSubtasks();
    this.dom.taskModalOverlay.classList.add('active');
    setTimeout(() => this.dom.taskTitleInput.focus(), 50);
  }

  closeTaskModal() {
    this.dom.taskModalOverlay.classList.remove('active');
  }

  handleAddSubtaskInModal() {
    const text = this.dom.newSubtaskInput.value.trim();
    if (!text) return;
    this.activeModalSubtasks.push({
      id: 'st_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title: text,
      completed: false
    });
    this.dom.newSubtaskInput.value = '';
    this.renderModalSubtasks();
  }

  renderModalSubtasks() {
    this.dom.modalSubtasksList.innerHTML = '';
    this.dom.modalSubtasksCount.textContent = `${this.activeModalSubtasks.length} items`;

    this.activeModalSubtasks.forEach((st, idx) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'subtask-input-item';
      itemEl.innerHTML = `
        <input type="checkbox" ${st.completed ? 'checked' : ''}>
        <span>${escapeHTML(st.title)}</span>
        <button type="button" class="btn-icon-sm" data-idx="${idx}" title="Remove subtask">✕</button>
      `;

      itemEl.querySelector('input').addEventListener('change', (e) => {
        st.completed = e.target.checked;
      });

      itemEl.querySelector('button').addEventListener('click', () => {
        this.activeModalSubtasks.splice(idx, 1);
        this.renderModalSubtasks();
      });

      this.dom.modalSubtasksList.appendChild(itemEl);
    });
  }

  async handleTaskFormSubmit() {
    const id = this.dom.taskIdInput.value;
    const title = this.dom.taskTitleInput.value.trim();
    const description = this.dom.taskDescInput.value.trim();
    const category = this.dom.taskCategorySelect.value;
    const priority = this.dom.taskForm.querySelector('input[name="task-priority"]:checked')?.value || 'medium';
    const dueDate = this.dom.taskDueDateInput.value;
    const dueTime = this.dom.taskDueTimeInput.value;
    const reminder = this.dom.taskReminderCheck.checked;
    const pinned = this.dom.taskPinCheck.checked;
    const tags = this.dom.taskTagsInput.value.split(',').map(t => t.trim()).filter(Boolean);

    const taskPayload = {
      title,
      description,
      category,
      priority,
      dueDate,
      dueTime,
      reminder,
      pinned,
      tags,
      subtasks: this.activeModalSubtasks
    };

    if (id) {
      await store.updateTask(id, taskPayload);
      this.showToast('Task updated successfully!', 'success');
    } else {
      await store.addTask(taskPayload);
      this.showToast('New task added!', 'success');
      sounds.playClick();
    }

    this.closeTaskModal();
    this.render();
    this.updateSidebarStats();
  }

  // ==========================================
  // Category, Backup & Shortcuts Modals
  // ==========================================
  openCategoryModal() {
    this.dom.categoryForm.reset();
    this.dom.categoryModalOverlay.classList.add('active');
    setTimeout(() => this.dom.catNameInput.focus(), 50);
  }

  closeCategoryModal() {
    this.dom.categoryModalOverlay.classList.remove('active');
  }

  async openBackupModal() {
    this.dom.backupModalOverlay.classList.add('active');
    
    // Update live persistent storage stats
    try {
      const metrics = await store.getStorageMetrics();
      if (this.dom.storagePersistBadge) {
        if (metrics.isPersisted) {
          this.dom.storagePersistBadge.textContent = 'Persisted';
          this.dom.storagePersistBadge.style.background = 'rgba(16, 185, 129, 0.2)';
          this.dom.storagePersistBadge.style.color = '#10b981';
          if (this.dom.storagePersistTitle) this.dom.storagePersistTitle.textContent = 'Persistent Storage Active';
          if (this.dom.storagePersistIcon) this.dom.storagePersistIcon.textContent = '🔒';
          if (this.dom.storagePersistDesc) this.dom.storagePersistDesc.textContent = 'Your tasks and settings are granted permanent storage mode and protected from browser auto-eviction.';
        } else {
          this.dom.storagePersistBadge.textContent = 'Standard';
          this.dom.storagePersistBadge.style.background = 'rgba(245, 158, 11, 0.2)';
          this.dom.storagePersistBadge.style.color = '#f59e0b';
          if (this.dom.storagePersistTitle) this.dom.storagePersistTitle.textContent = 'Standard Local Storage';
          if (this.dom.storagePersistIcon) this.dom.storagePersistIcon.textContent = '💾';
          if (this.dom.storagePersistDesc) this.dom.storagePersistDesc.textContent = 'Stored locally on your browser with cloud database synchronization.';
        }
      }

      if (this.dom.storageQuotaText) {
        if (metrics.usageBytes > 0) {
          this.dom.storageQuotaText.textContent = `Used: ${metrics.usageKB > 1024 ? metrics.usageMB + ' MB' : metrics.usageKB + ' KB'} (Quota: ${metrics.quotaMB} MB)`;
        } else {
          this.dom.storageQuotaText.textContent = `Local Storage: Active`;
        }
      }

      if (this.dom.storageTasksCount) {
        this.dom.storageTasksCount.textContent = `Tasks: ${metrics.tasksCount} | Categories: ${metrics.categoriesCount}`;
      }
    } catch (e) {
      console.warn('Error loading storage metrics:', e);
    }
  }

  closeBackupModal() {
    this.dom.backupModalOverlay.classList.remove('active');
  }

  openShortcutsModal() {
    this.dom.shortcutsModalOverlay.classList.add('active');
  }

  closeShortcutsModal() {
    this.dom.shortcutsModalOverlay.classList.remove('active');
  }

  closeAllModals() {
    this.closeTaskModal();
    this.closeCategoryModal();
    this.closeBackupModal();
    this.closeShortcutsModal();
    this.closeFocusModal();
    this.closeAuthModal();
    this.toggleSidebar(false);
  }

  // ==========================================
  // Focus / Pomodoro Timer Handlers
  // ==========================================
  openFocusModal() {
    const state = this.timer.getState();
    this.handleTimerTick(state);
    this.dom.focusModalOverlay.classList.add('active');
  }

  closeFocusModal() {
    this.dom.focusModalOverlay.classList.remove('active');
  }

  handleTimerTick(state) {
    this.dom.headerFocusTimerText.textContent = `${state.formattedTime} ${state.isRunning ? 'Active' : 'Focus'}`;
    this.dom.focusDigitsDisplay.textContent = state.formattedTime;
    this.dom.focusSubStatus.textContent = state.isRunning 
      ? (state.mode === 'pomodoro' ? 'Deep Work Session' : 'Rest & Recharge') 
      : 'Ready to Start';

    const radius = 110;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (state.progress * circumference);
    this.dom.focusSvgProgress.style.strokeDasharray = circumference;
    this.dom.focusSvgProgress.style.strokeDashoffset = offset;

    if (state.isRunning) {
      this.dom.focusBtnLabel.textContent = 'Pause';
      this.dom.focusPlayIcon.innerHTML = `<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>`;
    } else {
      this.dom.focusBtnLabel.textContent = 'Start Session';
      this.dom.focusPlayIcon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"></polygon>`;
    }

    if (state.activeTask) {
      this.dom.focusTaskTitleDisplay.textContent = state.activeTask.title;
    } else {
      this.dom.focusTaskTitleDisplay.textContent = 'General Focus Session';
    }

    this.dom.focusSessionsCounter.textContent = state.completedSessions;
  }

  handleTimerComplete(state) {
    this.handleTimerTick(state);
    fireConfetti();
    this.showToast('🎉 Focus timer session complete!', 'success');
  }

  // ==========================================
  // Cross-Device Cloud Authentication & Sync
  // ==========================================
  setAuthMode(mode) {
    this.authMode = mode;
    if (mode === 'register') {
      this.dom.tabAuthRegister.classList.add('active');
      this.dom.tabAuthLogin.classList.remove('active');
      this.dom.authModalTitle.textContent = 'Create TaskFlow Account';
      this.dom.authNameGroup.style.display = 'block';
      this.dom.btnAuthSubmit.textContent = 'Create Account & Sync';
      if (this.dom.authPasswordInput) this.dom.authPasswordInput.autocomplete = 'new-password';
    } else {
      this.dom.tabAuthLogin.classList.add('active');
      this.dom.tabAuthRegister.classList.remove('active');
      this.dom.authModalTitle.textContent = 'Sign In to TaskFlow';
      this.dom.authNameGroup.style.display = 'none';
      this.dom.btnAuthSubmit.textContent = 'Sign In & Sync';
      if (this.dom.authPasswordInput) this.dom.authPasswordInput.autocomplete = 'current-password';
    }
  }

  openAuthModal() {
    this.setAuthMode(this.authMode || 'login');
    this.dom.authModalOverlay.classList.add('active');
    setTimeout(() => {
      if (this.authMode === 'register') {
        this.dom.authNameInput?.focus();
      } else {
        this.dom.authEmailInput?.focus();
      }
    }, 50);
  }

  closeAuthModal() {
    this.dom.authModalOverlay.classList.remove('active');
    this.dom.authForm.reset();
  }

  updateAuthUI() {
    if (api.isLoggedIn()) {
      const user = api.currentUser || {};
      const firstName = (user.name || 'User').split(' ')[0];
      if (this.dom.authBtnLabel) {
        this.dom.authBtnLabel.textContent = firstName;
      }
      if (this.dom.dropdownUserName) {
        this.dom.dropdownUserName.textContent = user.name || 'User';
      }
      if (this.dom.dropdownUserEmail) {
        this.dom.dropdownUserEmail.textContent = user.email || '';
      }
      if (this.dom.btnAuthTrigger) {
        this.dom.btnAuthTrigger.classList.add('btn-user-logged-in');
        this.dom.btnAuthTrigger.title = `Signed in as ${user.name} (${user.email}) - Click for options`;
      }
    } else {
      if (this.dom.authBtnLabel) {
        this.dom.authBtnLabel.textContent = 'Sign In / Sync';
      }
      if (this.dom.btnAuthTrigger) {
        this.dom.btnAuthTrigger.classList.remove('btn-user-logged-in');
        this.dom.btnAuthTrigger.title = 'Sign in to sync tasks across all your devices';
      }
    }
  }

  async handleAuthSubmit() {
    const email = this.dom.authEmailInput.value.trim().toLowerCase();
    const password = this.dom.authPasswordInput.value;
    const name = this.dom.authNameInput ? this.dom.authNameInput.value.trim() : '';

    if (!email || !password) {
      this.showToast('Please enter both email and password', 'warning');
      return;
    }

    this.dom.btnAuthSubmit.disabled = true;
    const originalText = this.dom.btnAuthSubmit.textContent;
    this.dom.btnAuthSubmit.textContent = 'Connecting...';

    try {
      if (this.authMode === 'register') {
        if (!name) {
          this.showToast('Please enter your full name', 'warning');
          this.dom.btnAuthSubmit.disabled = false;
          this.dom.btnAuthSubmit.textContent = originalText;
          return;
        }
        await api.register(name, email, password);
        this.showToast(`🎉 Account created! Welcome, ${name}`, 'success');
      } else {
        const res = await api.login(email, password);
        this.showToast(`👋 Welcome back, ${res.user.name}!`, 'success');
      }

      this.closeAuthModal();
      this.updateAuthUI();

      // Pull canonical cloud state for the logged-in user
      this.showToast('🔄 Synchronizing your tasks across devices...', 'info');
      const syncRes = await store.syncWithCloud(true);

      this.populateCategories();
      this.render();
      this.startCrossDeviceSync();

      if (syncRes && syncRes.success) {
        this.showToast(`✅ Cross-device sync complete (${syncRes.count} tasks)`, 'success');
      }
    } catch (err) {
      this.showToast(`❌ ${err.message || 'Authentication failed'}`, 'error');
    } finally {
      this.dom.btnAuthSubmit.disabled = false;
      this.dom.btnAuthSubmit.textContent = originalText;
    }
  }

  startCrossDeviceSync() {
    this.stopCrossDeviceSync();
    // Poll every 8 seconds when active to seamlessly mirror changes across devices
    this.crossDeviceSyncInterval = setInterval(async () => {
      if (api.isLoggedIn() && document.visibilityState !== 'hidden') {
        await store.syncWithCloud();
      }
    }, 8000);
  }

  stopCrossDeviceSync() {
    if (this.crossDeviceSyncInterval) {
      clearInterval(this.crossDeviceSyncInterval);
      this.crossDeviceSyncInterval = null;
    }
  }
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${escapeHTML(message)}</span>`;

    this.dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // ==========================================
  // PWA Setup & Service Worker
  // ==========================================
  initPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('ServiceWorker registered:', reg.scope))
          .catch(err => console.warn('ServiceWorker registration error:', err));
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      this.dom.pwaInstallBanner.style.display = 'flex';
    });

    this.dom.btnPwaInstall?.addEventListener('click', async () => {
      if (this.deferredInstallPrompt) {
        this.deferredInstallPrompt.prompt();
        const { outcome } = await this.deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          this.dom.pwaInstallBanner.style.display = 'none';
        }
        this.deferredInstallPrompt = null;
      }
    });

    this.dom.btnPwaDismiss?.addEventListener('click', () => {
      this.dom.pwaInstallBanner.style.display = 'none';
    });
  }
}

// Utility escape
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
