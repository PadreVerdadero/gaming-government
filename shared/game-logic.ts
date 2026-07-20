import {
  buildInitialRules,
  DEFAULT_PASS_THRESHOLD_PERCENT,
  DEFAULT_WIN_THRESHOLD,
} from "./initial-rules";
import type {
  Chamber,
  ChatMessage,
  LogEntry,
  Player,
  Proposal,
  ProposalType,
  PublicChamber,
  PublicPlayer,
  Rule,
  VoteChoice,
} from "./types";

export { DEFAULT_PASS_THRESHOLD_PERCENT, DEFAULT_WIN_THRESHOLD };

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function createEmptyChamber(code: string, title: string, host: Player): Chamber {
  const at = nowIso();
  return {
    code,
    title,
    hostId: host.id,
    phase: "lobby",
    players: [host],
    rules: buildInitialRules(at),
    proposals: [],
    nextProposalNumber: 301,
    passThresholdPercent: DEFAULT_PASS_THRESHOLD_PERCENT,
    winThreshold: DEFAULT_WIN_THRESHOLD,
    winnerId: null,
    messages: [],
    log: [
      {
        id: makeId("log"),
        at,
        text: `Chamber ${code} convened. Host: ${host.name}.`,
      },
    ],
    createdAt: at,
    updatedAt: at,
  };
}

/** Upgrade older saved chambers to the current shape. */
export function normalizeChamber(raw: Chamber): Chamber {
  const at = raw.createdAt || nowIso();
  const rules = (raw.rules ?? []).map((r, idx) => {
    const legacy = r as Rule & { repealed?: boolean };
    const status =
      legacy.status ??
      (legacy.repealed ? ("repealed" as const) : ("active" as const));
    return {
      id: legacy.id ?? `migrated_${legacy.number}_${idx}`,
      number: legacy.number,
      text: legacy.text,
      mutable: legacy.mutable,
      status,
      enactedById: legacy.enactedById ?? null,
      enactedByName: legacy.enactedByName ?? "Initial Set",
      enactedAt: legacy.enactedAt ?? at,
      replacesNumber: legacy.replacesNumber ?? null,
      supersededByNumber: legacy.supersededByNumber ?? null,
      previousText: legacy.previousText ?? null,
      restoresRuleId: legacy.restoresRuleId ?? null,
    } satisfies Rule;
  });

  const legacyMajority = Boolean(
    (raw as Chamber & { majorityRuleActive?: boolean }).majorityRuleActive,
  );

  const players = (raw.players ?? []).map((p) => ({
    ...p,
    voteWeight:
      typeof p.voteWeight === "number" && Number.isFinite(p.voteWeight)
        ? Math.max(0, Math.trunc(p.voteWeight))
        : 1,
  }));

  return {
    ...raw,
    players,
    rules,
    passThresholdPercent:
      raw.passThresholdPercent ??
      (legacyMajority ? 50 : DEFAULT_PASS_THRESHOLD_PERCENT),
    winThreshold: raw.winThreshold ?? DEFAULT_WIN_THRESHOLD,
    winnerId: raw.winnerId ?? null,
    proposals: raw.proposals ?? [],
    messages: raw.messages ?? [],
    log: raw.log ?? [],
  };
}

export function toPublicPlayer(p: Player): PublicPlayer {
  return {
    id: p.id,
    name: p.name,
    score: p.score,
    connected: p.connected,
    voteWeight: p.voteWeight ?? 1,
  };
}

export function eligibleVoters(chamber: Chamber): Player[] {
  return chamber.players.filter((p) => (p.voteWeight ?? 1) > 0);
}

export function playerVoteWeight(player: Player): number {
  return Math.max(0, Math.trunc(player.voteWeight ?? 1));
}

export function filterMessagesForPlayer(
  messages: ChatMessage[],
  playerId: string,
): ChatMessage[] {
  return messages.filter((m) => {
    if (m.channel === "floor") return true;
    return m.fromId === playerId || m.toId === playerId;
  });
}

