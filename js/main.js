// main.js
import { createInitialState, cloneState, applyMove, X, O, DRAW, EMPTY, legalMoves } from "./game.js";
import { chooseAiMoveWithStats, getTopMoves } from "./ai.js";
import { buildBoardDOM, render } from "./ui.js";
import { saveToLocal, loadFromLocal, clearLocal, encodeShare, decodeShare } from "./storage.js";
import { buildReplay } from "./replay.js";

const $ = (id) => document.getElementById(id);

const elBoard = $("board");
const elStatus = $("status");
const elMode = $("mode");
const elHumanSymbol = $("humanSymbol");
const elAiType = $("aiType");
const elDifficulty = $("difficulty");
const elAiTimeLimit = $("aiTimeLimit");
const elAiTimeLimitLabel = $("aiTimeLimitLabel");
const elSpeed = $("speed");

const elPlayPause = $("playPause");
const elUndo = $("undo");
const elRedo = $("redo");
const elRestart = $("restart");
const elResetAll = $("resetAll");

const elActiveHint = $("activeHint");
const elPlayerHint = $("playerHint");
const elAiHint = $("aiHint");
const elSeriesHint = $("seriesHint");

const elAiMove = $("aiMove");
const elAiTime = $("aiTime");
const elAiDepth = $("aiDepth");
const elAiNodes = $("aiNodes");
const elAiCache = $("aiCache");

const elLog = $("log");
const elTopMoves = $("topMoves");
const elAnalysis = $("analysis");

const elOverlay = $("overlay");
const elOverlayText = $("overlayText");
const elOverlayRestart = $("overlayRestart");

const elToast = $("toast");

const elReplayStart = $("replayStart");
const elReplayPrev = $("replayPrev");
const elReplayNext = $("replayNext");
const elReplayEnd = $("replayEnd");
const elReplayPlay = $("replayPlay");

const elSim100 = $("simulate100");
const elSim1000 = $("simulate1000");

const elShare = $("shareCode");
const elExport = $("exportBtn");
const elImport = $("importBtn");
const elClearSave = $("clearSaveBtn");

// App state
let state = createInitialState();
let prevState = null;

// Past/future with full snapshot (for perfect undo/redo)
let past = [];
let future = [];

// Moves list for export/replay
let moveList = []; // [{sb,c,player:"X"|"O"}]
let log = [];      // html strings

// Replay mode
let replayStates = null;
let replayIndex = 0;
let replayTimer = null;

// Autoplay (IA vs IA) pause
let paused = false;
let busy = false;
let toastTimer = null;

// Series scoreboard (for simulations)
let series = { X: 0, O: 0, D: 0 };

function vToChar(v) { return v === X ? "X" : (v === O ? "O" : ""); }
function symToVal(sym) { return sym === "X" ? X : O; }
function otherSym(sym) { return sym === "X" ? "O" : "X"; }

function showToast(msg) {
  if (toastTimer) clearTimeout(toastTimer);
  elToast.textContent = msg;
  elToast.classList.remove("hidden");
  toastTimer = setTimeout(() => elToast.classList.add("hidden"), 1400);
}

function showOverlay(text) {
  elOverlayText.textContent = text;
  elOverlay.classList.remove("hidden");
}
function hideOverlay() { elOverlay.classList.add("hidden"); }

function setAiStatsEmpty() {
  elAiMove.textContent = "—";
  elAiTime.textContent = "—";
  elAiDepth.textContent = "—";
  elAiNodes.textContent = "—";
  elAiCache.textContent = "—";
}

function updateSeriesUI() {
  elSeriesHint.textContent = `Série: X ${series.X} • O ${series.O} • = ${series.D}`;
}

function updateLogUI() {
  elLog.innerHTML = "";
  for (const item of log.slice(-90)) {
    const li = document.createElement("li");
    li.innerHTML = item;
    elLog.appendChild(li);
  }
}

