"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../../shared/types";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

function socketUrl(): string {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
    return window.location.origin;
  }
  return "http://localhost:3001";
}

export function getSocket(): GameSocket {
  if (socket) return socket;
  socket = io(socketUrl(), {
    autoConnect: true,
    transports: ["websocket", "polling"],
  });
  return socket;
}
