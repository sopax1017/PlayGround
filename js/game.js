/* HUNTED // NIGHT SHIFT — game orchestration and simulation. */
import { TAU, clamp, dist, angleTo, normAngle, angleLerp, formatTime, hash2, mulberry32 } from './utils.js';
import { WORLD, WALLS, PROPS, LIGHTS, PLAYER_START, EXIT_ZONE, PICKUP_DEFS, ENEMY_DEFS } from './map.js';
import { NavGrid } from './nav.js';
import { AudioEngine } from './audio.js';
import { MotionController } from './motion.js';
import { Renderer } from './render.js';
import { InputController } from './input.js';
import { drawMinimap } from './render-actors.js';

const $ = (id) => document.getElementById(id);
const dom = {
  title: $('title-screen'),
  hud: $('hud'),
  pause: $('pause-screen'),
  end: $('end-screen'),
  startBtn: $('start-btn'),
  pauseBtn: $('pause-btn'),
  resumeBtn: $('resume-btn'),
  restartBtn: $('restart-btn'),
  againBtn: $('again-btn'),
  titleTilt: $('title-tilt'),
  titleAudio: $('title-audio'),
  pauseTilt: $('pause-tilt'),
  pauseAudio: $('pause-audio'),
  objectiveText: $('objective-text'),
  objCount: $('obj-count'),
  objectiveSub: $('objective-sub'),
  weaponLabel: $('weapon-label'),
  timerLabel: $('timer-label'),
  threatLabel: $('threat-label'),
  threatText: $('threat-text'),
  concealLabel: $('conceal-label'),
  hunterCount: $('hunter-count'),
  healthFill: $('health-fill'),
  staminaFill: $('stamina-fill'),
  healthNum: $('health-num'),
  staminaNum: $('stamina-num'),
  contextPrompt: $('context-prompt'),
  contextKey: $('context-key'),
  contextText: $('context-text'),
  toast: $('toast'),
  minimap: $('minimap'),
  attackBtn: $('btn-attack'),
  attackText: $('attack-text'),
  attackGlyph: $('attack-glyph'),
  crouchBtn: $('btn-crouch'),
  throwBtn: $('btn-throw'),
  interactBtn: $('btn-interact'),
  sprintBtn: $('btn-sprint'),
  executionBanner: $('execution-banner'),
  executionName: $('execution-name'),
  damageFlash: $('damage-flash'),
  executeFlash: $('execute-flash'),
  endKicker: $('end-kicker'),
  endTitle: $('end-title'),
  endCopy: $('end-copy'),
  statTime: $('stat-time'),
  statKills: $('stat-kills'),
  statExecutions: $('stat-executions')
};

const WEAPONS = {
  fists: { name: 'FISTS', damage: 24, reach: 58, noise: 260 },
  knife: { name: 'KNIFE', damage: 46, reach: 64, noise: 180 },
  bat: { name: 'BAT', damage: 42, reach: 70, noise: 330 },
  cleaver: { name: 'CLEAVER', damage: 58, reach: 66, noise: 250 }
};

const canvas = $('game');
const renderer = new Renderer(canvas);
const nav = new NavGrid(WORLD, WALLS, PROPS, 40, 17);
const audio = new AudioEngine();
const motion = new MotionController();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let soundOn = true;
try {
  soundOn = localStorage.getItem('hunted_sound') !== 'off';
} catch {
  // Storage can be unavailable in private or sandboxed browsing contexts.
}
audio.enabled = soundOn;
let tiltBusy = false;
let input;

const state = {
  mode: 'title',
  attract: true,
  time: 0,
  elapsed: 0,
  player: null,
  enemies: [],
  pickups: [],
  particles: [],
  noiseRings: [],
  projectiles: [],
  camera: { x: 1500, y: 980 },
  zoom: 1,
  shake: 0,
  shakeX: 0,
  shakeY: 0,
  hitStop: 0,
  exitUnlocked: false,
  lieutenantKills: 0,
  kills: 0,
  executions: 0,
  executeTarget: null,
  interactTarget: null,
  lastAlertTime: -99,
  minimapTimer: 0,
  hudTimer: 0,
  smokeTimer: 0,
  tiltWarned: false,
  lastFrame: performance.now(),
  missionOver: false,
  toastTimer: 0,
  executionTimer: 0,
  lockToastTime: -99
};

function computeZoom() {
  return clamp(Math.max(innerWidth / 980, innerHeight / 900), 0.82, 1.75);
}

function resize() {
  const w = innerWidth, h = innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.resize(w, h, dpr);
  state.zoom = computeZoom() * (state.attract ? 1.06 : 1);
  if (state.player && state.mode === 'playing') clampCamera();
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));

// ── spatial helpers ────────────────────────────────────────────
function insideRect(x, y, r, pad = 0) {
  return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
}

function lightLevel(x, y) {
  let level = 0.055;
  for (const l of LIGHTS) {
    const d = dist(x, y, l.x, l.y);
    if (d < l.r) {
      const v = (1 - d / l.r) * l.intensity;
      if (v > level) level = v;
    }
  }
  return clamp(level, 0, 1);
}

function hasLOS(x1, y1, x2, y2) {
  for (const w of WALLS) {
    if (segmentIntersects(x1, y1, x2, y2, w)) return false;
  }
  for (const p of PROPS) {
    if (!p.blockVision) continue;
    if (segmentIntersects(x1, y1, x2, y2, p)) return false;
  }
  return true;
}

// local copy to avoid an extra import in hot loops
function segmentIntersects(x1, y1, x2, y2, rect) {
  if (Math.max(x1, x2) < rect.x || Math.min(x1, x2) > rect.x + rect.w ||
      Math.max(y1, y2) < rect.y || Math.min(y1, y2) > rect.y + rect.h) return false;
  const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - rect.x, rect.x + rect.w - x1, y1 - rect.y, rect.y + rect.h - y1];
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-9) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

function collides(x, y, r) {
  if (x < r || y < r || x > WORLD.w - r || y > WORLD.h - r) return true;
  for (const w of WALLS) {
    if (x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h) return true;
  }
  for (const p of PROPS) {
    if (!p.solid) continue;
    if (x + r > p.x && x - r < p.x + p.w && y + r > p.y && y - r < p.y + p.h) return true;
  }
  return false;
}

