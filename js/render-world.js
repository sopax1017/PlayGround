import { TAU, clamp, hash2, mulberry32, roundedRect, ellipse, line, rgb } from './utils.js';
import { WORLD, WALLS, PROPS, LIGHTS, ZONES, DECALS, EXIT_ZONE } from './map.js';

let noisePattern = null;

function buildNoisePattern(ctx) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const nctx = c.getContext('2d');
  const image = nctx.createImageData(256, 256);
  const rng = mulberry32(0x51a7);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 30 + Math.floor(rng() * 55);
    image.data[i] = v;
    image.data[i + 1] = v + 2;
    image.data[i + 2] = v;
    image.data[i + 3] = 10 + Math.floor(rng() * 48);
  }
  nctx.putImageData(image, 0, 0);
  // hairline cracks and grime
  nctx.globalAlpha = 0.24;
  for (let i = 0; i < 22; i++) {
    nctx.strokeStyle = rng() > 0.5 ? '#0c0e0d' : '#7b7b6d';
    nctx.lineWidth = 0.5 + rng();
    nctx.beginPath();
    let x = rng() * 256, y = rng() * 256;
    nctx.moveTo(x, y);
    for (let j = 0; j < 3; j++) {
      x += (rng() - 0.5) * 38;
      y += (rng() - 0.5) * 38;
      nctx.lineTo(x, y);
    }
    nctx.stroke();
  }
  return ctx.createPattern(c, 'repeat');
}

export function initWorldTextures(ctx) {
  noisePattern = buildNoisePattern(ctx);
}

export function lightFlicker(light, time) {
  const phase = light.x * 0.013 + light.y * 0.009;
  const f = light.flicker || 0;
  let v = 1 - f * 0.5 + Math.sin(time * 9.1 + phase) * f * 0.24 + Math.sin(time * 23.7 + phase * 2.3) * f * 0.12;
  if (hash2(Math.floor(time * 7.2 + phase), Math.floor(phase * 31)) > 0.972) v -= f * 1.5;
  return clamp(v, 0.2, 1.15);
}

export function visibleRect(x, y, w, h, r) {
  return x < r.bounds.right && x + w > r.bounds.left && y < r.bounds.bottom && y + h > r.bounds.top;
}

export function drawFloor(ctx, state, r) {
  const cell = 64;
  const b = r.bounds;
  ctx.fillStyle = '#121615';
  ctx.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top);

  const x0 = Math.floor(b.left / cell) * cell;
  const x1 = Math.ceil(b.right / cell) * cell;
  const y0 = Math.floor(b.top / cell) * cell;
  const y1 = Math.ceil(b.bottom / cell) * cell;

  for (let y = y0; y < y1; y += cell) {
    for (let x = x0; x < x1; x += cell) {
      const tx = x / cell, ty = y / cell;
      const h = hash2(tx, ty);
      const h2 = hash2(tx + 41, ty - 17);
      const base = 38 + h * 14;
      ctx.fillStyle = `rgb(${base | 0},${(base + 4 + h2 * 4) | 0},${(base + 1) | 0})`;
      ctx.fillRect(x, y, cell, cell);

      // tile seams
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x, y, cell, 1);
      ctx.fillRect(x, y, 1, cell);
      ctx.fillStyle = 'rgba(200,202,188,0.025)';
      ctx.fillRect(x, y + 1, cell, 1);

      if (h > 0.78) {
        ctx.fillStyle = `rgba(8,10,9,${0.05 + h2 * 0.08})`;
        ctx.beginPath();
        ctx.ellipse(x + 18 + h * 28, y + 20 + h2 * 30, 7 + h2 * 12, 3 + h * 5, h * 4, 0, TAU);
        ctx.fill();
      }
      if (h2 > 0.9) {
        ctx.strokeStyle = 'rgba(4,6,5,0.26)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(x + 9 + h * 40, y + 10);
        ctx.lineTo(x + 16 + h2 * 36, y + 26);
        ctx.lineTo(x + 10 + h * 50, y + 48);
        ctx.stroke();
      }
    }
  }

  for (const z of ZONES) {
    if (!visibleRect(z.x, z.y, z.w, z.h, r)) continue;
    ctx.fillStyle = rgb(z.color, z.alpha);
    ctx.fillRect(z.x, z.y, z.w, z.h);
  }

  if (noisePattern) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = noisePattern;
    ctx.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
    ctx.restore();
  }

  // broad painted walkway lines
  ctx.save();
  ctx.strokeStyle = 'rgba(190,170,115,0.06)';
  ctx.lineWidth = 5;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  ctx.moveTo(420, 1570);
  ctx.lineTo(420, 1500);
  ctx.lineTo(1450, 1500);
  ctx.lineTo(1450, 1435);
  ctx.moveTo(1450, 450);
  ctx.lineTo(1450, 260);
  ctx.lineTo(2200, 260);
  ctx.lineTo(2200, 400);
  ctx.stroke();
  ctx.restore();
}