function updateTopMovesUI(list) {
  elTopMoves.innerHTML = "";
  if (!elAnalysis.checked) return;
  for (const item of list) {
    const li = document.createElement("li");
    const { move, score, visits } = item;
    const tail = visits ? ` • visits ${visits}` : ` • score ${score.toFixed(1)}`;
    li.innerHTML = `<b>plateau ${move.sb + 1}, case ${move.c + 1}</b>${tail}`;
    elTopMoves.appendChild(li);
  }
}

function snapshot() {
  return {
    state: cloneState(state),
    moveList: moveList.map(m => ({...m})),
    log: [...log],
    series: { ...series },
    settings: getSettings(),
  };
}
function restoreSnap(snap) {
  state = cloneState(snap.state);
  moveList = snap.moveList.map(m => ({...m}));
  log = [...snap.log];
  series = { ...snap.series };
  applySettings(snap.settings, false);
  prevState = null;
  updateLogUI();
  updateSeriesUI();
  hideOverlay();
  rerender();
}

function pushPast() {
  past.push(snapshot());
  future = [];
}

function getSettings() {
  return {
    mode: elMode.value,
    human: elHumanSymbol.value,
    aiType: elAiType.value,
    diff: elDifficulty.value,
    time: Number(elAiTimeLimit.value),
    speed: Number(elSpeed.value),
    paused,
    analysis: elAnalysis.checked,
  };
}

function applySettings(s, doReset = true) {
  elMode.value = s.mode ?? "hva";
  elHumanSymbol.value = s.human ?? "X";
  elAiType.value = s.aiType ?? "minimax";
  elDifficulty.value = s.diff ?? "medium";
  elAiTimeLimit.value = String(s.time ?? 250);
  elAiTimeLimitLabel.textContent = String(s.time ?? 250);
  elSpeed.value = String(s.speed ?? 1);
  paused = !!s.paused;
  elAnalysis.checked = !!s.analysis;

  elPlayPause.textContent = paused ? "Play" : "Pause";

  if (doReset) resetGame(true);
}

function persist() {
  saveToLocal({
    version: 1,
    snap: snapshot(),
  });
}

function loadPersisted() {
  const saved = loadFromLocal();
  if (!saved?.snap) return false;
  restoreSnap(saved.snap);
  return true;
}

function activeBoardText() {
  if (state.activeBoard === -1) return "Plateau actif : libre";
  return `Plateau actif : #${state.activeBoard + 1}`;
}

function currentPlayersInfo() {
  const mode = elMode.value;
  const diff = elDifficulty.value;
  const aiType = elAiType.value.toUpperCase();

  if (mode === "hvh") {
    elPlayerHint.textContent = `Joueur 1: X • Joueur 2: O`;
    elAiHint.textContent = `IA : (off)`;
    return;
  }

  if (mode === "ava") {
    elPlayerHint.textContent = `Humain : (spectateur)`;
    elAiHint.textContent = `IA : ${aiType} • ${diff}`;
    return;
  }

  const human = elHumanSymbol.value;
  const ai = otherSym(human);
  elPlayerHint.textContent = `Toi : ${human}`;
  elAiHint.textContent = `IA : ${ai} • ${aiType} • ${diff}`;
}

function setStatus() {
  if (state.bigWinner === X) elStatus.textContent = "Fin : X gagne !";
  else if (state.bigWinner === O) elStatus.textContent = "Fin : O gagne !";
  else if (state.bigWinner === DRAW) elStatus.textContent = "Fin : match nul.";
  else {
    const forced = (state.activeBoard !== -1 && state.smallWinners[state.activeBoard] === EMPTY);
    const where = forced ? `dans le plateau #${state.activeBoard + 1}` : "n’importe où (LIBRE)";
    elStatus.textContent = `Tour : ${vToChar(state.turn)} • Jouer ${where}`;
  }

  elActiveHint.textContent = activeBoardText();
  currentPlayersInfo();

  elUndo.disabled = past.length === 0 || busy || replayStates;
  elRedo.disabled = future.length === 0 || busy || replayStates;
}