function moveEntity(ent, dx, dy, r) {
  if (dx) {
    const nx = ent.x + dx;
    if (!collides(nx, ent.y, r)) ent.x = nx;
  }
  if (dy) {
    const ny = ent.y + dy;
    if (!collides(ent.x, ny, r)) ent.y = ny;
  }
}

// Push an actor out of a solid it spawned or got shoved into. Without this,
// an overlapping actor can reject every move direction and freeze in place.
function depenetrate(ent, r) {
  if (!collides(ent.x, ent.y, r)) return false;
  for (let step = 2; step <= 80; step += 2) {
    for (let i = 0; i < 16; i++) {
      const a = i * TAU / 16;
      const nx = ent.x + Math.cos(a) * step;
      const ny = ent.y + Math.sin(a) * step;
      if (!collides(nx, ny, r)) {
        ent.x = nx;
        ent.y = ny;
        return true;
      }
    }
  }
  return false;
}

function clampCamera() {
  const halfW = innerWidth / (2 * state.zoom);
  const halfH = innerHeight / (2 * state.zoom);
  if (WORLD.w > halfW * 2) state.camera.x = clamp(state.camera.x, halfW, WORLD.w - halfW);
  else state.camera.x = WORLD.w / 2;
  if (WORLD.h > halfH * 2) state.camera.y = clamp(state.camera.y, halfH, WORLD.h - halfH);
  else state.camera.y = WORLD.h / 2;
}

// ── setup / reset ──────────────────────────────────────────────
function resetWorld(attract) {
  state.attract = attract;
  state.player = {
    ...PLAYER_START,
    r: 15,
    health: 100,
    stamina: 100,
    weapon: 'fists',
    crouched: false,
    sprinting: false,
    moving: false,
    walkPhase: 0,
    attackCooldown: 0,
    throwCooldown: 0,
    swing: 0,
    stepTimer: 0,
    lastDamage: -99,
    hidden: true,
    medkits: 0
  };
  state.enemies = ENEMY_DEFS.map((def) => ({
    ...def,
    r: 15,
    waypoints: def.waypoints.map(([x, y]) => [x, y]),
    hp: def.hp,
    maxHp: def.hp,
    alive: true,
    state: 'patrol',
    awareness: 0,
    lastSeen: { x: def.x, y: def.y },
    path: [],
    pathTimer: 0,
    waitTimer: 0.5 + Math.random() * 1.8,
    wpIndex: 1,
    walkPhase: Math.random() * TAU,
    attackCooldown: 0,
    hitFlash: 0,
    swing: 0,
    deathAngle: 0,
    lostTimer: 0,
    searchTimer: 0,
    idleLook: Math.random() * 10,
    stuckTimer: 0
  }));
  depenetrate(state.player, state.player.r);
  for (const e of state.enemies) depenetrate(e, e.r);
  state.pickups = PICKUP_DEFS.map((p) => ({ ...p, taken: false }));
  state.particles = [];
  state.noiseRings = [];
  state.projectiles = [];
  state.exitUnlocked = false;
  state.lieutenantKills = 0;
  state.kills = 0;
  state.executions = 0;
  state.executeTarget = null;
  state.interactTarget = null;
  state.shake = 0;
  state.shakeX = 0;
  state.shakeY = 0;
  state.hitStop = 0;
  state.elapsed = 0;
  state.lastAlertTime = -99;
  state.missionOver = false;
  state.smokeTimer = 0;
  state.lockToastTime = -99;
  state.camera.x = attract ? 1500 : state.player.x;
  state.camera.y = attract ? 900 : state.player.y;
  state.zoom = computeZoom() * (attract ? 1.06 : 1);
  input?.clear();
  input && (input.crouch = false);
  dom.crouchBtn?.classList.remove('active');
  updateHUD(0);
}

function startGame() {
  audio.init();
  audio.setEnabled(soundOn);
  resetWorld(false);
  state.mode = 'playing';
  state.attract = false;
  input.setEnabled(true);
  input.clear();
  input.crouch = false;
  dom.title.classList.add('hidden');
  dom.hud.classList.remove('hidden');
  dom.hud.setAttribute('aria-hidden', 'false');
  dom.pause.classList.add('hidden');
  dom.end.classList.add('hidden');
  dom.end.classList.remove('lose');
  dom.executionBanner.classList.remove('on');
  state.lastFrame = performance.now();
  showToast('STAY IN SHADOW · STRIKE FROM BEHIND', 4200);
  updateHUD(0);
}

function togglePause(force) {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    input.setEnabled(false);
    dom.pause.classList.remove('hidden');
    audio.ui();
  } else if (state.mode === 'paused' && force !== true) {
    state.mode = 'playing';
    input.setEnabled(true);
    input.clear();
    dom.pause.classList.add('hidden');
    state.lastFrame = performance.now();
    audio.ui();
  }
}

function showEnd(win) {
  if (state.missionOver) return;
  state.missionOver = true;
  state.mode = win ? 'won' : 'lost';
  input.setEnabled(false);
  dom.executionBanner.classList.remove('on');
  dom.end.classList.remove('hidden');
  dom.end.classList.toggle('lose', !win);
  if (win) {
    dom.endKicker.textContent = 'MISSION COMPLETE';
    dom.endTitle.innerHTML = 'THE NIGHT<br /><span>IS YOURS.</span>';
    dom.endCopy.textContent = 'The van pulls away. Somewhere behind you, the kill floor goes quiet. For the first time tonight, nobody is hunting you.';
    audio.win();
  } else {
    dom.endKicker.textContent = 'MISSION FAILED';
    dom.endTitle.innerHTML = 'YOU WERE<br /><span>HUNTED.</span>';
    dom.endCopy.textContent = 'The kill floor takes another name. Stay in the dark. Strike from behind. Next time, do not let them hear you.';
    audio.lose();
  }
  dom.statTime.textContent = formatTime(state.elapsed);
  dom.statKills.textContent = String(state.kills);
  dom.statExecutions.textContent = String(state.executions);
}

