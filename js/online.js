// online.js
// Manages the Ably real-time connection for online duel mode.
//
// Usage:
//   import { OnlineSession } from "./online.js";
//   const session = new OnlineSession({ roomId, playerToken, playerSymbol, ablyTokenRequest });
//   await session.connect();
//   session.onMove = ({ symbol, move }) => { ... };  // called when opponent plays
//   session.onPresence = ({ count }) => { ... };     // called when opponent joins/leaves
//   await session.sendMove({ sb, c });
//   session.disconnect();

const ABLY_CDN = "https://cdn.ably.com/lib/ably.min-2.js";

async function loadAbly() {
  if (window.Ably) return window.Ably;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = ABLY_CDN;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Failed to load Ably SDK"));
    document.head.appendChild(s);
  });
  return window.Ably;
}

export class OnlineSession {
  /**
   * @param {object} opts
   * @param {string} opts.roomId
   * @param {string} opts.playerToken
   * @param {"X"|"O"} opts.playerSymbol
   * @param {object} opts.ablyTokenRequest  — signed token request from /api/room
   */
  constructor({ roomId, playerToken, playerSymbol, ablyTokenRequest }) {
    this.roomId = roomId;
    this.playerToken = playerToken;
    this.playerSymbol = playerSymbol;
    this.ablyTokenRequest = ablyTokenRequest;

    this._client = null;
    this._channel = null;
    this._connected = false;

    // Callbacks — assign these after construction
    /** @type {((payload: {symbol: string, move: {sb:number, c:number}}) => void) | null} */
    this.onMove = null;
    /** @type {((payload: {count: number, opponentPresent: boolean}) => void) | null} */
    this.onPresence = null;
    /** @type {((err: Error) => void) | null} */
    this.onError = null;
  }

  async connect() {
    const Ably = await loadAbly();

    this._client = new Ably.Realtime({
      authCallback: (_tokenParams, callback) => {
        callback(null, this.ablyTokenRequest);
      },
      clientId: `${this.roomId}:${this.playerSymbol}:${this.playerToken}`,
    });

    await new Promise((resolve, reject) => {
      this._client.connection.once("connected", resolve);
      this._client.connection.once("failed", (err) => reject(new Error(err?.message ?? "Connection failed")));
    });

    this._channel = this._client.channels.get(`room:${this.roomId}`);

    // Subscribe to moves from the opponent
    this._channel.subscribe("move", (msg) => {
      const { symbol, move } = msg.data;
      // Ignore our own echoed moves
      if (symbol === this.playerSymbol) return;
      this.onMove?.({ symbol, move });
    });

    // Presence — track when opponent joins/leaves
    await this._channel.presence.enter({ symbol: this.playerSymbol });

    this._channel.presence.subscribe(() => {
      this._channel.presence.get((err, members) => {
        if (err) return;
        const count = members?.length ?? 0;
        const opponentSymbol = this.playerSymbol === "X" ? "O" : "X";
        const opponentPresent = members?.some((m) => m.data?.symbol === opponentSymbol) ?? false;
        this.onPresence?.({ count, opponentPresent });
      });
    });

    this._connected = true;
  }

  /**
   * Send our move to the server for validation + relay.
   * Falls back to direct Ably publish if the API call fails (dev convenience).
   * @param {{sb: number, c: number}} move
   */
  async sendMove(move) {
    if (!this._connected) throw new Error("Not connected");

    try {
      const res = await fetch("/api/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: this.roomId,
          playerToken: this.playerToken,
          playerSymbol: this.playerSymbol,
          move,
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Move rejected");
    } catch (err) {
      this.onError?.(err);
      throw err;
    }
  }

  disconnect() {
    if (this._channel) {
      try { this._channel.presence.leave(); } catch {}
      this._channel.unsubscribe();
    }
    if (this._client) {
      this._client.close();
    }
    this._connected = false;
    this._channel = null;
    this._client = null;
  }

  get isConnected() {
    return this._connected;
  }
}

/**
 * Create a new room via /api/room.
 * @returns {Promise<{roomId, playerToken, playerSymbol, ablyTokenRequest}>}
 */
export async function createRoom() {
  const res = await fetch("/api/room", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create" }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

/**
 * Join an existing room via /api/room.
 * @param {string} roomId
 * @returns {Promise<{roomId, playerToken, playerSymbol, ablyTokenRequest}>}
 */
export async function joinRoom(roomId) {
  const res = await fetch("/api/room", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "join", roomId }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}
