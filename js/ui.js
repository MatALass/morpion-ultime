// ui.js
import { EMPTY, X, O, DRAW } from "./game.js";

/* ── SVG marks ─────────────────────────────────────────────────────────── */

const SVG_X = `<svg class="mark" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <line x1="5" y1="5" x2="27" y2="27" stroke-width="5" stroke-linecap="round"/>
  <line x1="27" y1="5" x2="5" y2="27" stroke-width="5" stroke-linecap="round"/>
</svg>`;

const SVG_O = `<svg class="mark" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="16" cy="16" r="10" stroke-width="5" fill="none"/>
</svg>`;

const SVG_X_BIG = `<svg class="big-mark" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <line x1="6" y1="6" x2="34" y2="34" stroke="white" stroke-width="6" stroke-linecap="round"/>
  <line x1="34" y1="6" x2="6" y2="34" stroke="white" stroke-width="6" stroke-linecap="round"/>
</svg>`;

const SVG_O_BIG = `<svg class="big-mark" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="20" cy="20" r="13" stroke="white" stroke-width="6" fill="none"/>
</svg>`;

const SVG_DRAW_BIG = `<span class="draw-text">NUL</span>`;

/* ── Board builder ──────────────────────────────────────────────────────── */

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

/* ── Helpers ────────────────────────────────────────────────────────────── */

function setCellMark(cell, v) {
  cell.classList.remove("cell-x", "cell-o");
  if (v === X) {
    cell.innerHTML = SVG_X;
    cell.classList.add("cell-x");
    cell.setAttribute("aria-label", "X");
  } else if (v === O) {
    cell.innerHTML = SVG_O;
    cell.classList.add("cell-o");
    cell.setAttribute("aria-label", "O");
  } else {
    cell.innerHTML = "";
    cell.removeAttribute("aria-label");
  }
}

/* ── Main render ────────────────────────────────────────────────────────── */

export function render(state, prevState, container, suggestions = null) {
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

    // Badge
    const badge = sbEl.querySelector('[data-badge="1"]');
    badge.className = "badge";
    if (resolved) badge.textContent = "";
    else if (forced && sb === state.activeBoard) { badge.textContent = "FORCÉ"; badge.classList.add("forced"); }
    else if (!forced) badge.textContent = "LIBRE";
    else badge.textContent = "";

    // Cells
    const cells = sbEl.querySelectorAll(".cell");
    for (const cell of cells) {
      const c = Number(cell.dataset.c);
      const v = state.boards[sb][c];
      const prev = prevState ? prevState.boards[sb][c] : EMPTY;
      const changed = prevState && prev !== v;

      setCellMark(cell, v);

      cell.classList.toggle("pop", changed && v !== EMPTY);
      if (changed && v !== EMPTY) {
        requestAnimationFrame(() => setTimeout(() => cell.classList.remove("pop"), 250));
      }

      // Dernier coup
      const isLast = state.lastMove && state.lastMove.sb === sb && state.lastMove.c === c;
      cell.classList.toggle("last", !!isLast);

      // Heatmap suggestion
      const key = `${sb},${c}`;
      const a = suggestions?.get(key);
      if (a && v === EMPTY) {
        cell.classList.add("suggest");
        cell.style.setProperty("--hintAlpha", String(Math.max(0, Math.min(0.25, a * 0.25))));
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

    // Stamp (winner du sous-plateau)
    const stamp = sbEl.querySelector('[data-stamp="1"]');
    const w = state.smallWinners[sb];
    stamp.className = "stamp";
    if (w === X)    { stamp.innerHTML = SVG_X_BIG; stamp.classList.add("x"); }
    else if (w === O)    { stamp.innerHTML = SVG_O_BIG; stamp.classList.add("o"); }
    else if (w === DRAW) { stamp.innerHTML = SVG_DRAW_BIG; stamp.classList.add("draw"); }
    else stamp.innerHTML = "";
  }
}
