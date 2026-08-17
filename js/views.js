// ==========================================
// View Renderers (List, Kanban, Calendar, Analytics)
// ==========================================

// Helper: Format Date nicely
export function formatDueDate(dateStr, timeStr) {
  if (!dateStr) return null;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  let label = '';
  let statusClass = '';

  if (dateStr === today) {
    label = 'Today';
    statusClass = 'due-today';
  } else if (dateStr === tomorrow) {
    label = 'Tomorrow';
    statusClass = 'due-tomorrow';
  } else if (dateStr === yesterday) {
    label = 'Yesterday';
    statusClass = 'due-overdue';
  } else if (dateStr < today) {
    label = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    statusClass = 'due-overdue';
  } else {
    label = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    statusClass = 'due-future';
  }

  if (timeStr) {
    label += ` at ${timeStr}`;
  }

  return { label, statusClass, isOverdue: dateStr < today };
}

// Priority Icon/Badge details
export const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: '#ef4444', icon: '🔴' },
  high: { label: 'High', color: '#f97316', icon: '🟠' },
  medium: { label: 'Medium', color: '#3b82f6', icon: '🔵' },
  low: { label: 'Low', color: '#10b981', icon: '🟢' }
};

// ==========================================
// 1. Task Card / List Item Component
// ==========================================
export function createTaskCard(task, categories, handlers, viewMode = 'list') {
  const card = document.createElement('div');
  card.className = `task-card priority-${task.priority} ${task.status === 'completed' ? 'is-completed' : ''} ${task.pinned ? 'is-pinned' : ''}`;
  card.setAttribute('data-id', task.id);
  card.setAttribute('draggable', 'true');

  const catObj = categories.find(c => c.name.toLowerCase() === task.category.toLowerCase()) || { color: '#6366f1' };
  const dueInfo = formatDueDate(task.dueDate, task.dueTime);
  
  // Subtask progress
  const subtasksTotal = task.subtasks ? task.subtasks.length : 0;
  const subtasksDone = task.subtasks ? task.subtasks.filter(st => st.completed).length : 0;
  const subtaskPercent = subtasksTotal > 0 ? Math.round((subtasksDone / subtasksTotal) * 100) : 0;

  card.innerHTML = `
    <div class="task-card-inner">
      <div class="task-left-section">
        <label class="task-checkbox-container" title="${task.status === 'completed' ? 'Mark as incomplete' : 'Mark as completed'}">
          <input type="checkbox" class="task-checkbox" ${task.status === 'completed' ? 'checked' : ''}>
          <span class="custom-checkbox">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </span>
        </label>
      </div>

      <div class="task-content">
        <div class="task-header-row">
          <span class="task-category-badge" style="--cat-color: ${catObj.color}">
            <span class="cat-dot" style="background-color: ${catObj.color}"></span>
            ${escapeHTML(task.category)}
          </span>

          <span class="task-priority-badge priority-badge-${task.priority}">
            ${PRIORITY_CONFIG[task.priority]?.icon || ''} ${PRIORITY_CONFIG[task.priority]?.label || task.priority}
          </span>

          ${task.pinned ? `<span class="task-pin-badge" title="Pinned to top">📌</span>` : ''}
          ${task.reminder ? `<span class="task-reminder-badge" title="Reminder scheduled">🔔</span>` : ''}
        </div>

        <h3 class="task-title ${task.status === 'completed' ? 'line-through' : ''}">${escapeHTML(task.title)}</h3>
        
        ${task.description ? `<p class="task-description">${escapeHTML(task.description)}</p>` : ''}

        <!-- Subtasks Checklist Section -->
        ${subtasksTotal > 0 ? `
          <div class="task-subtasks-preview">
            <div class="subtask-progress-header">
              <span>Subtasks (${subtasksDone}/${subtasksTotal})</span>
              <span>${subtaskPercent}%</span>
            </div>
            <div class="subtask-progress-bar">
              <div class="subtask-progress-fill" style="width: ${subtaskPercent}%"></div>
            </div>
            <div class="subtasks-list-inline">
              ${task.subtasks.map(st => `
                <label class="subtask-item ${st.completed ? 'completed' : ''}" data-subtask-id="${st.id}">
                  <input type="checkbox" class="subtask-checkbox" ${st.completed ? 'checked' : ''}>
                  <span class="subtask-text">${escapeHTML(st.title)}</span>
                </label>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Footer: Tags & Due Date -->
        <div class="task-footer">
          <div class="task-meta-left">
            ${dueInfo ? `
              <div class="task-due-date ${dueInfo.statusClass}" title="Due date">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>${dueInfo.label}</span>
              </div>
            ` : ''}

            ${task.tags && task.tags.length > 0 ? `
              <div class="task-tags-group">
                ${task.tags.map(t => `<span class="task-tag">#${escapeHTML(t)}</span>`).join('')}
              </div>
            ` : ''}
          </div>

          <div class="task-actions">
            <button class="btn-icon btn-task-focus" title="Start Focus Timer on this task" data-action="focus">
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </button>
            <button class="btn-icon btn-task-pin" title="${task.pinned ? 'Unpin' : 'Pin'}" data-action="pin">
              ${task.pinned ? '📍' : '📌'}
            </button>
            <button class="btn-icon btn-task-edit" title="Edit task" data-action="edit">
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn-icon btn-task-delete" title="Delete task" data-action="delete">
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach Event Handlers
  const checkbox = card.querySelector('.task-checkbox');
  checkbox.addEventListener('change', (e) => {
    e.stopPropagation();
    handlers.onToggleStatus(task.id, e.target.checked);
  });

  // Inline Subtask checkboxes
  card.querySelectorAll('.subtask-checkbox').forEach(stBox => {
    stBox.addEventListener('change', (e) => {
      e.stopPropagation();
      const stItem = e.target.closest('.subtask-item');
      const subtaskId = stItem.getAttribute('data-subtask-id');
      handlers.onToggleSubtask(task.id, subtaskId);
    });
  });

  // Action buttons
  card.querySelector('.btn-task-focus')?.addEventListener('click', (e) => {
    e.stopPropagation();
    handlers.onFocusTask(task);
  });

  card.querySelector('.btn-task-pin')?.addEventListener('click', (e) => {
    e.stopPropagation();
    handlers.onTogglePin(task.id);
  });

  card.querySelector('.btn-task-edit')?.addEventListener('click', (e) => {
    e.stopPropagation();
    handlers.onEditTask(task);
  });

  card.querySelector('.btn-task-delete')?.addEventListener('click', (e) => {
    e.stopPropagation();
    handlers.onDeleteTask(task.id);
  });

  // Click card to open edit view
  card.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('label')) return;
    handlers.onEditTask(task);
  });

  // HTML5 Drag & Drop
  card.addEventListener('dragstart', (e) => {
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
  });

  return card;
}

// ==========================================
// 2. Render List View
// ==========================================
export function renderListView(container, tasks, categories, handlers) {
  container.innerHTML = '';
  
  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✨</div>
        <h3>No tasks found</h3>
        <p>No tasks match the active filter or search query. Click below to add a new task!</p>
        <button class="btn btn-primary btn-add-empty" id="btn-empty-new-task">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Create Task
        </button>
      </div>
    `;
    container.querySelector('#btn-empty-new-task')?.addEventListener('click', () => handlers.onNewTask());
    return;
  }

  const listWrapper = document.createElement('div');
  listWrapper.className = 'task-list-wrapper';

  // Group into Active and Completed
  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  if (activeTasks.length > 0) {
    const activeSection = document.createElement('div');
    activeSection.className = 'task-section';
    activeSection.innerHTML = `<h4 class="section-title">Active Tasks (${activeTasks.length})</h4>`;
    const activeList = document.createElement('div');
    activeList.className = 'task-card-group';

    activeTasks.forEach(task => {
      activeList.appendChild(createTaskCard(task, categories, handlers, 'list'));
    });
    activeSection.appendChild(activeList);
    listWrapper.appendChild(activeSection);
  }

  if (completedTasks.length > 0) {
    const completedSection = document.createElement('div');
    completedSection.className = 'task-section completed-section';
    completedSection.innerHTML = `
      <div class="completed-section-header">
        <h4 class="section-title">Completed (${completedTasks.length})</h4>
        <button class="btn-text-toggle" id="btn-toggle-completed">Hide</button>
      </div>
    `;
    const completedList = document.createElement('div');
    completedList.className = 'task-card-group completed-cards-list';

    completedTasks.forEach(task => {
      completedList.appendChild(createTaskCard(task, categories, handlers, 'list'));
    });

    completedSection.appendChild(completedList);
    listWrapper.appendChild(completedSection);

    const toggleBtn = completedSection.querySelector('#btn-toggle-completed');
    toggleBtn.addEventListener('click', () => {
      const isHidden = completedList.style.display === 'none';
      completedList.style.display = isHidden ? 'flex' : 'none';
      toggleBtn.textContent = isHidden ? 'Hide' : 'Show';
    });
  }

  container.appendChild(listWrapper);
}

// ==========================================
// 3. Render Kanban Board View
// ==========================================
export function renderKanbanView(container, tasks, categories, handlers) {
  container.innerHTML = '';

  const columns = [
    { id: 'todo', title: 'To Do', icon: '📝', color: '#6366f1' },
    { id: 'in-progress', title: 'In Progress', icon: '⚡', color: '#f59e0b' },
    { id: 'completed', title: 'Done', icon: '✅', color: '#10b981' }
  ];

  const boardWrapper = document.createElement('div');
  boardWrapper.className = 'kanban-board';

  columns.forEach(col => {
    const colTasks = tasks.filter(t => t.status === col.id);
    const colEl = document.createElement('div');
    colEl.className = 'kanban-column';
    colEl.setAttribute('data-status', col.id);

    colEl.innerHTML = `
      <div class="kanban-column-header">
        <div class="kanban-column-title">
          <span class="kanban-col-icon">${col.icon}</span>
          <span class="kanban-col-name">${col.title}</span>
          <span class="kanban-col-count">${colTasks.length}</span>
        </div>
        <button class="btn-icon btn-add-col-task" title="Add task to ${col.title}" data-col="${col.id}">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
      </div>
      <div class="kanban-cards-container" data-status="${col.id}"></div>
    `;

    const cardsContainer = colEl.querySelector('.kanban-cards-container');

    // Drag over container
    cardsContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      cardsContainer.classList.add('drag-over');
    });

    cardsContainer.addEventListener('dragleave', () => {
      cardsContainer.classList.remove('drag-over');
    });

    cardsContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      cardsContainer.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      if (taskId) {
        handlers.onMoveTaskStatus(taskId, col.id);
      }
    });

    if (colTasks.length === 0) {
      cardsContainer.innerHTML = `<div class="kanban-empty-col">No tasks in ${col.title}</div>`;
    } else {
      colTasks.forEach(task => {
        cardsContainer.appendChild(createTaskCard(task, categories, handlers, 'board'));
      });
    }

    colEl.querySelector('.btn-add-col-task').addEventListener('click', () => {
      handlers.onNewTask({ status: col.id });
    });

    boardWrapper.appendChild(colEl);
  });

  container.appendChild(boardWrapper);
}

