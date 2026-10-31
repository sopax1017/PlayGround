import { mulberry32, pick } from './utils.js';

export const WORLD = { w: 3000, h: 2000 };
export const PLAYER_START = { x: 390, y: 1700, angle: -Math.PI / 2 };
export const EXIT_ZONE = { x: 2595, y: 282, w: 190, h: 76 };

export const WALLS = [];
function wall(x, y, w, h, style = 'concrete') {
  WALLS.push({ x, y, w, h, style });
}

// outer shell
wall(-40, -40, 3080, 40, 'outer');
wall(-40, 2000, 3080, 40, 'outer');
wall(-40, -40, 40, 2080, 'outer');
wall(3000, -40, 40, 2080, 'outer');

// storage / start
wall(40, 1580, 300, 26);
wall(440, 1580, 320, 26);
wall(760, 1580, 26, 120);
wall(760, 1800, 26, 160);

// locker room
wall(40, 1060, 580, 26);
wall(40, 1460, 580, 26);
wall(620, 1060, 26, 160);
wall(620, 1320, 26, 140);

// freezer
wall(40, 620, 580, 26);
wall(40, 980, 580, 26);
wall(620, 620, 26, 140);
wall(620, 860, 26, 120);

// office
wall(40, 540, 560, 26);
wall(700, 540, 120, 26);
wall(820, 40, 26, 500);
// office cubicles
wall(120, 180, 230, 16, 'metal');
wall(470, 180, 16, 160, 'metal');
wall(540, 360, 220, 16, 'metal');

// kill floor
wall(980, 420, 400, 26);
wall(1500, 420, 480, 26);
wall(980, 420, 26, 280);
wall(980, 800, 26, 380);
wall(980, 1280, 26, 180);
wall(1980, 420, 26, 180);
wall(1980, 700, 26, 300);
wall(1980, 1100, 26, 360);
wall(980, 1460, 400, 26);
wall(1500, 1460, 480, 26);

// loading dock
wall(2380, 40, 26, 320);
wall(2380, 460, 26, 200);
wall(2380, 660, 120, 26);
wall(2600, 660, 360, 26);

// processing
wall(2260, 860, 26, 260);
wall(2260, 1220, 26, 240);
wall(2260, 860, 340, 26);
wall(2700, 860, 260, 26);
wall(2260, 1460, 220, 26);
wall(2580, 1460, 380, 26);

// boiler room
wall(1900, 1660, 200, 26);
wall(2200, 1660, 760, 26);
wall(1900, 1660, 26, 100);
wall(1900, 1860, 26, 100);

// interior partitions / cover
wall(860, 150, 26, 210, 'metal');
wall(2120, 150, 26, 190, 'metal');
wall(2080, 1520, 26, 120, 'metal');
wall(830, 1690, 26, 140, 'metal');

// ── props ──────────────────────────────────────────────────────
export const PROPS = [];
function prop(type, x, y, w, h, opts = {}) {
  const p = {
    type, x, y, w, h,
    solid: opts.solid !== false,
    tall: opts.tall !== false,
    blockVision: opts.blockVision !== undefined ? opts.blockVision : (opts.solid !== false && opts.tall !== false),
    color: opts.color || null,
    rot: opts.rot || 0
  };
  PROPS.push(p);
  return p;
}

// storage
prop('shelf', 80, 1600, 32, 180);
prop('shelf', 80, 1840, 150, 32);
prop('crate', 120, 1660, 74, 74);
prop('crate', 200, 1690, 84, 66);
prop('crate', 160, 1740, 62, 58);
prop('crate', 570, 1605, 112, 92);
prop('crate', 640, 1810, 92, 92);
prop('crate', 560, 1730, 70, 64);
prop('barrel', 690, 1740, 56, 56);
prop('pallet', 310, 1840, 130, 84, { solid: false, tall: false });
prop('bodybag', 480, 1880, 140, 40, { solid: false, tall: false });

// locker room
prop('locker', 80, 1090, 230, 36);
prop('locker', 350, 1090, 200, 36);
prop('bench', 160, 1240, 190, 36, { tall: false });
prop('bench', 160, 1330, 190, 36, { tall: false });
prop('sink', 70, 1390, 80, 44, { tall: false });
prop('bodybag', 480, 1370, 120, 40, { solid: false, tall: false });
prop('locker', 555, 1120, 32, 150);