export function toPublicChamber(chamber: Chamber, viewerId: string): PublicChamber {
  return {
    code: chamber.code,
    title: chamber.title,
    hostId: chamber.hostId,
    phase: chamber.phase,
    players: chamber.players.map(toPublicPlayer),
    rules: chamber.rules,
    proposals: chamber.proposals,
    nextProposalNumber: chamber.nextProposalNumber,
    passThresholdPercent: chamber.passThresholdPercent,
    winThreshold: chamber.winThreshold,
    winnerId: chamber.winnerId,
    messages: filterMessagesForPlayer(chamber.messages, viewerId),
    log: chamber.log,
    createdAt: chamber.createdAt,
    updatedAt: chamber.updatedAt,
  };
}

export function addLog(chamber: Chamber, text: string): void {
  const entry: LogEntry = { id: makeId("log"), at: nowIso(), text };
  chamber.log = [...chamber.log.slice(-199), entry];
  chamber.updatedAt = nowIso();
}

export function activeRules(chamber: Chamber): Rule[] {
  return chamber.rules.filter((r) => r.status === "active");
}

export function mutableRuleCount(chamber: Chamber): number {
  return activeRules(chamber).filter((r) => r.mutable).length;
}

export function getActiveProposal(chamber: Chamber): Proposal | undefined {
  return chamber.proposals.find(
    (p) => p.status === "debate" || p.status === "voting",
  );
}

export function findActiveRule(
  chamber: Chamber,
  number: number,
): Rule | undefined {
  return chamber.rules.find((r) => r.number === number && r.status === "active");
}

export function startSession(chamber: Chamber): string | null {
  if (chamber.phase !== "lobby") return "Session already under way.";
  if (chamber.players.length < 2) return "Need at least two legislators to convene.";

  chamber.phase = "playing";
  addLog(
    chamber,
    `Session opened. No fixed speaking order — any member may introduce a bill when the floor is clear. Points and passage thresholds are adjusted manually.`,
  );
  return null;
}

function playerName(chamber: Chamber, id: string): string {
  return chamber.players.find((p) => p.id === id)?.name ?? "A member";
}