export function drawDecals(ctx, state, r) {
  for (const d of DECALS) {
    if (d.x < r.bounds.left - 220 || d.x > r.bounds.right + 220 || d.y < r.bounds.top - 220 || d.y > r.bounds.bottom + 220) continue;
    switch (d.type) {
      case 'grime': {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rot);
        ctx.fillStyle = `rgba(0,0,0,${d.alpha})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, d.rx, d.ry, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'stain': {
        const g = ctx.createRadialGradient(d.x, d.y, 2, d.x, d.y, d.r);
        g.addColorStop(0, rgb(d.color, d.alpha));
        g.addColorStop(0.65, rgb(d.color, d.alpha * 0.6));
        g.addColorStop(1, rgb(d.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, TAU);
        ctx.fill();
        break;
      }
      case 'puddle': {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rot);
        const g = ctx.createLinearGradient(0, -d.ry, 0, d.ry);
        g.addColorStop(0, `rgba(122,156,155,${d.alpha * 0.6})`);
        g.addColorStop(0.5, `rgba(26,42,42,${d.alpha})`);
        g.addColorStop(1, 'rgba(2,5,5,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, d.rx, d.ry, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = `rgba(174,198,190,${d.alpha * 0.22})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'blood':
        drawBlood(ctx, d);
        break;
      case 'grate': {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rot);
        ctx.fillStyle = 'rgba(3,5,4,0.78)';
        ctx.fillRect(0, 0, d.w, d.h);
        ctx.strokeStyle = 'rgba(126,130,118,0.25)';
        ctx.lineWidth = 2;
        for (let i = 6; i < d.w; i += 12) line(ctx, i, 4, i, d.h - 4, 'rgba(126,130,118,0.22)', 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, d.w, d.h);
        ctx.restore();
        break;
      }
      case 'hazard': {
        ctx.save();
        ctx.beginPath();
        ctx.rect(d.x, d.y, d.w, d.h);
        ctx.clip();
        ctx.fillStyle = 'rgba(14,14,10,0.55)';
        ctx.fillRect(d.x, d.y, d.w, d.h);
        for (let i = -d.h; i < d.w + d.h; i += 18) {
          ctx.fillStyle = 'rgba(197,157,73,0.34)';
          ctx.beginPath();
          ctx.moveTo(d.x + i, d.y + d.h);
          ctx.lineTo(d.x + i + 9, d.y + d.h);
          ctx.lineTo(d.x + i + d.h + 9, d.y);
          ctx.lineTo(d.x + i + d.h, d.y);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        break;
      }
      case 'label': {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rot);
        ctx.fillStyle = `rgba(208,198,172,${d.alpha})`;
        ctx.font = `900 ${d.size}px Impact, "Arial Narrow", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(d.text, 0, 0);
        ctx.restore();
        break;
      }
    }
  }
}

function drawBlood(ctx, d) {
  const rng = mulberry32(d.seed || 7);
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.rot);
  ctx.scale(d.scale, d.scale);
  ctx.fillStyle = 'rgba(52,10,9,0.38)';
  for (let i = 0; i < 7; i++) {
    const x = (rng() - 0.5) * 42;
    const y = (rng() - 0.5) * 30;
    const rr = 5 + rng() * 16;
    ctx.beginPath();
    ctx.ellipse(x, y, rr, rr * (0.55 + rng() * 0.5), rng() * 3, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(79,15,12,0.4)';
  for (let i = 0; i < 13; i++) {
    const a = rng() * TAU, len = 18 + rng() * 62;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * len, Math.sin(a) * len, 1 + rng() * 4, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(91,20,15,0.3)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo((rng() - 0.5) * 16, (rng() - 0.5) * 12);
    ctx.lineTo((rng() - 0.5) * 74, (rng() - 0.5) * 52);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawWalls(ctx, state, r) {
  for (const w of WALLS) {
    if (!visibleRect(w.x, w.y, w.w, w.h, r)) continue;
    const metal = w.style === 'metal';
    const outer = w.style === 'outer';
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    ctx.fillRect(w.x + 9, w.y + 12, w.w, w.h);

    const g = ctx.createLinearGradient(0, w.y, 0, w.y + w.h);
    if (metal) {
      g.addColorStop(0, '#46514e');
      g.addColorStop(0.22, '#333e3b');
      g.addColorStop(1, '#1a2220');
    } else if (outer) {
      g.addColorStop(0, '#2e3431');
      g.addColorStop(1, '#111615');
    } else {
      g.addColorStop(0, '#4c524f');
      g.addColorStop(0.16, '#3c4340');
      g.addColorStop(1, '#212825');
    }
    ctx.fillStyle = g;
    ctx.fillRect(w.x, w.y, w.w, w.h);

    ctx.fillStyle = 'rgba(233,227,213,0.2)';
    if (w.w >= w.h) ctx.fillRect(w.x + 2, w.y + 2, w.w - 4, 2);
    else ctx.fillRect(w.x + 2, w.y + 2, 2, w.h - 4);
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    if (w.w >= w.h) ctx.fillRect(w.x, w.y + w.h - 4, w.w, 4);
    else ctx.fillRect(w.x + w.w - 4, w.y, 4, w.h);

    ctx.strokeStyle = 'rgba(4,6,5,0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);

    if (metal) {
      ctx.strokeStyle = 'rgba(170,181,172,0.12)';
      ctx.lineWidth = 1;
      if (w.w > w.h) {
        for (let x = w.x + 14; x < w.x + w.w - 8; x += 26) line(ctx, x, w.y + 4, x, w.y + w.h - 4, 'rgba(170,181,172,0.12)', 1);
      } else {
        for (let y = w.y + 14; y < w.y + w.h - 8; y += 26) line(ctx, w.x + 4, y, w.x + w.w - 4, y, 'rgba(170,181,172,0.12)', 1);
      }
    } else {
      const count = Math.floor((w.w > w.h ? w.w : w.h) / 46);
      ctx.fillStyle = 'rgba(195,197,182,0.12)';
      for (let i = 0; i < count; i++) {
        const x = w.w > w.h ? w.x + 20 + i * 46 : w.x + w.w * 0.5;
        const y = w.w > w.h ? w.y + w.h * 0.5 : w.y + 20 + i * 46;
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, TAU);
        ctx.fill();
      }
    }
  }
}

export function drawProps(ctx, state, r) {
  const visible = PROPS.filter(p => visibleRect(p.x - 16, p.y - 16, p.w + 32, p.h + 32, r));
  visible.sort((a, b) => (a.y + a.h) - (b.y + b.h));
  for (const p of visible) drawProp(ctx, p, r);
}

function shadow(ctx, p, off = 9) {
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.fillRect(p.x + off, p.y + off * 1.2, p.w, p.h);
}

function drawProp(ctx, p, r) {
  const x = p.x, y = p.y, w = p.w, h = p.h;
  const v = p.seed || 0.5;
  switch (p.type) {
    case 'crate': {
      shadow(ctx, p);
      ctx.fillStyle = v > 0.5 ? '#3d3323' : '#332c20';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#16120c';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      ctx.strokeStyle = 'rgba(198,166,105,0.24)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
      ctx.beginPath();
      ctx.moveTo(x + 7, y + h - 7);
      ctx.lineTo(x + w - 7, y + 7);
      ctx.stroke();
      ctx.fillStyle = 'rgba(210,187,133,0.18)';
      ctx.fillRect(x + 5, y + 5, w - 10, 2);
      ctx.fillStyle = 'rgba(16,12,8,0.5)';
      for (let i = 12; i < w - 8; i += 20) ctx.fillRect(x + i, y + h * 0.5 - 1, 9, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(x + w - 8, y + 6, 3, h - 12);
      break;
    }
    case 'pallet': {
      ctx.fillStyle = 'rgba(0,0,0,0.24)';
      ctx.fillRect(x + 5, y + 5, w, h);
      ctx.fillStyle = '#2d271b';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#4a3d27';
      for (let i = 0; i < 5; i++) ctx.fillRect(x + 5 + i * (w - 10) / 5, y + 4, (w - 10) / 7, h - 8);
      ctx.strokeStyle = 'rgba(8,7,4,0.6)';
      ctx.strokeRect(x, y, w, h);
      break;
    }
    case 'barrel': {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ellipse(ctx, x + w / 2 + 7, y + h / 2 + 9, w / 2, h / 2);
      ctx.fill();
      const g = ctx.createRadialGradient(x + w * 0.38, y + h * 0.32, 2, x + w / 2, y + h / 2, w / 2);
      g.addColorStop(0, v > 0.5 ? '#5a5540' : '#4d3e2c');
      g.addColorStop(1, '#1b1a15');
      ctx.fillStyle = g;
      ellipse(ctx, x + w / 2, y + h / 2, w / 2, h / 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(12,12,9,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(207,183,116,0.22)';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w * 0.35, h * 0.35, 0, 0, TAU);
      ctx.stroke();
      if (v > 0.6) {
        ctx.fillStyle = 'rgba(167,53,37,0.48)';
        ctx.beginPath();
        ctx.arc(x + w * 0.52, y + h * 0.48, w * 0.16, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'locker': {
      shadow(ctx, p, 7);
      ctx.fillStyle = '#27312e';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#101615';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.strokeStyle = 'rgba(156,175,163,0.18)';
      for (let i = 26; i < w; i += 30) line(ctx, x + i, y + 4, x + i, y + h - 4, 'rgba(156,175,163,0.18)', 1);
      ctx.fillStyle = 'rgba(200,196,170,0.4)';
      for (let i = 18; i < w; i += 30) ctx.fillRect(x + i, y + h * 0.48, 2, 8);
      break;
    }
    case 'shelf': {
      shadow(ctx, p, 7);
      ctx.fillStyle = '#1b201d';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(123,132,121,0.32)';
      ctx.lineWidth = 2;
      if (w > h) {
        for (let i = 0; i < 3; i++) line(ctx, x + 3, y + 7 + i * (h - 14) / 2, x + w - 3, y + 7 + i * (h - 14) / 2, 'rgba(123,132,121,0.32)', 2);
        for (let i = 12; i < w - 8; i += 34) {
          ctx.fillStyle = `rgba(${60 + v * 30},${50 + v * 20},${35},0.8)`;
          ctx.fillRect(x + i, y + 8, 18, h - 18);
        }
      } else {
        for (let i = 0; i < 3; i++) line(ctx, x + 7 + i * (w - 14) / 2, y + 3, x + 7 + i * (w - 14) / 2, y + h - 3, 'rgba(123,132,121,0.32)', 2);
        for (let i = 12; i < h - 8; i += 34) {
          ctx.fillStyle = `rgba(${55 + v * 30},${50 + v * 20},${38},0.8)`;
          ctx.fillRect(x + 8, y + i, w - 18, 18);
        }
      }
      break;
    }
    case 'bench': {
      shadow(ctx, p, 5);
      ctx.fillStyle = '#343a33';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(180,184,165,0.12)';
      ctx.fillRect(x + 4, y + 3, w - 8, 2);
      ctx.strokeStyle = '#111513';
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      break;
    }
    case 'sink': {
      ctx.fillStyle = '#2e3937';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(150,170,164,0.3)';
      ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
      ctx.fillStyle = 'rgba(120,165,160,0.15)';
      ctx.fillRect(x + 8, y + 7, w - 16, h - 14);
      break;
    }
    case 'bodybag': {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x + 6, y + 6, w, h);
      ctx.fillStyle = '#111514';
      roundedRect(ctx, x, y, w, h, h * 0.45);
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,150,135,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      line(ctx, x + 12, y + h / 2, x + w - 12, y + h / 2, 'rgba(145,155,140,0.3)', 1.5);
      ctx.fillStyle = 'rgba(192,166,118,0.3)';
      ctx.fillRect(x + w * 0.76, y + h * 0.3, 12, 7);
      break;
    }
    case 'carcass': {
      // hook and chain
      ctx.strokeStyle = 'rgba(140,140,123,0.3)';
      ctx.lineWidth = 2;
      line(ctx, x + w / 2, y - 22, x + w / 2, y + 2, 'rgba(140,140,123,0.3)', 2);
      ctx.strokeStyle = 'rgba(182,182,160,0.45)';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + 2, 5, Math.PI * 0.15, Math.PI * 1.3);
      ctx.stroke();
      // body
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, 'rgba(151,121,100,0.78)');
      g.addColorStop(0.5, 'rgba(116,86,70,0.82)');
      g.addColorStop(1, 'rgba(58,42,35,0.9)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h * 0.58, w * 0.4, h * 0.43, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(44,24,20,0.75)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) {
        const yy = y + h * (0.34 + i * 0.12);
        ctx.beginPath();
        ctx.moveTo(x + w * 0.28, yy);
        ctx.quadraticCurveTo(x + w * 0.5, yy + 4, x + w * 0.72, yy);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(104,25,20,0.5)';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h * 0.84, w * 0.18, 4, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case 'curtain': {
      ctx.save();
      ctx.globalAlpha = 0.5;
      const strips = Math.max(3, Math.floor(w / 13));
      for (let i = 0; i < strips; i++) {
        const sx = x + i * (w / strips);
        const grad = ctx.createLinearGradient(sx, y, sx + 8, y + h);
        grad.addColorStop(0, 'rgba(207,216,202,0.35)');
        grad.addColorStop(0.5, 'rgba(160,174,161,0.17)');
        grad.addColorStop(1, 'rgba(207,216,202,0.28)');
        ctx.fillStyle = grad;
        ctx.fillRect(sx + 1, y, w / strips - 3, h);
      }
      ctx.strokeStyle = 'rgba(30,38,34,0.65)';
      ctx.lineWidth = 2;
      line(ctx, x, y, x + w, y, 'rgba(30,38,34,0.65)', 2);
      ctx.restore();
      break;
    }
    case 'table': {
      shadow(ctx, p, 8);
      ctx.fillStyle = '#2e3937';
      ctx.fillRect(x, y, w, h);
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, 'rgba(190,203,194,0.18)');
      g.addColorStop(0.25, 'rgba(50,66,62,0.7)');
      g.addColorStop(1, 'rgba(24,32,30,0.9)');
      ctx.fillStyle = g;
      ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
      ctx.strokeStyle = 'rgba(177,192,180,0.24)';
      ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
      ctx.fillStyle = 'rgba(194,206,194,0.13)';
      ctx.fillRect(x + 6, y + 5, w - 12, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x + w * 0.24, y + h * 0.68, w * 0.4, 2);
      break;
    }
    case 'machine': {
      shadow(ctx, p, 10);
      ctx.fillStyle = '#252d2b';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#0f1412';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      ctx.fillStyle = '#1a211f';
      ctx.fillRect(x + 10, y + 10, w - 20, h * 0.45);
      ctx.strokeStyle = 'rgba(160,174,160,0.16)';
      for (let i = 0; i < 4; i++) line(ctx, x + 15, y + 18 + i * 12, x + w - 15, y + 18 + i * 12, 'rgba(160,174,160,0.16)', 1);
      ctx.fillStyle = 'rgba(213,157,72,0.7)';
      ctx.fillRect(x + 12, y + h - 20, w * 0.35, 4);
      ctx.fillStyle = 'rgba(19,21,18,0.8)';
      for (let i = 0; i < 5; i++) ctx.fillRect(x + 12 + i * 9, y + h - 11, 5, 3);
      ctx.fillStyle = 'rgba(201,70,50,0.85)';
      ctx.beginPath();
      ctx.arc(x + w - 17, y + 17, 3, 0, TAU);
      ctx.fill();
      break;
    }
    case 'desk': {
      shadow(ctx, p, 8);
      ctx.fillStyle = '#3b3324';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#17130e';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = 'rgba(212,194,145,0.1)';
      ctx.fillRect(x + 5, y + 5, w - 10, 3);
      // monitor
      ctx.fillStyle = '#0b1110';
      ctx.fillRect(x + w * 0.58, y + h * 0.2, w * 0.26, h * 0.38);
      ctx.fillStyle = 'rgba(107,174,162,0.28)';
      ctx.fillRect(x + w * 0.6, y + h * 0.23, w * 0.22, h * 0.3);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x + w * 0.7, y + h * 0.58, 3, 6);
      // papers
      ctx.fillStyle = 'rgba(202,196,174,0.22)';
      ctx.fillRect(x + w * 0.12, y + h * 0.32, w * 0.22, h * 0.25);
      ctx.fillRect(x + w * 0.2, y + h * 0.22, w * 0.2, h * 0.24);
      break;
    }
    case 'cabinet': {
      shadow(ctx, p, 6);
      ctx.fillStyle = '#2b3330';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#111614';
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.strokeStyle = 'rgba(168,179,163,0.18)';
      for (let i = 1; i < 4; i++) line(ctx, x + 4, y + i * h / 4, x + w - 4, y + i * h / 4, 'rgba(168,179,163,0.18)', 1);
      ctx.fillStyle = 'rgba(205,199,170,0.36)';
      for (let i = 0; i < 4; i++) ctx.fillRect(x + w * 0.45, y + i * h / 4 + h * 0.13, 5, 2);
      break;
    }
    case 'chair': {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(x + w / 2 + 4, y + h / 2 + 5, w * 0.46, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1f2623';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, w * 0.4, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(170,180,164,0.18)';
      ctx.stroke();
      break;
    }
    case 'van': {
      shadow(ctx, p, 13);
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, '#626a62');
      g.addColorStop(0.4, '#444c46');
      g.addColorStop(1, '#252c28');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#0c100e';
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
      // roof ridges
      ctx.strokeStyle = 'rgba(220,224,207,0.12)';
      for (let i = 0; i < 5; i++) line(ctx, x + 30 + i * 55, y + 20, x + 30 + i * 55, y + h - 50, 'rgba(220,224,207,0.12)', 2);
      // windshield
      ctx.fillStyle = '#101b1b';
      ctx.fillRect(x + 26, y + 18, w - 52, 38);
      ctx.fillStyle = 'rgba(127,181,177,0.15)';
      ctx.fillRect(x + 30, y + 22, w - 60, 6);
      // rear open doors
      ctx.fillStyle = '#0c1110';
      ctx.fillRect(x + 34, y + h - 64, w - 68, 42);
      ctx.strokeStyle = 'rgba(194,199,180,0.2)';
      ctx.strokeRect(x + 34, y + h - 64, w - 68, 42);
      ctx.fillStyle = 'rgba(207,65,47,0.9)';
      ctx.fillRect(x + 18, y + h - 26, 20, 7);
      ctx.fillRect(x + w - 38, y + h - 26, 20, 7);
      ctx.fillStyle = 'rgba(238,229,208,0.18)';
      ctx.font = '700 16px "Arial Narrow", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('EXTRACTION', x + w / 2, y + h - 34);
      // wheels
      ctx.fillStyle = '#080a09';
      ctx.fillRect(x - 8, y + 38, 16, 34);
      ctx.fillRect(x + w - 8, y + 38, 16, 34);
      ctx.fillRect(x - 8, y + h - 62, 16, 34);
      ctx.fillRect(x + w - 8, y + h - 62, 16, 34);
      break;
    }
    case 'forklift': {
      shadow(ctx, p, 8);
      ctx.fillStyle = '#7f6424';
      ctx.fillRect(x, y, w * 0.7, h);
      ctx.fillStyle = '#27281d';
      ctx.fillRect(x + w * 0.14, y + h * 0.12, w * 0.3, h * 0.76);
      ctx.fillStyle = '#171a17';
      ctx.fillRect(x + w * 0.64, y + h * 0.2, w * 0.4, 9);
      ctx.fillRect(x + w * 0.64, y + h * 0.68, w * 0.4, 9);
      ctx.fillStyle = '#0b0d0b';
      ctx.beginPath(); ctx.arc(x + w * 0.18, y + h * 0.92, 9, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w * 0.55, y + h * 0.92, 9, 0, TAU); ctx.fill();
      break;
    }
    case 'conveyor': {
      shadow(ctx, p, 7);
      ctx.fillStyle = '#202926';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(151,164,151,0.22)';
      ctx.lineWidth = 2;
      for (let i = 10; i < w - 8; i += 18) line(ctx, x + i, y + 6, x + i, y + h - 6, 'rgba(151,164,151,0.2)', 2);
      ctx.fillStyle = 'rgba(199,73,51,0.7)';
      ctx.fillRect(x + 6, y + 3, 18, 3);
      ctx.fillRect(x + w - 24, y + h - 6, 18, 3);
      break;
    }
    case 'furnace': {
      shadow(ctx, p, 10);
      ctx.fillStyle = '#1d1b18';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#0b0a08';
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
      const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 3, x + w / 2, y + h / 2, w * 0.55);
      g.addColorStop(0, 'rgba(255,177,79,0.88)');
      g.addColorStop(0.5, 'rgba(212,76,31,0.45)');
      g.addColorStop(1, 'rgba(80,25,9,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x + 10, y + 14, w - 20, h - 28);
      ctx.fillStyle = 'rgba(8,7,5,0.85)';
      for (let i = 0; i < 6; i++) ctx.fillRect(x + 18 + i * (w - 36) / 6, y + 16, 4, h - 32);
      ctx.fillStyle = 'rgba(255,189,93,0.8)';
      ctx.beginPath();
      ctx.arc(x + w * 0.5, y + h * 0.5, 6, 0, TAU);
      ctx.fill();
      break;
    }
  }
}

function screenPos(r, x, y) {
  return {
    x: (x - r.cam.x) * r.zoom + r.w / 2,
    y: (y - r.cam.y) * r.zoom + r.h / 2
  };
}

function punchCircle(ctx, sx, sy, radius, alpha) {
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(0.55, `rgba(0,0,0,${alpha * 0.78})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
}

function punchCone(ctx, sx, sy, angle, length, spread, alpha) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, length);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(0.65, `rgba(0,0,0,${alpha * 0.72})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, length, -spread, spread);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function glow(ctx, sx, sy, radius, color, alpha) {
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
  g.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},${alpha})`);
  g.addColorStop(0.5, `rgba(${color[0]},${color[1]},${color[2]},${alpha * 0.45})`);
  g.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
}