// ==========================================
// 4. Render Calendar View
// ==========================================
export function renderCalendarView(container, tasks, categories, handlers, currentDate = new Date()) {
  container.innerHTML = '';

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarWrapper = document.createElement('div');
  calendarWrapper.className = 'calendar-view-layout';

  calendarWrapper.innerHTML = `
    <div class="calendar-main-card">
      <div class="calendar-nav-header">
        <div class="calendar-title-wrap">
          <h2 class="calendar-month-title">${monthName}</h2>
          <button class="btn btn-outline btn-sm btn-cal-today">Today</button>
        </div>
        <div class="calendar-nav-btns">
          <button class="btn-icon btn-cal-prev" title="Previous month">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <button class="btn-icon btn-cal-next" title="Next month">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
      </div>

      <div class="calendar-grid-header">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>

      <div class="calendar-days-grid" id="calendar-days-grid"></div>
    </div>

    <div class="calendar-day-sidebar" id="calendar-day-sidebar">
      <div class="day-sidebar-header">
        <h3 id="selected-day-title">Select a day</h3>
        <button class="btn btn-primary btn-sm" id="btn-add-for-day">+ Add Task</button>
      </div>
      <div class="day-tasks-list" id="day-tasks-list">
        <div class="empty-hint">Click any day on the calendar to see or add tasks scheduled for that date.</div>
      </div>
    </div>
  `;

  const daysGrid = calendarWrapper.querySelector('#calendar-days-grid');
  const todayStr = new Date().toISOString().slice(0, 10);
  let selectedDateStr = todayStr;

  // Previous month padding days
  for (let x = firstDayIndex; x > 0; x--) {
    const dayNum = totalDaysInPrevMonth - x + 1;
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day-cell prev-month-cell';
    dayEl.innerHTML = `<span class="day-num">${dayNum}</span>`;
    daysGrid.appendChild(dayEl);
  }

  // Current month days
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const formattedDay = String(day).padStart(2, '0');
    const formattedMonth = String(month + 1).padStart(2, '0');
    const dateStr = `${year}-${formattedMonth}-${formattedDay}`;

    const dayTasks = tasks.filter(t => t.dueDate === dateStr);
    const hasCompleted = dayTasks.some(t => t.status === 'completed');
    const hasPending = dayTasks.some(t => t.status !== 'completed');

    const dayEl = document.createElement('div');
    dayEl.className = `calendar-day-cell current-month-cell ${dateStr === todayStr ? 'is-today' : ''} ${dateStr === selectedDateStr ? 'is-selected' : ''}`;
    dayEl.setAttribute('data-date', dateStr);

    dayEl.innerHTML = `
      <div class="cell-top">
        <span class="day-num">${day}</span>
        ${dayTasks.length > 0 ? `<span class="task-count-pill">${dayTasks.length}</span>` : ''}
      </div>
      <div class="cell-tasks-dots">
        ${dayTasks.slice(0, 3).map(t => {
          const cat = categories.find(c => c.name.toLowerCase() === t.category.toLowerCase()) || { color: '#6366f1' };
          return `<span class="task-dot ${t.status === 'completed' ? 'dot-completed' : ''}" style="background-color: ${cat.color}" title="${escapeHTML(t.title)}"></span>`;
        }).join('')}
        ${dayTasks.length > 3 ? `<span class="more-dots">+${dayTasks.length - 3}</span>` : ''}
      </div>
    `;

    dayEl.addEventListener('click', () => {
      calendarWrapper.querySelectorAll('.calendar-day-cell').forEach(c => c.classList.remove('is-selected'));
      dayEl.classList.add('is-selected');
      selectedDateStr = dateStr;
      updateSidebarForDate(dateStr, tasks, categories, handlers, calendarWrapper);
    });

    daysGrid.appendChild(dayEl);
  }

  // Next month padding to fill 35 or 42 grid cells
  const totalRendered = firstDayIndex + totalDaysInMonth;
  const nextMonthPadding = (7 - (totalRendered % 7)) % 7;
  for (let y = 1; y <= nextMonthPadding; y++) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day-cell next-month-cell';
    dayEl.innerHTML = `<span class="day-num">${y}</span>`;
    daysGrid.appendChild(dayEl);
  }

  // Hook up navigation
  calendarWrapper.querySelector('.btn-cal-prev').addEventListener('click', () => {
    const prevDate = new Date(year, month - 1, 1);
    renderCalendarView(container, tasks, categories, handlers, prevDate);
  });

  calendarWrapper.querySelector('.btn-cal-next').addEventListener('click', () => {
    const nextDate = new Date(year, month + 1, 1);
    renderCalendarView(container, tasks, categories, handlers, nextDate);
  });

  calendarWrapper.querySelector('.btn-cal-today').addEventListener('click', () => {
    renderCalendarView(container, tasks, categories, handlers, new Date());
  });

  calendarWrapper.querySelector('#btn-add-for-day').addEventListener('click', () => {
    handlers.onNewTask({ dueDate: selectedDateStr });
  });

  container.appendChild(calendarWrapper);

  // Initial update of sidebar for today
  updateSidebarForDate(selectedDateStr, tasks, categories, handlers, calendarWrapper);
}

