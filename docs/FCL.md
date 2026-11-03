# FCL reference and source coverage

Baseline: S1, “The Freescape Command Language,” supplemented by the publisher's issue 1 startup listing (S6). The complete original command inventory is listed below; aliases do not add separate instructions.

| Family             | Commands                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| Structure          | IF, THEN, ELSE, ENDIF, AND, OR, END                                                                 |
| Arithmetic/bitwise | SETVAR, ADDVAR, SUBVAR, ANDV, ORV, NOTV                                                             |
| Comparisons        | VAR=?, VAR>?, VAR<?                                                                                 |
| Events/status      | ACTIVATED?, SHOT?, COLLIDED?, VIS?, INVIS?, DESTROYED?                                              |
| Object state       | VIS, INVIS, TOGVIS, DESTROY                                                                         |
| Positions/branch   | GETXPOS, GETYPOS, GETZPOS, EXECUTE                                                                  |
| Player             | GOTO, MODE, ENDGAME                                                                                 |
| Timing/display     | TIMER?, DELAY, WAIT, REDRAW, PRINT, UPDATEI                                                         |
| Sound              | SOUND, SYNCSND                                                                                      |
| Animation          | INCLUDE, REMOVE, START, RESTART, STARTANIM, STOPANIM, TRIGANIM, WAITTRIG, MOVE, MOVETO, LOOP, AGAIN |

Parameters use parentheses. `V0` through `V255` reference signed variables. `SETVAR(value,V30)`, `ADDVAR(value,V30)` and `SUBVAR(value,V30)` use value first and destination second. `GETXPOS(V30,object[,area])` uses the variable first. `GOTO(entrance[,area])` does not take area first. `VAR>?(P1,P2)` compares **P1 > P2**; the tutorial has a conflicting example, documented in the source decisions.

`SHOT?` and `COLLIDED?` consume their flags. `WAIT` suspends a program until the next simulation frame. `DELAY(n)` suspends the environment for n/50 seconds. Included moveable objects advance together; animator MOVE, MOVETO and END yield a frame. STOPANIM retains the program position. WAITTRIG consumes a trigger supplied with TRIGANIM. Ended animators restart from the beginning when STARTANIM is called again. The publisher's startup idiom uses LOOP(0) as a continuing loop with WAIT and a conditional AGAIN.

An object already included by another animator is ignored by INCLUDE until its owner issues REMOVE. Writing V7 changes the requested walking height and preserves the feet position; headroom limits the effective height beneath ceilings. Rise/fall adjusts walking height within 64–280 units and moves vertically while flying.

PRINT writes only to a text instrument; `\N` starts a new line. SOUND is immediate; SYNCSND waits for a frame update. Slots 7–31 are undefined/silent until configured. Reset restores objects and animators, clears variables, preserves V255, and runs the initial general condition once.

The runtime also accepts `XORV`, `VAR<>?`, `TIMER(n)`, and the verbose status predicates VISIBLE?/INVISIBLE? as modern extensions. They are not presented as original commands. The interpreter reports syntax errors and enforces an execution budget instead of hanging the editor on runaway scripts.

Programs are parsed into data instructions. FCL never evaluates JavaScript. Browser build artifacts embed the interpreter and the same world model used by the editor.
