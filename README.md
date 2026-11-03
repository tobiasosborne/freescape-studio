# Freescape Studio

A Three.js reimagining of the **1991 16-bit 3D Construction Kit**. Build geometric worlds, define their rules with Freescape Command Language, and export a playable HTML file.

The original manual is the baseline. [Specification](docs/SPEC.md), [source register](research/sources.json), [source decisions](research/errata.md), [independent semantic goldens](tests/goldens/manual-behavior.json), and [verification status](docs/STATUS.md) are included.

## Run

Use Node.js 24 or newer.

```sh
npm ci
npm run dev
```

For a build requiring no web server or CDN:

```sh
npm run build
```

Open `dist/index.html` in a browser with WebGL 2. The editor and all player dependencies are embedded. **Export** produces a separate self-contained HTML player for the current world.

## Included workflows

- Cuboids, editable pyramids, rectangle/triangle/quad/pentagon/hexagon facets, lines, sensors, and groups.
- Orbit and five retained cameras, walk/fly navigation, six lock views, transform handles, exact coordinates, point edits, turn/flip, move/stretch/shrink, fine/secondary steps, undo/redo, exclude and highlight.
- Sixteen-colour area palettes, per-face colours, invisible faces, two-colour shades, palette copy/gradient/reset, sky and ground.
- Areas, global-object library, entrances, project defaults, keyboard presets and custom keys, border-image button zones, view-window layout, instruments, and 32 audio slots.
- Object/area/general FCL conditions, 256 variables, startup conditions, timers, suspended programs, and animator loops/triggers/movement/collisions.
- JSON world and object/group import/export, browser library, autosave, play/reset, game save/load, and standalone export.
- An original two-area sample, **The Quiet Citadel**: collect three outer beacons, open the gate, and reach the observatory.

In play mode: WASD moves; arrows look; E activates; Space shoots; R/F rises/falls; V toggles walk/fly; B selects Fly 1/Fly 2; C crouches; X toggles the centre cursor; 1/2 saves/loads. F1 returns to the editor. The original 1991 control preset is available in World settings.

## Verification

```sh
npm test
npm run test:browser
```

`npm test` covers manual-derived semantics, geometry and collision, the actual editor DOM bindings, the standalone player's embedded module graph, persistence, and the production HTML build. DOM tests replace **only the WebGL renderer** with a test adapter; they retain the real Three.js scene, camera, controls, model and runtime.

The Playwright suite is prepared to exercise the production file, inspect rendered pixels, reopen saved worlds, round-trip JSON, test play/game saves, open the exported player offline, and capture desktop/narrow screenshots. It records each completed group and the launch/test result in `test-results/browser-report.json`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chromium executable if Playwright's browser is absent. `BASE_URL` optionally selects an existing dev server.

**Current verification limit:** this task environment denies server socket operations and Chromium launch IPC. The real-browser suite cannot yet execute here; no WebGL screenshot goldens or browser pass are claimed. The software SVG scene preview is geometry inspection, not a browser screenshot. See [status](docs/STATUS.md) and the retained red/green evidence in `tests/evidence/`.

## Compatibility

This recreates the first 16-bit kit's authoring capabilities. It does not load original binary worlds or reproduce the separate 8-bit FCL dialect or Kit II. Browser JSON, standard image/audio files, and HTML replace legacy disk formats, sample-bank encoding, and native runners. Original program code, shipped games, artwork and sound samples are not included. Exact original-executable differential conformance has not been established.

Three.js is distributed under its MIT licence; see `THIRD_PARTY_NOTICES.txt`.
