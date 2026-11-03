# Verification status

The implementation candidate is built. **88 tests pass**, with zero failures or skips. The production build emits a self-contained editor at `dist/index.html` (about 1.2 MB). **The real-browser/WebGL acceptance suite now runs and passes** (see below).

Latest evidence: [full acceptance run](../tests/evidence/43-audit-acceptance.txt). Numbered red/green logs preserve the development sequence, including assertion failures for behavior corrections.

## Implemented and exercised

| Requirement | Implementation | Passing evidence |
|---|---|---|
| W01–W02: areas, globals, defaults | model and editor area/global controls | model, editor, movement/global-group tests |
| O01–O05: primitives, points, transforms, groups, colours/shades | geometry, model, viewport, inspector | geometry, group transforms/state, editor paint/nudge/copy tests |
| E01: undo, selection, views/cameras, fine/secondary steps | editor history, Three.js controls, navigation | history, viewport helper, camera and editor tests |
| P01–P04: movement, collision, entrances, interactions, sensors | movement, player, runtime | movement, sensor, player input, area travel, sample-game tests |
| C01–C04: FCL, variables, program scheduling | runtime | original manual goldens, scope/reset/continuation tests |
| A01: animators | runtime program state and group movement | loops, triggers, remove, stop/resume, enclosure collision and reset tests |
| I01–I02: HUD, instruments, border/view layout | instrument editor, player and controls | scaling/number/text, PRINT, DOM HUD, border-zone tests |
| S01: 32 audio slots | audio bank and sound editor | undefined-slot silence, tone scheduling, immediate/synchronized FCL sound tests |
| F01–F03: files/library/game state/export | persistence, export, standalone player | round trips, file rejection, upward object placement, library, game saves, offline package and embedded-player boot tests |

The DOM harness runs the real model, runtime, Three.js scenes/cameras/controls, editor handlers and standalone player module graph. It replaces only WebGLRenderer. It establishes application behavior, **not GPU rendering correctness**.

The follow-up audit added full-body collision tests for flight, ceiling-aware walking height, persistent FCL height control, rendered-bounds checks for non-cubic TURN operations, centre-pivot gizmo conversion, live parent-group bounds, animator ownership, group start-position restoration, and malformed-world rejection. Each behavioral fix has a retained red/green log (36–42).

## Remaining delivery gate

Run `npm run test:browser` where ## Browser delivery gate (resolved 2026-11-03)

After the project was restored from the X1 backup onto a machine that permits Chromium IPC, `npm run test:browser` ran and **passed all 8 groups**: WebGL context and pixels, authoring and history, library reopen and JSON round trip, play movement and game save/load/reset, settings and FCL diagnostics, standalone download, offline standalone player with gameplay persistence, and narrow editor/settings layouts. The editor, play, standalone and narrow screenshots were inspected by eye. The suite now also runs in CI (`.github/workflows/release.yml`).

Two test-harness robustness changes accompanied the UI refresh. The standalone movement check now holds W and re-saves until the position advances (up to 3 s), instead of releasing after two animation frames. Software WebGL can stall the first frames while shaders compile, so two frames could pass with no movement tick. Screenshots use reduced motion, so dialogs are never captured mid-transition. No assertions were weakened.

The earlier blocked-environment record is retained in `tests/evidence/06-browser-progress.txt`, `26-browser-headless.txt` and `44-browser-delivery-gate.txt`.

## UI refresh and distribution (2026-11-03)

- Interface: SVG icon set (replacing Unicode glyphs that render inconsistently with Windows fonts), layered panels, framed viewport stage, illustrated shape tray, and a getting-started guide in the empty inspector.
- 3D view: soft directional shading, shadows and a sky gradient in the editor, in play mode and in exported players. Drafting edge lines appear in the editor only. **World settings → Look in play → Flat colours** restores the original 1991 look: ambient-only lighting reproduces every palette colour exactly, which a pixel check against the palette confirmed. Worlds without a `look` field play shaded.
- Distribution: `npm run package` writes `release/Freescape-Studio.html` and a zip with a plain-language START HERE note. Pages builds add a manifest and service worker, so the hosted copy can be installed from Edge/Chrome and works offline.

's manual is the baseline; [browser substitutions](SPEC.md#explicit-browser-adaptations) are explicit. Original binary worlds, proprietary image/sample encodings and native runners are replaced with browser equivalents. Original executable differential conformance and original scan visual verification have not been performed. Manual contradictions, publisher evidence, and implementation choices are recorded in [source decisions](../research/errata.md).
