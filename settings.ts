import { App, PluginSettingTab, Setting } from 'obsidian';
import TaskRewardPlugin from './main';

export interface RewardSettings {
  // Feature toggles
  enableSound: boolean;
  enableConfetti: boolean;
  globalMute: boolean;
  disableConfetti: boolean;
  
  // Sound settings
  soundVolume: number; // 0-1
  
  // Confetti settings
  confettiDuration: number; // ms
  
  // Timing parameters
  mergeWindowMs: number;
  throttleMs: number;
  undoWindowMs: number;
}

export const DEFAULT_SETTINGS: RewardSettings = {
  enableSound: true,
  enableConfetti: true,
  globalMute: false,
  disableConfetti: false,
  soundVolume: 0.3,
  confettiDuration: 800,
  mergeWindowMs: 300,
  throttleMs: 250,
  undoWindowMs: 1000
};

export class RewardSettingTab extends PluginSettingTab {
  plugin: TaskRewardPlugin;

  constructor(app: App, plugin: TaskRewardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    
    containerEl.createEl('h2', { text: 'Task Reward Settings' });
    
    // Quick controls
    containerEl.createEl('h3', { text: 'Quick Controls' });
    
    new Setting(containerEl)
      .setName('Enable sound')
      .setDesc('Play reward sound when completing tasks')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableSound)
        .onChange(async (value) => {
          this.plugin.settings.enableSound = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Enable confetti')
      .setDesc('Show confetti animation when completing tasks')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableConfetti)
        .onChange(async (value) => {
          this.plugin.settings.enableConfetti = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Global mute')
      .setDesc('Quickly disable all sound feedback')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.globalMute)
        .onChange(async (value) => {
          this.plugin.settings.globalMute = value;
          await this.plugin.saveSettings();
        }));
    
    // Sound settings
    containerEl.createEl('h3', { text: 'Sound Settings' });
    
    new Setting(containerEl)
      .setName('Volume')
      .setDesc('Adjust the volume of reward sound (0-100%)')
      .addSlider(slider => slider
        .setLimits(0, 100, 5)
        .setValue(this.plugin.settings.soundVolume * 100)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.soundVolume = value / 100;
          await this.plugin.saveSettings();
        }));
    
    // Confetti settings
    containerEl.createEl('h3', { text: 'Confetti Settings' });
    
    new Setting(containerEl)
      .setName('Animation duration')
      .setDesc('Confetti animation duration (milliseconds)')
      .addSlider(slider => slider
        .setLimits(400, 1200, 100)
        .setValue(this.plugin.settings.confettiDuration)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.confettiDuration = value;
          await this.plugin.saveSettings();
        }));
    
    // Advanced settings
    containerEl.createEl('h3', { text: 'Advanced Settings' });
    
    new Setting(containerEl)
      .setName('Merge window')
      .setDesc('Milliseconds to merge multiple task completions into one feedback')
      .addText(text => text
        .setValue(String(this.plugin.settings.mergeWindowMs))
        .onChange(async (value) => {
          const num = parseInt(value);
          if (!isNaN(num) && num >= 100 && num <= 1000) {
            this.plugin.settings.mergeWindowMs = num;
            await this.plugin.saveSettings();
          }
        }));
    
    new Setting(containerEl)
      .setName('Throttle interval')
      .setDesc('Minimum interval between feedbacks (milliseconds)')
      .addText(text => text
        .setValue(String(this.plugin.settings.throttleMs))
        .onChange(async (value) => {
          const num = parseInt(value);
          if (!isNaN(num) && num >= 100 && num <= 1000) {
            this.plugin.settings.throttleMs = num;
            await this.plugin.saveSettings();
          }
        }));
    
    new Setting(containerEl)
      .setName('Undo protection window')
      .setDesc('Milliseconds to prevent duplicate feedback after unchecking and rechecking')
      .addText(text => text
        .setValue(String(this.plugin.settings.undoWindowMs))
        .onChange(async (value) => {
          const num = parseInt(value);
          if (!isNaN(num) && num >= 500 && num <= 3000) {
            this.plugin.settings.undoWindowMs = num;
            await this.plugin.saveSettings();
          }
        }));
    
    // Test buttons
    containerEl.createEl('h3', { text: 'Test' });
    
    new Setting(containerEl)
      .setName('Test single completion')
      .setDesc('Preview feedback for one task completion')
      .addButton(button => button
        .setButtonText('Test')
        .onClick(() => {
          this.plugin.soundManager.playRewardSound('light', this.plugin.settings.soundVolume);
          this.plugin.confettiManager.burst({
            intensity: 'light',
            particleCount: 15,
            duration: this.plugin.settings.confettiDuration
          });
        }));
    
    new Setting(containerEl)
      .setName('Test batch completion')
      .setDesc('Preview feedback for 5 task completions')
      .addButton(button => button
        .setButtonText('Test')
        .onClick(() => {
          this.plugin.soundManager.playRewardSound('heavy', this.plugin.settings.soundVolume);
          this.plugin.confettiManager.burst({
            intensity: 'heavy',
            particleCount: 50,
            duration: this.plugin.settings.confettiDuration
          });
        }));
    
    // Notice
    containerEl.createEl('p', { 
      text: 'Note: The plugin automatically respects system "reduce motion" preferences.',
      cls: 'setting-item-description'
    });
  }
}