function applyAdoptedProposal(
  chamber: Chamber,
  proposal: Proposal,
): string | null {
  const at = nowIso();
  const enactorName = playerName(chamber, proposal.proponentId);

  if (proposal.type === "enact") {
    if (mutableRuleCount(chamber) >= 25) {
      return "Rule 209: there may not be more than 25 mutable rules.";
    }
    chamber.rules.push({
      id: makeId("rule"),
      number: proposal.number,
      text: proposal.text,
      mutable: true,
      status: "active",
      enactedById: proposal.proponentId,
      enactedByName: enactorName,
      enactedAt: at,
    });
    return null;
  }

  if (proposal.type === "amend") {
    const target = proposal.targetRuleId
      ? chamber.rules.find(
          (r) => r.id === proposal.targetRuleId && r.status === "active",
        )
      : findActiveRule(chamber, proposal.targetRuleNumber!);
    if (!target) return "Target rule not found.";
    if (!target.mutable) return "Immutable rules may not be amended (Rule 103).";

    target.status = "amended";
    target.supersededByNumber = proposal.number;

    chamber.rules.push({
      id: makeId("rule"),
      number: proposal.number,
      text: proposal.text,
      mutable: true,
      status: "active",
      enactedById: proposal.proponentId,
      enactedByName: enactorName,
      enactedAt: at,
      replacesNumber: target.number,
      previousText: target.text,
      restoresRuleId: target.id,
    });
    return null;
  }

  if (proposal.type === "repeal") {
    const target = proposal.targetRuleId
      ? chamber.rules.find(
          (r) => r.id === proposal.targetRuleId && r.status === "active",
        )
      : findActiveRule(chamber, proposal.targetRuleNumber!);
    if (!target) return "Target rule not found.";
    if (!target.mutable) return "Immutable rules may not be repealed (Rule 103).";
    if (mutableRuleCount(chamber) <= 1) {
      return "Rule 114: there must always be at least one mutable rule.";
    }

    target.status = "repealed";
    target.supersededByNumber = proposal.number;

    // Repealing an amendment / transmute / repeal-instrument restores the prior rule.
    if (target.restoresRuleId) {
      const prior = chamber.rules.find((r) => r.id === target.restoresRuleId);
      if (prior && prior.status !== "active") {
        prior.status = "active";
        prior.supersededByNumber = null;
        addLog(
          chamber,
          `Repeal of Rule ${target.number} restores Rule ${prior.number} to force.`,
        );
      }
      return null;
    }

    // Pure repeal of a base rule: keep an instrument so that instrument can later be repealed to restore.
    chamber.rules.push({
      id: makeId("rule"),
      number: proposal.number,
      text: `Repeal of Rule ${target.number}.`,
      mutable: true,
      status: "active",
      enactedById: proposal.proponentId,
      enactedByName: enactorName,
      enactedAt: at,
      replacesNumber: target.number,
      previousText: target.text,
      restoresRuleId: target.id,
    });
    return null;
  }

  if (proposal.type === "transmute") {
    const target = proposal.targetRuleId
      ? chamber.rules.find(
          (r) => r.id === proposal.targetRuleId && r.status === "active",
        )
      : findActiveRule(chamber, proposal.targetRuleNumber!);
    if (!target) return "Target rule not found.";
    const becomingMutable = proposal.makeMutable ?? !target.mutable;
    if (becomingMutable && !target.mutable && mutableRuleCount(chamber) >= 25) {
      return "Rule 209: there may not be more than 25 mutable rules.";
    }
    if (!becomingMutable && target.mutable && mutableRuleCount(chamber) <= 1) {
      return "Rule 114: there must always be at least one mutable rule.";
    }

    const oldNumber = target.number;
    const oldMutable = target.mutable;

    target.status = "amended";
    target.supersededByNumber = proposal.number;

    chamber.rules.push({
      id: makeId("rule"),
      number: proposal.number,
      text: target.text,
      mutable: becomingMutable,
      status: "active",
      enactedById: proposal.proponentId,
      enactedByName: enactorName,
      enactedAt: at,
      replacesNumber: oldNumber,
      previousText: target.text,
      restoresRuleId: target.id,
    });

    addLog(
      chamber,
      `Rule ${oldNumber} (${oldMutable ? "mutable" : "immutable"}) transmuted to ${becomingMutable ? "mutable" : "immutable"} as Rule ${proposal.number}.`,
    );
    return null;
  }

  return "Unknown proposal type.";
}

function checkWinner(chamber: Chamber): void {
  if (chamber.phase === "finished") return;
  const leader = [...chamber.players].sort((a, b) => b.score - a.score)[0];
  if (leader && leader.score >= chamber.winThreshold) {
    chamber.winnerId = leader.id;
    chamber.phase = "finished";
    addLog(
      chamber,
      `${leader.name} reaches ${chamber.winThreshold} points and wins the session.`,
    );
  }
}

function passesThreshold(
  chamber: Chamber,
  ayeCount: number,
  total: number,
): boolean {
  if (total === 0) return false;
  const percent = (ayeCount / total) * 100;
  return percent + 1e-9 >= chamber.passThresholdPercent;
}