function updateCamera(dt) {
  const t = state.time;
  if (state.attract) {
    const tx = 1500 + Math.sin(t * 0.075) * 355;
    const ty = 900 + Math.cos(t * 0.052) * 190;
    state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 0.7);
    state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 0.7);
  } else if (state.player) {
    const p = state.player;
    const lookX = p.moving ? Math.cos(p.angle) * 46 : 0;
    const lookY = p.moving ? Math.sin(p.angle) * 46 : 0;
    const bias = input.isTouch ? 44 : 0;
    const tx = p.x + lookX;
    const ty = p.y + lookY + bias;
    state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 5.2);
    state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 5.2);
  }
  state.zoom = computeZoom() * (state.attract ? 1.06 : 1);
  clampCamera();

  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 34);
  const amp = state.shake * (reduceMotion ? 0.3 : 1);
  state.shakeX = (Math.random() * 2 - 1) * amp;
  state.shakeY = (Math.random() * 2 - 1) * amp;
}

function updateAttract(dt) {
  updateEnemies(dt, true);
  updateParticles(dt);
  state.smokeTimer -= dt;
  if (state.smokeTimer <= 0) {
    state.smokeTimer = 0.18;
    spawnSmoke(2085 + Math.random() * 30, 1715 + Math.random() * 40);
  }
  updateCamera(dt);
}

// ── player ─────────────────────────────────────────────────────
function updatePlayer(dt) {
  const p = state.player;
  if (!p) return;
  if (collides(p.x, p.y, p.r)) depenetrate(p, p.r);
  p.attackCooldown = Math.max(0, p.attackCooldown - dt);
  p.throwCooldown = Math.max(0, p.throwCooldown - dt);
  p.swing = Math.max(0, p.swing - dt * 4.2);

  const v = input.vector;
  let mx = v.x, my = v.y, mag = v.mag;
  if (motion.enabled && motion.magnitude > 0.09 && motion.magnitude > mag) {
    mx = motion.x;
    my = motion.y;
    mag = Math.min(1, motion.magnitude);
  }

  p.crouched = input.crouch;
  p.sprinting = mag > 0.15 && input.sprinting && !p.crouched && p.stamina > 0.5;
  p.moving = mag > 0.12;

  if (p.sprinting) p.stamina = Math.max(0, p.stamina - 27 * dt);
  else p.stamina = Math.min(100, p.stamina + 17 * dt);

  if (p.moving) {
    const speed = p.sprinting ? 228 : p.crouched ? 83 : 143;
    p.angle = angleLerp(p.angle, Math.atan2(my, mx), Math.min(1, dt * 13));
    moveEntity(p, mx * speed * dt, my * speed * dt, p.r);
    p.walkPhase += dt * (p.sprinting ? 17 : p.crouched ? 7 : 11);
    p.stepTimer -= dt;
    if (p.stepTimer <= 0) {
      p.stepTimer = p.sprinting ? 0.24 : p.crouched ? 0.68 : 0.38;
      audio.footstep(p.sprinting ? 'sprint' : p.crouched ? 'crouch' : 'walk');
      spawnDust(p.x - Math.cos(p.angle) * 8, p.y - Math.sin(p.angle) * 8, p.sprinting ? 2 : 1);
      if (p.sprinting) emitNoise(p.x, p.y, 285, [218, 174, 105], 'sprint');
      else if (!p.crouched) emitNoise(p.x, p.y, 92, [168, 162, 137], 'step');
    }
  } else {
    p.stepTimer = Math.min(p.stepTimer, 0.08);
  }

  p.hidden = lightLevel(p.x, p.y) < 0.24;

  if (p.health > 0 && p.health < 100 && state.time - p.lastDamage > 12) {
    const danger = state.enemies.some(e => e.alive && (e.state === 'chase' || e.state === 'suspicious'));
    if (!danger) p.health = Math.min(100, p.health + 1.7 * dt);
  }

  if (input.consumeAttack()) playerAttack();
  if (input.consumeInteract()) tryInteract();
  if (input.consumeThrow()) throwDistraction();

  state.executeTarget = findExecuteTarget();
  state.interactTarget = findInteractTarget();
}

function findAttackTarget() {
  const p = state.player;
  const reach = WEAPONS[p.weapon].reach;
  let best = null, bestD = reach + 14;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d > bestD) continue;
    if (!hasLOS(p.x, p.y, e.x, e.y)) continue;
    const diff = Math.abs(normAngle(angleTo(p.x, p.y, e.x, e.y) - p.angle));
    if (d > 30 && diff > 1.42) continue;
    best = e;
    bestD = d;
  }
  return best;
}

function canExecute(e) {
  const p = state.player;
  if (!e.alive || e.state === 'chase' || e.awareness > 0.58) return false;
  if (dist(p.x, p.y, e.x, e.y) > 76) return false;
  const behind = Math.cos(normAngle(angleTo(e.x, e.y, p.x, p.y) - e.angle));
  if (behind > -0.12) return false;
  return hasLOS(p.x, p.y, e.x, e.y);
}

function findExecuteTarget() {
  const p = state.player;
  if (!p) return null;
  let best = null, bestD = 78;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d < bestD && canExecute(e)) { best = e; bestD = d; }
  }
  return best ? best.id : null;
}

function playerAttack() {
  const p = state.player;
  if (state.mode !== 'playing' || p.attackCooldown > 0 || state.hitStop > 0) return;
  const weapon = WEAPONS[p.weapon];
  p.attackCooldown = p.weapon === 'bat' || p.weapon === 'cleaver' ? 0.5 : 0.36;
  p.swing = 1;
  audio.swing();

  const target = findAttackTarget();
  if (target && canExecute(target)) {
    executeEnemy(target);
    return;
  }

  if (target) {
    target.hp -= weapon.damage;
    target.hitFlash = 0.14;
    target.state = 'chase';
    target.awareness = 1;
    target.lostTimer = 0;
    target.path = [];
    target.pathTimer = 0;
    target.lastSeen = { x: p.x, y: p.y };
    spawnBlood(target.x, target.y, p.angle, 11);
    const a = angleTo(p.x, p.y, target.x, target.y);
    moveEntity(target, Math.cos(a) * 12, Math.sin(a) * 12, target.r || 15);
    state.shake = Math.max(state.shake, 6);
    state.hitStop = Math.max(state.hitStop, 0.045);
    audio.hit();
    emitNoise(p.x, p.y, weapon.noise, [205, 132, 82], 'hit');
    if (target.hp <= 0) killEnemy(target, false);
    else triggerAlert(target, true);
  } else {
    emitNoise(p.x, p.y, weapon.noise * 0.7, [192, 174, 137], 'swing');
  }
}