function recordMoveText(move, playerVal) {
  const p = vToChar(playerVal);
  const sb = move.sb + 1;
  const c = move.c + 1;
  const target = move.c + 1;
  return `<b>${p}</b> → plateau ${sb}, case ${c} (envoie → plateau ${target})`;
}

function endIfNeeded() {
  if (state.bigWinner === EMPTY) return false;

  if (state.bigWinner === X) series.X++;
  else if (state.bigWinner === O) series.O++;
  else series.D++;

  updateSeriesUI();

  if (state.bigWinner === DRAW) showOverlay("Match nul !");
  else showOverlay(`${vToChar(state.bigWinner)} gagne la partie !`);

  persist();
  return true;
}

function computeSuggestions() {
  if (!elAnalysis.checked) return { top: [], map: null };

  // whose best moves to show?
  // In HVA show human-turn suggestions (help) OR AI-turn suggestions? We'll show current player suggestions.
  const aiSymbol = vToChar(state.turn); // suggest for current player
  const top = getTopMoves(state, aiSymbol, elAiType.value, elDifficulty.value, Number(elAiTimeLimit.value), 3);

  // normalize into heatmap alpha: higher is stronger
  const map = new Map();
  if (top.length) {
    // rank-based alpha: 1st 1.0, 2nd 0.6, 3rd 0.35
    const alphas = [1.0, 0.6, 0.35];
    top.forEach((t, i) => map.set(`${t.move.sb},${t.move.c}`, alphas[i] ?? 0.25));
  }
  return { top, map };
}

function rerender() {
  const { top, map } = computeSuggestions();
  render(state, prevState, elBoard, map);
  prevState = cloneState(state);
  setStatus();
  updateTopMovesUI(top);
}

function resetGame(keepSettings = true) {
  stopReplay();
  hideOverlay();
  state = createInitialState();
  prevState = null;
  past = [];
  future = [];
  moveList = [];
  log = [];
  updateLogUI();
  setAiStatsEmpty();

  state.turn = X;

  if (!keepSettings) {
    series = { X: 0, O: 0, D: 0 };
    updateSeriesUI();
    applySettings({ mode: "hva", human: "X", aiType: "minimax", diff: "medium", time: 250, speed: 1, paused: false, analysis: false }, false);
  }

  buildBoardDOM(elBoard, onClick);
  rerender();
  persist();
  maybeAutoPlay();
}

function canHumanPlay(playerVal) {
  const mode = elMode.value;
  if (mode === "ava") return false;
  if (mode === "hvh") return true;
  const humanVal = symToVal(elHumanSymbol.value);
  return playerVal === humanVal;
}

function explainIllegal(reason) {
  if (reason === "wrong_board") showToast(`Tu dois jouer dans le plateau #${state.activeBoard + 1}.`);
  else if (reason === "cell_taken") showToast("Case déjà prise.");
  else if (reason === "board_resolved") showToast("Ce plateau est déjà terminé.");
}

function onClick(sb, c) {
  if (busy || replayStates) return;
  if (state.bigWinner !== EMPTY) return;

  const playerVal = state.turn;
  if (!canHumanPlay(playerVal)) return;

  pushPast();
  const move = { sb, c };
  const res = applyMove(state, move, playerVal);
  if (!res.ok) {
    past.pop();
    explainIllegal(res.reason);
    return;
  }

  const playerSym = vToChar(playerVal);
  moveList.push({ sb, c, player: playerSym });
  log.push(recordMoveText(move, playerVal));
  updateLogUI();

  rerender();
  if (endIfNeeded()) return;

  persist();
  maybeAutoPlay();
}

function aiSymbolForTurn() {
  const mode = elMode.value;

  if (mode === "ava") return vToChar(state.turn);

  if (mode === "hva") {
    const human = elHumanSymbol.value;
    return otherSym(human);
  }
  return null;
}

