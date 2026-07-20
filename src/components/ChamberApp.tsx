"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { TextDiff } from "@/components/TextDiff";
import { formatTime, proposalTypeLabel } from "@/lib/format";
import { getSeat, saveSeat } from "@/lib/session";
import { getSocket } from "@/lib/socket";
import type { ProposalType, PublicChamber, Rule } from "../../shared/types";

type Props = { code: string };

function ruleTone(rule: Rule): "gold" | "blue" | "red" {
  if (rule.status === "amended" || rule.status === "repealed") return "red";
  if (!rule.mutable) return "gold";
  return "blue";
}

function ruleCardClass(rule: Rule): string {
  const tone = ruleTone(rule);
  if (tone === "gold") {
    return "border-brass/50 bg-[rgba(184,137,58,0.12)]";
  }
  if (tone === "blue") {
    return "border-sky-400/40 bg-sky-950/40";
  }
  return "border-red-400/40 bg-red-950/35";
}

function ruleLabelClass(rule: Rule): string {
  const tone = ruleTone(rule);
  if (tone === "gold") return "text-brass";
  if (tone === "blue") return "text-sky-300";
  return "text-red-300";
}

export function ChamberApp({ code }: Props) {
  const chamberCode = code.toUpperCase();
  const [chamber, setChamber] = useState<PublicChamber | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [seatToken, setSeatToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"connecting" | "ready" | "error">(
    "connecting",
  );
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"business" | "statute" | "journal" | "admin">(
    "business",
  );
  const [chatTab, setChatTab] = useState<"floor" | "cloakroom">("floor");
  const [floorText, setFloorText] = useState("");
  const [cloakText, setCloakText] = useState("");
  const [cloakTo, setCloakTo] = useState("");
  const [copied, setCopied] = useState(false);
  const [scoreFocus, setScoreFocus] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [statuteKind, setStatuteKind] = useState<
    "all" | "immutable" | "mutable" | "new"
  >("all");
  const [statuteNumberQuery, setStatuteNumberQuery] = useState("");
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>(
    {},
  );
  const [winDraft, setWinDraft] = useState("");
  const [passDraft, setPassDraft] = useState("");
  const [voteWeightDrafts, setVoteWeightDrafts] = useState<Record<string, string>>(
    {},
  );
  const [ayeVotes, setAyeVotes] = useState(1);
  const [nayVotes, setNayVotes] = useState(0);

  const [proposalType, setProposalType] = useState<ProposalType>("enact");
  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalText, setProposalText] = useState("");
  const [targetRule, setTargetRule] = useState<number | "">("");
  const [makeMutable, setMakeMutable] = useState(true);
  const [editingBill, setEditingBill] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [editMakeMutable, setEditMakeMutable] = useState(true);

  useEffect(() => {
    const socket = getSocket();
    const seat = getSeat(chamberCode);

    const onUpdate = (next: PublicChamber) => {
      setChamber(next);
      setWinDraft(String(next.winThreshold));
      setPassDraft(String(next.passThresholdPercent));
      setStatus("ready");
    };

    socket.on("chamber_update", onUpdate);
    socket.on("error_message", (payload) => setError(payload.message));

    if (!seat) {
      setStatus("error");
      setError(
        "No Credentials of Office found in this browser. Reconvene from the home page with your chamber code and seat token.",
      );
      return () => {
        socket.off("chamber_update", onUpdate);
      };
    }

    setSeatToken(seat.seatToken);
    setPlayerId(seat.playerId);

    socket.emit(
      "resume_seat",
      { code: chamberCode, seatToken: seat.seatToken },
      (res) => {
        if (!res.ok) {
          setStatus("error");
          setError(res.error);
          return;
        }
        saveSeat({
          code: res.chamber.code,
          seatToken: res.seatToken,
          playerId: res.playerId,
          name: seat.name,
        });
        setPlayerId(res.playerId);
        setSeatToken(res.seatToken);
        setChamber(res.chamber);
        setWinDraft(String(res.chamber.winThreshold));
        setPassDraft(String(res.chamber.passThresholdPercent));
        setStatus("ready");
      },
    );

    return () => {
      socket.off("chamber_update", onUpdate);
    };
  }, [chamberCode]);

  const me = useMemo(
    () => chamber?.players.find((p) => p.id === playerId) ?? null,
    [chamber, playerId],
  );

  const activeProposal = useMemo(
    () =>
      chamber?.proposals.find(
        (p) => p.status === "debate" || p.status === "voting",
      ) ?? null,
    [chamber],
  );

  const activeRules = useMemo(
    () =>
      (chamber?.rules ?? [])
        .filter((r) => r.status === "active")
        .sort((a, b) => a.number - b.number),
    [chamber],
  );

  const archivedRules = useMemo(
    () =>
      (chamber?.rules ?? [])
        .filter((r) => r.status === "amended" || r.status === "repealed")
        .sort((a, b) => a.number - b.number),
    [chamber],
  );

  const filteredActiveRules = useMemo(() => {
    const q = statuteNumberQuery.trim();
    return activeRules.filter((rule) => {
      if (statuteKind === "immutable" && rule.mutable) return false;
      if (statuteKind === "mutable" && !rule.mutable) return false;
      if (statuteKind === "new") {
        const newlyAdded =
          rule.number >= 301 ||
          (rule.enactedByName !== "Initial Set" && rule.enactedById != null);
        if (!newlyAdded) return false;
      }
      if (q && !String(rule.number).includes(q)) return false;
      return true;
    });
  }, [activeRules, statuteKind, statuteNumberQuery]);

  const filteredArchivedRules = useMemo(() => {
    const q = statuteNumberQuery.trim();
    return archivedRules.filter((rule) => {
      if (statuteKind === "immutable" && rule.mutable) return false;
      if (statuteKind === "mutable" && !rule.mutable) return false;
      if (statuteKind === "new") {
        const newlyAdded =
          rule.number >= 301 ||
          (rule.enactedByName !== "Initial Set" && rule.enactedById != null);
        if (!newlyAdded) return false;
      }
      if (q && !String(rule.number).includes(q)) return false;
      return true;
    });
  }, [archivedRules, statuteKind, statuteNumberQuery]);

  const mutableTargets = useMemo(
    () => activeRules.filter((r) => r.mutable),
    [activeRules],
  );

  const floorMessages =
    chamber?.messages.filter((m) => m.channel === "floor") ?? [];
  const cloakMessages =
    chamber?.messages.filter((m) => m.channel === "cloakroom") ?? [];

  function act(
    emit: (ack: (res: { ok: boolean; error?: string }) => void) => void,
  ) {
    setError(null);
    emit((res) => {
      if (!res.ok) setError(res.error ?? "Out of order.");
    });
  }

  function copyCredentials() {
    if (!seatToken) return;
    const text = `Chamber ${chamberCode}\nCredentials of Office: ${seatToken}`;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function selectTarget(value: number | "") {
    setTargetRule(value);
    if (value === "" || !chamber) return;
    const rule = chamber.rules.find(
      (r) => r.number === value && r.status === "active",
    );
    if (!rule) return;
    if (proposalType === "amend") {
      setProposalText(rule.text);
      if (!proposalTitle) setProposalTitle(`Amend Rule ${rule.number}`);
    }
    if (proposalType === "repeal") {
      setProposalTitle(`Repeal Rule ${rule.number}`);
      setProposalText(`Repeal Rule ${rule.number}.`);
    }
  }

  function onPropose(e: FormEvent) {
    e.preventDefault();
    act((ack) =>
      getSocket().emit(
        "submit_proposal",
        {
          code: chamberCode,
          type: proposalType,
          title: proposalType === "transmute" ? undefined : proposalTitle,
          text: proposalType === "transmute" ? undefined : proposalText,
          targetRuleNumber:
            targetRule === "" ? undefined : Number(targetRule),
          makeMutable:
            proposalType === "transmute" ? makeMutable : undefined,
        },
        ack,
      ),
    );
    setProposalTitle("");
    setProposalText("");
    setTargetRule("");
  }

  function onFloor(e: FormEvent) {
    e.preventDefault();
    const text = floorText;
    setFloorText("");
    act((ack) =>
      getSocket().emit("floor_message", { code: chamberCode, text }, ack),
    );
  }

  function onCloak(e: FormEvent) {
    e.preventDefault();
    if (!cloakTo) {
      setError("Choose a colleague for The Cloakroom.");
      return;
    }
    const text = cloakText;
    setCloakText("");
    act((ack) =>
      getSocket().emit(
        "cloakroom_message",
        { code: chamberCode, toId: cloakTo, text },
        ack,
      ),
    );
  }

  function submitBallot() {
    act((ack) =>
      getSocket().emit(
        "cast_vote",
        { code: chamberCode, aye: ayeVotes, nay: nayVotes },
        ack,
      ),
    );
  }

  function renderRuleMeta(rule: Rule) {
    const bits = [
      `Enacted by ${rule.enactedByName}`,
      rule.replacesNumber != null ? `amends/replaces Rule ${rule.replacesNumber}` : null,
      rule.status === "amended" && rule.supersededByNumber != null
        ? `amended by Rule ${rule.supersededByNumber}`
        : null,
      rule.status === "repealed" && rule.supersededByNumber != null
        ? `repealed by Rule ${rule.supersededByNumber}`
        : null,
    ].filter(Boolean);
    return bits.join(" · ");
  }

  function renderRuleCard(rule: Rule) {
    const historyOpen = expandedHistory[rule.id];
    const showDiff =
      historyOpen &&
      rule.previousText &&
      rule.previousText !== rule.text;

    return (
      <article
        key={rule.id}
        className={`rounded-md border px-2.5 py-1.5 ${ruleCardClass(rule)}`}
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p
            className={`text-[10px] font-medium tracking-wide uppercase ${ruleLabelClass(rule)}`}
          >
            Rule {rule.number} ·{" "}
            {rule.status === "active"
              ? rule.mutable
                ? "Mutable"
                : "Immutable"
              : rule.status}
          </p>
          <p className="text-[10px] text-stone/70">{renderRuleMeta(rule)}</p>
        </div>
        <p className="mt-0.5 text-xs leading-snug text-mist/95">{rule.text}</p>
        {(rule.previousText ||
          rule.replacesNumber != null ||
          rule.status !== "active") && (
          <button
            type="button"
            className="mt-1 text-[10px] text-stone underline decoration-stone/40 hover:text-mist"
            onClick={() =>
              setExpandedHistory((prev) => ({
                ...prev,
                [rule.id]: !prev[rule.id],
              }))
            }
          >
            {historyOpen ? "Hide detail" : "Amendment detail"}
          </button>
        )}
        {showDiff && (
          <div className="mt-1.5 rounded-md border border-stone/15 bg-ink/40 p-2">
            <p className="mb-1 text-[10px] tracking-wide text-stone uppercase">
              Changes from Rule {rule.replacesNumber}
            </p>
            <TextDiff before={rule.previousText!} after={rule.text} />
          </div>
        )}
      </article>
    );
  }

  if (status === "connecting") {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-stone">Calling the chamber to order…</p>
      </main>
    );
  }

  if (status === "error" || !chamber) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-mist">
          Seat not recognized
        </h1>
        <p className="text-stone">{error}</p>
        <Link href="/" className="text-brass underline">
          Return to the lobby
        </Link>
      </main>
    );
  }

  const winner = chamber.players.find((p) => p.id === chamber.winnerId);
  const canPropose =
    chamber.phase === "playing" && !activeProposal && !chamber.winnerId;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-brass/25 pb-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-brass uppercase">
            Gaming Government · Chamber {chamber.code}
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-mist sm:text-4xl">
            {chamber.title}
          </h1>
          <p className="mt-1 text-sm text-stone">
            {me ? `Seated as ${me.name}` : "Observer"} · Win at{" "}
            {chamber.winThreshold} pts · Pass at {chamber.passThresholdPercent}%
            aye · No fixed turn order
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyCredentials}
            className="rounded-lg border border-stone/20 px-3 py-2 text-sm text-stone hover:border-brass/50"
          >
            {copied ? "Copied" : "Copy Credentials of Office"}
          </button>
          <Link
            href="/"
            className="rounded-lg border border-stone/20 px-3 py-2 text-sm text-stone hover:border-brass/50"
          >
            Recess
          </Link>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {chamber.phase === "finished" && winner && (
        <div className="mb-4 rounded-xl border border-brass/50 bg-brass/15 px-4 py-3 text-mist">
          Session closed. {winner.name} wins at {chamber.winThreshold} points.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
        <aside className="space-y-4 rounded-xl border border-stone/15 bg-ink-soft/60 p-4">
          <div>
            <h2 className="mb-3 text-xs tracking-wide text-brass uppercase">
              Roll & standing
            </h2>
            <ul className="space-y-2">
              {[...chamber.players]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((p) => (
                  <li key={p.id} className="rounded-lg bg-ink/40 px-3 py-2">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 text-left"
                      onClick={() =>
                        setScoreFocus((id) => (id === p.id ? null : p.id))
                      }
                    >
                      <span className="font-medium text-mist">
                        {p.name}
                        {p.id === playerId ? " (you)" : ""}
                      </span>
                      <span className="tabular-nums text-brass">{p.score}</span>
                    </button>
                    <p className="text-xs text-stone/70">
                      {p.connected ? "Present" : "In recess"}
                      {p.id === chamber.hostId ? " · Host" : ""}
                      {" · "}
                      {(p.voteWeight ?? 1) === 0
                        ? "no vote"
                        : `${p.voteWeight ?? 1} vote${(p.voteWeight ?? 1) === 1 ? "" : "s"}`}
                    </p>
                    {scoreFocus === p.id && chamber.phase !== "lobby" && (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          className="flex-1 rounded-md bg-signal/80 py-1 text-sm text-mist"
                          onClick={() =>
                            act((ack) =>
                              getSocket().emit(
                                "adjust_score",
                                { code: chamberCode, playerId: p.id, delta: 1 },
                                ack,
                              ),
                            )
                          }
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          className="flex-1 rounded-md bg-danger/70 py-1 text-sm text-mist"
                          onClick={() =>
                            act((ack) =>
                              getSocket().emit(
                                "adjust_score",
                                { code: chamberCode, playerId: p.id, delta: -1 },
                                ack,
                              ),
                            )
                          }
                        >
                          −1
                        </button>
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          </div>

          {chamber.phase === "lobby" && playerId === chamber.hostId && (
            <button
              type="button"
              className="w-full rounded-lg bg-brass-bright px-3 py-2 text-sm font-medium text-ink"
              onClick={() =>
                act((ack) =>
                  getSocket().emit("start_session", { code: chamberCode }, ack),
                )
              }
            >
              Gavel open (start session)
            </button>
          )}

          {chamber.phase === "lobby" && (
            <p className="text-xs leading-relaxed text-stone/80">
              Share chamber code <strong className="text-mist">{chamber.code}</strong>.
              Click a name later to adjust points manually.
            </p>
          )}
        </aside>

        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["business", "Order of business"],
                ["statute", "Statute book"],
                ["journal", "Journal"],
                ["admin", "Admin"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  tab === id ? "bg-mist text-ink" : "bg-ink/50 text-stone"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "business" && (
            <div className="space-y-4">
              {activeProposal ? (
                <article className="rounded-xl border border-brass/30 bg-ink-soft/70 p-5">
                  <p className="text-xs tracking-wide text-brass uppercase">
                    Proposal {activeProposal.number} ·{" "}
                    {proposalTypeLabel(activeProposal.type)}
                    {activeProposal.targetRuleNumber
                      ? ` · Rule ${activeProposal.targetRuleNumber}`
                      : ""}
                  </p>
                  <h3 className="mt-1 font-[family-name:var(--font-display)] text-2xl text-mist">
                    {activeProposal.title}
                  </h3>

                  {activeProposal.type === "amend" &&
                  activeProposal.previousText ? (
                    <div className="mt-3 rounded-lg border border-stone/15 bg-ink/40 p-3">
                      <p className="mb-2 text-xs tracking-wide text-stone uppercase">
                        Proposed changes
                      </p>
                      <TextDiff
                        before={activeProposal.previousText}
                        after={activeProposal.text}
                      />
                    </div>
                  ) : activeProposal.type === "transmute" ? (
                    <p className="mt-3 text-stone">
                      Transmute Rule {activeProposal.targetRuleNumber} from{" "}
                      {activeProposal.previousMutable ? "mutable" : "immutable"}{" "}
                      to {activeProposal.makeMutable ? "mutable" : "immutable"}.
                    </p>
                  ) : (
                    <p className="mt-3 whitespace-pre-wrap text-stone">
                      {activeProposal.text}
                    </p>
                  )}

                  <p className="mt-3 text-sm text-stone/80">
                    Status: {activeProposal.status} · Weighted votes{" "}
                    {Object.values(activeProposal.votes).reduce(
                      (sum, b) => sum + (b?.aye ?? 0),
                      0,
                    )}
                    –
                    {Object.values(activeProposal.votes).reduce(
                      (sum, b) => sum + (b?.nay ?? 0),
                      0,
                    )}{" "}
                    of{" "}
                    {chamber.players.reduce(
                      (sum, p) => sum + Math.max(0, p.voteWeight ?? 1),
                      0,
                    )}{" "}
                    · need {chamber.passThresholdPercent}% aye
                  </p>

                  {activeProposal.status === "debate" &&
                    activeProposal.proponentId === playerId && (
                      <div className="mt-4 space-y-3">
                        {!editingBill ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-lg border border-brass/40 px-4 py-2 text-sm text-brass"
                              onClick={() => {
                                setEditTitle(activeProposal.title);
                                setEditText(activeProposal.text);
                                setEditMakeMutable(
                                  activeProposal.makeMutable ?? true,
                                );
                                setEditingBill(true);
                              }}
                            >
                              Revise bill
                            </button>
                            <button
                              type="button"
                              className="rounded-lg bg-signal px-4 py-2 text-sm text-mist"
                              onClick={() =>
                                act((ack) =>
                                  getSocket().emit(
                                    "open_roll_call",
                                    { code: chamberCode },
                                    ack,
                                  ),
                                )
                              }
                            >
                              End debate · open roll call
                            </button>
                          </div>
                        ) : (
                          <form
                            className="space-y-3 rounded-lg border border-brass/30 bg-ink/40 p-4"
                            onSubmit={(e) => {
                              e.preventDefault();
                              act((ack) =>
                                getSocket().emit(
                                  "edit_proposal",
                                  {
                                    code: chamberCode,
                                    title:
                                      activeProposal.type === "transmute"
                                        ? undefined
                                        : editTitle,
                                    text:
                                      activeProposal.type === "transmute" ||
                                      activeProposal.type === "repeal"
                                        ? undefined
                                        : editText,
                                    makeMutable:
                                      activeProposal.type === "transmute"
                                        ? editMakeMutable
                                        : undefined,
                                  },
                                  (res) => {
                                    ack(res);
                                    if (res.ok) setEditingBill(false);
                                  },
                                ),
                              );
                            }}
                          >
                            <p className="text-xs tracking-wide text-brass uppercase">
                              Final form for the vote (Rule 111)
                            </p>
                            {activeProposal.type === "transmute" ? (
                              <label className="flex items-center gap-2 text-sm text-stone">
                                <input
                                  type="checkbox"
                                  checked={editMakeMutable}
                                  onChange={(e) =>
                                    setEditMakeMutable(e.target.checked)
                                  }
                                />
                                Make target mutable (unchecked = immutable)
                              </label>
                            ) : (
                              <>
                                <label className="block text-sm">
                                  <span className="mb-1 block text-stone">
                                    Title
                                  </span>
                                  <input
                                    required
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full rounded-lg border border-stone/20 bg-ink px-3 py-2 text-mist"
                                  />
                                </label>
                                {activeProposal.type !== "repeal" && (
                                  <label className="block text-sm">
                                    <span className="mb-1 block text-stone">
                                      {activeProposal.type === "amend"
                                        ? "Amended rule text"
                                        : "Text of the rule-change"}
                                    </span>
                                    <textarea
                                      required
                                      rows={5}
                                      value={editText}
                                      onChange={(e) => setEditText(e.target.value)}
                                      className="w-full rounded-lg border border-stone/20 bg-ink px-3 py-2 text-mist"
                                    />
                                  </label>
                                )}
                              </>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="submit"
                                className="rounded-lg bg-brass-bright px-4 py-2 text-sm font-medium text-ink"
                              >
                                Save revision
                              </button>
                              <button
                                type="button"
                                className="rounded-lg border border-stone/25 px-4 py-2 text-sm text-stone"
                                onClick={() => setEditingBill(false)}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}

                  {activeProposal.status === "voting" &&
                    playerId &&
                    (me?.voteWeight ?? 1) <= 0 && (
                      <p className="mt-4 text-sm text-stone">
                        You have zero votes and are not called on this roll.
                      </p>
                    )}

                  {activeProposal.status === "voting" &&
                    playerId &&
                    (me?.voteWeight ?? 1) > 0 &&
                    !activeProposal.votes[playerId] && (
                      <div className="mt-4 space-y-3">
                        {(me?.voteWeight ?? 1) === 1 ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setAyeVotes(1);
                                setNayVotes(0);
                                act((ack) =>
                                  getSocket().emit(
                                    "cast_vote",
                                    { code: chamberCode, aye: 1, nay: 0 },
                                    ack,
                                  ),
                                );
                              }}
                              className="rounded-lg bg-signal px-4 py-2 text-sm text-mist"
                            >
                              Aye
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                act((ack) =>
                                  getSocket().emit(
                                    "cast_vote",
                                    { code: chamberCode, aye: 0, nay: 1 },
                                    ack,
                                  ),
                                );
                              }}
                              className="rounded-lg bg-danger/80 px-4 py-2 text-sm text-mist"
                            >
                              Nay
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-stone">
                              You have {me?.voteWeight} votes. Split them between
                              Aye and Nay (must sum to {me?.voteWeight}).
                            </p>
                            <div className="flex flex-wrap items-end gap-3">
                              <label className="text-sm text-stone">
                                Aye
                                <input
                                  type="number"
                                  min={0}
                                  max={me?.voteWeight ?? 1}
                                  value={ayeVotes}
                                  onChange={(e) => {
                                    const aye = Math.max(
                                      0,
                                      Number(e.target.value) || 0,
                                    );
                                    const max = me?.voteWeight ?? 1;
                                    setAyeVotes(Math.min(aye, max));
                                    setNayVotes(Math.max(0, max - Math.min(aye, max)));
                                  }}
                                  className="mt-1 block w-24 rounded-lg border border-stone/20 bg-ink px-2 py-1.5 text-mist"
                                />
                              </label>
                              <label className="text-sm text-stone">
                                Nay
                                <input
                                  type="number"
                                  min={0}
                                  max={me?.voteWeight ?? 1}
                                  value={nayVotes}
                                  onChange={(e) => {
                                    const nay = Math.max(
                                      0,
                                      Number(e.target.value) || 0,
                                    );
                                    const max = me?.voteWeight ?? 1;
                                    setNayVotes(Math.min(nay, max));
                                    setAyeVotes(Math.max(0, max - Math.min(nay, max)));
                                  }}
                                  className="mt-1 block w-24 rounded-lg border border-stone/20 bg-ink px-2 py-1.5 text-mist"
                                />
                              </label>
                              <button
                                type="button"
                                onClick={submitBallot}
                                disabled={
                                  ayeVotes + nayVotes !== (me?.voteWeight ?? 1)
                                }
                                className="rounded-lg bg-brass-bright px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
                              >
                                Cast ballot ({ayeVotes}–{nayVotes})
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                  {activeProposal.status === "voting" &&
                    playerId &&
                    (me?.voteWeight ?? 1) > 0 &&
                    activeProposal.votes[playerId] && (
                      <p className="mt-4 text-sm text-brass">
                        You voted {activeProposal.votes[playerId].aye} aye /{" "}
                        {activeProposal.votes[playerId].nay} nay. Waiting for the
                        full roll.
                      </p>
                    )}
                </article>
              ) : (
                <article className="rounded-xl border border-stone/15 bg-ink-soft/50 p-5 text-stone">
                  {chamber.phase === "lobby"
                    ? "Waiting for the host to gavel the session open."
                    : chamber.phase === "finished"
                      ? "No further business."
                      : "The floor is open. Any member may introduce a rule-change."}
                </article>
              )}

              {canPropose && (
                <form
                  onSubmit={onPropose}
                  className="space-y-3 rounded-xl border border-stone/15 bg-ink-soft/60 p-5"
                >
                  <h3 className="font-[family-name:var(--font-display)] text-xl text-mist">
                    Introduce a bill
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm">
                      <span className="mb-1 block text-stone">Type</span>
                      <select
                        value={proposalType}
                        onChange={(e) => {
                          const next = e.target.value as ProposalType;
                          setProposalType(next);
                          setTargetRule("");
                          setProposalTitle("");
                          setProposalText("");
                        }}
                        className="w-full rounded-lg border border-stone/20 bg-ink px-3 py-2 text-mist"
                      >
                        <option value="enact">Enact new mutable rule</option>
                        <option value="amend">Amend mutable rule</option>
                        <option value="repeal">Repeal mutable rule</option>
                        <option value="transmute">Transmute rule</option>
                      </select>
                    </label>
                    {proposalType !== "enact" && (
                      <label className="text-sm">
                        <span className="mb-1 block text-stone">Target rule #</span>
                        <select
                          required
                          value={targetRule}
                          onChange={(e) =>
                            selectTarget(
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value),
                            )
                          }
                          className="w-full rounded-lg border border-stone/20 bg-ink px-3 py-2 text-mist"
                        >
                          <option value="">Select…</option>
                          {(proposalType === "transmute"
                            ? activeRules
                            : mutableTargets
                          ).map((r) => (
                            <option key={r.id} value={r.number}>
                              {r.number} ({r.mutable ? "mutable" : "immutable"})
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>

                  {proposalType === "transmute" && (
                    <label className="flex items-center gap-2 text-sm text-stone">
                      <input
                        type="checkbox"
                        checked={makeMutable}
                        onChange={(e) => setMakeMutable(e.target.checked)}
                      />
                      Make target mutable (unchecked = make immutable)
                    </label>
                  )}

                  {proposalType !== "transmute" && (
                    <>
                      <label className="block text-sm">
                        <span className="mb-1 block text-stone">Title</span>
                        <input
                          required={proposalType === "enact"}
                          value={proposalTitle}
                          onChange={(e) => setProposalTitle(e.target.value)}
                          className="w-full rounded-lg border border-stone/20 bg-ink px-3 py-2 text-mist"
                        />
                      </label>
                      {proposalType !== "repeal" && (
                        <label className="block text-sm">
                          <span className="mb-1 block text-stone">
                            {proposalType === "amend"
                              ? "Amended rule text"
                              : "Text of the rule-change"}
                          </span>
                          <textarea
                            required
                            rows={5}
                            value={proposalText}
                            onChange={(e) => setProposalText(e.target.value)}
                            className="w-full rounded-lg border border-stone/20 bg-ink px-3 py-2 text-mist"
                          />
                        </label>
                      )}
                    </>
                  )}

                  {proposalType === "transmute" && (
                    <p className="text-sm text-stone/80">
                      Title and body are generated automatically from the target
                      and the status you choose.
                    </p>
                  )}

                  <button
                    type="submit"
                    className="rounded-lg bg-brass-bright px-4 py-2 text-sm font-medium text-ink"
                  >
                    Place on The Floor
                  </button>
                </form>
              )}

              <div className="rounded-xl border border-stone/15 bg-ink/40 p-4">
                <h3 className="mb-2 text-xs tracking-wide text-brass uppercase">
                  Recent proposals
                </h3>
                <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                  {[...chamber.proposals].reverse().map((p) => (
                    <li key={p.number} className="text-stone">
                      <span className="text-mist">#{p.number}</span> {p.title}{" "}
                      <span className="text-brass">({p.status})</span>
                    </li>
                  ))}
                  {chamber.proposals.length === 0 && (
                    <li className="text-stone/60">None yet.</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {tab === "statute" && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ["all", "All"],
                    ["immutable", "Immutable"],
                    ["mutable", "Mutable"],
                    ["new", "Newly added"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setStatuteKind(id)}
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      statuteKind === id
                        ? "bg-mist text-ink"
                        : "bg-ink/50 text-stone"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <input
                  type="search"
                  inputMode="numeric"
                  placeholder="Filter #"
                  value={statuteNumberQuery}
                  onChange={(e) => setStatuteNumberQuery(e.target.value)}
                  className="w-24 rounded-lg border border-stone/20 bg-ink px-2 py-1 text-xs text-mist"
                />
                <label className="ml-auto flex items-center gap-2 text-xs text-stone">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                  />
                  Show amended / repealed
                </label>
              </div>
              <p className="text-[10px] text-stone/70">
                <span className="text-brass">Gold</span> immutable ·{" "}
                <span className="text-sky-300">Blue</span> mutable ·{" "}
                <span className="text-red-300">Red</span> amended/repealed ·{" "}
                Newly added = enacted in play (301+)
              </p>
              <div className="grid grid-cols-1 gap-1.5 xl:grid-cols-2">
                {filteredActiveRules.map(renderRuleCard)}
                {filteredActiveRules.length === 0 && (
                  <p className="text-xs text-stone/60">No rules match these filters.</p>
                )}
              </div>
              {showArchived && filteredArchivedRules.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="pt-1 text-[10px] tracking-wide text-red-300 uppercase">
                    Superseded & repealed
                  </h3>
                  <div className="grid grid-cols-1 gap-1.5 xl:grid-cols-2">
                    {filteredArchivedRules.map(renderRuleCard)}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "admin" && (
            <AdminPanel
              chamber={chamber}
              chamberCode={chamberCode}
              playerId={playerId}
              winDraft={winDraft}
              passDraft={passDraft}
              setWinDraft={setWinDraft}
              setPassDraft={setPassDraft}
              voteWeightDrafts={voteWeightDrafts}
              setVoteWeightDrafts={setVoteWeightDrafts}
              act={act}
            />
          )}

          {tab === "journal" && (
            <ul className="max-h-[70vh] space-y-2 overflow-y-auto rounded-xl border border-stone/15 bg-ink-soft/50 p-4">
              {[...chamber.log].reverse().map((entry) => (
                <li key={entry.id} className="text-sm text-stone">
                  <span className="text-brass/80">{formatTime(entry.at)}</span>{" "}
                  {entry.text}
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex min-h-[420px] flex-col rounded-xl border border-stone/15 bg-ink-soft/60">
          <div className="flex border-b border-stone/15">
            <button
              type="button"
              onClick={() => setChatTab("floor")}
              className={`flex-1 px-3 py-3 text-sm ${
                chatTab === "floor"
                  ? "bg-mist/10 text-mist"
                  : "text-stone hover:text-mist"
              }`}
            >
              The Floor
            </button>
            <button
              type="button"
              onClick={() => setChatTab("cloakroom")}
              className={`flex-1 px-3 py-3 text-sm ${
                chatTab === "cloakroom"
                  ? "bg-mist/10 text-mist"
                  : "text-stone hover:text-mist"
              }`}
            >
              The Cloakroom
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {(chatTab === "floor" ? floorMessages : cloakMessages).map((m) => (
              <div key={m.id} className="rounded-lg bg-ink/50 px-3 py-2 text-sm">
                <p className="text-xs text-brass">
                  {m.fromName}
                  {m.channel === "cloakroom" && m.toName
                    ? ` → ${m.toName}`
                    : ""}{" "}
                  · {formatTime(m.at)}
                </p>
                <p className="text-mist">{m.text}</p>
              </div>
            ))}
            {(chatTab === "floor" ? floorMessages : cloakMessages).length ===
              0 && (
              <p className="text-sm text-stone/60">
                {chatTab === "floor"
                  ? "The Floor is quiet. Debate begins here."
                  : "The Cloakroom is empty. Private words stay between you and one colleague."}
              </p>
            )}
          </div>

          {chatTab === "floor" ? (
            <form onSubmit={onFloor} className="border-t border-stone/15 p-3">
              <textarea
                value={floorText}
                onChange={(e) => setFloorText(e.target.value)}
                rows={2}
                placeholder="Address the chamber…"
                className="mb-2 w-full rounded-lg border border-stone/20 bg-ink px-3 py-2 text-sm text-mist"
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-signal/90 px-3 py-2 text-sm text-mist"
              >
                Speak on The Floor
              </button>
            </form>
          ) : (
            <form onSubmit={onCloak} className="border-t border-stone/15 p-3">
              <select
                value={cloakTo}
                onChange={(e) => setCloakTo(e.target.value)}
                className="mb-2 w-full rounded-lg border border-stone/20 bg-ink px-3 py-2 text-sm text-mist"
              >
                <option value="">Whisper to…</option>
                {chamber.players
                  .filter((p) => p.id !== playerId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <textarea
                value={cloakText}
                onChange={(e) => setCloakText(e.target.value)}
                rows={2}
                placeholder="Off the record…"
                className="mb-2 w-full rounded-lg border border-stone/20 bg-ink px-3 py-2 text-sm text-mist"
              />
              <button
                type="submit"
                className="w-full rounded-lg border border-brass/40 px-3 py-2 text-sm text-brass"
              >
                Slip into The Cloakroom
              </button>
            </form>
          )}
        </aside>
      </div>
    </main>
  );
}