function executeEnemy(target) {
  const p = state.player;
  target.alive = false;
  target.state = 'dead';
  target.deathAngle = target.angle + (Math.random() - 0.5) * 1.8;
  target.hp = 0;
  state.kills++;
  state.executions++;
  p.angle = angleTo(p.x, p.y, target.x, target.y);
  spawnBlood(target.x, target.y, p.angle, 34);
  spawnBlood(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, p.angle, 9);
  state.shake = Math.max(state.shake, 14);
  state.hitStop = Math.max(state.hitStop, 0.17);
  audio.execute();
  flashExecute();
  showExecution(target.name);
  emitNoise(target.x, target.y, 95, [185, 88, 62], 'execute');
  onEnemyKilled(target, true);
}

function killEnemy(target, silent) {
  if (!target.alive) return;
  target.alive = false;
  target.state = 'dead';
  target.deathAngle = target.angle + (Math.random() - 0.5) * 1.8;
  target.hp = 0;
  state.kills++;
  spawnBlood(target.x, target.y, target.angle, silent ? 18 : 24);
  if (!silent) {
    state.shake = Math.max(state.shake, 8);
    audio.hit();
  }
  onEnemyKilled(target, silent);
}

function onEnemyKilled(target, silent) {
  if (target.lieutenant) {
    state.lieutenantKills++;
    if (state.lieutenantKills >= 3) {
      state.exitUnlocked = true;
      showToast('EXTRACTION UNLOCKED — <b>REACH THE VAN</b>', 4200);
    } else {
      showToast(`LIEUTENANT DOWN — <b>${state.lieutenantKills} OF 3</b>`, 2800);
    }
  }
  updateHUD(0);
}

function findInteractTarget() {
  const p = state.player;
  if (!p) return null;
  let best = null, bestD = 64;
  for (const item of state.pickups) {
    if (item.taken) continue;
    const d = dist(p.x, p.y, item.x, item.y);
    if (d < bestD) { best = item; bestD = d; }
  }
  if (best) return { type: 'pickup', item: best };
  if (insideRect(p.x, p.y, EXIT_ZONE, 30)) return { type: 'exit' };
  return null;
}

function tryInteract() {
  if (state.mode !== 'playing') return;
  const target = state.interactTarget || findInteractTarget();
  if (!target) return;
  if (target.type === 'pickup') {
    takePickup(target.item);
  } else if (target.type === 'exit') {
    if (state.exitUnlocked) {
      showEnd(true);
    } else if (state.time - state.lockToastTime > 2.2) {
      state.lockToastTime = state.time;
      showToast(`VAN LOCKED — <b>${3 - state.lieutenantKills} LIEUTENANT${3 - state.lieutenantKills === 1 ? '' : 'S'} REMAIN</b>`, 2600);
    }
  }
}

function takePickup(item) {
  item.taken = true;
  const p = state.player;
  if (item.type === 'weapon') {
    p.weapon = item.weapon;
    showToast(`PICKED UP — <b>${WEAPONS[item.weapon].name}</b>`, 2200);
  } else if (item.type === 'medkit') {
    p.health = Math.min(100, p.health + 45);
    p.medkits++;
    showToast('MEDKIT USED — <b>+45 VITAL</b>', 2200);
  }
  audio.pickup();
  state.interactTarget = null;
  updateHUD(0);
}

function throwDistraction() {
  const p = state.player;
  if (state.mode !== 'playing' || p.throwCooldown > 0) return;
  p.throwCooldown = 4.2;
  const a = p.angle;
  const speed = 470;
  state.projectiles.push({
    x: p.x + Math.cos(a) * 18,
    y: p.y + Math.sin(a) * 18,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    life: 0.5,
    maxLife: 0.5,
    spin: Math.random() * TAU
  });
  audio.swing();
  updateHUD(0);
}

function emitNoise(x, y, radius, color, kind) {
  state.noiseRings.push({
    x, y, maxR: radius, life: 0.9, maxLife: 0.9,
    color: color || [198, 186, 153]
  });
  if (state.noiseRings.length > 18) state.noiseRings.shift();

  for (const e of state.enemies) {
    if (!e.alive || e.state === 'chase') continue;
    const d = dist(x, y, e.x, e.y);
    if (d > radius) continue;
    const strength = 1 - d / radius;
    e.lastSeen = { x, y };
    e.awareness = Math.max(e.awareness, 0.32 + strength * 0.18);
    if (e.state === 'patrol') {
      e.state = 'suspicious';
      e.searchTimer = 0;
      e.path = [];
      e.pathTimer = 0;
    } else if (e.state === 'search' || e.state === 'suspicious') {
      e.pathTimer = 0;
    }
  }
}

// ── effects ────────────────────────────────────────────────────
function spawnBlood(x, y, angle, count) {
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * 2.1;
    const speed = 25 + Math.random() * 130;
    state.particles.push({
      type: 'blood',
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0.35 + Math.random() * 0.7,
      maxLife: 1.05,
      size: 1.5 + Math.random() * 4.5,
      color: [70 + Math.random() * 45, 13 + Math.random() * 12, 10]
    });
  }
}

function spawnDust(x, y, count) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      type: 'dust',
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 22,
      vy: (Math.random() - 0.5) * 22,
      life: 0.25 + Math.random() * 0.4,
      maxLife: 0.65,
      size: 2 + Math.random() * 4,
      color: [166, 161, 138]
    });
  }
}

