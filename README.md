# PlayGround

## HUNTED // NIGHT SHIFT

A phone/tablet-first stealth-action game inspired by the tension of classic
stealth thrillers — built as an original, self-contained browser game. No build
step, no external assets, no network calls at runtime.

You are locked inside a meat-processing kill floor with three lieutenants and a
crew of hunters between you and the extraction van. Stay in shadow, listen for
footsteps, take the lieutenants down silently, then reach the loading dock.

### Play

Open `index.html` through any static web server:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Or use the project start script when the OMGithub runtime is available:

```bash
./start.sh
```

### Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Move | Left virtual stick | `WASD` / arrows |
| Sprint | Hold **SPRINT** | Hold `Shift` |
| Crouch | **CROUCH** | `C` |
| Strike / execute | **STRIKE** | `Space` |
| Pick up / use van | **USE** | `E` |
| Throw distraction | **THROW** | `Q` |
| Pause | Pause button | `Esc` |

Optional tilt controls use the device accelerometer. On iOS, tap **TILT OFF**
and grant motion permission when prompted; the button changes to **TILT ON**.

### Features

- Detailed top-down kill-floor map with patrol routes, cover, props and lamps.
- Line-of-sight vision cones, hearing, suspicion, search and chase AI.
- Shadow concealment driven by the same light map used for rendering.
- Stealth executions from behind, melee weapons, medkits and thrown distractions.
- Touch joystick and action buttons, optional tilt, iOS motion permission flow.
- Canvas 2D lighting with a separate darkness layer, flickering lamps, fog,
  blood, particles, screen shake and a live minimap.
- Procedural WebAudio soundtrack, footsteps, alerts and execution stingers.
- Responsive HUD for phones, tablets, landscape and desktop.

### Project layout

| File | Purpose |
| --- | --- |
| `index.html` | App shell, title, HUD, overlays and touch controls |
| `styles.css` | Layout, atmosphere, responsive breakpoints |
| `js/game.js` | Game state, player/enemy simulation, HUD, win/lose flow |
| `js/map.js` | World geometry, props, lights, pickups, enemy definitions |
| `js/render.js` | Render orchestration and layer order |
| `js/render-world.js` | Floor, walls, props, decals, lighting and motes |
| `js/render-actors.js` | Actors, effects, pickups and minimap |
| `js/nav.js` | Navigation grid and A* pathfinding |
| `js/input.js` | Keyboard, virtual joystick and touch buttons |
| `js/motion.js` | Tilt controls and iOS motion permission |
| `js/audio.js` | Procedural WebAudio engine |
| `js/utils.js` | Math, collision and drawing helpers |

`?debug=1` exposes a small `window.__hunted` hook used by the automated
play-test script. It is inert during normal play.

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/sopax1017/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/sopax1017/PlayGround)

- 🎮 [Open the project](https://omgithub.com/sopax1017/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=sopax1017%2FPlayGround).
- 💻 [Explore the source](https://github.com/sopax1017/PlayGround).
- 🛠️ [Check build runs](https://github.com/sopax1017/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/sopax1017/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/sopax1017).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->
