"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { listSeats, saveSeat, type StoredSeat } from "@/lib/session";
import { getSocket } from "@/lib/socket";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"convene" | "join" | "reconvene">("convene");
  const [title, setTitle] = useState("Standing Session");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [seatToken, setSeatToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<StoredSeat[]>([]);

  useEffect(() => {
    setSaved(listSeats());
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const socket = getSocket();

    const finish = (res: {
      ok: boolean;
      error?: string;
      chamber?: { code: string };
      seatToken?: string;
      playerId?: string;
    }) => {
      setBusy(false);
      if (!res.ok || !res.chamber || !res.seatToken || !res.playerId) {
        setError(res.error ?? "Procedure failed.");
        return;
      }
      saveSeat({
        code: res.chamber.code,
        seatToken: res.seatToken,
        playerId: res.playerId,
        name: name.trim() || "Member",
      });
      router.push(`/chamber/${res.chamber.code}`);
    };

    if (mode === "convene") {
      socket.emit(
        "create_chamber",
        { title, hostName: name },
        (res) => finish(res),
      );
      return;
    }

    if (mode === "join") {
      socket.emit(
        "join_chamber",
        { code, name },
        (res) => finish(res),
      );
      return;
    }

    socket.emit(
      "resume_seat",
      { code, seatToken },
      (res) => {
        if (res.ok && res.chamber) {
          const existing = listSeats().find(
            (s) => s.code === res.chamber.code,
          );
          setName(existing?.name ?? name);
        }
        finish(res);
      },
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23b8893a' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.22em] text-brass uppercase">
          Online Nomic
        </p>
        <p className="text-sm text-stone/80">No accounts required</p>
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 pb-16 pt-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="animate-rise">
          <h1 className="font-[family-name:var(--font-display)] text-5xl leading-[0.95] text-mist sm:text-6xl lg:text-7xl">
            Gaming
            <br />
            Government
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-stone">
            Convene a chamber, rewrite the law mid-session, and keep your seat
            across recesses that last hours or days.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm text-stone/90">
            <span className="rounded-full border border-brass/40 px-3 py-1">
              The Floor — public debate
            </span>
            <span className="rounded-full border border-signal/50 px-3 py-1">
              The Cloakroom — private whispers
            </span>
          </div>
        </div>

        <div className="animate-rise animate-gavel rounded-2xl border border-brass/25 bg-ink-soft/80 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-md [animation-delay:120ms]">
          <div className="mb-5 flex gap-2">
            {(
              [
                ["convene", "Convene"],
                ["join", "Take a seat"],
                ["reconvene", "Reconvene"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMode(id);
                  setError(null);
                }}
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  mode === id
                    ? "bg-brass text-ink"
                    : "bg-ink/40 text-stone hover:bg-ink/70"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "convene" && (
              <label className="block text-sm">
                <span className="mb-1 block text-stone">Session title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-stone/20 bg-ink px-3 py-2 text-mist outline-none ring-brass/40 focus:ring-2"
                />
              </label>
            )}

            {(mode === "convene" || mode === "join") && (
              <label className="block text-sm">
                <span className="mb-1 block text-stone">Your name</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ada Lovelace"
                  className="w-full rounded-lg border border-stone/20 bg-ink px-3 py-2 text-mist outline-none ring-brass/40 focus:ring-2"
                />
              </label>
            )}

            {(mode === "join" || mode === "reconvene") && (
              <label className="block text-sm">
                <span className="mb-1 block text-stone">Chamber code</span>
                <input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  className="w-full rounded-lg border border-stone/20 bg-ink px-3 py-2 tracking-[0.2em] text-mist uppercase outline-none ring-brass/40 focus:ring-2"
                />
              </label>
            )}

            {mode === "reconvene" && (
              <label className="block text-sm">
                <span className="mb-1 block text-stone">Credentials of Office</span>
                <input
                  required
                  value={seatToken}
                  onChange={(e) => setSeatToken(e.target.value)}
                  placeholder="seat_…"
                  className="w-full rounded-lg border border-stone/20 bg-ink px-3 py-2 font-mono text-sm text-mist outline-none ring-brass/40 focus:ring-2"
                />
                <span className="mt-1 block text-xs text-stone/70">
                  Issued when you first sat down. Also saved in this browser.
                </span>
              </label>
            )}

            {error && (
              <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-stone">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-brass-bright px-4 py-2.5 font-medium text-ink transition hover:bg-brass disabled:opacity-60"
            >
              {busy
                ? "In session…"
                : mode === "convene"
                  ? "Open the chamber"
                  : mode === "join"
                    ? "Enter the chamber"
                    : "Resume your seat"}
            </button>
          </form>

          {saved.length > 0 && (
            <div className="mt-6 border-t border-stone/15 pt-4">
              <p className="mb-2 text-xs tracking-wide text-stone/70 uppercase">
                Recent recesses
              </p>
              <ul className="space-y-2">
                {saved.map((seat) => (
                  <li key={seat.code}>
                    <Link
                      href={`/chamber/${seat.code}`}
                      className="flex items-center justify-between rounded-lg border border-stone/10 bg-ink/50 px-3 py-2 text-sm hover:border-brass/40"
                    >
                      <span>
                        {seat.code} · {seat.name}
                      </span>
                      <span className="text-brass">Reconvene →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
