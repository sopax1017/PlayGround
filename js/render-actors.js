import { TAU, clamp, dist, hash2, roundedRect, ellipse, line } from './utils.js';
import { WORLD, WALLS, EXIT_ZONE } from './map.js';

export function drawVisionCones(ctx, state, r) {
  const player = state.player;
  if (player && !state.attract) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    const len = 500;
    const g = ctx.createRadialGradient(0, 0, 12, 0, 0, len);
    g.addColorStop(0, 'rgba(230,224,203,0.12)');
    g.addColorStop(0.5, 'rgba(221,214,190,0.055)');
    g.addColorStop(1, 'rgba(221,214,190,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, len, -0.46, 0.46);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (e.x < r.bounds.left - 500 || e.x > r.bounds.right + 500 || e.y < r.bounds.top - 500 || e.y > r.bounds.bottom + 500) continue;
    const chase = e.state === 'chase';
    const alert = e.state === 'suspicious' || e.state === 'search';
    const color = chase ? [205, 61, 43] : alert ? [221, 162, 83] : [202, 181, 126];
    const alpha = chase ? 0.16 : alert ? 0.12 : 0.075;
    const len = e.viewDist;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    const g = ctx.createRadialGradient(0, 0, 24, 0, 0, len);
    g.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},${alpha})`);
    g.addColorStop(0.6, `rgba(${color[0]},${color[1]},${color[2]},${alpha * 0.55})`);
    g.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, len, -e.fov / 2, e.fov / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha * 1.8})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(-e.fov / 2) * len, Math.sin(-e.fov / 2) * len);
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(e.fov / 2) * len, Math.sin(e.fov / 2) * len);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawNoiseRings(ctx, state) {
  for (const n of state.noiseRings) {
    const t = n.life / n.maxLife;
    const radius = n.maxR * (1 - t * t);
    ctx.strokeStyle = `rgba(${n.color[0]},${n.color[1]},${n.color[2]},${0.28 * t})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(n.x, n.y, radius, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = `rgba(${n.color[0]},${n.color[1]},${n.color[2]},${0.08 * t})`;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(n.x, n.y, radius, 0, TAU);
    ctx.stroke();
  }
}

