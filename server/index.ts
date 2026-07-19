import { createServer } from "node:http";
import { customAlphabet } from "nanoid";
import { Server } from "socket.io";
import {
  addLog,
  adjustScore,
  castVote,
  createEmptyChamber,
  makeId,
  normalizeChamber,
  editProposal,
  openRollCall,
  postCloakroomMessage,
  postFloorMessage,
  setPassThreshold,
  setWinThreshold,
  startSession,
  submitProposal,
  toPublicChamber,
} from "../shared/game-logic";
import type {
  ActionAck,
  Chamber,
  ClientToServerEvents,
  JoinAck,
  Player,
  ServerToClientEvents,
} from "../shared/types";
import { chamberExists, loadChamber, saveChamber } from "./store";

const PORT = Number(process.env.SOCKET_PORT ?? 3001);
const ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";
const roomCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

const chambers = new Map<string, Chamber>();
/** socket.id -> { code, playerId } */
const sockets = new Map<string, { code: string; playerId: string }>();

async function getChamber(code: string): Promise<Chamber | null> {
  const key = code.toUpperCase();
  const cached = chambers.get(key);
  if (cached) return cached;
  const loaded = await loadChamber(key);
  if (loaded) {
    const normalized = normalizeChamber(loaded);
    chambers.set(key, normalized);
    return normalized;
  }
  return null;
}

async function persist(chamber: Chamber): Promise<void> {
  chamber.updatedAt = new Date().toISOString();
  chambers.set(chamber.code, chamber);
  await saveChamber(chamber);
}

function emitChamber(io: Server, chamber: Chamber): void {
  for (const [socketId, ref] of sockets) {
    if (ref.code !== chamber.code) continue;
    io.to(socketId).emit("chamber_update", toPublicChamber(chamber, ref.playerId));
  }
}

