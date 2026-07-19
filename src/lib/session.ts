const KEY = "gaming-government.seats";

export type StoredSeat = {
  code: string;
  seatToken: string;
  playerId: string;
  name: string;
};

function readAll(): Record<string, StoredSeat> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, StoredSeat>;
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, StoredSeat>): void {
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function saveSeat(seat: StoredSeat): void {
  const map = readAll();
  map[seat.code.toUpperCase()] = { ...seat, code: seat.code.toUpperCase() };
  writeAll(map);
}

export function getSeat(code: string): StoredSeat | null {
  return readAll()[code.toUpperCase()] ?? null;
}

export function listSeats(): StoredSeat[] {
  return Object.values(readAll()).sort((a, b) => a.code.localeCompare(b.code));
}

export function clearSeat(code: string): void {
  const map = readAll();
  delete map[code.toUpperCase()];
  writeAll(map);
}
