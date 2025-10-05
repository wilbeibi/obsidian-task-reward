import { normalizePath } from 'obsidian';
import TaskRewardPlugin from './main';

export class SoundManager {
  private plugin: TaskRewardPlugin;
  private audioBuffer: AudioBuffer | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private objectUrl: string | null = null;
  private useWebAudio = true;
  private loading: Promise<void> | null = null;
  private unlockHandler: (() => void) | null = null;

  constructor(plugin: TaskRewardPlugin) {
    this.plugin = plugin;
    this.loading = this.loadSound();
    this.loading.catch((error) => {
      console.warn('Task Reward: Failed to preload sound', error);
    });

    this.unlockHandler = () => this.unlockAudio();
    this.plugin.registerDomEvent(window, 'pointerdown', this.unlockHandler);
    this.plugin.registerDomEvent(window, 'keydown', this.unlockHandler);
  }

  async prewarm() {
    const loading = this.loading;
    if (loading) {
      try {
        await loading;
      } catch (error) {
        console.warn('Task Reward: Prewarm failed during load', error);
      }
    }

    this.ensureAudioContext();

    if (this.audioElement) {
      try {
        this.audioElement.load();
      } catch (error) {
        console.warn('Task Reward: HTML audio prewarm failed', error);
      }
    }
  }

  private async loadSound() {
    try {
      const adapter: any = this.plugin.app.vault.adapter;
      const configDir = this.plugin.app.vault.configDir ?? '.obsidian';
      const basePath = normalizePath(`${configDir}/plugins/${this.plugin.manifest.id}/sound`);
      const candidates = ['reward.m4a', 'reward.mp3'];

      for (const file of candidates) {
        const vaultRelativePath = normalizePath(`${basePath}/${file}`);

        let exists = true;
        if (typeof adapter.exists === 'function') {
          exists = await adapter.exists(vaultRelativePath);
        }
        if (!exists) {
          continue;
        }

        const resourcePath = typeof adapter.getResourcePath === 'function'
          ? adapter.getResourcePath(vaultRelativePath)
          : null;

        if (resourcePath) {
          if (await this.tryLoadWithWebAudioFromUrl(resourcePath)) {
            console.log(`Task Reward: Sound loaded via resource URL with Web Audio (${file})`);
            return;
          }

          if (this.tryLoadWithHtmlAudioFromUrl(resourcePath)) {
            console.log(`Task Reward: Sound ready via HTML audio (${file})`);
            return;
          }
        }

        if (typeof adapter.readBinary === 'function') {
          try {
            const binary = await adapter.readBinary(vaultRelativePath);
            const arrayBuffer = this.toArrayBuffer(binary);

            if (await this.tryLoadWithWebAudio(arrayBuffer)) {
              console.log(`Task Reward: Sound loaded with Web Audio API (${file})`);
              return;
            }

            if (this.tryLoadWithHtmlAudioFromBuffer(arrayBuffer, file)) {
              console.log(`Task Reward: Sound loaded with HTML5 audio fallback (${file})`);
              return;
            }
          } catch (readError) {
            console.warn(`Task Reward: Failed to read audio asset ${vaultRelativePath}`, readError);
          }
        }
      }

      console.warn('Task Reward: No audio asset found, falling back to synthesized sound.');
    } catch (error) {
      console.warn('Task Reward: Failed to load sound asset, will use synthesized sound.', error);
    } finally {
      this.loading = null;
    }
  }

  playRewardSound(intensity: 'light' | 'medium' | 'heavy', volume: number) {
    if (this.loading) {
      this.loading.then(() => {
        this.playRewardSound(intensity, volume);
      }).catch((error) => {
        console.warn('Task Reward: Deferred sound playback failed', error);
        this.playSynthesizedSound(intensity, volume);
      });
      return;
    }

    // Calculate volume multiplier based on intensity
    const volumeMultiplier = intensity === 'light' ? 0.8 : intensity === 'medium' ? 1.0 : 1.2;
    const adjustedVolume = Math.min(volume * volumeMultiplier, 1.0);

    if (this.useWebAudio && this.audioBuffer) {
      this.playWebAudio(intensity, adjustedVolume);
    } else if (this.audioElement) {
      this.playHTML5Audio(intensity, adjustedVolume);
    } else {
      // Final fallback: Use synthesized sound
      this.playSynthesizedSound(intensity, volume);
    }
  }

