/* Keyboard, virtual stick and action-button input. */
export class InputController {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.keys = new Set();
    this.joyX = 0;
    this.joyY = 0;
    this.joyActive = false;
    this.sprintHeld = false;
    this.crouch = false;
    this.attackQueued = false;
    this.interactQueued = false;
    this.throwQueued = false;
    this.stickPointer = null;
    this.sprintPointer = null;
    this.enabled = false;
    this.isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 || innerWidth <= 820;
    document.body.classList.toggle('touch', this.isTouch);
    this.bind();
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.clear();
  }

  clear() {
    this.keys.clear();
    this.joyX = 0;
    this.joyY = 0;
    this.joyActive = false;
    this.sprintHeld = false;
    this.attackQueued = false;
    this.interactQueued = false;
    this.throwQueued = false;
    this.stickPointer = null;
    this.sprintPointer = null;
    this.resetStickVisual();
    document.getElementById('btn-sprint')?.classList.remove('pressed');
  }

  get vector() {
    let x = 0, y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (this.joyActive) { x = this.joyX; y = this.joyY; }
    const mag = Math.hypot(x, y);
    if (mag > 1) { x /= mag; y /= mag; }
    return { x, y, mag: Math.min(1, mag) };
  }

  get sprinting() {
    return this.sprintHeld || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  consumeAttack() {
    const v = this.attackQueued;
    this.attackQueued = false;
    return v;
  }

  consumeInteract() {
    const v = this.interactQueued;
    this.interactQueued = false;
    return v;
  }

  consumeThrow() {
    const v = this.throwQueued;
    this.throwQueued = false;
    return v;
  }

  toggleCrouch() {
    this.crouch = !this.crouch;
    document.getElementById('btn-crouch')?.classList.toggle('active', this.crouch);
    this.handlers.onCrouch?.(this.crouch);
  }

  resetStickVisual() {
    const knob = document.getElementById('joystick-knob');
    if (knob) knob.style.transform = 'translate(0px, 0px)';
  }

  bind() {
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(code);
      if (code === 'Escape' || code === 'KeyP') this.handlers.onPause?.();
      if (code === 'KeyC') this.toggleCrouch();
      if (code === 'Space') this.attackQueued = true;
      if (code === 'KeyE' || code === 'Enter') this.interactQueued = true;
      if (code === 'KeyQ') this.throwQueued = true;
      if (code === 'Enter' && this.handlers.onEnter) this.handlers.onEnter();
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.sprintHeld = false;
      document.getElementById('btn-sprint')?.classList.remove('pressed');
    });

    const zone = document.getElementById('joystick-zone');
    const base = zone?.querySelector('.joystick-base');
    const knob = document.getElementById('joystick-knob');
    if (zone && base && knob) {
      const moveStick = (e) => {
        const rect = base.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = e.clientX - cx;
        let dy = e.clientY - cy;
        const max = rect.width * 0.34;
        const mag = Math.hypot(dx, dy);
        if (mag > max) { dx = dx / mag * max; dy = dy / mag * max; }
        this.joyX = dx / max;
        this.joyY = dy / max;
        this.joyActive = Math.hypot(this.joyX, this.joyY) > 0.08;
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
      };
      zone.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (this.stickPointer !== null) return;
        this.stickPointer = e.pointerId;
        zone.setPointerCapture(e.pointerId);
        moveStick(e);
      }, { passive: false });
      zone.addEventListener('pointermove', (e) => {
        if (e.pointerId !== this.stickPointer) return;
        e.preventDefault();
        moveStick(e);
      }, { passive: false });
      const end = (e) => {
        if (e.pointerId !== this.stickPointer) return;
        this.stickPointer = null;
        this.joyX = 0;
        this.joyY = 0;
        this.joyActive = false;
        this.resetStickVisual();
      };
      zone.addEventListener('pointerup', end);
      zone.addEventListener('pointercancel', end);
      zone.addEventListener('lostpointercapture', end);
    }

    const tap = (id, fn) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('pressed');
        fn();
        setTimeout(() => el.classList.remove('pressed'), 120);
      }, { passive: false });
    };

    tap('btn-attack', () => { this.attackQueued = true; });
    tap('btn-interact', () => { this.interactQueued = true; });
    tap('btn-throw', () => { this.throwQueued = true; });
    tap('btn-crouch', () => { this.toggleCrouch(); });

    const sprintBtn = document.getElementById('btn-sprint');
    if (sprintBtn) {
      sprintBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.sprintPointer = e.pointerId;
        this.sprintHeld = true;
        sprintBtn.classList.add('pressed');
      }, { passive: false });
      const endSprint = (e) => {
        if (e && e.pointerId != null && this.sprintPointer != null && e.pointerId !== this.sprintPointer) return;
        if (e) e.preventDefault();
        this.sprintPointer = null;
        this.sprintHeld = false;
        sprintBtn.classList.remove('pressed');
      };
      sprintBtn.addEventListener('pointerup', endSprint, { passive: false });
      sprintBtn.addEventListener('pointercancel', endSprint);
      sprintBtn.addEventListener('pointerleave', endSprint);
    }

    document.addEventListener('pointerup', (e) => {
      // Only release sprint for the finger that pressed it; lifting the
      // movement thumb must not cancel a held sprint.
      if (this.sprintHeld && (this.sprintPointer == null || e.pointerId === this.sprintPointer)) {
        this.sprintPointer = null;
        this.sprintHeld = false;
        document.getElementById('btn-sprint')?.classList.remove('pressed');
      }
    });

    document.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('resize', () => {
      const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 || innerWidth <= 820;
      if (touch !== this.isTouch) {
        this.isTouch = touch;
        document.body.classList.toggle('touch', touch);
      }
    });
  }
}
