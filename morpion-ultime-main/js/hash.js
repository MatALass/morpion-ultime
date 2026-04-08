// hash.js
import { EMPTY, X, O } from "./game.js";

function rand32() {
  // xorshift32
  let x = (Math.random() * 0xffffffff) >>> 0;
  x ^= x << 13; x >>>= 0;
  x ^= x >> 17; x >>>= 0;
  x ^= x << 5;  x >>>= 0;
  return x >>> 0;
}

export function createZobrist() {
  // 9 small boards * 9 cells * 3 states (EMPTY not needed but keep for simplicity)
  const table = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => ({
      [X]: rand32(),
      [O]: rand32(),
    }))
  );
  const turnKey = { [X]: rand32(), [O]: rand32() };
  const activeKey = Array.from({ length: 10 }, () => rand32()); // -1 mapped to 9
  const smallWinKey = Array.from({ length: 9 }, () => ({ [X]: rand32(), [O]: rand32(), 3: rand32() }));
  return { table, turnKey, activeKey, smallWinKey };
}

export function hashState(z, state) {
  let h = 0 >>> 0;

  for (let sb = 0; sb < 9; sb++) {
    const b = state.boards[sb];
    for (let c = 0; c < 9; c++) {
      const v = b[c];
      if (v === X || v === O) h ^= z.table[sb][c][v];
    }
    const sw = state.smallWinners[sb];
    if (sw === X || sw === O || sw === 3) h ^= z.smallWinKey[sb][sw];
  }

  h ^= z.turnKey[state.turn];
  h ^= z.activeKey[state.activeBoard === -1 ? 9 : state.activeBoard];
  return h >>> 0;
}