// freezer
prop('shelf', 70, 660, 28, 240);
prop('shelf', 470, 650, 28, 240);
prop('carcass', 150, 700, 44, 110, { solid: false, tall: false });
prop('carcass', 230, 710, 44, 110, { solid: false, tall: false });
prop('carcass', 310, 700, 44, 110, { solid: false, tall: false });
prop('carcass', 390, 710, 44, 110, { solid: false, tall: false });
prop('carcass', 160, 850, 44, 110, { solid: false, tall: false });
prop('carcass', 240, 860, 44, 110, { solid: false, tall: false });
prop('crate', 80, 910, 90, 58);
prop('barrel', 530, 890, 54, 54);
prop('pallet', 300, 930, 120, 50, { solid: false, tall: false });
prop('bodybag', 430, 920, 100, 38, { solid: false, tall: false });

// kill floor
prop('machine', 1040, 470, 180, 130);
prop('machine', 1740, 470, 170, 130);
prop('machine', 1040, 1260, 170, 130);
prop('machine', 1750, 1260, 160, 130);
prop('table', 1280, 990, 420, 82, { tall: false });
prop('table', 1490, 1170, 250, 74, { tall: false });
prop('barrel', 1120, 900, 54, 54);
prop('barrel', 1840, 850, 54, 54);
prop('barrel', 1150, 1120, 50, 50);
prop('carcass', 1160, 630, 44, 120, { solid: false, tall: false });
prop('carcass', 1280, 640, 44, 120, { solid: false, tall: false });
prop('carcass', 1400, 630, 44, 120, { solid: false, tall: false });
prop('carcass', 1520, 640, 44, 120, { solid: false, tall: false });
prop('carcass', 1640, 630, 44, 120, { solid: false, tall: false });
prop('carcass', 1760, 640, 44, 120, { solid: false, tall: false });
prop('carcass', 1220, 1350, 44, 110, { solid: false, tall: false });
prop('carcass', 1580, 1350, 44, 110, { solid: false, tall: false });
prop('curtain', 1375, 402, 130, 38, { solid: false, tall: false });
prop('curtain', 1375, 1444, 130, 38, { solid: false, tall: false });
prop('crate', 1850, 1150, 80, 80);

// office
prop('desk', 130, 250, 210, 70, { tall: false });
prop('desk', 500, 260, 190, 70, { tall: false });
prop('desk', 300, 400, 190, 62, { tall: false });
prop('cabinet', 60, 90, 42, 140);
prop('cabinet', 760, 90, 50, 160);
prop('shelf', 70, 460, 180, 30);
prop('chair', 250, 350, 38, 38, { solid: false, tall: false });
prop('chair', 620, 350, 38, 38, { solid: false, tall: false });

// loading dock
prop('van', 2480, 60, 330, 190);
prop('forklift', 2400, 270, 120, 80);
prop('crate', 2420, 500, 100, 100);
prop('crate', 2550, 520, 120, 80);
prop('crate', 2800, 500, 80, 80);
prop('pallet', 2400, 600, 100, 40, { solid: false, tall: false });
prop('barrel', 2900, 380, 52, 52);
prop('curtain', 2355, 350, 34, 120, { solid: false, tall: false });

// processing
prop('conveyor', 2320, 980, 500, 82, { tall: false });
prop('machine', 2380, 880, 150, 70);
prop('machine', 2740, 880, 120, 70);
prop('barrel', 2320, 1200, 52, 52);
prop('barrel', 2800, 1300, 52, 52);
prop('crate', 2420, 1340, 90, 80);
prop('table', 2600, 1180, 180, 64, { tall: false });
prop('carcass', 2480, 1120, 44, 110, { solid: false, tall: false });
prop('carcass', 2700, 1120, 44, 110, { solid: false, tall: false });

// boiler
prop('furnace', 2000, 1690, 190, 160);
prop('barrel', 2380, 1790, 60, 60);
prop('barrel', 2500, 1840, 60, 60);
prop('crate', 2700, 1700, 100, 100);
prop('machine', 2250, 1840, 100, 80);
prop('pallet', 2850, 1800, 90, 50, { solid: false, tall: false });

