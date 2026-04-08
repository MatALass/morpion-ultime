// api/room.js — Vercel Serverless Function (CommonJS)
const Ably = require("ably");
const { randomBytes } = require("crypto");

const ROOM_TTL_MS = 10 * 60 * 1000;

function genId(n = 6) {
  return randomBytes(n).toString("hex").toUpperCase().slice(0, n);
}

function toRoomId(value) {
  return String(value ?? "").trim().toUpperCase();
}

function isExpired(meta) {
  return !meta?.createdAt || Date.now() - meta.createdAt > ROOM_TTL_MS;
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

async function buildTokenRequest(ably, roomId, playerSymbol, playerToken) {
  return ably.auth.createTokenRequest({
    clientId: `${roomId}:${playerSymbol}:${playerToken}`,
    capability: {
      [`room:${roomId}`]: ["publish", "subscribe", "presence"],
      [`room-meta:${roomId}`]: ["subscribe"],
    },
  });
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    action,
    roomId: requestedRoom,
    playerToken,
    playerSymbol,
  } = req.body ?? {};

  if (!process.env.ABLY_API_KEY) {
    return res.status(500).json({ error: "ABLY_API_KEY not configured" });
  }

  const ably = new Ably.Rest(process.env.ABLY_API_KEY);

  if (action === "create") {
    const roomId = genId(6);
    const hostToken = genId(16);

    const meta = {
      roomId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      hostToken,
      guestToken: null,
    };

    await writeRoomMeta(ably, roomId, meta);

    return res.status(200).json({
      roomId,
      playerToken: hostToken,
      playerSymbol: "X",
      ablyTokenRequest: await buildTokenRequest(ably, roomId, "X", hostToken),
    });
  }

  if (action === "join") {
    const roomId = toRoomId(requestedRoom);
    if (!roomId) return res.status(400).json({ error: "roomId required" });

    const meta = await readRoomMeta(ably, roomId);
    if (!meta) return res.status(404).json({ error: "Room not found" });
    if (isExpired(meta)) return res.status(410).json({ error: "Room expired" });
    if (meta.guestToken) return res.status(409).json({ error: "Room already full" });

    const guestToken = genId(16);
    const nextMeta = {
      ...meta,
      guestToken,
      updatedAt: Date.now(),
    };

    await writeRoomMeta(ably, roomId, nextMeta);

    return res.status(200).json({
      roomId,
      playerToken: guestToken,
      playerSymbol: "O",
      ablyTokenRequest: await buildTokenRequest(ably, roomId, "O", guestToken),
    });
  }

  if (action === "reconnect") {
    const roomId = toRoomId(requestedRoom);
    if (!roomId || !playerToken || !playerSymbol) {
      return res.status(400).json({ error: "roomId, playerToken and playerSymbol are required" });
    }
    if (!["X", "O"].includes(playerSymbol)) {
      return res.status(400).json({ error: "Invalid symbol" });
    }

    const meta = await readRoomMeta(ably, roomId);
    if (!meta) return res.status(404).json({ error: "Room not found" });
    if (isExpired(meta)) return res.status(410).json({ error: "Room expired" });

    const expectedToken = playerSymbol === "X" ? meta.hostToken : meta.guestToken;
    if (!expectedToken || expectedToken !== playerToken) {
      return res.status(403).json({ error: "Invalid token" });
    }

    return res.status(200).json({
      roomId,
      playerToken,
      playerSymbol,
      ablyTokenRequest: await buildTokenRequest(ably, roomId, playerSymbol, playerToken),
    });
  }

  return res.status(400).json({ error: "Invalid action" });
};
