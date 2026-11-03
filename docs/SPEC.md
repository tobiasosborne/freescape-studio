# Freescape Studio specification

Baseline: the 1991 **16-bit first 3D Construction Kit**, using the original manual (S1/S2 in [sources](../research/sources.json)). This is a Three.js reimagining of its world-authoring and playable-world features. Kit II and the distinct 8-bit byte-oriented FCL are separate products. The reference discovery page is [Incentive Software](https://en.wikipedia.org/wiki/Incentive_Software).

## Evidence and acceptance

Expected semantics live in `tests/goldens/manual-behavior.json`. They are authored from the manual before code. Tests refer to golden IDs and exact manual section headings. Screenshots of this app are separately labelled regression captures. No original executable has yet been run; semantic fidelity must not be described as emulator-verified. Direct scan downloads currently fail under the shell network restrictions. Original artwork, samples, bundled games, and executable code are not copied.

| ID  | Required capability                                                                                                      | Manual locator (S1)                     | Acceptance                         |
| --- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | ---------------------------------- |
| W01 | Multiple named areas; global area 0; area scale, horizon, palette and global-object inclusion                            | Area menu; List globals                 | Model tests + area UI              |
| W02 | New area has base cuboid 1 and entrance 1                                                                                | Create area                             | G01                                |
| O01 | Cuboids, pyramids, rectangle, triangle, quadrilateral, pentagon, hexagon, line, sensors, groups                          | Create/edit object                      | Geometry tests + create UI         |
| O02 | Select in view/list; names, positions, sizes, point editing, turn/flip, stretch/shrink/move                              | Edit object; Attributes                 | Edit tests + browser authoring     |
| O03 | Copy with conditions; relative placement; object deletion; groups with editable membership                               | Copy; Create object; List group         | G02 + model tests                  |
| O04 | Current visible/invisible/destroyed state; initial visible/invisible; moveable/start position                            | Attributes; Animation controller        | G03/G04                            |
| O05 | Per-face palette assignment; index 0 invisible; sky/ground; edit/copy/spread/reset area palette                          | Colour; Area colours                    | Geometry/palette tests + UI        |
| E01 | Undo, exclude, highlight; six lock views; fine/coarse steps; five persistent cameras                                     | Introduction to editor; Preferences     | Editor/browser tests               |
| P01 | WALK with collision, gravity, crouch, climb and safe-fall accounting; FLY1 horizontal forward; FLY2 view-relative        | Movement modes; Defaults                | Movement tests                     |
| P02 | Entrances with position/rotation; entrance/area navigation; start defaults                                               | Area menu; GOTO; Defaults               | G05                                |
| P03 | Shoot/activate/collide object events; activation distance; configurable controls and screen controls                     | FCL introduction; Controls              | Event/browser tests                |
| P04 | Sensors: range, detection directions, sensing or shooting, rate, system counters                                         | Attributes; system variables            | Sensor tests                       |
| C01 | Object, area and general conditions; initial general condition runs once on reset                                        | FCL; General conditions; variables      | Runtime tests                      |
| C02 | 256 signed 32-bit variables, system slots 0–29, V255 survives reset                                                      | More about variables; Reset             | G03 + variables tests              |
| C03 | IF/THEN/ELSE/ENDIF, AND/OR, comparisons, arithmetic/bitwise, object status and position, EXECUTE, GOTO, MODE             | FCL command reference                   | Parser/runtime tests               |
| C04 | WAIT, DELAY in 50ths, REDRAW, timer predicates; bounded execution; syntax diagnostics                                    | FCL command reference                   | Scheduler tests                    |
| A01 | Animators, INCLUDE/REMOVE, START/RESTART, MOVE/MOVETO, LOOP/AGAIN, END, start/stop/trigger/wait                          | Animation controller; command reference | G06 + animator tests               |
| I01 | Undefined, horizontal/vertical bar, numerical, text-window instruments; variable link; min/max, colors, screen placement | Create/edit instrument                  | Instrument tests + HUD editor      |
| I02 | PRINT with newlines and UPDATEI; view-window rectangle; border artwork                                                   | PRINT; Set view window; Load border     | Browser HUD tests                  |
| S01 | 32 sound slots, immediate and synchronized sounds, sample replacement                                                    | Sound effects; SOUND/SYNCSND            | Audio command tests + sound editor |
| F01 | Save/load complete world; save/load object/group; local library, delete stored file; clear all                           | File menu                               | Round-trip/rejection tests + UI    |
| F02 | Play/test; reset; return to editor with F1; game-state save/load                                                         | Test; Default key controls              | Browser play workflow              |
| F03 | MAKE distributable playable world with runtime and assets                                                                | Make                                    | Export artifact/browser test       |

## Explicit browser adaptations

JSON replaces the original disk database and object-file encoding; PNG/JPEG/WebP replace DEGAS/IFF/NEO borders; Web Audio synthesis and uploaded audio replace proprietary sample banks; downloadable browser bundles replace native RUNNER executables. Existing original binary worlds are not accepted by the JSON loader. A modern undo/redo history, orbit viewport, grid snapping, inspector, WASD control preset and autosave supplement the original workflows. These are product decisions, not claims about the 1991 engine.

Use original coordinate units: positions/sizes 0–8192 and degree rotations. The source gives inconsistent signed-number endpoints; this implementation uses conventional signed int32 arithmetic and documents that boundary choice. Normal literals use -16384…16383; variables may hold larger computed values. Newly created primitive size 200 derives from the first-cube tutorial; most UI default palette hues and sensor defaults are reimagining choices. An area-specific palette has 16 entries; index 0 hides a face, rather than making the whole object non-solid.

## Delivery gate

Do not mark the goal complete until each requirement has implementation plus meaningful passing acceptance evidence, the production build succeeds, and the browser editor → save/load → play → standalone workflow is verified. Track remaining work honestly in `docs/STATUS.md`. Do not regenerate semantic goldens to make tests pass. Run a red test before each behavioral implementation change and retain red/green logs under `tests/evidence/`.