let lightCanvas = null;
let lightCtx = null;

function ensureLightLayer(w, h) {
  if (!lightCanvas) {
    lightCanvas = document.createElement('canvas');
    lightCtx = lightCanvas.getContext('2d');
  }
  if (lightCanvas.width !== w || lightCanvas.height !== h) {
    lightCanvas.width = w;
    lightCanvas.height = h;
  }
}

export function drawLighting(ctx, state, r) {
  const player = state.player;
  const enemies = state.enemies;
  const time = r.time;
  const lw = Math.max(1, Math.floor(r.w * r.dpr));
  const lh = Math.max(1, Math.floor(r.h * r.dpr));
  ensureLightLayer(lw, lh);

  // The darkness pass lives on its own layer so destination-out punches
  // reveal the lit world instead of erasing it from the main canvas.
  const lctx = lightCtx;
  lctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, r.w, r.h);
  lctx.fillStyle = state.attract ? 'rgba(1,3,3,0.4)' : 'rgba(1,3,3,0.58)';
  lctx.fillRect(0, 0, r.w, r.h);

  lctx.globalCompositeOperation = 'destination-out';

  for (const l of LIGHTS) {
    const p = screenPos(r, l.x, l.y);
    const f = lightFlicker(l, time);
    const rad = l.r * r.zoom * f;
    if (p.x + rad < 0 || p.x - rad > r.w || p.y + rad < 0 || p.y - rad > r.h) continue;
    punchCircle(lctx, p.x, p.y, rad, 0.96);
  }

  if (player && !state.attract) {
    const p = screenPos(r, player.x, player.y);
    punchCircle(lctx, p.x, p.y, 124 * r.zoom, 0.9);
    punchCone(lctx, p.x, p.y, player.angle, 560 * r.zoom, 0.44, 0.88);
    punchCone(lctx, p.x, p.y, player.angle, 640 * r.zoom, 0.6, 0.4);
  }

  for (const e of enemies) {
    if (!e.alive) continue;
    const p = screenPos(r, e.x, e.y);
    if (p.x < -120 || p.x > r.w + 120 || p.y < -120 || p.y > r.h + 120) continue;
    punchCircle(lctx, p.x, p.y, 34 * r.zoom, 0.4);
    punchCone(lctx, p.x, p.y, e.angle, e.viewDist * 0.92 * r.zoom, e.fov * 0.52, 0.6);
  }

  const ex = screenPos(r, EXIT_ZONE.x + EXIT_ZONE.w / 2, EXIT_ZONE.y + EXIT_ZONE.h / 2);
  punchCircle(lctx, ex.x, ex.y, 120 * r.zoom, state.exitUnlocked ? 0.72 : 0.35);

  if (state.attract) {
    const c = screenPos(r, 1500, 900);
    punchCircle(lctx, c.x, c.y, 560 * r.zoom, 0.82);
  }

  lctx.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(lightCanvas, 0, 0);
  ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
  ctx.globalCompositeOperation = 'screen';
  for (const l of LIGHTS) {
    const p = screenPos(r, l.x, l.y);
    const f = lightFlicker(l, time);
    const rad = l.r * r.zoom * f * 1.08;
    if (p.x + rad < 0 || p.x - rad > r.w || p.y + rad < 0 || p.y - rad > r.h) continue;
    glow(ctx, p.x, p.y, rad, l.color, 0.19 * l.intensity * f);
  }

  if (player && !state.attract) {
    const p = screenPos(r, player.x, player.y);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(player.angle);
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 560 * r.zoom);
    g.addColorStop(0, 'rgba(229,223,200,0.13)');
    g.addColorStop(0.55, 'rgba(218,211,186,0.06)');
    g.addColorStop(1, 'rgba(218,211,186,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 560 * r.zoom, -0.48, 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  for (const e of enemies) {
    if (!e.alive || e.state !== 'chase') continue;
    const p = screenPos(r, e.x, e.y);
    glow(ctx, p.x, p.y, 90 * r.zoom, [205, 64, 45], 0.12);
  }

  if (state.attract) {
    const c = screenPos(r, 1500, 900);
    glow(ctx, c.x, c.y, 590 * r.zoom, [231, 174, 104], 0.1);
  }

  // A whisper of ambient bounce light keeps the shadows readable without
  // flattening the scene.
  const ambient = ctx.createLinearGradient(0, 0, 0, r.h);
  ambient.addColorStop(0, 'rgba(44,62,60,0.07)');
  ambient.addColorStop(0.55, 'rgba(30,44,41,0.045)');
  ambient.addColorStop(1, 'rgba(15,22,20,0.025)');
  ctx.fillStyle = ambient;
  ctx.fillRect(0, 0, r.w, r.h);

  ctx.restore();
}

export function drawMotes(ctx, state, r) {
  const t = r.time;
  ctx.save();
  ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
  for (let i = 0; i < 46; i++) {
    const seed = hash2(i, 13);
    const seed2 = hash2(i, 71);
    const speed = 4 + seed * 12;
    const x = ((seed * r.w + t * speed + r.cam.x * 0.06) % (r.w + 40)) - 20;
    const y = ((seed2 * r.h + t * (2 + seed2 * 5) + Math.sin(t * 0.5 + i) * 16) % (r.h + 40)) - 20;
    const a = 0.04 + seed2 * 0.13;
    ctx.fillStyle = `rgba(224,218,196,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.5 + seed * 1.3, 0, TAU);
    ctx.fill();
  }
  // occasional ash streak
  for (let i = 0; i < 4; i++) {
    const x = ((i * 277 + t * 22) % (r.w + 80)) - 40;
    const y = ((i * 173 + t * 11) % (r.h + 80)) - 40;
    ctx.strokeStyle = 'rgba(215,207,184,0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 12, y + 22);
    ctx.stroke();
  }
  ctx.restore();
}