// corridors
prop('pallet', 650, 1500, 90, 50, { solid: false, tall: false });
prop('crate', 820, 1640, 70, 70);
prop('barrel', 880, 1100, 50, 50);
prop('bodybag', 850, 1350, 110, 36, { solid: false, tall: false });
prop('crate', 2120, 700, 70, 70);
prop('barrel', 2200, 1300, 50, 50);
prop('pallet', 1450, 1520, 100, 60, { solid: false, tall: false });
prop('crate', 1650, 1550, 80, 80);
prop('crate', 2100, 1540, 80, 80);
prop('bodybag', 740, 800, 110, 36, { solid: false, tall: false });

// ── lighting ────────────────────────────────────────────────────
export const LIGHTS = [
  { x: 430, y: 1755, r: 275, color: [232, 181, 111], intensity: 0.92, flicker: 0.11, type: 'sodium' },
  { x: 700, y: 1875, r: 180, color: [204, 63, 46], intensity: 0.55, flicker: 0.24, type: 'emergency' },
  { x: 305, y: 1240, r: 255, color: [176, 208, 196], intensity: 0.8, flicker: 0.09, type: 'fluorescent' },
  { x: 300, y: 785, r: 300, color: [154, 205, 214], intensity: 0.84, flicker: 0.05, type: 'cold' },
  { x: 350, y: 305, r: 330, color: [206, 218, 201], intensity: 0.93, flicker: 0.035, type: 'fluorescent' },
  { x: 710, y: 445, r: 195, color: [232, 181, 111], intensity: 0.72, flicker: 0.08, type: 'sodium' },
  { x: 1200, y: 600, r: 285, color: [233, 180, 105], intensity: 0.92, flicker: 0.08, type: 'sodium' },
  { x: 1700, y: 600, r: 285, color: [233, 180, 105], intensity: 0.9, flicker: 0.12, type: 'sodium' },
  { x: 1200, y: 1200, r: 275, color: [233, 180, 105], intensity: 0.85, flicker: 0.13, type: 'sodium' },
  { x: 1700, y: 1200, r: 275, color: [233, 180, 105], intensity: 0.88, flicker: 0.07, type: 'sodium' },
  { x: 1500, y: 440, r: 220, color: [218, 59, 43], intensity: 0.64, flicker: 0.3, type: 'emergency' },
  { x: 2650, y: 320, r: 310, color: [186, 215, 201], intensity: 0.9, flicker: 0.04, type: 'fluorescent' },
  { x: 2870, y: 570, r: 220, color: [231, 177, 103], intensity: 0.74, flicker: 0.09, type: 'sodium' },
  { x: 2550, y: 1090, r: 300, color: [224, 126, 86], intensity: 0.8, flicker: 0.14, type: 'industrial' },
  { x: 2090, y: 1790, r: 285, color: [235, 123, 58], intensity: 0.96, flicker: 0.18, type: 'fire' },
  { x: 2650, y: 1830, r: 200, color: [214, 107, 50], intensity: 0.58, flicker: 0.22, type: 'fire' },
  { x: 700, y: 900, r: 220, color: [231, 177, 103], intensity: 0.7, flicker: 0.1, type: 'sodium' },
  { x: 700, y: 1540, r: 215, color: [171, 204, 194], intensity: 0.68, flicker: 0.18, type: 'fluorescent' },
  { x: 2150, y: 400, r: 240, color: [177, 208, 196], intensity: 0.76, flicker: 0.05, type: 'fluorescent' },
  { x: 2150, y: 1520, r: 220, color: [231, 177, 103], intensity: 0.7, flicker: 0.12, type: 'sodium' },
  { x: 1500, y: 150, r: 270, color: [175, 202, 191], intensity: 0.68, flicker: 0.07, type: 'fluorescent' }
];

