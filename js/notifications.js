// ==========================================
// Notifications & Web Audio Effects & Confetti
// ==========================================

class SoundEffects {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  initContext() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playCompleteChime() {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      
      const now = this.ctx.currentTime;
      // High crisp cheerful dual tone
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
      osc1.frequency.exponentialRampToValueAtTime(1174.66, now + 0.28); // D6

      osc2.frequency.setValueAtTime(440, now);
      osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.15);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.6);
      osc2.stop(now + 0.6);
    } catch (e) {
      console.warn('Audio playback not permitted yet:', e);
    }
  }

  playClick() {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {}
  }

  playTimerAlarm() {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [0, 0.2, 0.4, 0.6].forEach((offset, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(idx % 2 === 0 ? 880 : 1046.5, now + offset);
        gain.gain.setValueAtTime(0.25, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.18);
      });
    } catch (e) {}
  }
}

export const sounds = new SoundEffects();

// ==========================================
// Browser Push Notifications
// ==========================================
class NotificationService {
  constructor() {
    this.permission = ('Notification' in window) ? Notification.permission : 'denied';
    this.activeInterval = null;
  }

  async requestPermission() {
    if (!('Notification' in window)) {
      return false;
    }
    try {
      const result = await Notification.requestPermission();
      this.permission = result;
      return result === 'granted';
    } catch (e) {
      console.warn('Error requesting notification permission:', e);
      return false;
    }
  }

  notify(title, options = {}) {
    if (this.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          icon: 'icons/icon.svg',
          badge: 'icons/icon.svg',
          ...options
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (e) {
        console.warn('Native notification failed:', e);
      }
    }
  }

  startReminderChecker(getTasksCallback) {
    if (this.activeInterval) clearInterval(this.activeInterval);
    // Check every 30 seconds
    this.activeInterval = setInterval(() => {
      const tasks = getTasksCallback();
      const now = new Date();
      const nowFormatted = now.toISOString().slice(0, 10);
      const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      tasks.forEach(task => {
        if (task.status === 'completed') return;
        if (!task.dueDate || !task.dueTime) return;
        if (task.reminderSent) return;

        if (task.dueDate === nowFormatted && task.dueTime === currentTimeStr) {
          task.reminderSent = true;
          this.notify(`⏰ Task Due Now: ${task.title}`, {
            body: `Priority: ${task.priority.toUpperCase()} | Category: ${task.category}`,
            tag: `task-${task.id}`
          });
          sounds.playTimerAlarm();
        }
      });
    }, 30000);
  }
}

export const notifications = new NotificationService();

// ==========================================
// Micro Confetti Animation
// ==========================================
export function fireConfetti(originX = window.innerWidth / 2, originY = window.innerHeight / 2) {
  let canvas = document.getElementById('confetti-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');

  const particleCount = 70;
  const particles = [];
  const colors = ['#6366f1', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.random() * 360) * (Math.PI / 180);
    const speed = 4 + Math.random() * 8;
    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: 5 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      opacity: 1,
      shape: Math.random() > 0.4 ? 'rect' : 'circle',
      gravity: 0.22,
      drag: 0.96
    });
  }

  let animationFrame;
  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    particles.forEach(p => {
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.016;

      if (p.opacity > 0) {
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });

    if (alive) {
      animationFrame = requestAnimationFrame(update);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(animationFrame);
    }
  }

  update();
}
