// replay.js
import { createInitialState, applyMove, X, O } from "./game.js";

export function buildReplay(moves) {
  // moves: [{sb,c,player:"X"|"O"}]
  const s = createInitialState();
  s.turn = X;
  const states = [structuredCloneState(s)];

  for (const m of moves) {
    const playerVal = m.player === "X" ? X : O;
    applyMove(s, { sb: m.sb, c: m.c }, playerVal);
    states.push(structuredCloneState(s));
  }
  return states;
}

function structuredCloneState(state) {
  return {
    boards: state.boards.map(b => b.slice()),
    smallWinners: state.smallWinners.slice(),
    bigWinner: state.bigWinner,
    activeBoard: state.activeBoard,
    turn: state.turn,
    moveCount: state.moveCount,
    lastMove: state.lastMove ? { ...state.lastMove } : null,
  };
}