// ── floor tint zones ───────────────────────────────────────────
export const ZONES = [
  { x: 980, y: 420, w: 1000, h: 1040, color: [56, 31, 27], alpha: 0.24 },
  { x: 40, y: 620, w: 580, h: 360, color: [28, 48, 53], alpha: 0.35 },
  { x: 40, y: 40, w: 780, h: 500, color: [33, 39, 32], alpha: 0.22 },
  { x: 2380, y: 40, w: 580, h: 620, color: [34, 41, 37], alpha: 0.18 },
  { x: 2260, y: 860, w: 700, h: 600, color: [48, 29, 27], alpha: 0.24 },
  { x: 1900, y: 1660, w: 1060, h: 280, color: [54, 36, 23], alpha: 0.33 },
  { x: 40, y: 1580, w: 720, h: 380, color: [40, 37, 29], alpha: 0.22 },
  { x: 40, y: 1060, w: 580, h: 400, color: [30, 40, 35], alpha: 0.2 }
];

// ── floor decals ────────────────────────────────────────────────
export const DECALS = [];
const rng = mulberry32(0xdead51);
for (let i = 0; i < 92; i++) {
  DECALS.push({
    type: 'grime',
    x: rng() * WORLD.w,
    y: rng() * WORLD.h,
    rx: 18 + rng() * 95,
    ry: 12 + rng() * 55,
    rot: rng() * Math.PI,
    alpha: 0.035 + rng() * 0.075
  });
}
for (let i = 0; i < 20; i++) {
  DECALS.push({
    type: 'stain',
    x: rng() * WORLD.w,
    y: rng() * WORLD.h,
    r: 24 + rng() * 70,
    color: rng() > 0.55 ? [8, 10, 9] : [33, 25, 20],
    alpha: 0.1 + rng() * 0.12
  });
}
for (let i = 0; i < 8; i++) {
  DECALS.push({
    type: 'puddle',
    x: 90 + rng() * 500,
    y: 650 + rng() * 280,
    rx: 40 + rng() * 70,
    ry: 14 + rng() * 22,
    rot: rng() * 3,
    alpha: 0.2 + rng() * 0.15
  });
}
for (let i = 0; i < 5; i++) {
  DECALS.push({
    type: 'puddle',
    x: 1940 + rng() * 900,
    y: 1690 + rng() * 230,
    rx: 30 + rng() * 50,
    ry: 10 + rng() * 20,
    rot: rng() * 3,
    alpha: 0.16 + rng() * 0.14
  });
}

DECALS.push(
  { type: 'blood', x: 1490, y: 1110, scale: 2.7, rot: 0.4, seed: 44 },
  { type: 'blood', x: 1320, y: 920, scale: 1.8, rot: 2.1, seed: 81 },
  { type: 'blood', x: 1660, y: 1280, scale: 2.2, rot: 4.2, seed: 17 },
  { type: 'blood', x: 1110, y: 710, scale: 1.5, rot: 1.2, seed: 35 },
  { type: 'blood', x: 280, y: 1800, scale: 1.3, rot: 2.8, seed: 72 },
  { type: 'blood', x: 410, y: 1660, scale: 1.1, rot: 0.2, seed: 19 },
  { type: 'blood', x: 520, y: 1500, scale: 1.4, rot: 3.6, seed: 64 },
  { type: 'blood', x: 1230, y: 1520, scale: 1.6, rot: 5.1, seed: 29 },
  { type: 'blood', x: 2430, y: 1250, scale: 1.7, rot: 1.8, seed: 53 },
  { type: 'grate', x: 1440, y: 1100, w: 120, h: 82, rot: 0 },
  { type: 'grate', x: 720, y: 1400, w: 80, h: 55, rot: 0.2 },
  { type: 'grate', x: 2560, y: 380, w: 120, h: 60, rot: 0 },
  { type: 'hazard', x: 990, y: 1420, w: 390, h: 12, rot: 0 },
  { type: 'hazard', x: 1510, y: 1420, w: 450, h: 12, rot: 0 },
  { type: 'hazard', x: 990, y: 447, w: 390, h: 12, rot: 0 },
  { type: 'hazard', x: 1510, y: 447, w: 450, h: 12, rot: 0 },
  { type: 'hazard', x: 2420, y: 635, w: 160, h: 12, rot: 0 },
  { type: 'hazard', x: 2610, y: 635, w: 340, h: 12, rot: 0 },
  { type: 'label', x: 1460, y: 780, text: 'KILL FLOOR', size: 54, rot: 0, alpha: 0.1 },
  { type: 'label', x: 280, y: 830, text: 'COLD STORAGE', size: 30, rot: -Math.PI / 2, alpha: 0.11 },
  { type: 'label', x: 2570, y: 590, text: 'LOADING', size: 34, rot: 0, alpha: 0.1 },
  { type: 'label', x: 350, y: 470, text: 'ADMIN', size: 27, rot: 0, alpha: 0.11 },
  { type: 'label', x: 400, y: 1700, text: 'NO EXIT', size: 34, rot: 0.06, alpha: 0.12 }
);