function spawnGlass(x, y) {
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * TAU;
    const speed = 40 + Math.random() * 190;
    state.particles.push({
      type: 'glass',
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0.25 + Math.random() * 0.4,
      maxLife: 0.65,
      size: 1,
      color: [176, 213, 197]
    });
  }
}

function spawnSmoke(x, y) {
  state.particles.push({
    type: 'smoke',
    x, y,
    vx: 5 + Math.random() * 9,
    vy: -8 - Math.random() * 10,
    life: 1.8 + Math.random() * 2.2,
    maxLife: 4,
    size: 8 + Math.random() * 14,
    color: [92, 91, 80]
  });
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) { state.particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.06, dt);
    p.vy *= Math.pow(0.06, dt);
    if (p.type === 'smoke') {
      p.vx += Math.sin((state.time + i) * 1.3) * 2 * dt;
      p.vy -= 1.4 * dt;
    }
  }
  if (state.particles.length > 320) state.particles.splice(0, state.particles.length - 320);
}

function updateNoiseRings(dt) {
  for (let i = state.noiseRings.length - 1; i >= 0; i--) {
    state.noiseRings[i].life -= dt;
    if (state.noiseRings[i].life <= 0) state.noiseRings.splice(i, 1);
  }
}

function updateProjectiles(dt) {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const b = state.projectiles[i];
    b.life -= dt;
    b.spin += dt * 11;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.life <= 0 || collides(b.x, b.y, 2)) {
      emitNoise(b.x, b.y, 430, [124, 200, 189], 'glass');
      audio.glass();
      spawnGlass(b.x, b.y);
      state.projectiles.splice(i, 1);
    }
  }
}

function flashDamage() {
  dom.damageFlash.classList.add('on');
  clearTimeout(state.damageTimer);
  state.damageTimer = setTimeout(() => dom.damageFlash.classList.remove('on'), 110);
}

function flashExecute() {
  dom.executeFlash.classList.add('on');
  setTimeout(() => dom.executeFlash.classList.remove('on'), 520);
}

function showExecution(name) {
  dom.executionName.textContent = name;
  dom.executionBanner.classList.add('on');
  clearTimeout(state.executionTimer);
  state.executionTimer = setTimeout(() => dom.executionBanner.classList.remove('on'), 1400);
}

// ── hunters ────────────────────────────────────────────────────
function canSeePlayer(e) {
  const p = state.player;
  if (!p) return false;
  const d = dist(e.x, e.y, p.x, p.y);
  if (d > e.viewDist * 1.25) return false;
  const light = lightLevel(p.x, p.y);
  let range = e.viewDist * (0.58 + light * 0.58);
  if (p.crouched) range *= 0.78;
  if (p.sprinting) range *= 1.14;
  if (e.state === 'chase') range *= 1.2;
  if (d > range) return false;
  // Always respect the facing cone. A hunter does not magically see a
  // crouched player standing directly behind them; that is the whole point
  // of the stealth execution window.
  const fov = e.state === 'chase' ? Math.min(Math.PI, e.fov * 1.35) : e.fov;
  const dot = (Math.cos(e.angle) * (p.x - e.x) + Math.sin(e.angle) * (p.y - e.y)) / Math.max(1, d);
  if (dot < Math.cos(fov / 2)) return false;
  return hasLOS(e.x, e.y, p.x, p.y);
}

function setEnemyState(e, next) {
  if (e.state === next) return;
  e.state = next;
  e.path = [];
  e.pathTimer = 0;
  if (next === 'suspicious') {
    e.searchTimer = 0;
  } else if (next === 'search') {
    e.searchTimer = 0;
  } else if (next === 'chase') {
    e.lostTimer = 0;
    triggerAlert(e);
  } else if (next === 'patrol') {
    e.awareness = 0;
    e.waitTimer = 0.8 + Math.random() * 1.5;
  }
}

function triggerAlert(e) {
  if (state.time - state.lastAlertTime < 2.2) return;
  state.lastAlertTime = state.time;
  audio.alert();
  showToast("YOU'VE BEEN SEEN — <b>BREAK LINE OF SIGHT</b>", 2400);
}

function ensurePath(e, tx, ty, force = false) {
  if (!force && e.path.length && e.pathTimer > 0) return;
  e.path = nav.findPath(e.x, e.y, tx, ty);
  e.pathTimer = 0.55 + Math.random() * 0.35;
}

function moveAlongPath(e, speed, dt) {
  if (!e.path.length) return false;
  let node = e.path[0];
  if (dist(e.x, e.y, node.x, node.y) < 13) {
    e.path.shift();
    if (!e.path.length) return false;
    node = e.path[0];
  }
  const a = angleTo(e.x, e.y, node.x, node.y);
  const d = dist(e.x, e.y, node.x, node.y);
  const step = Math.min(speed * dt, d);
  const beforeX = e.x, beforeY = e.y;
  moveEntity(e, Math.cos(a) * step, Math.sin(a) * step, e.r || 15);
  if (dist(beforeX, beforeY, e.x, e.y) < step * 0.25) e.pathTimer = 0;
  e.angle = angleLerp(e.angle, a, Math.min(1, dt * 9));
  e.walkPhase += dt * speed * 0.11;
  return true;
}

function updatePatrol(e, dt, sees) {
  const p = state.player;
  if (sees) {
    e.angle = angleLerp(e.angle, angleTo(e.x, e.y, p.x, p.y), Math.min(1, dt * 5));
    if (e.awareness > 0.3) setEnemyState(e, 'suspicious');
    return;
  }
  if (e.waitTimer > 0) {
    e.waitTimer -= dt;
    e.idleLook += dt;
    e.angle += Math.sin(e.idleLook * 1.4) * dt * 0.55;
    return;
  }
  const wp = e.waypoints[e.wpIndex % e.waypoints.length];
  if (dist(e.x, e.y, wp[0], wp[1]) < 30) {
    e.waitTimer = 1.1 + Math.random() * 2.4;
    e.wpIndex = (e.wpIndex + 1) % e.waypoints.length;
    e.path = [];
    return;
  }
  if (!e.path.length || e.pathTimer <= 0) ensurePath(e, wp[0], wp[1]);
  if (!moveAlongPath(e, e.speed, dt)) {
    e.stuckTimer += dt;
    if (e.stuckTimer > 1.3) {
      e.stuckTimer = 0;
      e.waitTimer = 0.2;
      e.wpIndex = (e.wpIndex + 1) % e.waypoints.length;
      ensurePath(e, e.waypoints[e.wpIndex][0], e.waypoints[e.wpIndex][1], true);
    }
  } else {
    e.stuckTimer = 0;
  }
}

