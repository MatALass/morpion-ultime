// api/move.js — Vercel Serverless Function (CommonJS)
const Ably = require("ably");

const ROOM_TTL_MS = 10 * 60 * 1000;

function toRoomId(value) {
  return String(value ?? "").trim().toUpperCase();
}

function lastActivityAt(meta) {
  return Number(meta?.updatedAt ?? meta?.createdAt ?? 0);
}

function isExpired(meta) {
  return !lastActivityAt(meta) || Date.now() - lastActivityAt(meta) > ROOM_TTL_MS;
}

async function readRoomMeta(ably, roomId) {
  const metaChannel = ably.channels.get(`room-meta:${roomId}`);
  let history;

  try {
    history = await metaChannel.history({ limit: 50 });
  } catch {
    return null;
  }

  const stateItem = history.items.find((item) => item.name === "state" && item.data?.roomId === roomId);
  return stateItem?.data ?? null;
}

async function writeRoomMeta(ably, roomId, meta) {
  const metaChannel = ably.channels.get(`room-meta:${roomId}`);
  await metaChannel.publish("state", meta);
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const rawRoomId = req.body?.roomId;
  const roomId = toRoomId(rawRoomId);
  const { playerToken, playerSymbol, move } = req.body ?? {};

  if (!roomId || !playerToken || !playerSymbol || !move) {
    return res.status(400).json({ error: "Missing fields" });
  }
  if (!["X", "O"].includes(playerSymbol)) {
    return res.status(400).json({ error: "Invalid symbol" });
  }
  if (typeof move.sb !== "number" || typeof move.c !== "number") {
    return res.status(400).json({ error: "Invalid move shape" });
  }
  if (move.sb < 0 || move.sb > 8 || move.c < 0 || move.c > 8) {
    return res.status(400).json({ error: "Move out of bounds" });
  }

  if (!process.env.ABLY_API_KEY) {
    return res.status(500).json({ error: "ABLY_API_KEY not configured" });
  }

  const ably = new Ably.Rest(process.env.ABLY_API_KEY);
  const meta = await readRoomMeta(ably, roomId);

  if (!meta) {
    return res.status(404).json({ error: "Room not found" });
  }
  if (isExpired(meta)) {
    return res.status(410).json({ error: "Room expired" });
  }

  const expectedToken = playerSymbol === "X" ? meta.hostToken : meta.guestToken;
  if (!expectedToken || expectedToken !== playerToken) {
    return res.status(403).json({ error: "Invalid token" });
  }

  const roomChannel = ably.channels.get(`room:${roomId}`);
  await roomChannel.publish("move", {
    symbol: playerSymbol,
    move: { sb: move.sb, c: move.c },
    ts: Date.now(),
  });

  await writeRoomMeta(ably, roomId, {
    ...meta,
    updatedAt: Date.now(),
  });

  return res.status(200).json({ ok: true });
};
