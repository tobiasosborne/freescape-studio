# Source decisions and unresolved fidelity

Read 2026-10-17. The complete S1 transcription became accessible through `https://www.lemonamiga.com/games/docs.php?id=5`, redirected to the canonical manual URL. Web-extracted line locators below refer to that retrieval, not original printed pages.

- Comparison operand order: the tutorial at “How to use variables” swaps its operands. The command reference at lines 1592–1612 explicitly compares P1 to P2. Follow the command reference. This also agrees with the publisher's issue 1 startup listing checking `VAR>?(V15,0)`. Regression test added before correcting the interpreter.
- `SHOT?` (1452–1462) and `COLLIDED?` (1081–1091) clear their event flags. Multiple interrogations of the same event cannot all succeed. `ACTIVATED?` has no equivalent clear-on-read statement; retain activation for that invocation.
- `REMOVE` is a genuine animator instruction (1429–1436). `MOVE`, `MOVETO`, and animator `END` force a redraw/yield (1680–1695).
- Animator collisions use the bounding enclosure of included members, even when empty space separates them (1696–1704). This is required, not a per-mesh-only substitute.
- `SETVAR` with a literal destination has no effect according to the command reference (1445–1450). The editor may provide a diagnostic, but the engine must accept the documented no-op.
- The variable-range text disagrees with the range appendix. Conventional signed int32 overflow is a documented reimagining choice at the extreme boundary, not established original behavior.
- `XORV`, `VAR<>?`, `TIMER(n)` setter and arbitrary modern rotation are extensions unless separately corroborated. Clearly separate them from the original command inventory.
- The publisher's issue 1 Kitgame startup listing (S6) uses a continuing `LOOP 0`, WAIT, and an AGAIN inside an ELSE branch. The interpreter supports that control-flow idiom; the regression fixture normalizes the listed parameter syntax to `LOOP (0)`. This is additional publisher evidence beyond the manual's finite-loop example.