export function submitProposal(
  chamber: Chamber,
  playerId: string,
  input: {
    type: ProposalType;
    title?: string;
    text?: string;
    targetRuleNumber?: number;
    makeMutable?: boolean;
  },
): string | null {
  if (chamber.phase !== "playing") return "Session is not in play.";
  if (getActiveProposal(chamber)) return "A proposal is already on the floor.";

  if (input.type !== "enact" && input.targetRuleNumber == null) {
    return "Specify which rule this motion targets.";
  }

  let title = (input.title ?? "").trim();
  let text = (input.text ?? "").trim();
  let previousText: string | undefined;
  let previousMutable: boolean | undefined;
  let targetRuleId: string | undefined;

  if (input.type === "transmute") {
    if (input.makeMutable === undefined) {
      return "Transmutation must state the new status explicitly (Rule 109).";
    }
    const target = findActiveRule(chamber, input.targetRuleNumber!);
    if (!target) return "Target rule not found.";
    targetRuleId = target.id;
    previousText = target.text;
    previousMutable = target.mutable;
    const dest = input.makeMutable ? "mutable" : "immutable";
    title = `Transmute Rule ${target.number} to ${dest}`;
    text = `Transmute Rule ${target.number} from ${target.mutable ? "mutable" : "immutable"} to ${dest}.`;
  } else if (input.type === "repeal") {
    const target = findActiveRule(chamber, input.targetRuleNumber!);
    if (!target) return "Target rule not found.";
    if (!target.mutable) return "Immutable rules may not be repealed (Rule 103).";
    targetRuleId = target.id;
    previousText = target.text;
    title = title || `Repeal Rule ${target.number}`;
    text = text || `Repeal Rule ${target.number}.`;
  } else if (input.type === "amend") {
    const target = findActiveRule(chamber, input.targetRuleNumber!);
    if (!target) return "Target rule not found.";
    if (!target.mutable) return "Immutable rules may not be amended (Rule 103).";
    targetRuleId = target.id;
    previousText = target.text;
    if (!title) title = `Amend Rule ${target.number}`;
    if (!text) return "Provide the amended text of the rule.";
  } else {
    if (!title || !text) return "Bills need a title and body text.";
    if (mutableRuleCount(chamber) >= 25) {
      return "Rule 209: there may not be more than 25 mutable rules.";
    }
  }

  const proposal: Proposal = {
    number: chamber.nextProposalNumber,
    proponentId: playerId,
    type: input.type,
    title,
    text,
    targetRuleNumber: input.targetRuleNumber,
    targetRuleId,
    makeMutable: input.makeMutable,
    previousText,
    previousMutable,
    status: "debate",
    votes: {},
    createdAt: nowIso(),
  };

  chamber.nextProposalNumber += 1;
  chamber.proposals.push(proposal);
  addLog(
    chamber,
    `${playerName(chamber, playerId)} introduced Proposal ${proposal.number}: ${proposal.title}. Debate is open on The Floor.`,
  );
  return null;
}

export function openRollCall(chamber: Chamber, playerId: string): string | null {
  if (chamber.phase !== "playing") return "Session is not in play.";
  const proposal = getActiveProposal(chamber);
  if (!proposal || proposal.status !== "debate") {
    return "No bill is in debate.";
  }
  if (proposal.proponentId !== playerId) return "Only the proponent may call the roll.";
  if (eligibleVoters(chamber).length === 0) {
    return "No eligible voters (everyone has zero vote weight).";
  }

  proposal.status = "voting";
  addLog(chamber, `Roll call opened on Proposal ${proposal.number}.`);
  return null;
}

