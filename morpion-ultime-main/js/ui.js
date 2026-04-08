// ui.js
import { EMPTY, X, O, DRAW } from "./game.js";

export function buildBoardDOM(container, onCellClick) {
  container.innerHTML = "";
  for (let sb = 0; sb < 9; sb++) {
    const small = document.createElement("div");
    small.className = "small-board";
    small.dataset.sb = String(sb);

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.dataset.badge = "1";
    small.appendChild(badge);

    for (let c = 0; c < 9; c++) {
      const btn = document.createElement("button");
      btn.className = "cell";
      btn.type = "button";
      btn.dataset.sb = String(sb);
      btn.dataset.c = String(c);
      btn.addEventListener("click", () => onCellClick(sb, c));
      small.appendChild(btn);
    }

    const stamp = document.createElement("div");
    stamp.className = "stamp";
    stamp.dataset.stamp = "1";
    small.appendChild(stamp);

    container.appendChild(small);
  }
}

function symbolToChar(v) {
  if (v === X) return "X";
  if (v === O) return "O";
  return "";
}

export function render(state, prevState, container, suggestions = null) {
  // suggestions: Map("sb,c" -> normalized 0..1)
  const smallBoards = container.querySelectorAll(".small-board");
  const forced = (state.activeBoard !== -1 && state.smallWinners[state.activeBoard] === EMPTY);

  for (const sbEl of smallBoards) {
    const sb = Number(sbEl.dataset.sb);
    const resolved = state.smallWinners[sb] !== EMPTY;

    const shouldBeActive =
      !resolved &&
      (state.activeBoard === -1 || state.activeBoard === sb || state.smallWinners[state.activeBoard] !== EMPTY);

    sbEl.classList.toggle("active", shouldBeActive);
    sbEl.classList.toggle("resolved", resolved);

    const forbidden = forced && sb !== state.activeBoard && !resolved;
    sbEl.classList.toggle("forbidden", forbidden);

    // badge
    const badge = sbEl.querySelector('[data-badge="1"]');
    badge.className = "badge";
    if (resolved) badge.textContent = "";
    else if (forced && sb === state.activeBoard) { badge.textContent = "FORCÉ"; badge.classList.add("forced"); }
    else if (!forced) badge.textContent = "LIBRE";
    else badge.textContent = "";

    const cells = sbEl.querySelectorAll(".cell");
    for (const cell of cells) {
      const c = Number(cell.dataset.c);
      const v = state.boards[sb][c];

      const prev = prevState ? prevState.boards[sb][c] : EMPTY;
      const changed = prevState && prev !== v;

      cell.textContent = symbolToChar(v);
      cell.classList.toggle("pop", changed && v !== EMPTY);
      if (changed && v !== EMPTY) requestAnimationFrame(() => setTimeout(() => cell.classList.remove("pop"), 180));

      // last move
      const isLast = state.lastMove && state.lastMove.sb === sb && state.lastMove.c === c;
      cell.classList.toggle("last", !!isLast);

      // heatmap suggestion
      const key = `${sb},${c}`;
      const a = suggestions?.get(key);
      if (a && v === EMPTY) {
        cell.classList.add("suggest");
        cell.style.setProperty("--hintAlpha", String(Math.max(0, Math.min(0.22, a * 0.22))));
      } else {
        cell.classList.remove("suggest");
        cell.style.removeProperty("--hintAlpha");
      }

      const playable =
        state.bigWinner === EMPTY &&
        state.smallWinners[sb] === EMPTY &&
        v === EMPTY &&
        (state.activeBoard === -1 || state.activeBoard === sb || state.smallWinners[state.activeBoard] !== EMPTY);

      cell.disabled = !playable;
    }

    // stamp
    const stamp = sbEl.querySelector('[data-stamp="1"]');
    const w = state.smallWinners[sb];
    stamp.className = "stamp";
    if (w === X) { stamp.textContent = "X"; stamp.classList.add("x"); }
    else if (w === O) { stamp.textContent = "O"; stamp.classList.add("o"); }
    else if (w === DRAW) { stamp.textContent = "·"; stamp.classList.add("draw"); }
    else stamp.textContent = "";
  }
}