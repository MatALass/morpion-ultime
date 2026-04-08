// storage.js
const KEY = "ultimate-ttt-save-v1";
const ONLINE_KEY = "ultimate-ttt-online-v1";

export function saveToLocal(payload) {
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {}
}

export function loadFromLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
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
    const raw = localStorage.getItem(ONLINE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    return {
      roomId: String(parsed.roomId ?? "").trim().toUpperCase(),
      playerToken: String(parsed.playerToken ?? "").trim(),
      playerSymbol: String(parsed.playerSymbol ?? "").trim().toUpperCase(),
      myPseudo: String(parsed.myPseudo ?? "").trim(),
      opponentPseudo: String(parsed.opponentPseudo ?? "").trim(),
      moveList: Array.isArray(parsed.moveList)
        ? parsed.moveList
            .filter((move) => move && typeof move.sb === "number" && typeof move.c === "number" && ["X", "O"].includes(String(move.player ?? "").toUpperCase()))
            .map((move) => ({
              sb: move.sb,
              c: move.c,
              player: String(move.player).toUpperCase(),
              pseudo: String(move.pseudo ?? "").trim(),
            }))
        : [],
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
