/**
 * App.js - Core Timer Engine & UI Logic
 * Offline Focus Study Session Timer
 */

class StudyTimerApp {
  constructor() {
    // Default Settings
    this.settings = {
      focusTime: 25 * 60,      // in seconds
      shortBreakTime: 5 * 60,
      longBreakTime: 15 * 60,
      longBreakInterval: 4,
      chimeSound: 'zenBowl',
      autoStartBreaks: false,
      autoStartPomodoros: false,
    };

    // State Variables
    this.currentMode = 'pomodoro'; // 'pomodoro', 'shortBreak', 'longBreak', 'custom', 'stopwatch'
    this.remainingSeconds = this.settings.focusTime;
    this.isRunning = false;
    this.cycleCount = 1;
    this.timerInterval = null;
    this.targetEndTime = null;
    this.stopwatchElapsed = 0;

    // History & Stats Data
    this.stats = {
      totalSeconds: 0,
      completedSessions: 0,
      streakDays: 1,
      lastStudyDate: new Date().toDateString(),
      logs: []
    };

    // Tasks Data
    this.tasks = [];
    this.activeTaskId = null;

    // Title flash interval for background tab popup alert
    this.titleFlashInterval = null;

    // Visualizer RAF
    this.visualizerFrame = null;
  }

  init() {
    this.loadLocalStorage();
    this.bindDOM();
    this.bindEvents();
    this.updateUI();
    this.initVisualizer();
    this.checkNotificationPermission();
  }

  // -------------------------------------------------------------
  // LOCAL STORAGE PERSISTENCE
  // -------------------------------------------------------------
  loadLocalStorage() {
    try {
      const savedSettings = localStorage.getItem('focus_timer_settings');
      if (savedSettings) this.settings = { ...this.settings, ...JSON.parse(savedSettings) };

      const savedStats = localStorage.getItem('focus_timer_stats');
      if (savedStats) this.stats = { ...this.stats, ...JSON.parse(savedStats) };

      const savedTasks = localStorage.getItem('focus_timer_tasks');
      if (savedTasks) this.tasks = JSON.parse(savedTasks);

      // Check streak continuity
      const today = new Date().toDateString();
      if (this.stats.lastStudyDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (this.stats.lastStudyDate !== yesterday && this.stats.completedSessions > 0) {
          // Streak reset if missed a day
          this.stats.streakDays = 1;
        }
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }

  saveLocalStorage() {
    try {
      localStorage.setItem('focus_timer_settings', JSON.stringify(this.settings));
      localStorage.setItem('focus_timer_stats', JSON.stringify(this.stats));
      localStorage.setItem('focus_timer_tasks', JSON.stringify(this.tasks));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }

  // -------------------------------------------------------------
  // DOM BINDING & UI UPDATES
  // -------------------------------------------------------------
  bindDOM() {
    // Mode Buttons
    this.modeBtns = document.querySelectorAll('.mode-btn');

    // Timer Elements
    this.clockEl = document.getElementById('timer-clock');
    this.modeLabelEl = document.getElementById('timer-mode-label');
    this.cycleCountEl = document.getElementById('cycle-count');
    this.progressCircle = document.getElementById('progress-circle');

    // Control Buttons
    this.startBtn = document.getElementById('start-btn');
    this.startBtnText = document.getElementById('start-btn-text');
    this.playIcon = document.getElementById('play-icon');
    this.pauseIcon = document.getElementById('pause-icon');
    this.resetBtn = document.getElementById('reset-btn');
    this.skipBtn = document.getElementById('skip-btn');
    this.zenBtn = document.getElementById('zen-btn');

    // Header Actions
    this.notifBtn = document.getElementById('notif-btn');
    this.muteBtn = document.getElementById('mute-btn');
    this.muteIconOn = document.getElementById('mute-icon-on');
    this.muteIconOff = document.getElementById('mute-icon-off');
    this.statsBtn = document.getElementById('stats-btn');
    this.settingsBtn = document.getElementById('settings-btn');

    // Task Elements
    this.taskInput = document.getElementById('task-input');
    this.addTaskBtn = document.getElementById('add-task-btn');
    this.taskListEl = document.getElementById('task-list');
    this.taskCounterEl = document.getElementById('task-counter');
    this.currentTaskNameEl = document.getElementById('current-task-name');

    // Modals
    this.completionModal = document.getElementById('completion-modal');
    this.modalTitle = document.getElementById('completion-modal-title');
    this.modalDesc = document.getElementById('completion-modal-desc');
    this.modalNextBtn = document.getElementById('modal-next-btn');
    this.modalDismissBtn = document.getElementById('modal-dismiss-btn');

    this.statsModal = document.getElementById('stats-modal');
    this.closeStatsBtn = document.getElementById('close-stats-btn');
    this.clearStatsBtn = document.getElementById('clear-stats-btn');

    this.settingsModal = document.getElementById('settings-modal');
    this.saveSettingsBtn = document.getElementById('save-settings-btn');
    this.closeSettingsBtn = document.getElementById('close-settings-btn');

    // Settings Inputs
    this.setFocusTimeInput = document.getElementById('set-focus-time');
    this.setShortBreakInput = document.getElementById('set-short-break');
    this.setLongBreakInput = document.getElementById('set-long-break');
    this.setIntervalInput = document.getElementById('set-interval');
    this.setChimeSoundSelect = document.getElementById('set-chime-sound');
    this.setAutostartBreaksInput = document.getElementById('set-autostart-breaks');
    this.setAutostartPomodorosInput = document.getElementById('set-autostart-pomodoros');

    // Ambient Sound Cards & Sliders
    this.ambientCards = document.querySelectorAll('.ambient-card');
  }

  bindEvents() {
    // Mode Switcher
    this.modeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.switchMode(mode);
      });
    });

