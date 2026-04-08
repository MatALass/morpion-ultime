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

function normalizePresenceMember(member) {
  return {
    clientId: member?.clientId ?? "",
    symbol: member?.data?.symbol ?? "",
    pseudo: String(member?.data?.pseudo ?? "").trim(),
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

    this.onMove = null;
    this.onPresence = null;
    this.onError = null;
  }

  async _getPresenceMembers() {
    return await new Promise((resolve, reject) => {
      this._channel.presence.get((err, members) => {
        if (err) {
          reject(new Error(err?.message ?? "Failed to fetch presence"));
          return;
        }
        resolve(Array.isArray(members) ? members : []);
      });
    });
  }

  async _emitPresenceSnapshot(reason = "snapshot") {
    if (!this._channel) return;

    try {
      const members = (await this._getPresenceMembers()).map(normalizePresenceMember);
      const opponentSymbol = this.playerSymbol === "X" ? "O" : "X";
      const meClientId = `${this.roomId}:${this.playerSymbol}:${this.playerToken}`;
      const opponent =
        members.find((member) => member.symbol === opponentSymbol && member.clientId !== meClientId) ?? null;

      this.onPresence?.({
        type: "snapshot",
        reason,
        count: members.length,
        opponentPresent: Boolean(opponent),
        opponentPseudo: opponent?.pseudo ?? "",
        opponentSymbol,
        members,
      });
    } catch (err) {
      this.onError?.(err);
    }
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
      if (!symbol || !move) return;
      if (symbol === this.playerSymbol) return;
      this.onMove?.({ symbol, move });
    });

    await this._channel.presence.enter({
      symbol: this.playerSymbol,
      pseudo: this.myPseudo,
    });

    this._channel.presence.subscribe((presenceMessage) => {
      const member = normalizePresenceMember(presenceMessage);
      const isSelf = member.symbol === this.playerSymbol && member.clientId === `${this.roomId}:${this.playerSymbol}:${this.playerToken}`;
      const eventType = String(presenceMessage?.action ?? "").toLowerCase();

      if (!isSelf) {
        this.onPresence?.({
          type: "event",
          event: eventType,
          symbol: member.symbol,
          pseudo: member.pseudo,
          clientId: member.clientId,
        });
      }

      this._emitPresenceSnapshot(eventType || "event");
    });

    this._connected = true;
    this._emitPresenceSnapshot("connect");
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
        this._channel.presence.leave();
      } catch {}
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

export async function createRoom(pseudo) {
  return postRoomAction({
    action: "create",
    pseudo,
  });
}

export async function joinRoom(roomId, pseudo) {
  return postRoomAction({
    action: "join",
    roomId,
    pseudo,
  });
}

export async function reconnectRoom(roomId, playerToken, playerSymbol) {
  return postRoomAction({
    action: "reconnect",
    roomId,
    playerToken,
    playerSymbol,
  });
}
