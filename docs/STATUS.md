# Verification status

The implementation candidate is built. **88 tests pass**, with zero failures or skips. The production build emits a self-contained editor at `dist/index.html` (about 1.2 MB). The goal has **not** been marked complete: real-browser/WebGL acceptance remains outstanding and is blocked by the execution environment.

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

Run `npm run test:browser` where Chromium IPC is permitted, then inspect the editor/play screenshots and exported player in a real browser. Resolve rendering, layout, pointer/keyboard, and download defects observed there before calling delivery feature complete. Review desktop and narrow-window layouts and capture explicitly labelled regression baselines after inspection.

The browser suite now includes WebGL context/pixel checks, editor authoring/history, library reopen, JSON download/import, play movement/save/load/reset, FCL diagnostics, standalone export, running the standalone file in an offline browser context, gameplay persistence, and narrow editor/settings layouts. The expanded suite passes JavaScript syntax checking; its browser checks remain **unexecuted**, because launch fails first. Latest [launch log](../tests/evidence/44-browser-delivery-gate.txt) and [machine-readable report](../tests/evidence/44-browser-report.json) record `status: blocked`, `phase: browser-launch`, zero executed check groups, and zero screenshots.

This environment denies server socket operations (`listen EPERM`) and browser IPC socket operations. Both installed Chromium variants fail before opening a page: the full browser fails in crashpad socket setup; the headless shell fails in sandbox-host socket shutdown. See [Chromium evidence](../tests/evidence/06-browser-progress.txt) and [headless-shell evidence](../tests/evidence/26-browser-headless.txt). No browser screenshot golden or browser pass is claimed. The computer-use browser inventory is empty. Escalated execution is disallowed by the environment's approval policy.

The blocker was revalidated during the follow-up turn: computer-use still exposes no browser, and a headless-shell readiness check with single-process/no-zygote startup also fails in `sandbox_host_linux.cc` with `shutdown: Operation not permitted`. No browser process reached a page.

The same browser/IPC blocker was confirmed across the original work turn and both automatic goal continuations. The third audit again found no connected browser, and the expanded acceptance command again terminated in `sandbox_host_linux.cc` before reaching the application. Finishing the delivery gate requires an environment that permits Chromium IPC or provides a connected browser.

`scripts/render-scene.mjs` produces an SVG software scene preview. Its PNG was inspected for scenery/geometry; SVG painter ordering is adjusted for the floor and plinth. It is not a WebGL screenshot or historical visual oracle.

## Historical compatibility limits

The 1991 first 16-bit kit's manual is the baseline; [browser substitutions](SPEC.md#explicit-browser-adaptations) are explicit. Original binary worlds, proprietary image/sample encodings and native runners are replaced with browser equivalents. Original executable differential conformance and original scan visual verification have not been performed. Manual contradictions, publisher evidence, and implementation choices are recorded in [source decisions](../research/errata.md).
