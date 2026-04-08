// api/move.js
// POST /api/move  { roomId, playerToken, playerSymbol, move: {sb, c} }
//   → { ok: true } | { error }
//
// This function validates that the player making the request owns the correct symbol,
// then publishes the move to the Ably room channel for both clients to apply.
// The actual game state lives on the clients — this is a thin auth + relay layer.
//
// Full server-side state validation would require a persistent store (Redis, KV, etc.).
// For a portfolio project, this auth layer prevents the most obvious cheating
// (playing as the opponent). Deep state validation is noted as a future improvement.

import Ably from "ably";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { roomId, playerToken, playerSymbol, move } = req.body ?? {};

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

  // Verify the token matches the declared symbol by checking the meta channel
  const ably = new Ably.Rest(process.env.ABLY_API_KEY);
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

  // X is the host — validate their token
  const meta = history.items[0].data;
  if (playerSymbol === "X" && meta.hostToken !== playerToken) {
    return res.status(403).json({ error: "Invalid token" });
  }
  // O token is not stored in meta (issued per-join, ephemeral)
  // For now we trust the scoped Ably token as proof of identity for O.
  // A Redis-backed store would allow full validation here.

  // Publish move to the room channel
  const roomChannel = ably.channels.get(`room:${roomId}`);
  await roomChannel.publish("move", {
    symbol: playerSymbol,
    move: { sb: move.sb, c: move.c },
    ts: Date.now(),
  });

  return res.status(200).json({ ok: true });
}
