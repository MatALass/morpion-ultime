// storage.js
const KEY = "ultimate-ttt-save-v1";
const ONLINE_KEY = "ultimate-ttt-online-v1";

function safeParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizeMove(move) {
  if (!move || typeof move !== "object") return null;
  const sb = Number(move.sb);
  const c = Number(move.c);
  const player = move.player === "X" || move.player === "O" ? move.player : null;
  if (!Number.isInteger(sb) || !Number.isInteger(c) || !player) return null;
  if (sb < 0 || sb > 8 || c < 0 || c > 8) return null;
  return {
    sb,
    c,
    player,
    pseudo: String(move.pseudo ?? "").trim(),
  };
}

export function saveToLocal(payload) {
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {}
}

export function loadFromLocal() {
  try {
    return safeParse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function clearLocal() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function encodeShare(payload) {
  return btoa(encodeURIComponent(JSON.stringify(payload)));
}

export function decodeShare(code) {
  return JSON.parse(decodeURIComponent(atob(code.trim())));
}

export function saveOnlineSession(payload) {
  try {
    localStorage.setItem(ONLINE_KEY, JSON.stringify(payload));
  } catch {}
}

export function loadOnlineSession() {
  try {
    const parsed = safeParse(localStorage.getItem(ONLINE_KEY));
    if (!parsed || typeof parsed !== "object") return null;

    const roomId = String(parsed.roomId ?? "").trim().toUpperCase();
    const playerToken = String(parsed.playerToken ?? "").trim();
    const playerSymbol = parsed.playerSymbol === "X" || parsed.playerSymbol === "O" ? parsed.playerSymbol : null;
    if (!roomId || !playerToken || !playerSymbol) return null;

    const moveList = Array.isArray(parsed.moveList)
      ? parsed.moveList.map(normalizeMove).filter(Boolean)
      : [];

    return {
      roomId,
      playerToken,
      playerSymbol,
      myPseudo: String(parsed.myPseudo ?? "").trim() || "Joueur",
      opponentPseudo: String(parsed.opponentPseudo ?? "").trim(),
      moveList,
    };
  } catch {
    return null;
  }
}

export function clearOnlineSession() {
  try {
    localStorage.removeItem(ONLINE_KEY);
  } catch {}
}
