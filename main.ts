import { Plugin, TFile, CachedMetadata, ListItemCache, MarkdownView } from 'obsidian';
import { RewardSettings, DEFAULT_SETTINGS, RewardSettingTab } from './settings';
import { SoundManager } from './sound';
import { ConfettiManager } from './confetti';

interface TaskEvent {
  file: TFile;
  line: number;
  checked: boolean;
  timestamp: number;
  coords?: { x: number; y: number } | null;
}

export default class TaskRewardPlugin extends Plugin {
  settings: RewardSettings;
  soundManager: SoundManager;
  confettiManager: ConfettiManager;

  // Event merging and throttling
  private taskEventQueue: TaskEvent[] = [];
  private mergeTimer: number | null = null;
  private lastFeedbackTime = 0;
  private undoProtection = new Map<string, number>(); // key: file:line, value: timestamp
  private taskStates = new Map<string, Map<number, boolean>>();
  private recentTaskCoordinates = new Map<string, { coords: { x: number; y: number }; timestamp: number }>();

  async onload() {
    await this.loadSettings();

    this.soundManager = new SoundManager(this);
    this.confettiManager = new ConfettiManager(this);

    // Listen for task state changes
    this.registerEvent(
      this.app.metadataCache.on('changed', (file, _data, cache) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.handleTaskMetadataChange(file, cache);
        }
      })
    );

    this.addSettingTab(new RewardSettingTab(this.app, this));

    this.registerDomEvent(document, 'change', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target || !(target instanceof HTMLInputElement)) return;
      if (!target.classList.contains('task-list-item-checkbox')) return;

      const file = this.app.workspace.getActiveFile();
      if (!file) return;

      const lineAttr = target.dataset.line ?? target.closest('[data-line]')?.getAttribute('data-line');
      if (!lineAttr) return;

      const line = parseInt(lineAttr, 10);
      if (Number.isNaN(line)) return;

      const rect = target.getBoundingClientRect();
      const coords = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };

      const key = `${file.path}:${line}`;
      this.recentTaskCoordinates.set(key, {
        coords,
        timestamp: Date.now()
      });
    });

    console.log('Task Reward Plugin loaded');
  }

  onunload() {
    this.soundManager.cleanup();
    this.confettiManager.cleanup();
    if (this.mergeTimer) {
      window.clearTimeout(this.mergeTimer);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private handleTaskMetadataChange(file: TFile, cache: CachedMetadata | null) {
    if (!cache) {
      this.taskStates.delete(file.path);
      return;
    }

    const tasks = (cache.listItems ?? []).filter((item: ListItemCache) => item.task !== undefined);
    const currentStates = new Map<number, boolean>();

    if (!this.taskStates.has(file.path)) {
      for (const task of tasks) {
        currentStates.set(task.position.start.line, this.isChecked(task));
      }
      this.taskStates.set(file.path, currentStates);
      return;
    }

    const previousStates = this.taskStates.get(file.path) ?? new Map<number, boolean>();
    const now = Date.now();

    for (const task of tasks) {
      const line = task.position.start.line;
      const isChecked = this.isChecked(task);
      const wasChecked = previousStates.get(line) ?? false;
      const taskKey = `${file.path}:${line}`;

      currentStates.set(line, isChecked);

      if (!wasChecked && isChecked) {
        const lastUndoTime = this.undoProtection.get(taskKey);
        if (lastUndoTime && now - lastUndoTime < this.settings.undoWindowMs) {
          continue;
        }

        this.cleanupUndoProtection(now);
        this.queueTaskEvent({
          file,
          line,
          checked: true,
          timestamp: now
        });
      } else if (wasChecked && !isChecked) {
        this.undoProtection.set(taskKey, now);
      }
    }

    this.taskStates.set(file.path, currentStates);
  }

  private isChecked(task: ListItemCache): boolean {
    if (typeof task.task !== 'string') {
      return false;
    }
    const normalized = task.task.trim().toLowerCase();
    return normalized === 'x' || normalized === 'check' || normalized === 'checked';
  }

  private cleanupUndoProtection(now: number) {
    if (this.undoProtection.size <= 100) return;
    for (const [key, time] of this.undoProtection.entries()) {
      if (now - time > this.settings.undoWindowMs * 2) {
        this.undoProtection.delete(key);
      }
    }
  }

  private queueTaskEvent(event: TaskEvent) {
    const key = `${event.file.path}:${event.line}`;
    let cachedCoords: { x: number; y: number } | null = null;
    const recent = this.recentTaskCoordinates.get(key);
    const now = Date.now();
    if (recent && now - recent.timestamp < 1500) {
      cachedCoords = recent.coords;
    }
    this.recentTaskCoordinates.delete(key);

    const enrichedEvent: TaskEvent = {
      ...event,
      coords: cachedCoords ?? event.coords ?? this.computeTaskCoordinates(event.file, event.line)
    };

    this.taskEventQueue.push(enrichedEvent);

    // Clear existing merge timer
    if (this.mergeTimer) {
      window.clearTimeout(this.mergeTimer);
    }

    // Set new merge window
    this.mergeTimer = window.setTimeout(() => {
      this.processMergedEvents();
    }, this.settings.mergeWindowMs);
  }

  private processMergedEvents() {
    const now = Date.now();
    const events = this.taskEventQueue.slice();
    const count = events.length;

    // Global throttle check
    if (now - this.lastFeedbackTime < this.settings.throttleMs) {
      this.taskEventQueue = [];
      this.mergeTimer = null;
      return;
    }

    if (count === 0) {
      this.mergeTimer = null;
      return;
    }

    // Get feedback profile
    const profile = this.getFeedbackProfile(count);

    // Trigger feedback
    this.triggerFeedback(profile, events);

    // Clear queue and timer
    this.taskEventQueue = [];
    this.mergeTimer = null;
    this.lastFeedbackTime = now;
  }

  private getFeedbackProfile(count: number): FeedbackProfile {
    // Check system and app settings
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const muted = this.settings.globalMute;

    const intensity: 'light' | 'medium' | 'heavy' = 'heavy';

    return {
      sound: muted ? null : {
        intensity,
        volume: this.settings.soundVolume
      },
      confetti: (reducedMotion || this.settings.disableConfetti) ? null : {
        intensity,
        particleCount: this.getParticleCount(intensity),
        duration: this.settings.confettiDuration
      }
    };
  }

  private getParticleCount(_intensity: 'light' | 'medium' | 'heavy'): number {
    return 150;
  }

  private triggerFeedback(profile: FeedbackProfile, events: TaskEvent[]) {
    const startTime = performance.now();

    // Play sound
    if (profile.sound && this.settings.enableSound) {
      this.soundManager.playRewardSound(profile.sound.intensity, profile.sound.volume);
    }

    // Show confetti
    if (profile.confetti && this.settings.enableConfetti) {
      const origin = this.getConfettiOrigin(events);
      this.confettiManager.burst({
        ...profile.confetti,
        origin: origin ?? undefined
      });
    }

    const elapsed = performance.now() - startTime;
    if (elapsed > 200) {
      console.warn(`Task Reward: Feedback delay: ${elapsed.toFixed(1)}ms (target: ≤200ms)`);
    }
  }

  private getConfettiOrigin(events: TaskEvent[]): { x: number; y: number } | null {
    const coords = events
      .map(event => {
        if (!event.coords) {
          event.coords = this.computeTaskCoordinates(event.file, event.line);
        }
        return event.coords;
      })
      .filter((value): value is { x: number; y: number } => !!value);

    if (coords.length === 0) {
      return null;
    }

    const sum = coords.reduce((acc, coord) => {
      acc.x += coord.x;
      acc.y += coord.y;
      return acc;
    }, { x: 0, y: 0 });

    return {
      x: sum.x / coords.length,
      y: sum.y / coords.length
    };
  }

  private computeTaskCoordinates(file: TFile, line: number): { x: number; y: number } | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || view.file !== file) {
      return null;
    }

    try {
      const mode = (view as any).getMode?.();
      const editor: any = view.editor;
      const cm: any = editor?.cm;

      if ((!mode || mode === 'source' || mode === 'source-both') && cm?.state) {
        const doc = cm.state.doc;
        const lineNumber = Math.min(Math.max(0, line), doc.lines - 1);
        const docLine = doc.line(lineNumber + 1);

        const coords = cm.coordsAtPos?.(docLine.from);
        if (coords) {
          return {
            x: coords.left + (coords.right - coords.left) / 2,
            y: coords.top + (coords.bottom - coords.top) / 2
          };
        }

        const fallbackCoords = cm.coordsAtPos?.(docLine.to);
        if (fallbackCoords) {
          return {
            x: fallbackCoords.left + (fallbackCoords.right - fallbackCoords.left) / 2,
            y: fallbackCoords.top + (fallbackCoords.bottom - fallbackCoords.top) / 2
          };
        }
      }

      const previewContainer: HTMLElement | null = (view as any).previewMode?.renderer?.view?.containerEl ?? null;
      if (previewContainer) {
        const lineEl = previewContainer.querySelector(`[data-line="${line}"]`) as HTMLElement | null;
        if (lineEl) {
          const rect = lineEl.getBoundingClientRect();
          return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          };
        }
      }
    } catch (error) {
      console.warn('Task Reward: Failed to compute task coordinates', error);
    }

    return null;
  }
}

interface FeedbackProfile {
  sound: {
    intensity: 'light' | 'medium' | 'heavy';
    volume: number;
  } | null;
  confetti: {
    intensity: 'light' | 'medium' | 'heavy';
    particleCount: number;
    duration: number;
  } | null;
}