export function drawCorpses(ctx, state) {
  for (const e of state.enemies) {
    if (e.alive) continue;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.deathAngle || 0);
    ctx.fillStyle = 'rgba(40,8,7,0.45)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 36, 22, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(16,19,17,0.95)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 11, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(30,34,29,0.95)';
    ctx.beginPath();
    ctx.ellipse(16, 3, 8, 7, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(5,7,6,0.9)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.lineTo(-27, -14);
    ctx.moveTo(-8, 4);
    ctx.lineTo(-26, 16);
    ctx.stroke();
    ctx.fillStyle = 'rgba(120,35,27,0.45)';
    if (e.lieutenant) {
      ctx.fillStyle = 'rgba(170,45,34,0.72)';
      ctx.fillRect(10, -8, 7, 4);
    }
    ctx.fillStyle = 'rgba(190,177,146,0.18)';
    ctx.beginPath();
    ctx.arc(20, 1, 2.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

export function drawEnemies(ctx, state, r) {
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (e.x < r.bounds.left - 80 || e.x > r.bounds.right + 80 || e.y < r.bounds.top - 80 || e.y > r.bounds.bottom + 80) continue;
    drawEnemy(ctx, e, state);
  }
}

function drawEnemy(ctx, e, state) {
  const walk = Math.sin(e.walkPhase || 0);
  const chase = e.state === 'chase';
  const suspicious = e.state === 'suspicious' || e.state === 'search';
  const flash = e.hitFlash > 0;

  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.ellipse(5, 8, e.lieutenant ? 22 : 18, e.lieutenant ? 13 : 10, 0, 0, TAU);
  ctx.fill();

  ctx.rotate(e.angle);
  const scale = e.lieutenant ? 1.1 : 1;
  ctx.scale(scale, scale);

  // legs
  ctx.strokeStyle = '#171d1a';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-7, -5);
  ctx.lineTo(-15 - walk * 4, -8);
  ctx.moveTo(-7, 5);
  ctx.lineTo(-15 + walk * 4, 8);
  ctx.stroke();

  // torso / armor
  const bodyGrad = ctx.createLinearGradient(-14, -12, 14, 12);
  if (chase) {
    bodyGrad.addColorStop(0, '#4c2b24');
    bodyGrad.addColorStop(1, '#211816');
  } else {
    bodyGrad.addColorStop(0, '#3e4436');
    bodyGrad.addColorStop(0.55, '#282e26');
    bodyGrad.addColorStop(1, '#181d1a');
  }
  ctx.fillStyle = flash ? 'rgba(242,232,210,0.85)' : bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 17, 12, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(7,10,8,0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // tactical vest plate
  ctx.fillStyle = flash ? '#fff4dc' : 'rgba(12,16,14,0.65)';
  ctx.fillRect(-6, -8, 11, 16);
  ctx.strokeStyle = 'rgba(155,166,146,0.18)';
  ctx.strokeRect(-5, -7, 9, 14);

  // arms and weapon
  ctx.strokeStyle = '#1d231e';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(4, -9);
  ctx.lineTo(14, -12 - walk * 2);
  ctx.moveTo(4, 9);
  ctx.lineTo(13, 11 + walk * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(160,156,132,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(13, 11);
  ctx.lineTo(31, 13);
  ctx.stroke();
  ctx.fillStyle = 'rgba(15,17,14,0.9)';
  ctx.fillRect(13, 9, 6, 5);

  // head + cap
  ctx.fillStyle = flash ? '#fff3da' : '#87755e';
  ctx.beginPath();
  ctx.arc(13, 0, 7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = flash ? '#fff8e8' : '#242820';
  ctx.beginPath();
  ctx.arc(13, 0, 8, Math.PI * 0.9, Math.PI * 1.6);
  ctx.lineTo(18, 0);
  ctx.fill();
  ctx.fillStyle = 'rgba(9,11,9,0.8)';
  ctx.fillRect(15, -3, 6, 2);

  // flashlight body + hot spot
  ctx.fillStyle = 'rgba(221,207,165,0.9)';
  ctx.beginPath();
  ctx.arc(22, 7, 3.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,241,197,0.18)';
  ctx.beginPath();
  ctx.arc(22, 7, 7, 0, TAU);
  ctx.fill();

  // red armband for lieutenants
  if (e.lieutenant) {
    ctx.fillStyle = 'rgba(177,51,38,0.85)';
    ctx.fillRect(-2, -13, 7, 5);
    ctx.fillStyle = 'rgba(229,177,107,0.5)';
    ctx.fillRect(0, -12, 3, 2);
  }

  if (e.swing > 0) {
    ctx.strokeStyle = `rgba(232,211,170,${e.swing * 1.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(9, 0, 37, -0.85, 0.4);
    ctx.stroke();
  }

  ctx.restore();

  // status above the hunter
  if (e.awareness > 0.03 && e.state !== 'chase') {
    const w = 36;
    ctx.fillStyle = 'rgba(3,6,5,0.7)';
    ctx.fillRect(e.x - w / 2, e.y - 36, w, 4);
    ctx.fillStyle = suspicious ? 'rgba(226,162,83,0.9)' : 'rgba(219,211,179,0.7)';
    ctx.fillRect(e.x - w / 2, e.y - 36, w * clamp(e.awareness, 0, 1), 4);
  }
  if (e.state === 'chase') {
    ctx.fillStyle = 'rgba(226,74,54,0.95)';
    ctx.font = '900 22px Impact, "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', e.x, e.y - 31);
  } else if (suspicious && e.awareness > 0.25) {
    ctx.fillStyle = 'rgba(229,177,107,0.9)';
    ctx.font = '900 17px Impact, "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('?', e.x, e.y - 31);
  }
  if (e.lieutenant) {
    ctx.fillStyle = 'rgba(199,74,56,0.85)';
    ctx.save();
    ctx.translate(e.x + 24, e.y - 23);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-3.5, -3.5, 7, 7);
    ctx.restore();
  }

  if (state.executeTarget === e.id) {
    const pulse = 0.55 + Math.sin(state.time * 7) * 0.2;
    ctx.strokeStyle = `rgba(229,177,107,${pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 31, -2.4, 0.7);
    ctx.stroke();
    ctx.fillStyle = `rgba(229,177,107,${pulse})`;
    ctx.font = '700 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EXECUTE', e.x, e.y + 44);
  }
}

export function drawPickups(ctx, state, r) {
  for (const p of state.pickups) {
    if (p.taken) continue;
    if (p.x < r.bounds.left - 80 || p.x > r.bounds.right + 80 || p.y < r.bounds.top - 80 || p.y > r.bounds.bottom + 80) continue;
    const bob = Math.sin(state.time * 2.2 + p.x * 0.02) * 2;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 7, 15, 7, 0, 0, TAU);
    ctx.fill();

    const pulse = 0.45 + Math.sin(state.time * 3.4 + p.y * 0.01) * 0.14;
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 28);
    g.addColorStop(0, `rgba(230,185,115,${pulse * 0.22})`);
    g.addColorStop(1, 'rgba(230,185,115,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-28, -28, 56, 56);

    if (p.type === 'weapon') {
      ctx.rotate(-0.45);
      if (p.weapon === 'knife') {
        ctx.fillStyle = '#1a201d';
        ctx.fillRect(-10, -2, 12, 4);
        ctx.fillStyle = 'rgba(219,224,208,0.88)';
        ctx.beginPath();
        ctx.moveTo(2, -2.5);
        ctx.lineTo(19, 0);
        ctx.lineTo(2, 2.5);
        ctx.closePath();
        ctx.fill();
      } else if (p.weapon === 'bat') {
        ctx.strokeStyle = '#6b5637';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(16, 0);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(213,184,126,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-9, -1);
        ctx.lineTo(13, -1);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#262c28';
        ctx.fillRect(-9, -2, 12, 4);
        ctx.fillStyle = 'rgba(211,217,201,0.9)';
        ctx.beginPath();
        ctx.moveTo(3, -8);
        ctx.lineTo(17, 0);
        ctx.lineTo(3, 8);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#d6d0bd';
      ctx.fillRect(-11, -8, 22, 16);
      ctx.fillStyle = '#a7382b';
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-6, -2, 12, 4);
      ctx.strokeStyle = 'rgba(30,34,29,0.8)';
      ctx.strokeRect(-11, -8, 22, 16);
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(229,177,107,0.78)';
    ctx.font = '700 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(p.label, p.x, p.y - 19);
  }
}

export function drawProjectiles(ctx, state) {
  for (const b of state.projectiles) {
    const z = Math.sin((1 - b.life / b.maxLife) * Math.PI) * 32;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, 5, 2.5, 0, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.translate(b.x, b.y - z);
    ctx.rotate(b.spin);
    ctx.fillStyle = 'rgba(143,176,152,0.75)';
    ctx.fillRect(-3, -8, 6, 14);
    ctx.fillStyle = 'rgba(223,231,210,0.8)';
    ctx.fillRect(-1, -10, 2, 4);
    ctx.strokeStyle = 'rgba(255,255,230,0.4)';
    ctx.strokeRect(-3, -8, 6, 14);
    ctx.restore();
  }
}

export function drawParticles(ctx, state) {
  for (const p of state.particles) {
    const t = p.life / p.maxLife;
    if (p.type === 'blood') {
      ctx.fillStyle = `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${0.75 * t})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + t * 0.8), 0, TAU);
      ctx.fill();
    } else if (p.type === 'spark') {
      ctx.strokeStyle = `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${t})`;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      ctx.stroke();
    } else if (p.type === 'dust') {
      ctx.fillStyle = `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${0.14 * t})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.7 - t), 0, TAU);
      ctx.fill();
    } else if (p.type === 'glass') {
      ctx.strokeStyle = `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${0.7 * t})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 0.02, p.y + p.vy * 0.02);
      ctx.stroke();
    } else if (p.type === 'smoke') {
      ctx.fillStyle = `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${0.1 * t})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (2.5 - t * 1.5), 0, TAU);
      ctx.fill();
    }
  }
}

