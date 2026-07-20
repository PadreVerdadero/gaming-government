"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { getSocket } from "@/lib/socket";
import type { AdminAction, PublicChamber, Rule } from "../../shared/types";

type Props = {
  chamber: PublicChamber;
  chamberCode: string;
  playerId: string | null;
  winDraft: string;
  passDraft: string;
  setWinDraft: (v: string) => void;
  setPassDraft: (v: string) => void;
  voteWeightDrafts: Record<string, string>;
  setVoteWeightDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  act: (emit: (ack: (res: { ok: boolean; error?: string }) => void) => void) => void;
};

function admin(
  chamberCode: string,
  action: AdminAction,
  act: Props["act"],
) {
  act((ack) =>
    getSocket().emit("admin_action", { code: chamberCode, action }, ack),
  );
}

export function AdminPanel({
  chamber,
  chamberCode,
  playerId,
  winDraft,
  passDraft,
  setWinDraft,
  setPassDraft,
  voteWeightDrafts,
  setVoteWeightDrafts,
  act,
}: Props) {
  const activeProposal = useMemo(
    () =>
      chamber.proposals.find(
        (p) => p.status === "debate" || p.status === "voting",
      ) ?? null,
    [chamber.proposals],
  );

  const activeRules = useMemo(
    () =>
      chamber.rules
        .filter((r) => r.status === "active")
        .sort((a, b) => a.number - b.number),
    [chamber.rules],
  );

  const [enactText, setEnactText] = useState("");
  const [enactMutable, setEnactMutable] = useState(true);
  const [enactNumber, setEnactNumber] = useState("");
  const [titleDraft, setTitleDraft] = useState(chamber.title);
  const [nextNumDraft, setNextNumDraft] = useState(
    String(chamber.nextProposalNumber),
  );
  const [ruleEdits, setRuleEdits] = useState<
    Record<string, { text: string; number: string }>
  >({});
  const [ballotDrafts, setBallotDrafts] = useState<
    Record<string, { aye: string; nay: string }>
  >({});
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});

  function ruleEdit(rule: Rule) {
    return (
      ruleEdits[rule.id] ?? {
        text: rule.text,
        number: String(rule.number),
      }
    );
  }

  return (
    <div className="space-y-5">
      <p className="rounded-lg border border-brass/30 bg-brass/10 px-3 py-2 text-xs text-stone">
        Admin is a ledger override: use it when the rules (or the table) say the
        software should get out of the way. Actions are journaled.
      </p>

      {/* Proposal / vote controls */}
      <section className="rounded-xl border border-stone/15 bg-ink-soft/60 p-4">
        <h3 className="text-xs tracking-wide text-brass uppercase">
          Floor & votes
        </h3>
        {activeProposal ? (
          <div className="mt-2 space-y-3">
            <p className="text-sm text-mist">
              Proposal {activeProposal.number}: {activeProposal.title}{" "}
              <span className="text-stone">({activeProposal.status})</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-signal px-3 py-1.5 text-xs text-mist"
                onClick={() =>
                  admin(chamberCode, { type: "force_adopt_proposal" }, act)
                }
              >
                Pass without vote
              </button>
              <button
                type="button"
                className="rounded-lg bg-danger/80 px-3 py-1.5 text-xs text-mist"
                onClick={() =>
                  admin(chamberCode, { type: "force_defeat_proposal" }, act)
                }
              >
                Defeat without vote
              </button>
              <button
                type="button"
                className="rounded-lg border border-stone/30 px-3 py-1.5 text-xs text-stone"
                onClick={() =>
                  admin(chamberCode, { type: "withdraw_proposal" }, act)
                }
              >
                Withdraw
              </button>
              {activeProposal.status === "debate" && (
                <button
                  type="button"
                  className="rounded-lg border border-brass/40 px-3 py-1.5 text-xs text-brass"
                  onClick={() =>
                    admin(chamberCode, { type: "open_roll_call" }, act)
                  }
                >
                  Open roll call
                </button>
              )}
              {activeProposal.status === "voting" && (
                <button
                  type="button"
                  className="rounded-lg border border-brass/40 px-3 py-1.5 text-xs text-brass"
                  onClick={() =>
                    admin(chamberCode, { type: "resolve_vote_now" }, act)
                  }
                >
                  Resolve vote now
                </button>
              )}
            </div>

            {activeProposal.status === "voting" && (
              <div className="space-y-2 border-t border-stone/15 pt-3">
                <p className="text-xs text-stone">
                  Cast or overwrite ballots (aye + nay must equal that member&apos;s
                  weight).
                </p>
                {[...chamber.players]
                  .filter((p) => (p.voteWeight ?? 1) > 0)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((p) => {
                    const w = p.voteWeight ?? 1;
                    const existing = activeProposal.votes[p.id];
                    const draft = ballotDrafts[p.id] ?? {
                      aye: String(existing?.aye ?? w),
                      nay: String(existing?.nay ?? 0),
                    };
                    return (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg bg-ink/40 px-3 py-2 text-sm"
                      >
                        <span className="min-w-28 flex-1 text-mist">
                          {p.name}{" "}
                          <span className="text-stone/70">({w})</span>
                        </span>
                        <label className="text-xs text-stone">
                          Aye
                          <input
                            type="number"
                            min={0}
                            value={draft.aye}
                            onChange={(e) =>
                              setBallotDrafts((prev) => ({
                                ...prev,
                                [p.id]: { ...draft, aye: e.target.value },
                              }))
                            }
                            className="ml-1 w-16 rounded border border-stone/20 bg-ink px-1 py-0.5 text-mist"
                          />
                        </label>
                        <label className="text-xs text-stone">
                          Nay
                          <input
                            type="number"
                            min={0}
                            value={draft.nay}
                            onChange={(e) =>
                              setBallotDrafts((prev) => ({
                                ...prev,
                                [p.id]: { ...draft, nay: e.target.value },
                              }))
                            }
                            className="ml-1 w-16 rounded border border-stone/20 bg-ink px-1 py-0.5 text-mist"
                          />
                        </label>
                        <button
                          type="button"
                          className="rounded border border-brass/40 px-2 py-1 text-xs text-brass"
                          onClick={() =>
                            admin(
                              chamberCode,
                              {
                                type: "set_ballot",
                                playerId: p.id,
                                aye: Number(draft.aye),
                                nay: Number(draft.nay),
                              },
                              act,
                            )
                          }
                        >
                          Set ballot
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-stone">No proposal on the floor.</p>
        )}
      </section>

      {/* Pass a rule without proposal */}
      <section className="rounded-xl border border-stone/15 bg-ink-soft/60 p-4">
        <h3 className="text-xs tracking-wide text-brass uppercase">
          Enact rule (no vote)
        </h3>
        <div className="mt-3 space-y-2">
          <textarea
            rows={3}
            value={enactText}
            onChange={(e) => setEnactText(e.target.value)}
            placeholder="Rule text…"
            className="w-full rounded-lg border border-stone/20 bg-ink px-3 py-2 text-sm text-mist"
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-stone">
              <input
                type="checkbox"
                checked={enactMutable}
                onChange={(e) => setEnactMutable(e.target.checked)}
              />
              Mutable
            </label>
            <label className="text-xs text-stone">
              Number (blank = next)
              <input
                type="number"
                value={enactNumber}
                onChange={(e) => setEnactNumber(e.target.value)}
                className="ml-2 w-24 rounded border border-stone/20 bg-ink px-2 py-1 text-mist"
              />
            </label>
            <button
              type="button"
              className="rounded-lg bg-brass-bright px-3 py-1.5 text-xs font-medium text-ink"
              onClick={() => {
                admin(
                  chamberCode,
                  {
                    type: "enact_rule",
                    text: enactText,
                    mutable: enactMutable,
                    number: enactNumber === "" ? undefined : Number(enactNumber),
                  },
                  act,
                );
                setEnactText("");
                setEnactNumber("");
              }}
            >
              Enact now
            </button>
          </div>
        </div>
      </section>

      {/* Rules: mutable toggle + edit */}
      <section className="rounded-xl border border-stone/15 bg-ink-soft/60 p-4">
        <h3 className="text-xs tracking-wide text-brass uppercase">
          Statute edits
        </h3>
        <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto">
          {activeRules.map((rule) => {
            const edit = ruleEdit(rule);
            return (
              <li
                key={rule.id}
                className="rounded-lg border border-stone/10 bg-ink/40 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-xs font-medium ${
                      rule.mutable ? "text-sky-300" : "text-brass"
                    }`}
                  >
                    Rule {rule.number}
                  </span>
                  <button
                    type="button"
                    className="rounded border border-stone/25 px-2 py-0.5 text-[10px] text-stone"
                    onClick={() =>
                      admin(
                        chamberCode,
                        {
                          type: "set_rule_mutable",
                          ruleId: rule.id,
                          mutable: !rule.mutable,
                        },
                        act,
                      )
                    }
                  >
                    Make {rule.mutable ? "immutable" : "mutable"}
                  </button>
                  <button
                    type="button"
                    className="rounded border border-danger/40 px-2 py-0.5 text-[10px] text-red-300"
                    onClick={() =>
                      admin(
                        chamberCode,
                        { type: "repeal_rule", ruleId: rule.id },
                        act,
                      )
                    }
                  >
                    Repeal
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    type="number"
                    value={edit.number}
                    onChange={(e) =>
                      setRuleEdits((prev) => ({
                        ...prev,
                        [rule.id]: { ...edit, number: e.target.value },
                      }))
                    }
                    className="w-20 rounded border border-stone/20 bg-ink px-2 py-1 text-xs text-mist"
                  />
                  <button
                    type="button"
                    className="rounded border border-brass/40 px-2 text-[10px] text-brass"
                    onClick={() =>
                      admin(
                        chamberCode,
                        {
                          type: "edit_rule",
                          ruleId: rule.id,
                          number: Number(edit.number),
                          text: edit.text,
                        },
                        act,
                      )
                    }
                  >
                    Save text/#
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={edit.text}
                  onChange={(e) =>
                    setRuleEdits((prev) => ({
                      ...prev,
                      [rule.id]: { ...edit, text: e.target.value },
                    }))
                  }
                  className="mt-2 w-full rounded border border-stone/20 bg-ink px-2 py-1 text-xs text-mist"
                />
              </li>
            );
          })}
        </ul>
      </section>

      {/* Chamber dials */}
      <section className="rounded-xl border border-stone/15 bg-ink-soft/60 p-4">
        <h3 className="text-xs tracking-wide text-brass uppercase">
          Chamber dials
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-stone">
            Win threshold (points)
            <div className="mt-1 flex gap-2">
              <input
                type="number"
                min={1}
                value={winDraft}
                onChange={(e) => setWinDraft(e.target.value)}
                className="w-full rounded-lg border border-stone/20 bg-ink px-2 py-1.5 text-sm text-mist"
              />
              <button
                type="button"
                className="rounded-lg border border-brass/40 px-2 text-xs text-brass"
                onClick={() =>
                  admin(
                    chamberCode,
                    { type: "set_win_threshold", value: Number(winDraft) },
                    act,
                  )
                }
              >
                Set
              </button>
            </div>
          </label>
          <label className="block text-xs text-stone">
            Passage threshold (% aye)
            <div className="mt-1 flex gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={passDraft}
                onChange={(e) => setPassDraft(e.target.value)}
                className="w-full rounded-lg border border-stone/20 bg-ink px-2 py-1.5 text-sm text-mist"
              />
              <button
                type="button"
                className="rounded-lg border border-brass/40 px-2 text-xs text-brass"
                onClick={() =>
                  admin(
                    chamberCode,
                    { type: "set_pass_threshold", value: Number(passDraft) },
                    act,
                  )
                }
              >
                Set
              </button>
            </div>
          </label>
          <label className="block text-xs text-stone">
            Session title
            <div className="mt-1 flex gap-2">
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="w-full rounded-lg border border-stone/20 bg-ink px-2 py-1.5 text-sm text-mist"
              />
              <button
                type="button"
                className="rounded-lg border border-brass/40 px-2 text-xs text-brass"
                onClick={() =>
                  admin(
                    chamberCode,
                    { type: "set_chamber_title", title: titleDraft },
                    act,
                  )
                }
              >
                Set
              </button>
            </div>
          </label>
          <label className="block text-xs text-stone">
            Next proposal #
            <div className="mt-1 flex gap-2">
              <input
                type="number"
                value={nextNumDraft}
                onChange={(e) => setNextNumDraft(e.target.value)}
                className="w-full rounded-lg border border-stone/20 bg-ink px-2 py-1.5 text-sm text-mist"
              />
              <button
                type="button"
                className="rounded-lg border border-brass/40 px-2 text-xs text-brass"
                onClick={() =>
                  admin(
                    chamberCode,
                    {
                      type: "set_next_proposal_number",
                      value: Number(nextNumDraft),
                    },
                    act,
                  )
                }
              >
                Set
              </button>
            </div>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["lobby", "playing", "finished"] as const).map((phase) => (
            <button
              key={phase}
              type="button"
              className={`rounded-full px-3 py-1 text-xs ${
                chamber.phase === phase
                  ? "bg-mist text-ink"
                  : "border border-stone/25 text-stone"
              }`}
              onClick={() =>
                admin(chamberCode, { type: "set_phase", phase }, act)
              }
            >
              Phase: {phase}
            </button>
          ))}
          <button
            type="button"
            className="rounded-full border border-stone/25 px-3 py-1 text-xs text-stone"
            onClick={() => admin(chamberCode, { type: "clear_winner" }, act)}
          >
            Clear winner
          </button>
        </div>
      </section>

      {/* Players */}
      <section className="rounded-xl border border-stone/15 bg-ink-soft/60 p-4">
        <h3 className="text-xs tracking-wide text-brass uppercase">
          Members · scores · vote weights
        </h3>
        <p className="mt-1 text-xs text-stone/70">
          Weight 0 = cannot vote. Split aye/nay on the Floor when weight &gt; 1.
        </p>
        <ul className="mt-3 space-y-2">
          {[...chamber.players]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((p) => (
              <li
                key={p.id}
                className="space-y-2 rounded-lg bg-ink/40 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <input
                    value={nameDrafts[p.id] ?? p.name}
                    onChange={(e) =>
                      setNameDrafts((prev) => ({
                        ...prev,
                        [p.id]: e.target.value,
                      }))
                    }
                    className="min-w-28 flex-1 rounded border border-stone/20 bg-ink px-2 py-1 text-mist"
                  />
                  <button
                    type="button"
                    className="rounded border border-brass/40 px-2 py-1 text-[10px] text-brass"
                    onClick={() =>
                      admin(
                        chamberCode,
                        {
                          type: "set_player_name",
                          playerId: p.id,
                          name: nameDrafts[p.id] ?? p.name,
                        },
                        act,
                      )
                    }
                  >
                    Rename
                  </button>
                  {p.id !== chamber.hostId && (
                    <button
                      type="button"
                      className="rounded border border-stone/30 px-2 py-1 text-[10px] text-stone"
                      onClick={() =>
                        admin(
                          chamberCode,
                          { type: "set_host", playerId: p.id },
                          act,
                        )
                      }
                    >
                      Make host
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded border border-brass/40 px-2 py-1 text-[10px] text-brass"
                    onClick={() =>
                      admin(
                        chamberCode,
                        { type: "declare_winner", playerId: p.id },
                        act,
                      )
                    }
                  >
                    Declare winner
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-stone">
                  <label>
                    Score
                    <input
                      type="number"
                      value={scoreDrafts[p.id] ?? String(p.score)}
                      onChange={(e) =>
                        setScoreDrafts((prev) => ({
                          ...prev,
                          [p.id]: e.target.value,
                        }))
                      }
                      className="ml-1 w-20 rounded border border-stone/20 bg-ink px-1 py-0.5 text-mist"
                    />
                  </label>
                  <button
                    type="button"
                    className="rounded border border-brass/40 px-2 py-0.5 text-brass"
                    onClick={() =>
                      admin(
                        chamberCode,
                        {
                          type: "set_score",
                          playerId: p.id,
                          score: Number(scoreDrafts[p.id] ?? p.score),
                        },
                        act,
                      )
                    }
                  >
                    Set score
                  </button>
                  <label>
                    Votes
                    <input
                      type="number"
                      min={0}
                      value={
                        voteWeightDrafts[p.id] ?? String(p.voteWeight ?? 1)
                      }
                      onChange={(e) =>
                        setVoteWeightDrafts((prev) => ({
                          ...prev,
                          [p.id]: e.target.value,
                        }))
                      }
                      className="ml-1 w-16 rounded border border-stone/20 bg-ink px-1 py-0.5 text-mist"
                    />
                  </label>
                  <button
                    type="button"
                    className="rounded border border-brass/40 px-2 py-0.5 text-brass"
                    onClick={() =>
                      admin(
                        chamberCode,
                        {
                          type: "set_vote_weight",
                          playerId: p.id,
                          weight: Number(
                            voteWeightDrafts[p.id] ?? p.voteWeight ?? 1,
                          ),
                        },
                        act,
                      )
                    }
                  >
                    Set weight
                  </button>
                  {p.id === playerId && (
                    <span className="text-stone/60">(you)</span>
                  )}
                  {p.id === chamber.hostId && (
                    <span className="text-brass/80">Host</span>
                  )}
                </div>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
