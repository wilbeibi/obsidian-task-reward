import TaskRewardPlugin from './main';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface ConfettiBurstConfig {
  intensity: string;
  particleCount: number;
  duration: number;
  origin?: { x: number; y: number };
}

export class ConfettiManager {
  private plugin: TaskRewardPlugin;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private particles: Particle[] = [];
  private animationFrame: number | null = null;
  private colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
  private resizeHandler: (() => void) | null = null;
  private logicalWidth = 0;
  private logicalHeight = 0;

  constructor(plugin: TaskRewardPlugin) {
    this.plugin = plugin;
    this.setupCanvas();
  }

  private setupCanvas() {
    if (this.canvas) return;

    // Create fullscreen canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '9999';
    this.canvas.style.opacity = '1';

    this.ctx = this.canvas.getContext('2d');

    this.resizeHandler = () => this.resizeCanvas();
    this.resizeCanvas();
    if (this.resizeHandler) {
      this.plugin.registerDomEvent(window, 'resize', this.resizeHandler);
    }
  }

  private resizeCanvas() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    this.logicalWidth = window.innerWidth;
    this.logicalHeight = window.innerHeight;

    this.canvas.style.width = `${this.logicalWidth}px`;
    this.canvas.style.height = `${this.logicalHeight}px`;
    this.canvas.width = Math.floor(this.logicalWidth * dpr);
    this.canvas.height = Math.floor(this.logicalHeight * dpr);

    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  burst(config: ConfettiBurstConfig) {
    this.ensureCanvas();

    // Clear existing particles
    this.particles = [];

    // Generate new particles
    const width = this.logicalWidth || window.innerWidth;
    const height = this.logicalHeight || window.innerHeight;
    const originX = this.clamp(config.origin?.x ?? width / 2, 40, Math.max(40, width - 40));
    const originY = this.clamp(config.origin?.y ?? height * 0.25, 40, Math.max(40, height - 40));
    const spreadX = Math.max(width * 0.25, 160);
    const spreadY = Math.max(height * 0.15, 80);

    for (let i = 0; i < config.particleCount; i++) {
      const spawnX = originX + (Math.random() - 0.5) * spreadX;
      const spawnY = originY + (Math.random() - 0.5) * spreadY * 0.3;

      this.particles.push({
        x: spawnX,
        y: spawnY,
        vx: (Math.random() - 0.5) * 6,
        vy: -(Math.random() * 3 + 2),
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        size: Math.random() * 6 + 4,
        life: 1,
        maxLife: config.duration
      });
    }
    
    // Add canvas to DOM
    if (this.canvas && !this.canvas.parentElement) {
      document.body.appendChild(this.canvas);
    }
    
    // Start animation
    this.startAnimation();
  }

  private startAnimation() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      if (!this.ctx || !this.canvas) return;
      
      const elapsed = currentTime - startTime;
      
      // Clear canvas
      this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
      
      // Update and draw particles
      this.particles = this.particles.filter(particle => {
        // Update physics
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.18; // Gravity
        particle.rotation += particle.rotationSpeed;
        
        // Update life
        particle.life = 1 - (elapsed / particle.maxLife);

        if (particle.life <= 0) return false;
        
        // Draw particle
        this.ctx!.save();
        this.ctx!.translate(particle.x, particle.y);
        this.ctx!.rotate((particle.rotation * Math.PI) / 180);
        this.ctx!.globalAlpha = particle.life * 0.9;
        
        // Draw confetti shape (rectangle or circle)
        this.ctx!.fillStyle = particle.color;
        if (Math.random() > 0.5) {
          // Rectangle confetti
          this.ctx!.fillRect(
            -particle.size / 2,
            -particle.size / 3,
            particle.size,
            particle.size / 1.5
          );
        } else {
          // Circle confetti
          this.ctx!.beginPath();
          this.ctx!.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
          this.ctx!.fill();
        }
        
        this.ctx!.restore();
        
        return true;
      });
      
      // Continue animation or cleanup
      if (this.particles.length > 0) {
        this.animationFrame = requestAnimationFrame(animate);
      } else {
        this.stopAnimation();
      }
    };
    
    this.animationFrame = requestAnimationFrame(animate);
  }

  private stopAnimation() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Remove canvas
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }

    // Clear canvas
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
    }
  }

  cleanup() {
    this.stopAnimation();

    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }

    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.logicalWidth = 0;
    this.logicalHeight = 0;
  }

  private ensureCanvas() {
    if (!this.canvas) {
      this.setupCanvas();
    }
    this.resizeCanvas();
  }

  private clamp(value: number, min: number, max: number) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }
}