export function drawPlayer(ctx, state, r) {
  const p = state.player;
  if (!p) return;
  const bob = p.moving ? Math.sin(p.walkPhase) * 1.4 : Math.sin(state.time * 1.8) * 0.5;
  const crouch = p.crouched ? 0.82 : 1;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.beginPath();
  ctx.ellipse(4, 8, 18 * crouch, 10 * crouch, 0, 0, TAU);
  ctx.fill();

  ctx.rotate(p.angle);
  ctx.scale(crouch, crouch);

  // legs
  const walk = p.moving ? Math.sin(p.walkPhase) * (p.sprinting ? 5.5 : 3.5) : 0;
  ctx.strokeStyle = '#111715';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, -5);
  ctx.lineTo(-17 - walk, -7);
  ctx.moveTo(-6, 5);
  ctx.lineTo(-17 + walk, 7);
  ctx.stroke();

  // torso / coat
  const g = ctx.createLinearGradient(-12, -12, 12, 12);
  g.addColorStop(0, '#4a5048');
  g.addColorStop(0.4, '#303731');
  g.addColorStop(1, '#151b18');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, bob, 16, 12, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(5,8,7,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // shoulder strap and scarf
  ctx.strokeStyle = 'rgba(151,145,122,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-6, -9);
  ctx.lineTo(7, 8);
  ctx.stroke();
  ctx.fillStyle = 'rgba(154,49,38,0.8)';
  ctx.fillRect(4, -4, 5, 8);

  // arms
  ctx.strokeStyle = '#232a24';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(5, -9);
  ctx.lineTo(15, -12 + walk * 0.4);
  ctx.moveTo(5, 9);
  ctx.lineTo(15, 11 - walk * 0.4);
  ctx.stroke();

  // weapon
  if (p.weapon !== 'fists') {
    ctx.save();
    ctx.translate(14, 11);
    ctx.rotate(p.swing > 0 ? -0.9 + (0.9 - p.swing) * 0.4 : 0.1);
    if (p.weapon === 'bat') {
      ctx.strokeStyle = '#7b6240';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(24, 0);
      ctx.stroke();
    } else if (p.weapon === 'cleaver') {
      ctx.fillStyle = '#2d332f';
      ctx.fillRect(-5, -2, 12, 4);
      ctx.fillStyle = 'rgba(218,222,205,0.9)';
      ctx.beginPath();
      ctx.moveTo(7, -9);
      ctx.lineTo(24, 0);
      ctx.lineTo(7, 9);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = '#202622';
      ctx.fillRect(-4, -2, 9, 4);
      ctx.fillStyle = 'rgba(219,224,208,0.92)';
      ctx.beginPath();
      ctx.moveTo(5, -2.5);
      ctx.lineTo(22, 0);
      ctx.lineTo(5, 2.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // head + hood
  ctx.fillStyle = '#1a211d';
  ctx.beginPath();
  ctx.arc(12, 0, 8.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#cbbda2';
  ctx.beginPath();
  ctx.arc(14.5, 0, 5.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(16,20,17,0.95)';
  ctx.beginPath();
  ctx.arc(12, 0, 8.7, Math.PI * 0.85, Math.PI * 1.55);
  ctx.lineTo(19, 0);
  ctx.fill();
  ctx.fillStyle = 'rgba(9,12,10,0.85)';
  ctx.fillRect(16, -2.5, 4, 2);

  // flashlight
  ctx.fillStyle = 'rgba(242,234,202,0.95)';
  ctx.beginPath();
  ctx.arc(19, 8, 2.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(250,239,196,0.16)';
  ctx.beginPath();
  ctx.arc(19, 8, 7, 0, TAU);
  ctx.fill();

  // outline glint
  ctx.strokeStyle = 'rgba(236,228,205,0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, bob, 16, 12, 0, 0, TAU);
  ctx.stroke();

  if (p.swing > 0) {
    ctx.strokeStyle = `rgba(238,221,183,${0.5 + p.swing * 0.8})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(10, 0, 40, -0.8, 0.6);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawObjectiveMarker(ctx, state, r) {
  const cx = EXIT_ZONE.x + EXIT_ZONE.w / 2;
  const cy = EXIT_ZONE.y + EXIT_ZONE.h / 2;
  const unlocked = state.exitUnlocked;
  const pulse = 0.55 + Math.sin(state.time * 3.2) * 0.22;
  const color = unlocked ? [124, 200, 189] : [199, 74, 56];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${0.25 + pulse * 0.35})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 42 + pulse * 8, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${0.16})`;
  ctx.beginPath();
  ctx.arc(0, 0, 55, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${0.1 + pulse * 0.12})`;
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, TAU);
  ctx.fill();

  // chevrons
  ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${0.55 + pulse * 0.4})`;
  for (let i = 0; i < 3; i++) {
    const y = -16 + i * 14 - (state.time * 18 % 14);
    ctx.beginPath();
    ctx.moveTo(-9, y);
    ctx.lineTo(0, y + 8);
    ctx.lineTo(9, y);
    ctx.lineTo(9, y + 4);
    ctx.lineTo(0, y + 12);
    ctx.lineTo(-9, y + 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(233,227,213,0.8)';
  ctx.font = '700 7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(unlocked ? 'EXTRACTION' : 'LOCKED', 0, 44);
  ctx.restore();
}

export function drawActorGlints(ctx, state, r) {
  const s = (x, y) => ({
    x: (x - r.cam.x) * r.zoom + r.w / 2,
    y: (y - r.cam.y) * r.zoom + r.h / 2
  });
  ctx.save();
  ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const p = s(e.x, e.y);
    if (p.x < -20 || p.x > r.w + 20 || p.y < -20 || p.y > r.h + 20) continue;
    const chase = e.state === 'chase';
    const suspicious = e.state === 'suspicious' || e.state === 'search';
    const a = chase ? 0.95 : suspicious ? 0.68 : 0.32;
    ctx.fillStyle = `rgba(${chase ? '235,80,56' : suspicious ? '230,172,92' : '209,199,170'},${a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 3 * r.zoom, Math.max(1.4, 2.1 * r.zoom), 0, TAU);
    ctx.fill();
    if (e.lieutenant) {
      ctx.fillStyle = `rgba(213,74,53,${0.55 + (chase ? 0.4 : 0)})`;
      ctx.save();
      ctx.translate(p.x + 15 * r.zoom, p.y - 16 * r.zoom);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-2.2, -2.2, 4.4, 4.4);
      ctx.restore();
    }
  }

  for (const p of state.pickups) {
    if (p.taken) continue;
    const q = s(p.x, p.y);
    if (q.x < -20 || q.x > r.w + 20 || q.y < -20 || q.y > r.h + 20) continue;
    ctx.strokeStyle = 'rgba(231,184,111,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(q.x, q.y, 12 * r.zoom, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawMinimap(canvas, state, time) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const pad = 8;
  const scale = Math.min((w - pad * 2) / WORLD.w, (h - pad * 2) / WORLD.h);
  const ox = (w - WORLD.w * scale) / 2;
  const oy = (h - WORLD.h * scale) / 2;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#090d0c';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  ctx.fillStyle = '#121817';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  // faint grid
  ctx.strokeStyle = 'rgba(148,160,146,0.055)';
  ctx.lineWidth = 8;
  for (let x = 0; x <= WORLD.w; x += 300) line(ctx, x, 0, x, WORLD.h, 'rgba(148,160,146,0.055)', 8);
  for (let y = 0; y <= WORLD.h; y += 300) line(ctx, 0, y, WORLD.w, y, 'rgba(148,160,146,0.055)', 8);

  for (const wall of WALLS) {
    ctx.fillStyle = 'rgba(124,133,120,0.44)';
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
  }

  // exit
  const ex = EXIT_ZONE;
  ctx.fillStyle = state.exitUnlocked ? 'rgba(124,200,189,0.85)' : 'rgba(199,74,56,0.7)';
  ctx.fillRect(ex.x, ex.y, ex.w, ex.h);

  for (const e of state.enemies) {
    if (!e.alive) continue;
    const known = e.lieutenant || e.state === 'chase' || e.state === 'suspicious' || dist(e.x, e.y, state.player.x, state.player.y) < 620;
    if (!known) continue;
    ctx.fillStyle = e.lieutenant ? 'rgba(217,72,52,0.95)' : e.state === 'chase' ? 'rgba(235,92,64,0.9)' : 'rgba(203,159,89,0.7)';
    if (e.lieutenant) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-15, -15, 30, 30);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(e.x, e.y, 10, 0, TAU);
      ctx.fill();
    }
  }

  // player viewport
  const vw = Math.min(WORLD.w, 980 / (state.zoom || 1));
  const vh = Math.min(WORLD.h, 900 / (state.zoom || 1));
  ctx.strokeStyle = 'rgba(233,227,213,0.2)';
  ctx.lineWidth = 7;
  ctx.strokeRect(state.player.x - vw / 2, state.player.y - vh / 2, vw, vh);

  // player
  ctx.save();
  ctx.translate(state.player.x, state.player.y);
  ctx.rotate(state.player.angle);
  ctx.fillStyle = 'rgba(233,227,213,0.98)';
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(-13, -13);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-13, 13);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();

  // scanline sheen
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

  // compass
  ctx.fillStyle = 'rgba(233,227,213,0.4)';
  ctx.font = '700 9px monospace';
  ctx.fillText('N', w - 16, 16);
  ctx.strokeStyle = 'rgba(233,227,213,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w - 13, 20);
  ctx.lineTo(w - 13, 27);
  ctx.stroke();
}