function updateSidebarForDate(dateStr, tasks, categories, handlers, wrapper) {
  const titleEl = wrapper.querySelector('#selected-day-title');
  const listEl = wrapper.querySelector('#day-tasks-list');
  const d = new Date(dateStr + 'T00:00:00');
  const formattedTitle = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  titleEl.textContent = formattedTitle;

  const dayTasks = tasks.filter(t => t.dueDate === dateStr);
  listEl.innerHTML = '';

  if (dayTasks.length === 0) {
    listEl.innerHTML = `
      <div class="empty-hint">
        <span>📅</span>
        <p>No tasks scheduled for this date.</p>
      </div>
    `;
  } else {
    dayTasks.forEach(task => {
      listEl.appendChild(createTaskCard(task, categories, handlers, 'list'));
    });
  }
}

// ==========================================
// 5. Render Analytics & Productivity Dashboard
// ==========================================
export function renderAnalyticsView(container, store) {
  container.innerHTML = '';
  const data = store.getAnalytics();

  const analyticsWrapper = document.createElement('div');
  analyticsWrapper.className = 'analytics-dashboard';

  // SVG Progress circle calculations
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (data.rate / 100) * circumference;

  // Max week count for scaling bar chart
  const maxWeekCount = Math.max(...data.weekData.map(d => d.count), 5);

  analyticsWrapper.innerHTML = `
    <!-- Top Stat KPI Cards -->
    <div class="analytics-kpi-grid">
      <div class="kpi-card">
        <div class="kpi-icon-wrap" style="background: rgba(99, 102, 241, 0.15); color: #6366f1;">📋</div>
        <div class="kpi-info">
          <span class="kpi-label">Total Tasks</span>
          <span class="kpi-value">${data.total}</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon-wrap" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">✅</div>
        <div class="kpi-info">
          <span class="kpi-label">Completed</span>
          <span class="kpi-value">${data.completed}</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon-wrap" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b;">🔥</div>
        <div class="kpi-info">
          <span class="kpi-label">Daily Streak</span>
          <span class="kpi-value">${data.streak} ${data.streak === 1 ? 'day' : 'days'}</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon-wrap" style="background: rgba(239, 68, 68, 0.15); color: #ef4444;">⚠️</div>
        <div class="kpi-info">
          <span class="kpi-label">Overdue</span>
          <span class="kpi-value">${data.overdue}</span>
        </div>
      </div>
    </div>

    <!-- Charts Layout -->
    <div class="analytics-charts-grid">
      <!-- 1. Completion Rate Gauge -->
      <div class="analytics-card progress-gauge-card">
        <h3 class="chart-card-title">Completion Efficiency</h3>
        <div class="gauge-center-content">
          <svg class="progress-ring" width="140" height="140">
            <circle class="progress-ring-bg" stroke="rgba(255,255,255,0.08)" stroke-width="12" fill="transparent" r="${radius}" cx="70" cy="70" />
            <circle class="progress-ring-fill" stroke="#6366f1" stroke-width="12" stroke-linecap="round" fill="transparent" r="${radius}" cx="70" cy="70"
              style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${strokeOffset};" />
          </svg>
          <div class="gauge-value-text">
            <span class="gauge-percent">${data.rate}%</span>
            <span class="gauge-sublabel">Done</span>
          </div>
        </div>
        <div class="gauge-legend">
          <div class="legend-item"><span class="dot" style="background: #6366f1"></span> Completed: ${data.completed}</div>
          <div class="legend-item"><span class="dot" style="background: rgba(255,255,255,0.2)"></span> Pending: ${data.pending}</div>
        </div>
      </div>

      <!-- 2. Weekly Activity Bar Chart -->
      <div class="analytics-card bar-chart-card">
        <h3 class="chart-card-title">7-Day Completion Velocity</h3>
        <div class="bar-chart-container">
          ${data.weekData.map(item => {
            const heightPercent = Math.round((item.count / maxWeekCount) * 100);
            return `
              <div class="bar-column" title="${item.count} tasks completed on ${item.date}">
                <span class="bar-value">${item.count > 0 ? item.count : ''}</span>
                <div class="bar-track">
                  <div class="bar-fill" style="height: ${Math.max(item.count > 0 ? heightPercent : 4, 4)}%"></div>
                </div>
                <span class="bar-label">${item.day}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 3. Priority Distribution -->
      <div class="analytics-card priority-dist-card">
        <h3 class="chart-card-title">Priority Breakdown</h3>
        <div class="priority-bars-list">
          ${Object.entries(PRIORITY_CONFIG).map(([key, config]) => {
            const count = data.priorityCounts[key] || 0;
            const percent = data.total > 0 ? Math.round((count / data.total) * 100) : 0;
            return `
              <div class="priority-row">
                <div class="priority-row-labels">
                  <span class="priority-name">${config.icon} ${config.label}</span>
                  <span class="priority-count">${count} (${percent}%)</span>
                </div>
                <div class="priority-meter">
                  <div class="priority-meter-fill" style="width: ${percent}%; background-color: ${config.color}"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 4. Category Breakdown -->
      <div class="analytics-card category-dist-card">
        <h3 class="chart-card-title">Category Distribution</h3>
        <div class="category-breakdown-list">
          ${Object.entries(data.categoryCounts).map(([catName, stats]) => {
            const percent = data.total > 0 ? Math.round((stats.total / data.total) * 100) : 0;
            return `
              <div class="category-stat-item">
                <div class="cat-stat-header">
                  <span class="cat-stat-name">
                    <span class="cat-dot" style="background-color: ${stats.color}"></span>
                    ${escapeHTML(catName)}
                  </span>
                  <span class="cat-stat-counts">${stats.completed}/${stats.total} done</span>
                </div>
                <div class="cat-progress-track">
                  <div class="cat-progress-fill" style="width: ${percent}%; background-color: ${stats.color}"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  container.appendChild(analyticsWrapper);
}

// Utility to escape user text
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
