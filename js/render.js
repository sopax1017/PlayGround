import { initWorldTextures, drawFloor, drawDecals, drawWalls, drawProps, drawLighting, drawMotes } from './render-world.js';
import {
  drawVisionCones, drawNoiseRings, drawCorpses, drawEnemies, drawPickups,
  drawProjectiles, drawParticles, drawPlayer, drawObjectiveMarker, drawActorGlints
} from './render-actors.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.w = 1;
    this.h = 1;
    this.dpr = 1;
    initWorldTextures(this.ctx);
  }

  resize(w, h, dpr) {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  render(state) {
    const ctx = this.ctx;
    const { w, h, dpr } = this;
    const zoom = state.zoom;
    const shakeX = state.shakeX || 0;
    const shakeY = state.shakeY || 0;
    const camX = state.camera.x - shakeX / zoom;
    const camY = state.camera.y - shakeY / zoom;
    const halfW = w / (2 * zoom);
    const halfH = h / (2 * zoom);
    const r = {
      w, h, dpr, zoom, time: state.time,
      cam: { x: camX, y: camY },
      bounds: {
        left: camX - halfW - 80,
        right: camX + halfW + 80,
        top: camY - halfH - 80,
        bottom: camY + halfH + 80
      }
    };

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#030505';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
    ctx.scale(zoom, zoom);
    ctx.translate(-state.camera.x, -state.camera.y);

    drawFloor(ctx, state, r);
    drawDecals(ctx, state, r);
    drawWalls(ctx, state, r);
    drawProps(ctx, state, r);
    drawCorpses(ctx, state);
    drawNoiseRings(ctx, state);
    drawVisionCones(ctx, state, r);
    drawPickups(ctx, state, r);
    drawEnemies(ctx, state, r);
    drawProjectiles(ctx, state);
    drawParticles(ctx, state);

    ctx.restore();

    drawLighting(ctx, state, r);

    ctx.save();
    ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
    ctx.scale(zoom, zoom);
    ctx.translate(-state.camera.x, -state.camera.y);
    if (!state.attract) {
      drawObjectiveMarker(ctx, state, r);
      drawPlayer(ctx, state, r);
    }
    ctx.restore();

    if (!state.attract) drawActorGlints(ctx, state, r);
    drawMotes(ctx, state, r);
  }
}