function updateEnemyAI(e, dt, attract) {
  if (!e.alive) return;
  if (collides(e.x, e.y, e.r || 15)) depenetrate(e, e.r || 15);
  e.attackCooldown = Math.max(0, e.attackCooldown - dt);
  e.hitFlash = Math.max(0, e.hitFlash - dt);
  e.swing = Math.max(0, e.swing - dt * 4);
  e.pathTimer = Math.max(0, e.pathTimer - dt);

  if (attract) {
    updatePatrol(e, dt, false);
    return;
  }

  const p = state.player;
  const d = dist(e.x, e.y, p.x, p.y);
  const sees = canSeePlayer(e);

  if (sees) {
    e.lastSeen = { x: p.x, y: p.y };
    const light = lightLevel(p.x, p.y);
    let rate = 1.15 + (1 - Math.min(1, d / e.viewDist)) * 1.25;
    if (p.sprinting) rate *= 1.2;
    if (p.crouched) rate *= 0.82;
    e.awareness = Math.min(1, e.awareness + dt * rate);
    if (e.awareness >= 0.96 && e.state !== 'chase') setEnemyState(e, 'chase');
    else if (e.awareness > 0.3 && e.state === 'patrol') setEnemyState(e, 'suspicious');
  } else {
    e.awareness = Math.max(0, e.awareness - dt * 0.2);
  }

  switch (e.state) {
    case 'patrol':
      updatePatrol(e, dt, sees);
      break;

    case 'suspicious': {
      e.searchTimer += dt;
      if (sees) {
        e.angle = angleLerp(e.angle, angleTo(e.x, e.y, p.x, p.y), Math.min(1, dt * 6));
        if (e.awareness >= 0.96) { setEnemyState(e, 'chase'); break; }
        if (d < 95) { setEnemyState(e, 'chase'); break; }
      }
      if (!e.path.length || e.pathTimer <= 0) ensurePath(e, e.lastSeen.x, e.lastSeen.y);
      moveAlongPath(e, e.speed * 0.58, dt);
      if (dist(e.x, e.y, e.lastSeen.x, e.lastSeen.y) < 38) {
        e.idleLook += dt;
        e.angle += Math.sin(e.idleLook * 1.7) * dt * 1.1;
      }
      if (!sees && e.searchTimer > 2.8) setEnemyState(e, 'search');
      break;
    }

    case 'search': {
      e.searchTimer += dt;
      if (sees) {
        e.angle = angleLerp(e.angle, angleTo(e.x, e.y, p.x, p.y), Math.min(1, dt * 7));
        if (e.awareness >= 0.96) { setEnemyState(e, 'chase'); break; }
      }
      const remaining = dist(e.x, e.y, e.lastSeen.x, e.lastSeen.y);
      if (remaining > 45) {
        if (!e.path.length || e.pathTimer <= 0) ensurePath(e, e.lastSeen.x, e.lastSeen.y);
        moveAlongPath(e, e.speed * 0.72, dt);
      } else {
        e.idleLook += dt;
        e.angle += Math.sin(e.idleLook * 1.8) * dt * 1.15;
      }
      if (e.searchTimer > 6.5) setEnemyState(e, 'patrol');
      break;
    }

    case 'chase': {
      if (sees) {
        e.lostTimer = 0;
        e.lastSeen = { x: p.x, y: p.y };
      } else {
        e.lostTimer += dt;
      }
      if (e.lostTimer > 3.4) {
        setEnemyState(e, 'search');
        break;
      }
      if (sees && d < 62) {
        e.angle = angleLerp(e.angle, angleTo(e.x, e.y, p.x, p.y), Math.min(1, dt * 12));
        if (e.attackCooldown <= 0) enemyAttack(e);
        break;
      }
      if (sees && d < 440) {
        const a = angleTo(e.x, e.y, p.x, p.y);
        const beforeX = e.x, beforeY = e.y;
        moveEntity(e, Math.cos(a) * e.chaseSpeed * dt, Math.sin(a) * e.chaseSpeed * dt, e.r || 15);
        e.angle = angleLerp(e.angle, a, Math.min(1, dt * 10));
        e.walkPhase += dt * e.chaseSpeed * 0.12;
        if (dist(beforeX, beforeY, e.x, e.y) < e.chaseSpeed * dt * 0.3) {
          if (!e.path.length || e.pathTimer <= 0) ensurePath(e, p.x, p.y, true);
          moveAlongPath(e, e.chaseSpeed, dt);
        }
      } else {
        if (!e.path.length || e.pathTimer <= 0) ensurePath(e, e.lastSeen.x, e.lastSeen.y);
        moveAlongPath(e, e.chaseSpeed, dt);
        if (!sees && dist(e.x, e.y, e.lastSeen.x, e.lastSeen.y) < 34) {
          setEnemyState(e, 'search');
        }
      }
      break;
    }
  }
}

function updateEnemies(dt, attract = false) {
  for (const e of state.enemies) {
    if (!e.alive) continue;
    updateEnemyAI(e, dt, attract);
  }
  separateEnemies();
}

function separateEnemies() {
  for (let i = 0; i < state.enemies.length; i++) {
    const a = state.enemies[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < state.enemies.length; j++) {
      const b = state.enemies[j];
      if (!b.alive) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = (a.r || 15) + (b.r || 15);
      if (d > 0.01 && d < min) {
        const push = (min - d) * 0.5;
        moveEntity(a, -dx / d * push, -dy / d * push, a.r || 15);
        moveEntity(b, dx / d * push, dy / d * push, b.r || 15);
      }
    }
  }
}