/** Proponent may revise the bill during debate (Rule 111). */
export function editProposal(
  chamber: Chamber,
  playerId: string,
  input: { title?: string; text?: string; makeMutable?: boolean },
): string | null {
  if (chamber.phase !== "playing") return "Session is not in play.";
  const proposal = getActiveProposal(chamber);
  if (!proposal || proposal.status !== "debate") {
    return "A bill may only be revised while it is in debate.";
  }
  if (proposal.proponentId !== playerId) {
    return "Only the proponent may revise the final form of the proposal.";
  }

  if (proposal.type === "transmute") {
    if (input.makeMutable === undefined) {
      return "Transmutation must state the new status explicitly.";
    }
    const targetNum = proposal.targetRuleNumber;
    const dest = input.makeMutable ? "mutable" : "immutable";
    const from = proposal.previousMutable ? "mutable" : "immutable";
    proposal.makeMutable = input.makeMutable;
    proposal.title = `Transmute Rule ${targetNum} to ${dest}`;
    proposal.text = `Transmute Rule ${targetNum} from ${from} to ${dest}.`;
    addLog(
      chamber,
      `${playerName(chamber, playerId)} revised Proposal ${proposal.number} during debate (${proposal.title}).`,
    );
    chamber.updatedAt = nowIso();
    return null;
  }

  if (proposal.type === "repeal") {
    const title = (input.title ?? proposal.title).trim();
    if (!title) return "Repeal needs a title.";
    proposal.title = title;
    proposal.text = `Repeal Rule ${proposal.targetRuleNumber}.`;
    addLog(
      chamber,
      `${playerName(chamber, playerId)} revised Proposal ${proposal.number} during debate.`,
    );
    chamber.updatedAt = nowIso();
    return null;
  }

  const title = (input.title ?? proposal.title).trim();
  const text = (input.text ?? proposal.text).trim();
  if (!title || !text) return "Revised bills still need a title and body text.";

  proposal.title = title;
  proposal.text = text;
  addLog(
    chamber,
    `${playerName(chamber, playerId)} revised Proposal ${proposal.number} during debate.`,
  );
  chamber.updatedAt = nowIso();
  return null;
}

export function castVote(
  chamber: Chamber,
  playerId: string,
  choice: VoteChoice,
): string | null {
  if (chamber.phase !== "playing") return "Session is not in play.";
  const proposal = getActiveProposal(chamber);
  if (!proposal || proposal.status !== "voting") return "No roll call is open.";
  const voter = chamber.players.find((p) => p.id === playerId);
  if (!voter) return "Member not found.";
  if (playerVoteWeight(voter) <= 0) {
    return "You have zero votes and do not participate in this roll call.";
  }
  if (proposal.votes[playerId]) return "You have already voted.";

  proposal.votes[playerId] = choice;

  const eligible = eligibleVoters(chamber);
  const allIn = eligible.every((p) => proposal.votes[p.id] != null);
  if (!allIn) {
    chamber.updatedAt = nowIso();
    return null;
  }

  return resolveVote(chamber, proposal);
}

function weightedTally(
  chamber: Chamber,
  proposal: Proposal,
): { ayeWeight: number; nayWeight: number; totalWeight: number } {
  let ayeWeight = 0;
  let nayWeight = 0;
  let totalWeight = 0;
  for (const voter of eligibleVoters(chamber)) {
    const weight = playerVoteWeight(voter);
    totalWeight += weight;
    if (proposal.votes[voter.id] === "aye") ayeWeight += weight;
    if (proposal.votes[voter.id] === "nay") nayWeight += weight;
  }
  return { ayeWeight, nayWeight, totalWeight };
}

function resolveVote(chamber: Chamber, proposal: Proposal): string | null {
  const { ayeWeight, nayWeight, totalWeight } = weightedTally(chamber, proposal);

  const adopted = passesThreshold(chamber, ayeWeight, totalWeight);
  proposal.resolvedAt = nowIso();

  if (adopted) {
    const err = applyAdoptedProposal(chamber, proposal);
    if (err) {
      proposal.status = "defeated";
      addLog(
        chamber,
        `Proposal ${proposal.number} could not take effect (${err}) and is treated as defeated. Adjust points manually if the rules require it.`,
      );
    } else {
      proposal.status = "adopted";
      addLog(
        chamber,
        `Proposal ${proposal.number} adopted (${ayeWeight}-${nayWeight} weighted) at ${chamber.passThresholdPercent}% threshold.`,
      );
    }
  } else {
    proposal.status = "defeated";
    addLog(
      chamber,
      `Proposal ${proposal.number} defeated (${ayeWeight}-${nayWeight} weighted). Needed ${chamber.passThresholdPercent}% aye.`,
    );
  }

  checkWinner(chamber);
  chamber.updatedAt = nowIso();
  return null;
}

