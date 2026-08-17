# 🚀 TaskFlow — Personal Task Manager (Fullstack PWA)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-purple.svg)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![Database](https://img.shields.io/badge/Database-SQLite%20%2F%20PostgreSQL-blue.svg)](https://www.sqlite.org/)

A personal task manager web application designed to help users organize, track, and manage their daily tasks efficiently. Built as a high-performance Progressive Web App (PWA) with a **Node.js & Express REST API**, persistent **SQLite database**, **JWT authentication**, and seamless offline-to-cloud synchronization across mobile phones, tablets, and laptops.

---

## ✨ Features

- 📋 **Flexible Task Workflows**:
  - **List View**: Grouped by Active and Completed tasks with inline subtask checkboxes.
  - **Kanban Board**: HTML5 Drag-and-drop task cards between `To Do`, `In Progress`, and `Done` columns.
  - **Calendar View**: Interactive monthly calendar grid with date task inspectors.
  - **Productivity & Analytics Dashboard**: Daily completion streak counter (🔥), efficiency gauge, 7-day velocity chart, and category distribution.
- 🎯 **Rich Task Attributes**:
  - Priority levels (`🔴 Urgent`, `🟠 High`, `🔵 Medium`, `🟢 Low`).
  - Categorization with custom color tags (`Work`, `Personal`, `Study`, `Health`, `Finance`, + Custom Categories).
  - Due dates, times, and browser Web Notifications.
  - Subtask checklists with live completion progress bars.
- ⏱️ **Integrated Focus / Pomodoro Timer**:
  - 25m Pomodoro, 5m Short Break, and 15m Long Break modes.
  - Attach active tasks to sessions with audio alarms and celebratory confetti.
- 🔐 **Fullstack User Authentication & Cloud Sync**:
  - User signup and login with secure `bcryptjs` password hashing and JWT bearer tokens.
  - Automatic multi-device cloud synchronization with local storage fallback when offline.
- 📱 **Progressive Web App (PWA)**:
  - Installable directly to Home Screen on iOS, Android, macOS, and Windows.
  - Offline-first caching via Service Worker.
- 🎨 **Modern Glassmorphism UI**:
  - 4 curated themes: **Dark Studio**, **Midnight Blue**, **Cyber Sunset**, and **Crisp Light**.
- 💾 **Data Portability**:
  - One-click JSON backup & restore and CSV spreadsheet export.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom Properties & Glassmorphism), Modular ES6 JavaScript, Web Audio API, Canvas Confetti.
- **Backend**: Node.js, Express.js, JWT (JSON Web Tokens), `bcryptjs`, Helmet security middleware, CORS.
- **Database**: SQLite (`better-sqlite3` with WAL concurrency mode), PostgreSQL-ready.
- **DevOps**: Docker, Docker Compose, Service Worker (`sw.js`), Web App Manifest.

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation
```bash
# 1. Clone the repository
git clone https://github.com/Surya-Prakashh/Task_manager.git
cd Task_manager

# 2. Install dependencies
npm install

# 3. Start the application
npm start
```

Open **`http://localhost:3000`** in your browser.

---

## 🐳 Running with Docker

```bash
docker-compose up -d --build
```

---

## ☁️ Deployment Guide

### Deploy to Render.com
1. Connect your GitHub repository on [Render](https://render.com).
2. Set **Build Command**: `npm install`
3. Set **Start Command**: `npm start`
4. Under **Disks**, add a persistent disk mounted at `/app/data` (Size: 1 GB).

### Deploy to Ubuntu / Linux VPS
```bash
git clone https://github.com/Surya-Prakashh/Task_manager.git
cd Task_manager
npm install --omit=dev
npm install -g pm2
pm2 start server.js --name taskflow
pm2 save
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| <kbd>N</kbd> | Create New Task |
| <kbd>/</kbd> | Focus Search Bar |
| <kbd>F</kbd> | Open Focus / Pomodoro Timer |
| <kbd>1</kbd> - <kbd>4</kbd> | Switch Views (List, Board, Calendar, Stats) |
| <kbd>?</kbd> | Open Shortcuts Guide |
| <kbd>Esc</kbd> | Close Active Modal / Drawer |

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