async function aiPlayOneTurn(aiSymbol) {
  const aiType = elAiType.value;
  const timeLimitMs = Number(elAiTimeLimit.value);

  const { move, stats } = chooseAiMoveWithStats(
    state,
    aiSymbol,
    aiType,
    elDifficulty.value,
    timeLimitMs
  );

  if (!move) return;

  const playerVal = state.turn;
  pushPast();
  const res = applyMove(state, move, playerVal);
  if (!res.ok) { past.pop(); return; }

  const playerSym = vToChar(playerVal);
  moveList.push({ sb: move.sb, c: move.c, player: playerSym });
  log.push(recordMoveText(move, playerVal));
  updateLogUI();

  elAiMove.textContent = `plateau ${move.sb + 1}, case ${move.c + 1}`;
  elAiTime.textContent = stats.ms ? `${stats.ms.toFixed(1)} ms` : "—";
  elAiDepth.textContent = stats.depth ? String(stats.depth) : "—";
  elAiNodes.textContent = stats.nodes ? String(stats.nodes) : "—";
  elAiCache.textContent = stats.ttSize ? `${stats.ttHits} hits / ${stats.ttSize}` : "—";
}

async function maybeAutoPlay() {
  if (paused) return;
  if (busy || replayStates) return;
  if (state.bigWinner !== EMPTY) return;

  const mode = elMode.value;
  if (mode === "hvh") return;

  const aiSym = aiSymbolForTurn();
  if (!aiSym) return;

  if (mode === "hva") {
    const humanVal = symToVal(elHumanSymbol.value);
    if (state.turn === humanVal) return;
  }

  busy = true;
  setStatus();

  const speed = Number(elSpeed.value) || 1;
  const delay = Math.max(10, Math.floor(120 / speed));
  await new Promise(r => setTimeout(r, delay));

  await aiPlayOneTurn(aiSym);

  rerender();
  const ended = endIfNeeded();

  busy = false;
  setStatus();

  persist();

  if (!ended && mode === "ava") {
    setTimeout(() => maybeAutoPlay(), 0);
  }
}

// Undo/Redo
function undo() {
  if (busy || replayStates) return;
  if (!past.length) return;
  future.push(snapshot());
  const snap = past.pop();
  restoreSnap(snap);
  persist();
}
function redo() {
  if (busy || replayStates) return;
  if (!future.length) return;
  past.push(snapshot());
  const snap = future.pop();
  restoreSnap(snap);
  persist();
  maybeAutoPlay();
}

// Pause/Play
function togglePause() {
  paused = !paused;
  elPlayPause.textContent = paused ? "Play" : "Pause";
  persist();
  if (!paused) maybeAutoPlay();
}

// Replay
function startReplay() {
  if (!moveList.length) { showToast("Aucun coup à rejouer."); return; }
  stopReplay();
  replayStates = buildReplay(moveList);
  replayIndex = 0;
  state = cloneState(replayStates[replayIndex]);
  prevState = null;
  rerender();
  showToast("Replay: mode lecture (les clics sont bloqués).");
}
function stopReplay() {
  if (replayTimer) { clearInterval(replayTimer); replayTimer = null; }
  elReplayPlay.textContent = "▶";
  replayStates = null;
}
function replayGo(i) {
  if (!replayStates) startReplay();
  if (!replayStates) return;
  replayIndex = Math.max(0, Math.min(replayStates.length - 1, i));
  state = cloneState(replayStates[replayIndex]);
  prevState = null;
  rerender();
}
function replayPlayToggle() {
  if (!replayStates) startReplay();
  if (!replayStates) return;

  if (replayTimer) {
    clearInterval(replayTimer);
    replayTimer = null;
    elReplayPlay.textContent = "▶";
    return;
  }
  elReplayPlay.textContent = "⏸";
  const speed = Number(elSpeed.value) || 1;
  const stepMs = Math.max(40, Math.floor(220 / speed));

  replayTimer = setInterval(() => {
    if (!replayStates) return;
    if (replayIndex >= replayStates.length - 1) {
      replayPlayToggle();
      return;
    }
    replayGo(replayIndex + 1);
  }, stepMs);
}