  private toArrayBuffer(binary: ArrayBuffer | ArrayBufferLike | Uint8Array): ArrayBuffer {
    if (binary instanceof ArrayBuffer) {
      return binary.slice(0);
    }

    if (binary instanceof Uint8Array) {
      return binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength);
    }

    return new Uint8Array(binary as ArrayBufferLike).buffer;
  }

  private async tryLoadWithWebAudioFromUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return false;
      }
      const arrayBuffer = await response.arrayBuffer();
      return this.tryLoadWithWebAudio(arrayBuffer);
    } catch (error) {
      console.warn('Task Reward: Failed to fetch audio asset for Web Audio playback.', error);
      return false;
    }
  }

  private async tryLoadWithWebAudio(arrayBuffer: ArrayBuffer): Promise<boolean> {
    const audioContext = this.ensureAudioContext();
    if (!audioContext) {
      this.useWebAudio = false;
      return false;
    }

    try {
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      this.audioBuffer = decoded;
      this.useWebAudio = true;
      return true;
    } catch (error) {
      console.warn('Task Reward: Audio decoding failed, will try HTML audio fallback.', error);
      this.audioBuffer = null;
      this.useWebAudio = false;
      return false;
    }
  }

  private tryLoadWithHtmlAudioFromUrl(url: string): boolean {
    try {
      this.audioElement = new Audio(url);
      this.audioElement.preload = 'auto';
      this.audioElement.crossOrigin = 'anonymous';
      this.audioElement.load();
      this.attachHtmlAudioHandlers(this.audioElement);
      this.useWebAudio = false;
      return true;
    } catch (error) {
      console.warn('Task Reward: Failed to initialise HTML audio from URL.', error);
      this.audioElement = null;
      return false;
    }
  }

  private tryLoadWithHtmlAudioFromBuffer(arrayBuffer: ArrayBuffer, fileName: string): boolean {
    try {
      const mimeType = fileName.endsWith('.mp3') ? 'audio/mpeg' : 'audio/mp4';
      const blob = new Blob([arrayBuffer.slice(0)], { type: mimeType });
      this.objectUrl = URL.createObjectURL(blob);
      this.audioElement = new Audio(this.objectUrl);
      this.audioElement.preload = 'auto';
      this.audioElement.crossOrigin = 'anonymous';
      this.audioElement.load();
      this.attachHtmlAudioHandlers(this.audioElement);
      this.useWebAudio = false;
      return true;
    } catch (error) {
      console.warn('Task Reward: Failed to initialize HTML audio element.', error);
      this.audioElement = null;
      return false;
    }
  }

  private ensureAudioContext(): AudioContext | null {
    if (this.audioContext) return this.audioContext;

    const AudioContextCtor = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AudioContextCtor) return null;

    try {
      this.audioContext = new AudioContextCtor();
      return this.audioContext;
    } catch (error) {
      console.warn('Task Reward: Failed to create AudioContext.', error);
      this.audioContext = null;
      return null;
    }
  }

  private unlockAudio() {
    const context = this.audioContext;
    if (context && context.state === 'suspended') {
      context.resume().catch(() => {
        // ignore unlock failures
      });
    }

    if (this.audioElement && this.audioElement.paused) {
      const previousVolume = this.audioElement.volume;
      this.audioElement.volume = 0;
      this.audioElement.play().then(() => {
        this.audioElement?.pause();
        if (this.audioElement) {
          this.audioElement.currentTime = 0;
          this.audioElement.volume = previousVolume;
        }
      }).catch(() => {
        if (this.audioElement) {
          this.audioElement.volume = previousVolume;
        }
      });
    }

    if (context && context.state === 'running' && (!this.audioElement || this.audioElement.currentTime === 0)) {
      // One successful unlock is enough
      if (this.unlockHandler) {
        window.removeEventListener('pointerdown', this.unlockHandler);
        window.removeEventListener('keydown', this.unlockHandler);
        this.unlockHandler = null;
      }
    }
  }

  private playWebAudio(intensity: 'light' | 'medium' | 'heavy', volume: number) {
    if (!this.audioBuffer) return;

    const audioContext = this.ensureAudioContext();
    if (!audioContext) {
      this.useWebAudio = false;
      this.playHTML5Audio(intensity, volume);
      return;
    }

    const startPlayback = () => {
      try {
        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();

        source.buffer = this.audioBuffer;
        gainNode.gain.value = volume;

        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        source.start();
      } catch (error) {
        console.warn('Task Reward: Failed to play Web Audio:', error);
        this.playHTML5Audio(intensity, volume);
      }
    };

    if (audioContext.state === 'suspended') {
      audioContext.resume().then(startPlayback).catch((error) => {
        console.warn('Task Reward: Unable to resume AudioContext, falling back to HTML audio.', error);
        this.useWebAudio = false;
        this.playHTML5Audio(intensity, volume);
      });
    } else {
      startPlayback();
    }
  }

  private playHTML5Audio(intensity: 'light' | 'medium' | 'heavy', volume: number) {
    if (!this.audioElement) return;

    try {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement.volume = volume;

      const promise = this.audioElement.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(error => {
          console.warn('Task Reward: Failed to play HTML5 audio:', error);
          this.playSynthesizedSound(intensity, volume);
        });
      }
    } catch (error) {
      console.warn('Task Reward: Failed to play HTML5 audio:', error);
      this.playSynthesizedSound(intensity, volume);
    }
  }

  private attachHtmlAudioHandlers(element: HTMLAudioElement) {
    element.addEventListener('error', () => {
      const mediaError = element.error;
      if (mediaError) {
        console.warn('Task Reward: Audio element reported error code', mediaError.code);
      }
    });
  }

  private playSynthesizedSound(intensity: 'light' | 'medium' | 'heavy', volume: number) {
    // Fallback to synthesized sound effect
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();

      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const now = audioContext.currentTime;
      const layers = intensity === 'light' ? 1 : intensity === 'medium' ? 2 : 3;

      this.synthesizeTone(audioContext, now, volume, layers);
    } catch (error) {
      console.warn('Task Reward: Failed to play synthesized sound:', error);
    }
  }

  private synthesizeTone(audioContext: AudioContext, startTime: number, volume: number, layers: number) {
    const gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);

    // Harmonious frequencies for positive feedback
    const frequencies = [
      [880, 1100],  // A5, C#6
      [660, 880],   // E5, A5
      [440, 660]    // A4, E5
    ];

    for (let i = 0; i < Math.min(layers, frequencies.length); i++) {
      const delay = i * 0.03; // Slight delay for layering

      frequencies[i].forEach((freq, idx) => {
        const oscillator = audioContext.createOscillator();
        const layerGain = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, startTime + delay);

        const layerVolume = volume * 0.15 * (1 - i * 0.2);
        layerGain.gain.setValueAtTime(0, startTime + delay);
        layerGain.gain.linearRampToValueAtTime(layerVolume, startTime + delay + 0.01);
        layerGain.gain.exponentialRampToValueAtTime(0.001, startTime + delay + 0.15 + idx * 0.05);

        oscillator.connect(layerGain);
        layerGain.connect(gainNode);

        oscillator.start(startTime + delay);
        oscillator.stop(startTime + delay + 0.2);
      });
    }
  }

  cleanup() {
    this.audioBuffer = null;
    if (this.audioContext) {
      if (typeof this.audioContext.close === 'function') {
        this.audioContext.close().catch(() => {
          // ignore errors on close
        });
      }
      this.audioContext = null;
    }
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    if (this.unlockHandler) {
      window.removeEventListener('pointerdown', this.unlockHandler);
      window.removeEventListener('keydown', this.unlockHandler);
      this.unlockHandler = null;
    }
  }
}
