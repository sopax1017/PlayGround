import { circleRect, segmentRect } from './utils.js';

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(index, f) {
    const a = this.items;
    a.push({ index, f });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    if (!a.length) return null;
    const top = a[0];
    const last = a.pop();
    if (a.length && last) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let best = i;
        if (l < a.length && a[l].f < a[best].f) best = l;
        if (r < a.length && a[r].f < a[best].f) best = r;
        if (best === i) break;
        [a[i], a[best]] = [a[best], a[i]];
        i = best;
      }
    }
    return top;
  }
}

export class NavGrid {
  constructor(world, walls, props, cell = 40, radius = 17) {
    this.world = world;
    this.walls = walls;
    this.props = props;
    this.cell = cell;
    this.radius = radius;
    this.cols = Math.ceil(world.w / cell);
    this.rows = Math.ceil(world.h / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
    this.build();
  }

  build() {
    const { cols, rows, cell, radius } = this;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cx = (x + 0.5) * cell;
        const cy = (y + 0.5) * cell;
        let blocked = false;
        for (const w of this.walls) {
          if (circleRect(cx, cy, radius, w)) { blocked = true; break; }
        }
        if (!blocked) {
          for (const p of this.props) {
            if (p.solid && circleRect(cx, cy, radius, p)) { blocked = true; break; }
          }
        }
        this.blocked[y * cols + x] = blocked ? 1 : 0;
      }
    }
  }

  cellOf(x, y) {
    return {
      x: Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cell))),
      y: Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cell)))
    };
  }

  center(cx, cy) {
    return { x: (cx + 0.5) * this.cell, y: (cy + 0.5) * this.cell };
  }

  isFreeCell(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return false;
    return this.blocked[cy * this.cols + cx] === 0;
  }

  isFree(x, y) {
    const c = this.cellOf(x, y);
    return this.isFreeCell(c.x, c.y);
  }

  nearestFree(cx, cy, maxRadius = 9) {
    if (this.isFreeCell(cx, cy)) return { x: cx, y: cy };
    for (let r = 1; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          if (this.isFreeCell(cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy };
        }
      }
    }
    return null;
  }

  lineFree(x1, y1, x2, y2, radius = this.radius * 0.8) {
    for (const w of this.walls) {
      const r = { x: w.x - radius, y: w.y - radius, w: w.w + radius * 2, h: w.h + radius * 2 };
      if (segmentRect(x1, y1, x2, y2, r)) return false;
    }
    for (const p of this.props) {
      if (!p.solid) continue;
      const r = { x: p.x - radius, y: p.y - radius, w: p.w + radius * 2, h: p.h + radius * 2 };
      if (segmentRect(x1, y1, x2, y2, r)) return false;
    }
    return true;
  }

  smooth(points, sx, sy) {
    if (points.length < 2) return points;
    const out = [];
    let currentX = sx, currentY = sy;
    let i = 0;
    while (i < points.length) {
      let j = points.length - 1;
      while (j > i && !this.lineFree(currentX, currentY, points[j].x, points[j].y)) j--;
      const chosen = points[j];
      out.push(chosen);
      currentX = chosen.x;
      currentY = chosen.y;
      if (j === i) i++;
      else i = j + 1;
    }
    return out;
  }

  findPath(sx, sy, tx, ty) {
    const startCell = this.nearestFree(this.cellOf(sx, sy).x, this.cellOf(sx, sy).y);
    const targetCell = this.nearestFree(this.cellOf(tx, ty).x, this.cellOf(tx, ty).y);
    if (!startCell || !targetCell) return [];

    const { cols, rows, cell } = this;
    const start = startCell.y * cols + startCell.x;
    const goal = targetCell.y * cols + targetCell.x;
    if (start === goal) return [{ x: tx, y: ty }];

    const total = cols * rows;
    const g = new Float32Array(total).fill(Infinity);
    const came = new Int32Array(total).fill(-1);
    const closed = new Uint8Array(total);
    const heap = new MinHeap();
    const h = (i) => {
      const x = i % cols, y = (i / cols) | 0;
      const dx = Math.abs(x - targetCell.x), dy = Math.abs(y - targetCell.y);
      return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
    };

    g[start] = 0;
    heap.push(start, h(start));
    let iterations = 0;

    while (heap.size && iterations++ < 7000) {
      const node = heap.pop();
      if (!node) break;
      const cur = node.index;
      if (closed[cur]) continue;
      if (cur === goal) break;
      closed[cur] = 1;
      const cx = cur % cols, cy = (cur / cols) | 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const ni = ny * cols + nx;
          if (this.blocked[ni] || closed[ni]) continue;
          if (dx && dy) {
            if (this.blocked[cy * cols + nx] || this.blocked[ny * cols + cx]) continue;
          }
          const step = dx && dy ? Math.SQRT2 : 1;
          const tentative = g[cur] + step;
          if (tentative < g[ni]) {
            g[ni] = tentative;
            came[ni] = cur;
            heap.push(ni, tentative + h(ni));
          }
        }
      }
    }

    if (came[goal] === -1 && goal !== start) return [];
    const cells = [];
    let cur = goal;
    let guard = 0;
    while (cur !== start && guard++ < 4000) {
      const c = this.center(cur % cols, (cur / cols) | 0);
      cells.push(c);
      cur = came[cur];
      if (cur < 0) break;
    }
    cells.reverse();
    if (!cells.length) return [{ x: tx, y: ty }];
    const last = cells[cells.length - 1];
    if (Math.hypot(last.x - tx, last.y - ty) < cell * 1.25) {
      last.x = tx;
      last.y = ty;
    }
    return this.smooth(cells, sx, sy);
  }
}