// Export/Import
function exportGame() {
  const payload = { snap: snapshot() };
  const code = encodeShare(payload);
  elShare.value = code;
  elShare.select();
  showToast("Code exporté.");
}
function importGame() {
  try {
    const payload = decodeShare(elShare.value);
    if (!payload?.snap) throw new Error("bad");
    restoreSnap(payload.snap);
    persist();
    showToast("Partie importée.");
  } catch {
    showToast("Code invalide.");
  }
}

// Simulation IA vs IA
async function simulateGames(n) {
  if (busy || replayStates) return;
  showToast(`Simulation ${n}…`);
  const savedSeries = { ...series };
  const savedSettings = getSettings();

  // Force AVA during simulation (no UI changes persisted)
  const mode = elMode.value;
  elMode.value = "ava";

  let winsX = 0, winsO = 0, draws = 0;
  for (let i = 0; i < n; i++) {
    let s = createInitialState();
    s.turn = X;

    while (s.bigWinner === EMPTY) {
      const aiSym = vToChar(s.turn);
      const { move } = chooseAiMoveWithStats(s, aiSym, elAiType.value, elDifficulty.value, Number(elAiTimeLimit.value));
      if (!move) break;
      applyMove(s, move, s.turn);
    }
    if (s.bigWinner === X) winsX++;
    else if (s.bigWinner === O) winsO++;
    else draws++;
  }

  // restore
  elMode.value = mode;
  series = savedSeries;
  applySettings(savedSettings, false);
  updateSeriesUI();

  showToast(`Résultat: X ${winsX} • O ${winsO} • = ${draws}`);
}

// Keyboard shortcuts
window.addEventListener("keydown", (e) => {
  const tag = e.target?.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  const k = e.key.toLowerCase();
  if (k === "u") undo();
  if (k === "r") redo();
  if (k === "n") resetGame(true);
  if (k === " ") { e.preventDefault(); togglePause(); }
});

// Events
elRestart.addEventListener("click", () => resetGame(true));
elResetAll.addEventListener("click", () => resetGame(false));
elOverlayRestart.addEventListener("click", () => resetGame(true));

elUndo.addEventListener("click", undo);
elRedo.addEventListener("click", redo);
elPlayPause.addEventListener("click", togglePause);

elMode.addEventListener("change", () => { resetGame(true); persist(); });
elHumanSymbol.addEventListener("change", () => { resetGame(true); persist(); });
elAiType.addEventListener("change", () => { currentPlayersInfo(); setStatus(); persist(); });
elDifficulty.addEventListener("change", () => { currentPlayersInfo(); setStatus(); persist(); });
elSpeed.addEventListener("change", () => { persist(); });

elAiTimeLimit.addEventListener("input", () => {
  elAiTimeLimitLabel.textContent = String(elAiTimeLimit.value);
  persist();
});

elAnalysis.addEventListener("change", () => rerender());

// Replay buttons
elReplayStart.addEventListener("click", () => replayGo(0));
elReplayPrev.addEventListener("click", () => replayGo(replayIndex - 1));
elReplayNext.addEventListener("click", () => replayGo(replayIndex + 1));
elReplayEnd.addEventListener("click", () => replayGo((replayStates?.length ?? 1) - 1));
elReplayPlay.addEventListener("click", replayPlayToggle);

// Start replay automatically when user clicks first time on replay controls? (optional)
elReplayStart.addEventListener("dblclick", startReplay);

// Simulate
elSim100.addEventListener("click", () => simulateGames(100));
elSim1000.addEventListener("click", () => simulateGames(1000));

// Export/Import
elExport.addEventListener("click", exportGame);
elImport.addEventListener("click", importGame);
elClearSave.addEventListener("click", () => { clearLocal(); showToast("Sauvegarde effacée."); });

// Init
buildBoardDOM(elBoard, onClick);
updateSeriesUI();

// load saved session if exists
if (!loadPersisted()) {
  resetGame(true);
} else {
  showToast("Sauvegarde restaurée.");
  maybeAutoPlay();
}