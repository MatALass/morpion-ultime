// storage.js
const KEY = "ultimate-ttt-save-v1";

export function saveToLocal(payload) {
  try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch {}
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
  try { localStorage.removeItem(KEY); } catch {}
}

export function encodeShare(payload) {
  return btoa(encodeURIComponent(JSON.stringify(payload)));
}

export function decodeShare(code) {
  return JSON.parse(decodeURIComponent(atob(code.trim())));
}