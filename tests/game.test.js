import { describe, it, expect } from "vitest";
import { createInitialState, applyMove, X, O, DRAW, winnerOfBoard } from "../js/game.js";

describe("game rules", () => {
  it("winnerOfBoard detects row win", () => {
    const b = [X,X,X, 0,0,0, 0,0,0];
    expect(winnerOfBoard(b)).toBe(X);
  });

  it("applyMove sets lastMove and toggles turn", () => {
    const s = createInitialState();
    const r = applyMove(s, { sb: 0, c: 0 }, X);
    expect(r.ok).toBe(true);
    expect(s.lastMove.sb).toBe(0);
    expect(s.lastMove.c).toBe(0);
    expect(s.turn).toBe(O);
  });

  it("forces next active board from played cell index", () => {
    const s = createInitialState();
    applyMove(s, { sb: 0, c: 4 }, X);
    expect(s.activeBoard).toBe(4);
  });
});