// ── pickups ─────────────────────────────────────────────────────
export const PICKUP_DEFS = [
  { id: 'knife', type: 'weapon', weapon: 'knife', x: 345, y: 1840, label: 'KNIFE' },
  { id: 'bat', type: 'weapon', weapon: 'bat', x: 175, y: 1290, label: 'BAT' },
  { id: 'cleaver', type: 'weapon', weapon: 'cleaver', x: 1510, y: 1092, label: 'CLEAVER' },
  { id: 'medkit', type: 'medkit', x: 495, y: 1410, label: 'MEDKIT' }
];

// ── hunters ────────────────────────────────────────────────────
export const ENEMY_DEFS = [
  {
    id: 'vance', name: 'VANCE', lieutenant: true, x: 610, y: 380, angle: 2.8,
    hp: 115, speed: 52, chaseSpeed: 124, viewDist: 375, fov: 1.28, damage: 21,
    waypoints: [[610, 380], [400, 350], [150, 370], [380, 500], [700, 500]]
  },
  {
    id: 'cutter', name: 'CUTTER', lieutenant: true, x: 1500, y: 875, angle: 0,
    hp: 125, speed: 58, chaseSpeed: 132, viewDist: 405, fov: 1.32, damage: 23,
    waypoints: [[1500, 875], [1200, 800], [1800, 800], [1800, 1220], [1200, 1220]]
  },
  {
    id: 'rook', name: 'ROOK', lieutenant: true, x: 2700, y: 420, angle: -1.6,
    hp: 120, speed: 55, chaseSpeed: 128, viewDist: 390, fov: 1.3, damage: 22,
    waypoints: [[2700, 420], [2450, 300], [2850, 300], [2850, 570], [2450, 570]]
  },
  {
    id: 'dog', name: 'DOG', lieutenant: false, x: 300, y: 1360, angle: -1.6,
    hp: 58, speed: 46, chaseSpeed: 112, viewDist: 320, fov: 1.24, damage: 13,
    waypoints: [[300, 1360], [180, 1160], [480, 1160], [480, 1400], [180, 1400]]
  },
  {
    id: 'mace', name: 'MACE', lieutenant: false, x: 300, y: 800, angle: 0,
    hp: 66, speed: 48, chaseSpeed: 110, viewDist: 330, fov: 1.2, damage: 15,
    waypoints: [[300, 800], [150, 690], [520, 690], [520, 920], [150, 920]]
  },
  {
    id: 'tin', name: 'TIN', lieutenant: false, x: 2550, y: 1210, angle: -1.5,
    hp: 62, speed: 47, chaseSpeed: 113, viewDist: 335, fov: 1.26, damage: 14,
    waypoints: [[2550, 1210], [2400, 930], [2850, 930], [2850, 1360], [2400, 1360]]
  },
  {
    id: 'brick', name: 'BRICK', lieutenant: false, x: 2310, y: 1770, angle: 0,
    hp: 78, speed: 43, chaseSpeed: 103, viewDist: 315, fov: 1.18, damage: 18,
    waypoints: [[2310, 1770], [1970, 1740], [2850, 1740], [2850, 1900], [1970, 1900]]
  },
  {
    id: 'silas', name: 'SILAS', lieutenant: false, x: 1500, y: 210, angle: 0,
    hp: 60, speed: 50, chaseSpeed: 118, viewDist: 340, fov: 1.22, damage: 14,
    waypoints: [[1500, 210], [1000, 150], [2200, 150], [2200, 350], [1000, 350]]
  }
];

// deterministic crate colors / visual variation
const propRng = mulberry32(0xc0ffee);
for (const p of PROPS) {
  p.seed = propRng();
  p.variant = pick(['a', 'b', 'c'], propRng);
}
