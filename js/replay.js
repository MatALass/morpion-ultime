// replay.js
import { createInitialState, applyMove, X, O, cloneState } from "./game.js";

export function buildReplay(moves) {
  // moves: [{sb,c,player:"X"|"O"}]
  const s = createInitialState();
  s.turn = X;
  const states = [cloneState(s)];

  for (const m of moves) {
    const playerVal = m.player === "X" ? X : O;
    applyMove(s, { sb: m.sb, c: m.c }, playerVal);
    states.push(cloneState(s));
  }
  return states;
}
