// game.js
export const EMPTY = 0;
export const X = 1;
export const O = 2;
export const DRAW = 3;

const LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

export function createInitialState() {
  return {
    boards: Array.from({ length: 9 }, () => Array(9).fill(EMPTY)),
    smallWinners: Array(9).fill(EMPTY),
    bigWinner: EMPTY,
    activeBoard: -1,
    turn: X,
    moveCount: 0,
    lastMove: null, // { sb, c, player }
  };
}

export function cloneState(s) {
  return {
    boards: s.boards.map(b => b.slice()),
    smallWinners: s.smallWinners.slice(),
    bigWinner: s.bigWinner,
    activeBoard: s.activeBoard,
    turn: s.turn,
    moveCount: s.moveCount,
    lastMove: s.lastMove ? { ...s.lastMove } : null,
  };
}

export function isBoardFull(board) {
  return board.every(v => v !== EMPTY);
}

export function winnerOfBoard(board) {
  for (const [a,b,c] of LINES) {
    if (board[a] !== EMPTY && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (isBoardFull(board)) return DRAW;
  return EMPTY;
}

function winnerOfBig(smallWinners) {
  const big = smallWinners.map(v => (v === DRAW ? EMPTY : v));
  for (const [a,b,c] of LINES) {
    if (big[a] !== EMPTY && big[a] === big[b] && big[a] === big[c]) return big[a];
  }
  if (smallWinners.every(v => v !== EMPTY)) return DRAW;
  return EMPTY;
}

export function legalMoves(state) {
  if (state.bigWinner !== EMPTY) return [];
  const moves = [];

  let allowedBoards = [];
  if (state.activeBoard === -1) {
    allowedBoards = [...Array(9).keys()].filter(i => state.smallWinners[i] === EMPTY);
  } else {
    if (state.smallWinners[state.activeBoard] === EMPTY) allowedBoards = [state.activeBoard];
    else allowedBoards = [];
  }

  if (allowedBoards.length === 0) {
    for (let sb = 0; sb < 9; sb++) {
      if (state.smallWinners[sb] !== EMPTY) continue;
      for (let c = 0; c < 9; c++) if (state.boards[sb][c] === EMPTY) moves.push({ sb, c });
    }
    return moves;
  }

  for (const sb of allowedBoards) {
    for (let c = 0; c < 9; c++) if (state.boards[sb][c] === EMPTY) moves.push({ sb, c });
  }
  return moves;
}

export function applyMove(state, move, player) {
  const { sb, c } = move;

  if (state.bigWinner !== EMPTY) return { ok: false, reason: "game_over" };

  if (state.activeBoard !== -1 && state.activeBoard !== sb) {
    if (state.smallWinners[state.activeBoard] === EMPTY) return { ok: false, reason: "wrong_board" };
  }

  if (state.smallWinners[sb] !== EMPTY) return { ok: false, reason: "board_resolved" };
  if (state.boards[sb][c] !== EMPTY) return { ok: false, reason: "cell_taken" };

  state.boards[sb][c] = player;
  state.moveCount++;
  state.lastMove = { sb, c, player };

  const w = winnerOfBoard(state.boards[sb]);
  if (w !== EMPTY) state.smallWinners[sb] = w;

  state.bigWinner = winnerOfBig(state.smallWinners);

  const target = c;
  if (state.smallWinners[target] === EMPTY && !isBoardFull(state.boards[target])) state.activeBoard = target;
  else state.activeBoard = -1;

  state.turn = (player === X ? O : X);
  return { ok: true };
}