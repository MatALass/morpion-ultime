// ai.js
import { X, O, DRAW, EMPTY, cloneState, legalMoves, applyMove, winnerOfBoard } from "./game.js";
import { createZobrist, hashState } from "./hash.js";

const zobrist = createZobrist();
const BIG_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function scoreSmallBoard(board, me, opp) {
  const w = winnerOfBoard(board);
  if (w === me) return 80;
  if (w === opp) return -80;
  if (w === DRAW) return 0;

  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ];

  let s = 0;
  for (const [a,b,c] of lines) {
    const line = [board[a], board[b], board[c]];
    const meC = line.filter(v => v === me).length;
    const opC = line.filter(v => v === opp).length;
    const emC = line.filter(v => v === EMPTY).length;

    if (meC && !opC) s += (meC === 2 && emC === 1) ? 6 : (meC === 1 ? 2 : 0);
    if (opC && !meC) s -= (opC === 2 && emC === 1) ? 6 : (opC === 1 ? 2 : 0);
  }
  if (board[4] === me) s += 1.5;
  if (board[4] === opp) s -= 1.5;
  return s;
}

function scoreBig(state, me, opp) {
  let s = 0;

  // captured boards
  for (let i = 0; i < 9; i++) {
    const w = state.smallWinners[i];
    if (w === me) s += 120;
    else if (w === opp) s -= 120;
  }

  // big line potential
  const big = state.smallWinners.map(v => (v === DRAW ? EMPTY : v));
  for (const [a,b,c] of BIG_LINES) {
    const line = [big[a], big[b], big[c]];
    const meC = line.filter(v => v === me).length;
    const opC = line.filter(v => v === opp).length;
    const emC = line.filter(v => v === EMPTY).length;

    if (meC && !opC) s += (meC === 2 && emC === 1) ? 35 : (meC === 1 ? 10 : 0);
    if (opC && !meC) s -= (opC === 2 && emC === 1) ? 35 : (opC === 1 ? 10 : 0);
  }

  // local boards
  for (let i = 0; i < 9; i++) {
    if (state.smallWinners[i] !== EMPTY) continue;
    s += scoreSmallBoard(state.boards[i], me, opp);
  }

  // tempo on active board
  if (state.activeBoard !== -1) s += scoreSmallBoard(state.boards[state.activeBoard], me, opp) * 0.6;

  return s;
}

function evaluate(state, me, opp) {
  if (state.bigWinner === me) return 100000;
  if (state.bigWinner === opp) return -100000;
  if (state.bigWinner === DRAW) return 0;
  return scoreBig(state, me, opp);
}

function orderMoves(state, moves, me, opp) {
  const scored = moves.map(m => {
    const s2 = cloneState(state);
    applyMove(s2, m, s2.turn);
    return { m, val: evaluate(s2, me, opp) };
  });
  const maximizing = (state.turn === me);
  scored.sort((a,b) => maximizing ? (b.val - a.val) : (a.val - b.val));
  return scored.map(x => x.m);
}

// --- Minimax TT bounds ---
const EXACT = 0, LOWER = 1, UPPER = 2;

