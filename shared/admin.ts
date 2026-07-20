import {
  addLog,
  castVote,
  checkWinner,
  forceAdoptProposal,
  forceDefeatProposal,
  getActiveProposal,
  makeId,
  nowIso,
  playerName,
  playerVoteWeight,
  resolveVote,
  setPassThreshold,
  setVoteWeight,
  setWinThreshold,
  withdrawProposal,
} from "./game-logic";
import type { AdminAction, Chamber, Rule } from "./types";

export function applyAdminAction(
  chamber: Chamber,
  actorId: string,
  action: AdminAction,
): string | null {
  switch (action.type) {
    case "force_adopt_proposal":
      return forceAdoptProposal(chamber, actorId);
    case "force_defeat_proposal":
      return forceDefeatProposal(chamber, actorId);
    case "withdraw_proposal":
      return withdrawProposal(chamber, actorId);
    case "open_roll_call": {
      const proposal = getActiveProposal(chamber);
      if (!proposal || proposal.status !== "debate") {
        return "No bill in debate to call.";
      }
      // Temporarily treat actor as proponent for openRollCall check by calling logic inline
      proposal.status = "voting";
      addLog(
        chamber,
        `${playerName(chamber, actorId)} opened roll call on Proposal ${proposal.number} (admin).`,
      );
      return null;
    }
    case "set_ballot":
      return castVote(chamber, action.playerId, action.aye, action.nay, {
        allowOverwrite: true,
        skipWeightCheck: false,
      });
    case "resolve_vote_now": {
      const proposal = getActiveProposal(chamber);
      if (!proposal || proposal.status !== "voting") {
        return "No roll call is open.";
      }
      addLog(
        chamber,
        `${playerName(chamber, actorId)} resolved the roll call early (admin).`,
      );
      return resolveVote(chamber, proposal);
    }
    case "enact_rule": {
      const text = action.text.trim();
      if (!text) return "Rule text is required.";
      const number = action.number ?? chamber.nextProposalNumber;
      if (chamber.rules.some((r) => r.number === number && r.status === "active")) {
        return `Rule ${number} is already active.`;
      }
      if (action.number == null) chamber.nextProposalNumber = number + 1;
      else if (number >= chamber.nextProposalNumber) {
        chamber.nextProposalNumber = number + 1;
      }
      const rule: Rule = {
        id: makeId("rule"),
        number,
        text,
        mutable: action.mutable ?? true,
        status: "active",
        enactedById: actorId,
        enactedByName: playerName(chamber, actorId),
        enactedAt: nowIso(),
      };
      chamber.rules.push(rule);
      addLog(
        chamber,
        `${playerName(chamber, actorId)} enacted Rule ${number} by admin fiat${action.title ? ` (${action.title})` : ""}.`,
      );
      return null;
    }
    case "edit_rule": {
      const rule = chamber.rules.find((r) => r.id === action.ruleId);
      if (!rule) return "Rule not found.";
      if (action.text != null) rule.text = action.text;
      if (action.number != null) rule.number = Math.trunc(action.number);
      if (action.mutable != null) rule.mutable = action.mutable;
      if (action.status != null) rule.status = action.status;
      addLog(
        chamber,
        `${playerName(chamber, actorId)} edited Rule ${rule.number} (admin).`,
      );
      return null;
    }
    case "set_rule_mutable": {
      const rule = chamber.rules.find((r) => r.id === action.ruleId);
      if (!rule) return "Rule not found.";
      if (rule.status !== "active") return "Only active rules can be transmuted here.";
      rule.mutable = action.mutable;
      addLog(
        chamber,
        `${playerName(chamber, actorId)} set Rule ${rule.number} to ${action.mutable ? "mutable" : "immutable"} (admin).`,
      );
      return null;
    }
    case "repeal_rule": {
      const rule = chamber.rules.find((r) => r.id === action.ruleId);
      if (!rule) return "Rule not found.";
      if (rule.status !== "active") return "Rule is not active.";
      rule.status = "repealed";
      rule.supersededByNumber = rule.supersededByNumber ?? chamber.nextProposalNumber;
      if (rule.restoresRuleId) {
        const prior = chamber.rules.find((r) => r.id === rule.restoresRuleId);
        if (prior && prior.status !== "active") {
          prior.status = "active";
          prior.supersededByNumber = null;
        }
      }
      addLog(
        chamber,
        `${playerName(chamber, actorId)} repealed Rule ${rule.number} (admin).`,
      );
      return null;
    }
    case "restore_rule": {
      const rule = chamber.rules.find((r) => r.id === action.ruleId);
      if (!rule) return "Rule not found.";
      rule.status = "active";
      rule.supersededByNumber = null;
      addLog(
        chamber,
        `${playerName(chamber, actorId)} restored Rule ${rule.number} to active (admin).`,
      );
      return null;
    }
    case "set_score": {
      const target = chamber.players.find((p) => p.id === action.playerId);
      if (!target) return "Member not found.";
      target.score = Math.trunc(action.score);
      addLog(
        chamber,
        `${playerName(chamber, actorId)} set ${target.name}'s score to ${target.score} (admin).`,
      );
      checkWinner(chamber);
      return null;
    }
    case "set_player_name": {
      const name = action.name.trim();
      if (!name) return "Name required.";
      const target = chamber.players.find((p) => p.id === action.playerId);
      if (!target) return "Member not found.";
      const old = target.name;
      target.name = name;
      addLog(
        chamber,
        `${playerName(chamber, actorId)} renamed ${old} to ${name} (admin).`,
      );
      return null;
    }
    case "set_vote_weight":
      return setVoteWeight(chamber, actorId, action.playerId, action.weight);
    case "set_host": {
      const target = chamber.players.find((p) => p.id === action.playerId);
      if (!target) return "Member not found.";
      chamber.hostId = target.id;
      addLog(
        chamber,
        `${playerName(chamber, actorId)} made ${target.name} the host (admin).`,
      );
      return null;
    }
    case "set_chamber_title": {
      const title = action.title.trim();
      if (!title) return "Title required.";
      chamber.title = title;
      addLog(
        chamber,
        `${playerName(chamber, actorId)} retitled the chamber to “${title}” (admin).`,
      );
      return null;
    }
    case "set_phase": {
      chamber.phase = action.phase;
      if (action.phase !== "finished") chamber.winnerId = null;
      addLog(
        chamber,
        `${playerName(chamber, actorId)} set phase to ${action.phase} (admin).`,
      );
      return null;
    }
    case "set_next_proposal_number": {
      if (!Number.isFinite(action.value) || action.value < 1) {
        return "Proposal number must be at least 1.";
      }
      chamber.nextProposalNumber = Math.trunc(action.value);
      addLog(
        chamber,
        `${playerName(chamber, actorId)} set next proposal number to ${chamber.nextProposalNumber} (admin).`,
      );
      return null;
    }
    case "set_win_threshold":
      return setWinThreshold(chamber, actorId, action.value);
    case "set_pass_threshold":
      return setPassThreshold(chamber, actorId, action.value);
    case "clear_winner": {
      chamber.winnerId = null;
      if (chamber.phase === "finished") chamber.phase = "playing";
      addLog(
        chamber,
        `${playerName(chamber, actorId)} cleared the winner (admin).`,
      );
      return null;
    }
    case "declare_winner": {
      const target = chamber.players.find((p) => p.id === action.playerId);
      if (!target) return "Member not found.";
      chamber.winnerId = target.id;
      chamber.phase = "finished";
      addLog(
        chamber,
        `${playerName(chamber, actorId)} declared ${target.name} the winner (admin).`,
      );
      return null;
    }
    default:
      return "Unknown admin action.";
  }
}

/** Convenience for UI: default ballot for a voter. */
export function defaultBallotForWeight(weight: number): { aye: number; nay: number } {
  const w = Math.max(0, Math.trunc(weight));
  return { aye: w, nay: 0 };
}

export function ballotUsesFullWeight(
  aye: number,
  nay: number,
  weight: number,
): boolean {
  return Math.max(0, Math.trunc(aye)) + Math.max(0, Math.trunc(nay)) ===
    playerVoteWeight({ voteWeight: weight } as never);
}
