"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../../shared/types";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

export function getSocket(): GameSocket {
  if (socket) return socket;
  const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";
  socket = io(url, {
    autoConnect: true,
    transports: ["websocket", "polling"],
  });
  return socket;
}
