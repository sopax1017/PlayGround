/* Optional accelerometer / gyroscope tilt. iOS permission is requested from a tap. */
export class MotionController {
  constructor() {
    this.supported = typeof window.DeviceOrientationEvent !== 'undefined';
    this.enabled = false;
    this.received = false;
    this.enabledAt = 0;
    this.baseX = null;
    this.baseY = null;
    this.rawX = 0;
    this.rawY = 0;
    this.sx = 0;
    this.sy = 0;
    this.listener = (event) => this.onOrientation(event);
  }

  async enable() {
    if (!this.supported) throw new Error('Motion sensors are not available on this device.');
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result !== 'granted') throw new Error('Motion permission was not granted.');
    }
    this.disable();
    this.enabled = true;
    this.received = false;
    this.enabledAt = performance.now();
    this.baseX = null;
    this.baseY = null;
    this.sx = 0;
    this.sy = 0;
    window.addEventListener('deviceorientation', this.listener, true);
  }

  disable() {
    window.removeEventListener('deviceorientation', this.listener, true);
    this.enabled = false;
    this.sx = 0;
    this.sy = 0;
    this.baseX = null;
    this.baseY = null;
  }

  onOrientation(event) {
    if (!this.enabled) return;
    if (event.beta == null && event.gamma == null) return;
    this.received = true;
    const beta = event.beta || 0;
    const gamma = event.gamma || 0;
    const angle = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * Math.PI / 180;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    // Rotate the two tilt axes into screen space.
    const x = gamma * cos - beta * sin;
    const y = beta * cos + gamma * sin;
    if (this.baseX == null) {
      this.baseX = x;
      this.baseY = y;
      return;
    }
    const dead = 2.2;
    let dx = x - this.baseX;
    let dy = y - this.baseY;
    if (Math.abs(dx) < dead) dx = 0;
    if (Math.abs(dy) < dead) dy = 0;
    this.rawX = Math.max(-1, Math.min(1, dx / 19));
    this.rawY = Math.max(-1, Math.min(1, -dy / 19));
  }

  update(dt) {
    if (!this.enabled) {
      this.sx += (0 - this.sx) * Math.min(1, dt * 12);
      this.sy += (0 - this.sy) * Math.min(1, dt * 12);
      return;
    }
    const k = Math.min(1, dt * 9);
    this.sx += (this.rawX - this.sx) * k;
    this.sy += (this.rawY - this.sy) * k;
    if (Math.abs(this.sx) < 0.03) this.sx = 0;
    if (Math.abs(this.sy) < 0.03) this.sy = 0;
  }

  get x() { return this.sx; }
  get y() { return this.sy; }
  get magnitude() { return Math.hypot(this.sx, this.sy); }
}