function makePlayer(name: string): Player {
  return {
    id: makeId("leg"),
    name: name.trim(),
    score: 0,
    connected: true,
    seatToken: makeId("seat"),
  };
}

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "gaming-government-chamber" }));
});

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: ORIGIN, methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  socket.on("create_chamber", async (payload, ack) => {
    try {
      const hostName = payload.hostName?.trim();
      const title = payload.title?.trim() || "Standing Session";
      if (!hostName) {
        ack({ ok: false, error: "Please enter your name." });
        return;
      }

      let code = roomCode();
      while (chambers.has(code) || (await chamberExists(code))) {
        code = roomCode();
      }

      const host = makePlayer(hostName);
      const chamber = createEmptyChamber(code, title, host);
      await persist(chamber);

      sockets.set(socket.id, { code: chamber.code, playerId: host.id });
      await socket.join(chamber.code);

      const response: JoinAck = {
        ok: true,
        chamber: toPublicChamber(chamber, host.id),
        seatToken: host.seatToken,
        playerId: host.id,
      };
      ack(response);
      socket.emit("personal", { seatToken: host.seatToken, playerId: host.id });
    } catch (err) {
      console.error(err);
      ack({ ok: false, error: "Could not convene the chamber." });
    }
  });

  socket.on("join_chamber", async (payload, ack) => {
    try {
      const code = payload.code?.trim().toUpperCase();
      const name = payload.name?.trim();
      if (!code || !name) {
        ack({ ok: false, error: "Chamber code and name are required." });
        return;
      }

      const chamber = await getChamber(code);
      if (!chamber) {
        ack({ ok: false, error: "No chamber found with that code." });
        return;
      }
      if (chamber.phase === "finished") {
        ack({ ok: false, error: "This session has already adjourned sine die." });
        return;
      }
      if (chamber.phase !== "lobby") {
        ack({
          ok: false,
          error:
            "Session already in progress. Use your Credentials of Office to reconvene.",
        });
        return;
      }
      if (chamber.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        ack({
          ok: false,
          error: "That name is taken. Choose another, or resume with your credentials.",
        });
        return;
      }

      const player = makePlayer(name);
      chamber.players.push(player);
      addLog(chamber, `${player.name} took a seat in the chamber.`);
      await persist(chamber);

      sockets.set(socket.id, { code: chamber.code, playerId: player.id });
      await socket.join(chamber.code);

      ack({
        ok: true,
        chamber: toPublicChamber(chamber, player.id),
        seatToken: player.seatToken,
        playerId: player.id,
      });
      socket.emit("personal", { seatToken: player.seatToken, playerId: player.id });
      emitChamber(io, chamber);
    } catch (err) {
      console.error(err);
      ack({ ok: false, error: "Could not join the chamber." });
    }
  });

  socket.on("resume_seat", async (payload, ack) => {
    try {
      const code = payload.code?.trim().toUpperCase();
      const seatToken = payload.seatToken?.trim();
      if (!code || !seatToken) {
        ack({ ok: false, error: "Chamber code and Credentials of Office are required." });
        return;
      }

      const chamber = await getChamber(code);
      if (!chamber) {
        ack({ ok: false, error: "No chamber found with that code." });
        return;
      }

      const player = chamber.players.find((p) => p.seatToken === seatToken);
      if (!player) {
        ack({ ok: false, error: "Those credentials do not match any seat." });
        return;
      }

      player.connected = true;
      addLog(chamber, `${player.name} reconvened after recess.`);
      await persist(chamber);

      sockets.set(socket.id, { code: chamber.code, playerId: player.id });
      await socket.join(chamber.code);

      ack({
        ok: true,
        chamber: toPublicChamber(chamber, player.id),
        seatToken: player.seatToken,
        playerId: player.id,
      });
      socket.emit("personal", { seatToken: player.seatToken, playerId: player.id });
      emitChamber(io, chamber);
    } catch (err) {
      console.error(err);
      ack({ ok: false, error: "Could not resume your seat." });
    }
  });

  const withSeat = async (
    code: string,
    ack: (res: ActionAck) => void,
    fn: (chamber: Chamber, player: Player) => string | null | Promise<string | null>,
  ) => {
    try {
      const ref = sockets.get(socket.id);
      const chamber = await getChamber(code);
      if (!ref || !chamber || ref.code !== chamber.code) {
        ack({ ok: false, error: "You are not seated in this chamber." });
        return;
      }
      const player = chamber.players.find((p) => p.id === ref.playerId);
      if (!player) {
        ack({ ok: false, error: "Seat not found." });
        return;
      }
      const error = await fn(chamber, player);
      if (error) {
        ack({ ok: false, error });
        return;
      }
      await persist(chamber);
      emitChamber(io, chamber);
      ack({ ok: true });
    } catch (err) {
      console.error(err);
      ack({ ok: false, error: "Procedure failed." });
    }
  };

  socket.on("start_session", (payload, ack) => {
    void withSeat(payload.code, ack, (chamber, player) => {
      if (player.id !== chamber.hostId) {
        return "Only the host may gavel the session open.";
      }
      return startSession(chamber);
    });
  });

  socket.on("submit_proposal", (payload, ack) => {
    void withSeat(payload.code, ack, (chamber, player) =>
      submitProposal(chamber, player.id, {
        type: payload.type,
        title: payload.title,
        text: payload.text,
        targetRuleNumber: payload.targetRuleNumber,
        makeMutable: payload.makeMutable,
      }),
    );
  });

  socket.on("open_roll_call", (payload, ack) => {
    void withSeat(payload.code, ack, (chamber, player) =>
      openRollCall(chamber, player.id),
    );
  });

  socket.on("edit_proposal", (payload, ack) => {
    void withSeat(payload.code, ack, (chamber, player) =>
      editProposal(chamber, player.id, {
        title: payload.title,
        text: payload.text,
        makeMutable: payload.makeMutable,
      }),
    );
  });

  socket.on("cast_vote", (payload, ack) => {
    void withSeat(payload.code, ack, (chamber, player) =>
      castVote(chamber, player.id, payload.choice),
    );
  });

  socket.on("adjust_score", (payload, ack) => {
    void withSeat(payload.code, ack, (chamber, player) =>
      adjustScore(chamber, player.id, payload.playerId, payload.delta),
    );
  });

  socket.on("set_win_threshold", (payload, ack) => {
    void withSeat(payload.code, ack, (chamber, player) =>
      setWinThreshold(chamber, player.id, payload.value),
    );
  });

  socket.on("set_pass_threshold", (payload, ack) => {
    void withSeat(payload.code, ack, (chamber, player) =>
      setPassThreshold(chamber, player.id, payload.value),
    );
  });

  socket.on("floor_message", (payload, ack) => {
    void withSeat(payload.code, ack, (chamber, player) =>
      postFloorMessage(chamber, player, payload.text),
    );
  });

  socket.on("cloakroom_message", (payload, ack) => {
    void withSeat(payload.code, ack, (chamber, player) =>
      postCloakroomMessage(chamber, player, payload.toId, payload.text),
    );
  });

  socket.on("disconnect", () => {
    const ref = sockets.get(socket.id);
    sockets.delete(socket.id);
    if (!ref) return;

    void (async () => {
      const chamber = await getChamber(ref.code);
      if (!chamber) return;
      const stillHere = [...sockets.values()].some(
        (s) => s.code === ref.code && s.playerId === ref.playerId,
      );
      if (stillHere) return;
      const player = chamber.players.find((p) => p.id === ref.playerId);
      if (!player) return;
      player.connected = false;
      addLog(chamber, `${player.name} stepped out (recess). Seat held.`);
      await persist(chamber);
      emitChamber(io, chamber);
    })();
  });
});

httpServer.listen(PORT, () => {
  console.log(`Gaming Government chamber server on :${PORT}`);
});
