// online.js
// Manages the Ably real-time connection for online duel mode.

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

function normalizePresenceMessage(msg) {
  const action = msg?.action ?? "present";
  const member = msg?.clientId ? msg : msg?.member ?? null;
  const data = member?.data ?? msg?.data ?? {};

  return {
    action,
    clientId: member?.clientId ?? msg?.clientId ?? "",
    symbol: data?.symbol ?? "",
    pseudo: data?.pseudo ?? "",
  };
}

export class OnlineSession {
  /**
   * @param {object} opts
   * @param {string} opts.roomId
   * @param {string} opts.playerToken
   * @param {"X"|"O"} opts.playerSymbol
   * @param {object} opts.ablyTokenRequest
   * @param {string} [opts.myPseudo]
   */
  constructor({ roomId, playerToken, playerSymbol, ablyTokenRequest, myPseudo = "Joueur" }) {
    this.roomId = roomId;
    this.playerToken = playerToken;
    this.playerSymbol = playerSymbol;
    this.ablyTokenRequest = ablyTokenRequest;
    this.myPseudo = myPseudo;

    this._client = null;
    this._channel = null;
    this._connected = false;
    this._presenceListener = null;

    this.onMove = null;
    this.onPresence = null;
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

    this._channel.subscribe("move", (msg) => {
      const { symbol, move } = msg.data ?? {};
      if (symbol === this.playerSymbol) return;
      this.onMove?.({ symbol, move });
    });

    const emitPresenceSnapshot = () => {
      this._channel.presence.get((err, members) => {
        if (err) {
          this.onError?.(new Error(err?.message ?? "Presence lookup failed"));
          return;
        }

        const membersList = Array.isArray(members) ? members : [];
        const opponents = membersList
          .map((member) => normalizePresenceMessage(member))
          .filter((member) => member.symbol && member.symbol !== this.playerSymbol);
        const opponent = opponents[0] ?? null;

        this.onPresence?.({
          type: "snapshot",
          count: membersList.length,
          members: membersList.map((member) => normalizePresenceMessage(member)),
          opponentPresent: Boolean(opponent),
          opponentPseudo: opponent?.pseudo ?? "",
          opponentSymbol: opponent?.symbol ?? (this.playerSymbol === "X" ? "O" : "X"),
        });
      });
    };

    this._presenceListener = (msg) => {
      const event = normalizePresenceMessage(msg);
      const isOpponent = Boolean(event.symbol) && event.symbol !== this.playerSymbol;

      this.onPresence?.({
        type: "event",
        event,
        isOpponent,
      });

      emitPresenceSnapshot();
    };

    this._channel.presence.subscribe(this._presenceListener);

    await this._channel.presence.enter({
      symbol: this.playerSymbol,
      pseudo: this.myPseudo,
    });

    emitPresenceSnapshot();
    this._connected = true;
  }

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
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Move rejected");
    } catch (err) {
      this.onError?.(err);
      throw err;
    }
  }

  disconnect() {
    if (this._channel) {
      try {
        this._channel.presence.leave({
          symbol: this.playerSymbol,
          pseudo: this.myPseudo,
        });
      } catch {}
      if (this._presenceListener) {
        try {
          this._channel.presence.unsubscribe(this._presenceListener);
        } catch {}
      }
      this._channel.unsubscribe();
    }

    if (this._client) {
      this._client.close();
    }

    this._connected = false;
    this._channel = null;
    this._client = null;
    this._presenceListener = null;
  }

  get isConnected() {
    return this._connected;
  }
}

async function postRoomAction(body) {
  const res = await fetch("/api/room", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error ?? "Request failed");
  return data;
}

export async function createRoom() {
  return postRoomAction({ action: "create" });
}

export async function joinRoom(roomId) {
  return postRoomAction({ action: "join", roomId });
}

export async function reconnectRoom(roomId, playerToken, playerSymbol) {
  return postRoomAction({
    action: "reconnect",
    roomId,
    playerToken,
    playerSymbol,
  });
}