export function setVoteWeight(
  chamber: Chamber,
  actorId: string,
  playerId: string,
  weight: number,
): string | null {
  if (!Number.isFinite(weight) || weight < 0) {
    return "Vote weight must be zero or a positive integer.";
  }
  const target = chamber.players.find((p) => p.id === playerId);
  if (!target) return "Member not found.";
  target.voteWeight = Math.trunc(weight);
  addLog(
    chamber,
    `${playerName(chamber, actorId)} set ${target.name}'s vote weight to ${target.voteWeight}.`,
  );
  return null;
}

export function adjustScore(
  chamber: Chamber,
  actorId: string,
  playerId: string,
  delta: number,
): string | null {
  if (chamber.phase === "lobby") return "Open the session before adjusting scores.";
  if (!Number.isFinite(delta) || delta === 0) return "Invalid score change.";
  const target = chamber.players.find((p) => p.id === playerId);
  if (!target) return "Member not found.";
  target.score += Math.trunc(delta);
  addLog(
    chamber,
    `${playerName(chamber, actorId)} adjusted ${target.name}'s score by ${delta >= 0 ? "+" : ""}${Math.trunc(delta)} (now ${target.score}).`,
  );
  checkWinner(chamber);
  return null;
}

export function setWinThreshold(
  chamber: Chamber,
  actorId: string,
  value: number,
): string | null {
  if (!Number.isFinite(value) || value < 1) return "Win threshold must be at least 1.";
  chamber.winThreshold = Math.trunc(value);
  addLog(
    chamber,
    `${playerName(chamber, actorId)} set the win threshold to ${chamber.winThreshold} points.`,
  );
  checkWinner(chamber);
  return null;
}

export function setPassThreshold(
  chamber: Chamber,
  actorId: string,
  value: number,
): string | null {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return "Passage threshold must be between 0 and 100 percent.";
  }
  chamber.passThresholdPercent = Math.round(value * 100) / 100;
  addLog(
    chamber,
    `${playerName(chamber, actorId)} set the passage threshold to ${chamber.passThresholdPercent}% aye.`,
  );
  return null;
}

export function postFloorMessage(
  chamber: Chamber,
  player: Player,
  text: string,
): string | null {
  const body = text.trim();
  if (!body) return "Empty remarks are out of order.";
  if (body.length > 2000) return "Remarks limited to 2000 characters.";

  chamber.messages.push({
    id: makeId("msg"),
    channel: "floor",
    fromId: player.id,
    fromName: player.name,
    text: body,
    at: nowIso(),
  });
  if (chamber.messages.length > 500) {
    chamber.messages = chamber.messages.slice(-500);
  }
  chamber.updatedAt = nowIso();
  return null;
}

export function postCloakroomMessage(
  chamber: Chamber,
  player: Player,
  toId: string,
  text: string,
): string | null {
  const body = text.trim();
  if (!body) return "Empty whispers are out of order.";
  if (body.length > 2000) return "Whispers limited to 2000 characters.";
  const to = chamber.players.find((p) => p.id === toId);
  if (!to) return "That member is not in this chamber.";
  if (to.id === player.id) return "The Cloakroom is for talking to someone else.";

  chamber.messages.push({
    id: makeId("msg"),
    channel: "cloakroom",
    fromId: player.id,
    fromName: player.name,
    toId: to.id,
    toName: to.name,
    text: body,
    at: nowIso(),
  });
  if (chamber.messages.length > 500) {
    chamber.messages = chamber.messages.slice(-500);
  }
  chamber.updatedAt = nowIso();
  return null;
}