function minimaxTT(state, depth, alpha, beta, me, opp, stats, tt, deadline) {
  stats.nodes++;
  if (performance.now() > deadline) return { score: evaluate(state, me, opp), move: null, timedOut: true };

  if (state.bigWinner !== EMPTY || depth === 0) {
    return { score: evaluate(state, me, opp), move: null, timedOut: false };
  }

  const key = hashState(zobrist, state);
  const hit = tt.get(key);
  if (hit && hit.depth >= depth) {
    stats.ttHits++;
    if (hit.flag === EXACT) return { score: hit.score, move: hit.move, timedOut: false };
    if (hit.flag === LOWER) alpha = Math.max(alpha, hit.score);
    else if (hit.flag === UPPER) beta = Math.min(beta, hit.score);
    if (alpha >= beta) return { score: hit.score, move: hit.move, timedOut: false };
  } else {
    stats.ttMiss++;
  }

  let moves = legalMoves(state);
  if (!moves.length) return { score: evaluate(state, me, opp), move: null, timedOut: false };

  moves = orderMoves(state, moves, me, opp);
  if (moves.length > stats.branchLimit) moves = moves.slice(0, stats.branchLimit);

  const maximizing = (state.turn === me);
  let bestMove = null;

  const alpha0 = alpha, beta0 = beta;
  let best = maximizing ? -Infinity : Infinity;

  for (const m of moves) {
    const s2 = cloneState(state);
    applyMove(s2, m, s2.turn);

    const r = minimaxTT(s2, depth - 1, alpha, beta, me, opp, stats, tt, deadline);
    if (r.timedOut) return { score: best, move: bestMove, timedOut: true };

    if (maximizing) {
      if (r.score > best) { best = r.score; bestMove = m; }
      alpha = Math.max(alpha, best);
    } else {
      if (r.score < best) { best = r.score; bestMove = m; }
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }

  // store TT with bounds
  let flag = EXACT;
  if (best <= alpha0) flag = UPPER;
  else if (best >= beta0) flag = LOWER;

  tt.set(key, { depth, score: best, move: bestMove, flag });
  return { score: best, move: bestMove, timedOut: false };
}

function branchLimitForDifficulty(d, len) {
  if (d === "easy") return Math.min(8, len);
  if (d === "medium") return Math.min(12, len);
  return Math.min(16, len);
}
function maxDepthForDifficulty(d) {
  if (d === "easy") return 2;
  if (d === "medium") return 7;
  return 9;
}

function chooseMinimaxIterative(state, aiSymbol, difficulty, timeLimitMs) {
  const me = aiSymbol === "X" ? X : O;
  const opp = me === X ? O : X;

  const moves = legalMoves(state);
  if (!moves.length) return { move: null, stats: { ms: 0, depth: 0, nodes: 0, ttHits: 0, ttSize: 0 } };

  if (difficulty === "easy") {
    const ord = orderMoves(state, moves, me, opp);
    const top = ord.slice(0, Math.min(6, ord.length));
    return { move: top[(Math.random() * top.length) | 0], stats: { ms: 0, depth: 0, nodes: 0, ttHits: 0, ttSize: 0 } };
  }

  const tt = new Map();
  const stats = {
    nodes: 0, depth: 0, ttHits: 0, ttMiss: 0,
    branchLimit: branchLimitForDifficulty(difficulty, moves.length),
  };

  const t0 = performance.now();
  const deadline = t0 + Math.max(30, timeLimitMs);

  let bestMove = null;
  const maxD = maxDepthForDifficulty(difficulty);

  for (let d = 1; d <= maxD; d++) {
    const r = minimaxTT(state, d, -Infinity, Infinity, me, opp, stats, tt, deadline);
    if (r.timedOut) break;
    if (r.move) bestMove = r.move;
    stats.depth = d;
  }

  const t1 = performance.now();
  return {
    move: bestMove ?? moves[0],
    stats: { ms: t1 - t0, depth: stats.depth, nodes: stats.nodes, ttHits: stats.ttHits, ttSize: tt.size },
  };
}

// --- MCTS UCT (vraie) ---
class Node {
  constructor(state, parent = null, move = null) {
    this.state = state;          // cloned state
    this.parent = parent;
    this.move = move;            // move that led here
    this.children = [];
    this.untried = legalMoves(state);
    this.wins = 0;               // from perspective of "me"
    this.visits = 0;
  }
}

function uctValue(child, parentVisits, c = 1.41) {
  if (child.visits === 0) return Infinity;
  return (child.wins / child.visits) + c * Math.sqrt(Math.log(parentVisits) / child.visits);
}

function rolloutResult(state, me, opp) {
  const s = cloneState(state);
  while (s.bigWinner === EMPTY) {
    const moves = legalMoves(s);
    if (!moves.length) break;
    const m = moves[(Math.random() * moves.length) | 0];
    applyMove(s, m, s.turn);
  }
  if (s.bigWinner === me) return 1;
  if (s.bigWinner === opp) return 0;
  return 0.5; // draw
}

function chooseMCTS(state, aiSymbol, difficulty, timeLimitMs) {
  const me = aiSymbol === "X" ? X : O;
  const opp = me === X ? O : X;

  const root = new Node(cloneState(state));
  const t0 = performance.now();
  const deadline = t0 + Math.max(30, timeLimitMs);

  const maxIters =
    difficulty === "easy" ? 1500 :
    difficulty === "medium" ? 4500 : 9000;

  let iters = 0;

  while (performance.now() < deadline && iters < maxIters) {
    iters++;

    // 1) Selection
    let node = root;
    while (node.untried.length === 0 && node.children.length > 0) {
      node = node.children.reduce((best, ch) =>
        uctValue(ch, node.visits) > uctValue(best, node.visits) ? ch : best
      , node.children[0]);
    }

    // 2) Expansion
    if (node.untried.length > 0) {
      const m = node.untried.pop();
      const s2 = cloneState(node.state);
      applyMove(s2, m, s2.turn);
      const child = new Node(s2, node, m);
      node.children.push(child);
      node = child;
    }

    // 3) Simulation
    const result = rolloutResult(node.state, me, opp);

    // 4) Backprop
    while (node) {
      node.visits++;
      node.wins += result;
      node = node.parent;
    }
  }

  // pick most visited
  let best = null;
  let bestV = -1;
  for (const ch of root.children) {
    if (ch.visits > bestV) { bestV = ch.visits; best = ch; }
  }

  const t1 = performance.now();
  return {
    move: best ? best.move : (legalMoves(state)[0] ?? null),
    stats: { ms: t1 - t0, depth: 0, nodes: iters, ttHits: 0, ttSize: root.children.length },
  };
}

// --- Top moves for analysis/heatmap ---
export function getTopMoves(state, aiSymbol, aiType, difficulty, timeLimitMs, k = 3) {
  const moves = legalMoves(state);
  if (!moves.length) return [];

  if (aiType === "mcts") {
    // quick: run a small MCTS and return top by visits
    const me = aiSymbol === "X" ? X : O;
    const opp = me === X ? O : X;
    const root = new Node(cloneState(state));
    const t0 = performance.now();
    const deadline = t0 + Math.max(30, Math.min(timeLimitMs, 250));

    while (performance.now() < deadline) {
      let node = root;
      while (node.untried.length === 0 && node.children.length > 0) {
        node = node.children.reduce((best, ch) =>
          uctValue(ch, node.visits) > uctValue(best, node.visits) ? ch : best
        , node.children[0]);
      }
      if (node.untried.length > 0) {
        const m = node.untried.pop();
        const s2 = cloneState(node.state);
        applyMove(s2, m, s2.turn);
        const child = new Node(s2, node, m);
        node.children.push(child);
        node = child;
      }
      const result = rolloutResult(node.state, me, opp);
      while (node) { node.visits++; node.wins += result; node = node.parent; }
    }

    return root.children
      .map(ch => ({ move: ch.move, score: ch.visits ? ch.wins / ch.visits : 0, visits: ch.visits }))
      .sort((a,b) => b.visits - a.visits)
      .slice(0, k);
  }

  // minimax: shallow score from evaluate after move
  const me = aiSymbol === "X" ? X : O;
  const opp = me === X ? O : X;
  const scored = moves.map(m => {
    const s2 = cloneState(state);
    applyMove(s2, m, s2.turn);
    return { move: m, score: evaluate(s2, me, opp), visits: 0 };
  });
  scored.sort((a,b) => b.score - a.score);
  return scored.slice(0, k);
}

export function chooseAiMoveWithStats(state, aiSymbol, aiType, difficulty, timeLimitMs) {
  if (aiType === "mcts") return chooseMCTS(state, aiSymbol, difficulty, timeLimitMs);
  return chooseMinimaxIterative(state, aiSymbol, difficulty, timeLimitMs);
}