function enemyAttack(e) {
  const p = state.player;
  e.attackCooldown = 1.18 + Math.random() * 0.24;
  e.swing = 1;
  if (dist(e.x, e.y, p.x, p.y) > 74) return;
  p.health = Math.max(0, p.health - e.damage);
  p.lastDamage = state.time;
  state.shake = Math.max(state.shake, 10);
  flashDamage();
  audio.hit();
  spawnBlood(p.x, p.y, angleTo(e.x, e.y, p.x, p.y), 8);
  const a = angleTo(e.x, e.y, p.x, p.y);
  moveEntity(p, Math.cos(a) * 19, Math.sin(a) * 19, p.r);
  if (p.health <= 0) showEnd(false);
}

// ── HUD / feedback ─────────────────────────────────────────────
function updateHUD(dt = 0) {
  const p = state.player;
  if (!p) return;
  state.hudTimer -= dt;
  if (dt > 0 && state.hudTimer > 0) return;
  state.hudTimer = 0.07;

  let anyChase = false, anySus = false, maxAware = 0, alive = 0;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    alive++;
    if (e.state === 'chase') anyChase = true;
    if (e.state === 'suspicious' || e.state === 'search') anySus = true;
    if (e.awareness > maxAware) maxAware = e.awareness;
  }

  let threatClass = 'hidden-state';
  let threatText = p.hidden ? 'HIDDEN' : 'UNDETECTED';
  if (anyChase) { threatClass = 'hunted'; threatText = 'HUNTED'; }
  else if (anySus || maxAware > 0.12) { threatClass = 'suspect'; threatText = 'SUSPICIOUS'; }
  dom.threatLabel.className = `threat-label ${threatClass}`;
  dom.threatText.textContent = threatText;
  dom.concealLabel.classList.toggle('on', p.hidden && !anyChase);
  dom.hunterCount.textContent = String(alive);

  if (state.exitUnlocked) {
    dom.objectiveText.textContent = 'REACH THE EXTRACTION VAN';
    dom.objCount.textContent = 'OPEN';
    dom.objCount.style.color = 'var(--teal)';
    dom.objectiveSub.textContent = 'THE VAN IS WAITING AT THE LOADING DOCK';
  } else {
    dom.objectiveText.textContent = 'ELIMINATE THE LIEUTENANTS';
    dom.objCount.textContent = `${state.lieutenantKills} / 3`;
    dom.objCount.style.color = '';
    dom.objectiveSub.textContent = 'THEN REACH THE EXTRACTION VAN';
  }

  dom.weaponLabel.textContent = `WEAPON / ${WEAPONS[p.weapon].name}`;
  dom.timerLabel.textContent = formatTime(state.elapsed);
  dom.healthFill.style.width = `${clamp(p.health, 0, 100)}%`;
  dom.staminaFill.style.width = `${clamp(p.stamina, 0, 100)}%`;
  dom.healthNum.textContent = String(Math.ceil(p.health));
  dom.staminaNum.textContent = String(Math.ceil(p.stamina));

  const execute = state.executeTarget ? state.enemies.find(e => e.id === state.executeTarget) : null;
  if (execute) {
    dom.attackBtn.classList.add('execute-ready');
    dom.attackText.textContent = 'EXECUTE';
    dom.attackGlyph.textContent = '!';
  } else {
    dom.attackBtn.classList.remove('execute-ready');
    dom.attackText.textContent = 'STRIKE';
    dom.attackGlyph.textContent = '╱';
  }

  const it = state.interactTarget;
  if (it) {
    dom.interactBtn.style.opacity = '1';
    dom.interactBtn.style.borderColor = 'rgba(229,177,107,0.62)';
    if (it.type === 'exit') {
      dom.interactBtn.querySelector('.action-text').textContent = state.exitUnlocked ? 'ESCAPE' : 'LOCKED';
      dom.contextKey.textContent = input.isTouch ? 'USE' : 'E';
      dom.contextText.textContent = state.exitUnlocked ? 'ESCAPE THE KILL FLOOR' : `VAN LOCKED — ${3 - state.lieutenantKills} LIEUTENANTS REMAIN`;
      dom.contextPrompt.classList.add('on');
    } else {
      dom.interactBtn.querySelector('.action-text').textContent = 'TAKE';
      dom.contextKey.textContent = input.isTouch ? 'USE' : 'E';
      dom.contextText.textContent = `TAKE ${it.item.label}`;
      dom.contextPrompt.classList.add('on');
    }
  } else if (execute) {
    dom.interactBtn.style.opacity = '0.5';
    dom.interactBtn.style.borderColor = '';
    dom.interactBtn.querySelector('.action-text').textContent = 'USE';
    dom.contextKey.textContent = input.isTouch ? 'HIT' : 'SPACE';
    dom.contextText.textContent = `EXECUTE ${execute.name}`;
    dom.contextPrompt.classList.add('on');
  } else {
    dom.interactBtn.style.opacity = '0.5';
    dom.interactBtn.style.borderColor = '';
    dom.interactBtn.querySelector('.action-text').textContent = 'USE';
    dom.contextPrompt.classList.remove('on');
  }

  const throwLabel = dom.throwBtn.querySelector('.action-text');
  if (p.throwCooldown > 0) {
    dom.throwBtn.classList.add('cooldown');
    throwLabel.textContent = `${Math.ceil(p.throwCooldown)}S`;
  } else {
    dom.throwBtn.classList.remove('cooldown');
    throwLabel.textContent = 'THROW';
  }
  dom.crouchBtn.classList.toggle('active', p.crouched);

  state.minimapTimer -= dt;
  if (dt === 0 || state.minimapTimer <= 0) {
    state.minimapTimer = 0.1;
    drawMinimap(dom.minimap, state, state.time);
  }
}

function showToast(html, duration = 2600) {
  dom.toast.innerHTML = html;
  dom.toast.classList.add('on');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => dom.toast.classList.remove('on'), duration);
}

function updateAudioUI() {
  const label = soundOn ? 'SOUND ON' : 'SOUND OFF';
  dom.titleAudio.querySelector('.utility-label').textContent = label;
  dom.titleAudio.setAttribute('aria-pressed', String(soundOn));
  dom.pauseAudio.textContent = `SOUND / ${soundOn ? 'ON' : 'OFF'}`;
  dom.pauseAudio.setAttribute('aria-pressed', String(soundOn));
}

