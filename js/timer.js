// ==========================================
// Focus & Pomodoro Timer Module
// ==========================================
import { sounds, notifications } from './notifications.js';

export class FocusTimer {
  constructor(onTick, onComplete) {
    this.duration = 25 * 60; // 25 minutes default
    this.remaining = this.duration;
    this.isRunning = false;
    this.timerId = null;
    this.mode = 'pomodoro'; // 'pomodoro' | 'shortBreak' | 'longBreak' | 'custom'
    this.activeTask = null;
    this.completedSessions = parseInt(localStorage.getItem('taskflow_pomodoros') || '0', 10);
    this.onTick = onTick || (() => {});
    this.onComplete = onComplete || (() => {});
  }

  setMode(mode) {
    this.mode = mode;
    this.pause();
    if (mode === 'pomodoro') {
      this.duration = 25 * 60;
    } else if (mode === 'shortBreak') {
      this.duration = 5 * 60;
    } else if (mode === 'longBreak') {
      this.duration = 15 * 60;
    }
    this.remaining = this.duration;
    this.onTick(this.getState());
  }

  setCustomDuration(minutes) {
    this.mode = 'custom';
    this.pause();
    this.duration = Math.max(1, minutes) * 60;
    this.remaining = this.duration;
    this.onTick(this.getState());
  }

  attachTask(task) {
    this.activeTask = task;
    this.onTick(this.getState());
  }

  detachTask() {
    this.activeTask = null;
    this.onTick(this.getState());
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    sounds.playClick();

    this.timerId = setInterval(() => {
      if (this.remaining > 0) {
        this.remaining--;
        this.onTick(this.getState());
        this.updateDocumentTitle();
      } else {
        this.complete();
      }
    }, 1000);

    this.onTick(this.getState());
  }

  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    clearInterval(this.timerId);
    this.timerId = null;
    document.title = 'TaskFlow';
    this.onTick(this.getState());
  }

  reset() {
    this.pause();
    this.remaining = this.duration;
    this.onTick(this.getState());
  }

  complete() {
    this.pause();
    sounds.playTimerAlarm();
    
    if (this.mode === 'pomodoro') {
      this.completedSessions++;
      localStorage.setItem('taskflow_pomodoros', this.completedSessions.toString());
      notifications.notify('🎉 Focus Session Finished!', {
        body: this.activeTask 
          ? `Great job! Session on "${this.activeTask.title}" is complete. Take a well-deserved break.`
          : 'Great job! Time for a short break.',
      });
    } else {
      notifications.notify('⚡ Break Finished!', {
        body: 'Ready to dive back into your tasks?',
      });
    }

    this.onComplete(this.getState());
  }

  updateDocumentTitle() {
    const mins = String(Math.floor(this.remaining / 60)).padStart(2, '0');
    const secs = String(this.remaining % 60).padStart(2, '0');
    document.title = `(${mins}:${secs}) ${this.activeTask ? this.activeTask.title : 'Focus Timer'} - TaskFlow`;
  }

  getState() {
    const mins = Math.floor(this.remaining / 60);
    const secs = this.remaining % 60;
    const progress = this.duration > 0 ? (this.duration - this.remaining) / this.duration : 0;
    return {
      minutes: mins,
      seconds: secs,
      formattedTime: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
      progress: progress,
      isRunning: this.isRunning,
      mode: this.mode,
      duration: this.duration,
      remaining: this.remaining,
      activeTask: this.activeTask,
      completedSessions: this.completedSessions
    };
  }
}