    // Start / Pause
    this.startBtn.addEventListener('click', () => this.toggleTimer());

    // Reset & Skip
    this.resetBtn.addEventListener('click', () => this.resetTimer());
    this.skipBtn.addEventListener('click', () => this.skipCycle());

    // Zen Mode
    this.zenBtn.addEventListener('click', () => {
      document.body.classList.toggle('zen-mode');
    });

    // Mute Sound
    this.muteBtn.addEventListener('click', () => {
      const isMuted = window.soundEngine.toggleMute();
      this.muteIconOn.style.display = isMuted ? 'none' : 'block';
      this.muteIconOff.style.display = isMuted ? 'block' : 'none';
    });

    // Notifications Button
    this.notifBtn.addEventListener('click', () => this.requestNotificationPermission());

    // Task Management
    this.addTaskBtn.addEventListener('click', () => this.addTask());
    this.taskInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addTask();
    });

    // Ambient Sound Cards
    this.ambientCards.forEach((card) => {
      card.addEventListener('click', () => {
        const soundType = card.dataset.sound;
        const isActive = card.classList.contains('active');

        // Stop all others
        this.ambientCards.forEach((c) => {
          c.classList.remove('active');
          c.querySelector('.ambient-icon').textContent = 'OFF';
        });

        if (!isActive) {
          card.classList.add('active');
          card.querySelector('.ambient-icon').textContent = 'ON';
          window.soundEngine.setAmbient(soundType);
        } else {
          window.soundEngine.stopAmbient();
        }
      });

      const slider = card.querySelector('.ambient-vol');
      slider.addEventListener('input', (e) => {
        window.soundEngine.setAmbientVolume(e.target.value);
      });
    });

    // Modals Handling
    this.modalDismissBtn.addEventListener('click', () => this.closeCompletionModal());
    this.modalNextBtn.addEventListener('click', () => {
      this.closeCompletionModal();
      if (this.currentMode === 'pomodoro') {
        const nextMode = (this.cycleCount % this.settings.longBreakInterval === 0) ? 'longBreak' : 'shortBreak';
        this.switchMode(nextMode);
        this.startTimer();
      } else {
        this.switchMode('pomodoro');
        this.startTimer();
      }
    });

    // Stats Modal
    this.statsBtn.addEventListener('click', () => this.openStatsModal());
    this.closeStatsBtn.addEventListener('click', () => this.statsModal.classList.remove('open'));
    this.clearStatsBtn.addEventListener('click', () => {
      if (confirm('Clear all study session history?')) {
        this.stats = { totalSeconds: 0, completedSessions: 0, streakDays: 1, lastStudyDate: new Date().toDateString(), logs: [] };
        this.saveLocalStorage();
        this.openStatsModal();
      }
    });

    // Settings Modal
    this.settingsBtn.addEventListener('click', () => this.openSettingsModal());
    this.closeSettingsBtn.addEventListener('click', () => this.settingsModal.classList.remove('open'));
    this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts if typing inside inputs
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.toggleTimer();
      } else if (e.code === 'KeyR') {
        this.resetTimer();
      } else if (e.code === 'KeyS') {
        this.skipCycle();
      } else if (e.code === 'KeyF') {
        document.body.classList.toggle('zen-mode');
      } else if (e.code === 'Escape') {
        this.closeCompletionModal();
        this.statsModal.classList.remove('open');
        this.settingsModal.classList.remove('open');
        document.body.classList.remove('zen-mode');
      }
    });
  }

  // -------------------------------------------------------------
  // TIMER ENGINE LOGIC
  // -------------------------------------------------------------
  switchMode(mode) {
    this.pauseTimer();
    this.currentMode = mode;

    // Update active navbar pill
    this.modeBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Body Theme class
    document.body.classList.remove('theme-focus', 'theme-shortBreak', 'theme-longBreak');

    if (mode === 'pomodoro') {
      document.body.classList.add('theme-focus');
      this.remainingSeconds = this.settings.focusTime;
      this.modeLabelEl.textContent = 'Focus Session';
    } else if (mode === 'shortBreak') {
      document.body.classList.add('theme-shortBreak');
      this.remainingSeconds = this.settings.shortBreakTime;
      this.modeLabelEl.textContent = 'Short Break';
    } else if (mode === 'longBreak') {
      document.body.classList.add('theme-longBreak');
      this.remainingSeconds = this.settings.longBreakTime;
      this.modeLabelEl.textContent = 'Long Break';
    } else if (mode === 'custom') {
      document.body.classList.add('theme-focus');
      const mins = prompt('Enter custom study timer duration in minutes:', '45');
      const val = parseInt(mins, 10);
      this.remainingSeconds = (isNaN(val) || val <= 0) ? 45 * 60 : val * 60;
      this.modeLabelEl.textContent = `Custom (${Math.round(this.remainingSeconds / 60)}m)`;
    } else if (mode === 'stopwatch') {
      document.body.classList.add('theme-focus');
      this.stopwatchElapsed = 0;
      this.remainingSeconds = 0;
      this.modeLabelEl.textContent = 'Open Stopwatch';
    }

    this.updateUI();
  }

  toggleTimer() {
    if (this.isRunning) {
      this.pauseTimer();
    } else {
      this.startTimer();
    }
  }

  startTimer() {
    if (this.isRunning) return;
    window.soundEngine.init(); // Initialize audio context on click gesture

    this.isRunning = true;
    this.targetEndTime = Date.now() + this.remainingSeconds * 1000;

    this.updateControlsUI();

    this.timerInterval = setInterval(() => {
      if (this.currentMode === 'stopwatch') {
        this.stopwatchElapsed++;
        this.updateClockDisplay(this.stopwatchElapsed);
      } else {
        const secondsLeft = Math.max(0, Math.ceil((this.targetEndTime - Date.now()) / 1000));
        this.remainingSeconds = secondsLeft;
        this.updateUI();

        if (this.remainingSeconds <= 0) {
          this.onTimerComplete();
        }
      }
    }, 250);
  }

  pauseTimer() {
    this.isRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.updateControlsUI();
  }

  resetTimer() {
    this.pauseTimer();
    if (this.currentMode === 'stopwatch') {
      this.stopwatchElapsed = 0;
    } else {
      this.switchMode(this.currentMode);
    }
    this.updateUI();
  }

  skipCycle() {
    this.pauseTimer();
    if (this.currentMode === 'pomodoro') {
      const nextMode = (this.cycleCount % this.settings.longBreakInterval === 0) ? 'longBreak' : 'shortBreak';
      this.switchMode(nextMode);
    } else {
      this.cycleCount++;
      this.switchMode('pomodoro');
    }
  }

  /**
   * Called when timer hits 00:00 - Triggers Alarms & Popups
   */
  onTimerComplete() {
    this.pauseTimer();

    const isFocus = (this.currentMode === 'pomodoro' || this.currentMode === 'custom');

    if (isFocus) {
      const focusMinutes = Math.round((this.settings.focusTime || 25 * 60) / 60);
      this.stats.totalSeconds += (this.settings.focusTime || 25 * 60);
      this.stats.completedSessions += 1;

      const activeTaskObj = this.tasks.find((t) => t.id === this.activeTaskId);
      const taskName = activeTaskObj ? activeTaskObj.name : 'General Focus';
      if (activeTaskObj) activeTaskObj.pomodoros = (activeTaskObj.pomodoros || 0) + 1;

      this.stats.logs.unshift({
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode: this.currentMode,
        duration: `${focusMinutes} mins`,
        task: taskName
      });

      this.stats.lastStudyDate = new Date().toDateString();
      this.saveLocalStorage();

      // Trigger completion popup modal
      this.modalTitle.textContent = '🎉 Focus Session Complete!';
      this.modalDesc.textContent = `Great work on "${taskName}"! Take a well-deserved break now.`;
      this.modalNextBtn.textContent = 'Start Short Break (5m)';
    } else {
      this.cycleCount++;
      this.modalTitle.textContent = '☕ Break Finished!';
      this.modalDesc.textContent = 'Ready to dive back into your study flow?';
      this.modalNextBtn.textContent = 'Start Focus Session (25m)';
    }

    // 1. POPUP IN-APP MODAL
    this.completionModal.classList.add('open');

    // 2. START PROCEDURAL LOOPING CHIME ALARM
    window.soundEngine.startAlarmLoop(this.settings.chimeSound);

    // 3. DESKTOP OS POPUP NOTIFICATION (Works minimized/in background)
    this.triggerDesktopNotification(
      this.modalTitle.textContent,
      this.modalDesc.textContent
    );

    // 4. TAB TITLE FLASHING ALERT
    this.startTitleFlashing(this.modalTitle.textContent);

    this.updateUI();

    // Auto-start next cycle check
    if (isFocus && this.settings.autoStartBreaks) {
      setTimeout(() => this.modalNextBtn.click(), 1000);
    } else if (!isFocus && this.settings.autoStartPomodoros) {
      setTimeout(() => this.modalNextBtn.click(), 1000);
    }
  }

  closeCompletionModal() {
    this.completionModal.classList.remove('open');
    window.soundEngine.stopAlarmLoop();
    this.stopTitleFlashing();
  }

  // -------------------------------------------------------------
  // NOTIFICATIONS & BACKGROUND ALERTING
  // -------------------------------------------------------------
  checkNotificationPermission() {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        this.notifBtn.classList.add('active');
      }
    }
  }

  requestNotificationPermission() {
    if (!('Notification' in window)) {
      alert('Desktop notifications are not supported in this browser.');
      return;
    }
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        this.notifBtn.classList.add('active');
        new Notification('Offline Focus Timer', {
          body: 'Pop-up notifications enabled! You will be alerted when study timers finish.',
          icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236366f1"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>'
        });
      }
    });
  }

  triggerDesktopNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: body,
          requireInteraction: true, // Keep notification pop-up visible until user clicks it
          silent: false
        });
      } catch (e) {
        console.warn('Desktop notification error:', e);
      }
    }
  }

  startTitleFlashing(alertText) {
    this.stopTitleFlashing();
    let isOriginal = false;
    const origTitle = document.title;

    this.titleFlashInterval = setInterval(() => {
      document.title = isOriginal ? origTitle : `⏰ ${alertText}`;
      isOriginal = !isOriginal;
    }, 800);
  }

  stopTitleFlashing() {
    if (this.titleFlashInterval) {
      clearInterval(this.titleFlashInterval);
      this.titleFlashInterval = null;
      this.updateTabTitle();
    }
  }

  updateTabTitle() {
    if (this.titleFlashInterval) return;
    const formatted = this.formatTime(this.currentMode === 'stopwatch' ? this.stopwatchElapsed : this.remainingSeconds);
    const modeName = this.currentMode.charAt(0).toUpperCase() + this.currentMode.slice(1);
    document.title = `${formatted} - ${modeName} | Offline Focus`;
  }

  // -------------------------------------------------------------
  // UI FORMATTING & RENDER
  // -------------------------------------------------------------
  updateUI() {
    const secs = this.currentMode === 'stopwatch' ? this.stopwatchElapsed : this.remainingSeconds;
    this.updateClockDisplay(secs);
    this.updateProgressRing();
    this.updateCycleBadge();
    this.updateControlsUI();
    this.updateTaskUI();
    this.updateTabTitle();
  }

  updateClockDisplay(totalSecs) {
    this.clockEl.textContent = this.formatTime(totalSecs);
  }

  formatTime(totalSecs) {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  updateProgressRing() {
    const total = this.getTotalModeDuration();
    if (total <= 0 || this.currentMode === 'stopwatch') {
      this.progressCircle.style.strokeDashoffset = '0';
      return;
    }

    const radius = 120;
    const circumference = 2 * Math.PI * radius; // 753.98
    const progress = (total - this.remainingSeconds) / total;
    const offset = circumference * (1 - progress);

    this.progressCircle.style.strokeDasharray = `${circumference}`;
    this.progressCircle.style.strokeDashoffset = `${offset}`;
  }

  getTotalModeDuration() {
    switch (this.currentMode) {
      case 'pomodoro': return this.settings.focusTime;
      case 'shortBreak': return this.settings.shortBreakTime;
      case 'longBreak': return this.settings.longBreakTime;
      default: return this.remainingSeconds || 1;
    }
  }

  updateCycleBadge() {
    this.cycleCountEl.textContent = `Cycle #${this.cycleCount}`;
  }

  updateControlsUI() {
    if (this.isRunning) {
      this.startBtnText.textContent = 'PAUSE';
      this.playIcon.style.display = 'none';
      this.pauseIcon.style.display = 'block';
    } else {
      this.startBtnText.textContent = this.currentMode === 'stopwatch' ? 'START STOPWATCH' : 'START FOCUS';
      this.playIcon.style.display = 'block';
      this.pauseIcon.style.display = 'none';
    }
  }

  // -------------------------------------------------------------
  // TASK MANAGEMENT
  // -------------------------------------------------------------
  addTask() {
    const text = this.taskInput.value.trim();
    if (!text) return;

    const newTask = {
      id: Date.now().toString(),
      name: text,
      completed: false,
      pomodoros: 0
    };

    this.tasks.push(newTask);
    if (!this.activeTaskId) this.activeTaskId = newTask.id;

    this.taskInput.value = '';
    this.saveLocalStorage();
    this.updateTaskUI();
  }

  toggleTaskComplete(id) {
    const task = this.tasks.find((t) => t.id === id);
    if (task) {
      task.completed = !task.completed;
      this.saveLocalStorage();
      this.updateTaskUI();
    }
  }

  deleteTask(id) {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    if (this.activeTaskId === id) {
      this.activeTaskId = this.tasks.length > 0 ? this.tasks[0].id : null;
    }
    this.saveLocalStorage();
    this.updateTaskUI();
  }

  setActiveTask(id) {
    this.activeTaskId = id;
    this.saveLocalStorage();
    this.updateTaskUI();
  }

  updateTaskUI() {
    this.taskListEl.innerHTML = '';
    let doneCount = 0;

    this.tasks.forEach((task) => {
      if (task.completed) doneCount++;

      const li = document.createElement('li');
      li.className = `task-item ${task.id === this.activeTaskId ? 'active-task' : ''} ${task.completed ? 'completed' : ''}`;
      li.onclick = () => this.setActiveTask(task.id);

      li.innerHTML = `
        <div class="task-left">
          <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} 
                 onclick="event.stopPropagation(); window.app.toggleTaskComplete('${task.id}')">
          <span class="task-name">${this.escapeHTML(task.name)}</span>
          <span class="cycle-badge" style="font-size:0.75rem;">🍅 ${task.pomodoros || 0}</span>
        </div>
        <div class="task-actions">
          <button class="icon-btn" style="width:28px; height:28px;" onclick="event.stopPropagation(); window.app.deleteTask('${task.id}')" title="Delete Task">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      `;

      this.taskListEl.appendChild(li);
    });

    this.taskCounterEl.textContent = `${doneCount} / ${this.tasks.length} Done`;

    const activeObj = this.tasks.find((t) => t.id === this.activeTaskId);
    this.currentTaskNameEl.textContent = activeObj ? `Studying: ${activeObj.name}` : 'No active task set';
  }

  // -------------------------------------------------------------
  // MODALS & ANALYTICS
  // -------------------------------------------------------------
  openStatsModal() {
    document.getElementById('stat-total-time').textContent = `${Math.round(this.stats.totalSeconds / 60)} mins`;
    document.getElementById('stat-sessions-count').textContent = this.stats.completedSessions;
    document.getElementById('stat-streak-count').textContent = `${this.stats.streakDays} Day${this.stats.streakDays > 1 ? 's' : ''}`;

    const logList = document.getElementById('stats-log-list');
    logList.innerHTML = '';

    if (this.stats.logs.length === 0) {
      logList.innerHTML = '<div style="color:var(--text-dim); text-align:center; padding:12px;">No focus sessions logged yet today.</div>';
    } else {
      this.stats.logs.slice(0, 15).forEach((log) => {
        const div = document.createElement('div');
        div.style.cssText = 'background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;';
        div.innerHTML = `
          <span><b>${log.task || 'Focus Session'}</b> (${log.duration})</span>
          <span style="color:var(--text-muted);">${log.date}</span>
        `;
        logList.appendChild(div);
      });
    }

    this.statsModal.classList.add('open');
  }

  openSettingsModal() {
    this.setFocusTimeInput.value = Math.round(this.settings.focusTime / 60);
    this.setShortBreakInput.value = Math.round(this.settings.shortBreakTime / 60);
    this.setLongBreakInput.value = Math.round(this.settings.longBreakTime / 60);
    this.setIntervalInput.value = this.settings.longBreakInterval;
    this.setChimeSoundSelect.value = this.settings.chimeSound;
    this.setAutostartBreaksInput.checked = this.settings.autoStartBreaks;
    this.setAutostartPomodorosInput.checked = this.settings.autoStartPomodoros;

    this.settingsModal.classList.add('open');
  }

  saveSettings() {
    this.settings.focusTime = Math.max(1, parseInt(this.setFocusTimeInput.value, 10)) * 60;
    this.settings.shortBreakTime = Math.max(1, parseInt(this.setShortBreakInput.value, 10)) * 60;
    this.settings.longBreakTime = Math.max(1, parseInt(this.setLongBreakInput.value, 10)) * 60;
    this.settings.longBreakInterval = Math.max(1, parseInt(this.setIntervalInput.value, 10));
    this.settings.chimeSound = this.setChimeSoundSelect.value;
    this.settings.autoStartBreaks = this.setAutostartBreaksInput.checked;
    this.settings.autoStartPomodoros = this.setAutostartPomodorosInput.checked;

    this.saveLocalStorage();
    this.settingsModal.classList.remove('open');
    this.switchMode(this.currentMode);
  }

  // -------------------------------------------------------------
  // AUDIO VISUALIZER CANVAS
  // -------------------------------------------------------------
  initVisualizer() {
    const canvas = document.getElementById('visualizer-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      this.visualizerFrame = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!window.soundEngine || !window.soundEngine.analyser) return;

      const analyser = window.soundEngine.analyser;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
      const barWidth = (width / bufferLength) * 2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height * 0.4;
        ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };

    draw();
  }

  escapeHTML(str) {
    return str.replace(/[&<>'"]/g, (tag) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }
}

// Instantiate App
window.addEventListener('DOMContentLoaded', () => {
  window.app = new StudyTimerApp();
  window.app.init();
});