function updateTiltUI() {
  const on = motion.enabled;
  dom.titleTilt.querySelector('.utility-label').textContent = on ? 'TILT ON' : 'TILT OFF';
  dom.titleTilt.setAttribute('aria-pressed', String(on));
  dom.pauseTilt.textContent = `TILT CONTROLS / ${on ? 'ON' : 'OFF'}`;
  dom.pauseTilt.setAttribute('aria-pressed', String(on));
}

function toggleAudio() {
  audio.init();
  soundOn = !soundOn;
  audio.setEnabled(soundOn);
  try {
    localStorage.setItem('hunted_sound', soundOn ? 'on' : 'off');
  } catch {
    // Ignore storage failures; the session still remembers the setting.
  }
  updateAudioUI();
  if (state.mode === 'playing') showToast(soundOn ? 'SOUND ON' : 'SOUND OFF', 1200);
}

async function toggleTilt() {
  if (tiltBusy) return;
  if (motion.enabled) {
    motion.disable();
    updateTiltUI();
    if (state.mode === 'playing') showToast('TILT CONTROLS OFF', 1600);
    return;
  }
  tiltBusy = true;
  try {
    await motion.enable();
    state.tiltWarned = false;
    updateTiltUI();
    if (state.mode === 'playing') showToast('TILT ON — HOLD NATURALLY TO CALIBRATE', 2600);
  } catch (err) {
    updateTiltUI();
    const label = dom.titleTilt.querySelector('.utility-label');
    const old = label.textContent;
    label.textContent = 'MOTION BLOCKED';
    setTimeout(() => { if (!motion.enabled) label.textContent = old; }, 2200);
    if (state.mode === 'playing') showToast(String(err.message || 'MOTION UNAVAILABLE').toUpperCase(), 3000);
  } finally {
    tiltBusy = false;
  }
}

function updateHeartbeat() {
  let nearest = Infinity;
  let chase = false;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const d = dist(e.x, e.y, state.player.x, state.player.y);
    if (d < nearest) nearest = d;
    if (e.state === 'chase') chase = true;
  }
  if (chase || nearest < 390) {
    const intensity = clamp(1.35 - nearest / 460, 0.35, 1.2) * (chase ? 1.25 : 1);
    audio.heartbeat(intensity);
  }
}

function checkEndConditions() {
  if (state.mode !== 'playing') return;
  if (state.player.health <= 0) {
    showEnd(false);
    return;
  }
  if (state.exitUnlocked && insideRect(state.player.x, state.player.y, EXIT_ZONE, 6)) {
    showEnd(true);
  }
}

// ── boot / loop ────────────────────────────────────────────────
input = new InputController({
  onPause: () => togglePause(),
  onEnter: () => {
    if (state.mode === 'title' || state.mode === 'won' || state.mode === 'lost') startGame();
  },
  onCrouch: (on) => {
    if (state.mode === 'playing' && state.player) state.player.crouched = on;
  }
});

dom.startBtn.addEventListener('click', () => {
  audio.init();
  audio.ui();
  startGame();
});
dom.pauseBtn.addEventListener('click', () => togglePause());
dom.resumeBtn.addEventListener('click', () => togglePause());
dom.restartBtn.addEventListener('click', () => startGame());
dom.againBtn.addEventListener('click', () => startGame());
dom.titleAudio.addEventListener('click', toggleAudio);
dom.pauseAudio.addEventListener('click', toggleAudio);
dom.titleTilt.addEventListener('click', toggleTilt);
dom.pauseTilt.addEventListener('click', toggleTilt);

document.addEventListener('visibilitychange', () => {
  state.lastFrame = performance.now();
  if (document.hidden && state.mode === 'playing') togglePause();
});

updateAudioUI();
updateTiltUI();
resize();
resetWorld(true);
state.mode = 'title';
state.attract = true;
dom.hud.classList.add('hidden');
dom.hud.setAttribute('aria-hidden', 'true');
dom.pause.classList.add('hidden');
dom.end.classList.add('hidden');

let last = performance.now();
function frame(now) {
  const raw = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  state.lastFrame = now;
  update(raw);
  renderer.render(state);
  requestAnimationFrame(frame);
}

function update(raw) {
  if (state.mode === 'paused') return;
  const dt = Math.min(0.033, raw);
  state.time += dt;
  motion.update(dt);

  if (motion.enabled && !motion.received && performance.now() - motion.enabledAt > 2800 && !state.tiltWarned) {
    state.tiltWarned = true;
    if (state.mode === 'playing') showToast('NO MOTION DATA — USE TOUCH CONTROLS', 2800);
  }

  if (state.mode === 'title') {
    updateAttract(dt);
    return;
  }

  if (state.mode === 'playing') {
    if (state.hitStop > 0) {
      state.hitStop = Math.max(0, state.hitStop - dt);
      updateParticles(dt * 0.3);
      updateCamera(dt);
      updateHUD(dt);
      return;
    }
    state.elapsed += dt;
    updatePlayer(dt);
    if (state.mode !== 'playing') return;
    updateEnemies(dt, false);
    if (state.mode !== 'playing') return;
    updateProjectiles(dt);
    updateNoiseRings(dt);
    updateParticles(dt);
    updateCamera(dt);
    updateHUD(dt);
    updateHeartbeat();
    checkEndConditions();

    state.smokeTimer -= dt;
    if (state.smokeTimer <= 0) {
      state.smokeTimer = 0.22;
      spawnSmoke(2070 + Math.random() * 60, 1710 + Math.random() * 40);
    }
  } else {
    updateParticles(dt);
    updateCamera(dt);
    updateHUD(dt);
  }
}

requestAnimationFrame(frame);

// Lightweight debug hook for automated play-testing (?debug=1).
if (new URLSearchParams(location.search).has('debug')) {
  window.__hunted = {
    state, nav, startGame, togglePause, showEnd, playerAttack, throwDistraction,
    tryInteract, executeEnemy, killEnemy, findExecuteTarget, findInteractTarget
  };
}