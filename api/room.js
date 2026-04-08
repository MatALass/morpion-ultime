// api/room.js — Vercel Serverless Function (CommonJS)
const Ably = require("ably");
const { randomBytes } = require("crypto");

function genId(n = 6) {
  return randomBytes(n).toString("hex").toUpperCase().slice(0, n);
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, roomId: requestedRoom } = req.body ?? {};

  if (!process.env.ABLY_API_KEY) {
    return res.status(500).json({ error: "ABLY_API_KEY not configured" });
  }

  const ably = new Ably.Rest(process.env.ABLY_API_KEY);

  if (action === "create") {
    const roomId = genId(6);
    const playerToken = genId(16);

    const channel = ably.channels.get(`room-meta:${roomId}`);
    await channel.publish("created", {
      roomId,
      hostToken: playerToken,
      createdAt: Date.now(),
    });

    const tokenRequest = await ably.auth.createTokenRequest({
      clientId: `${roomId}:X:${playerToken}`,
      capability: {
        [`room:${roomId}`]: ["publish", "subscribe", "presence"],
        [`room-meta:${roomId}`]: ["subscribe"],
      },
    });

    return res.status(200).json({
      roomId,
      playerToken,
      playerSymbol: "X",
      ablyTokenRequest: tokenRequest,
    });
  }

  if (action === "join") {
    if (!requestedRoom) return res.status(400).json({ error: "roomId required" });

    const roomId = requestedRoom.toUpperCase().trim();
    const playerToken = genId(16);

    const metaChannel = ably.channels.get(`room-meta:${roomId}`);
    let history;
    try {
      history = await metaChannel.history({ limit: 1 });
    } catch {
      return res.status(404).json({ error: "Room not found" });
    }

    if (!history.items.length) {
      return res.status(404).json({ error: "Room not found" });
    }

    const meta = history.items[0].data;
    if (Date.now() - meta.createdAt > 10 * 60 * 1000) {
      return res.status(410).json({ error: "Room expired" });
    }

    const tokenRequest = await ably.auth.createTokenRequest({
      clientId: `${roomId}:O:${playerToken}`,
      capability: {
        [`room:${roomId}`]: ["publish", "subscribe", "presence"],
        [`room-meta:${roomId}`]: ["subscribe"],
      },
    });

    return res.status(200).json({
      roomId,
      playerToken,
      playerSymbol: "O",
      ablyTokenRequest: tokenRequest,
    });
  }

  return res.status(400).json({ error: "Invalid action" });
};
