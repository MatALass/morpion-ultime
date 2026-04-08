// api/room.js
// POST /api/room  { action: "create" }
//   → { roomId, playerToken, playerSymbol: "X" }
// POST /api/room  { action: "join", roomId }
//   → { roomId, playerToken, playerSymbol: "O" } | { error }
//
// State persisted in Ably channel metadata (presence) — no DB needed.
// Each room is a channel named "room:<roomId>".
// Room state is stored as a small JSON in an Ably key-value store
// via the Ably Control API (channel rules), but the simplest
// stateless approach: we use a shared Ably channel + client-side
// reconciliation, and this function only issues signed tokens.
//
// Required env vars (set in Vercel dashboard):
//   ABLY_API_KEY   — e.g. "xVLRlA.xxxxxx:yyyyyyyyyyyy"

import Ably from "ably";
import { randomBytes } from "crypto";

function genId(n = 6) {
  return randomBytes(n).toString("hex").toUpperCase().slice(0, n);
}

export default async function handler(req, res) {
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

    // Publish room metadata to a control channel so the joiner can verify it exists
    const channel = ably.channels.get(`room-meta:${roomId}`);
    await channel.publish("created", {
      roomId,
      hostToken: playerToken,
      createdAt: Date.now(),
    });

    // Issue a scoped Ably token for this player
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

    // Verify room exists by checking history on the meta channel
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
}
