import type { Rule } from "./types";

const SEED: Array<{ number: number; mutable: boolean; text: string }> = [
  {
    number: 101,
    mutable: false,
    text: "All players must always abide by all the rules then in effect, in the form in which they are then in effect. The rules in the Initial Set are in effect whenever a game begins. The Initial Set consists of Rules 101-116 (immutable) and 201-213 (mutable).",
  },
  {
    number: 102,
    mutable: false,
    text: "Initially rules in the 100's are immutable and rules in the 200's are mutable. Rules subsequently enacted or transmuted (that is, changed from immutable to mutable or vice versa) may be immutable or mutable regardless of their numbers, and rules in the Initial Set may be transmuted regardless of their numbers.",
  },
  {
    number: 103,
    mutable: false,
    text: "A rule-change is any of the following: (1) the enactment, repeal, or amendment of a mutable rule; (2) the enactment, repeal, or amendment of an amendment of a mutable rule; or (3) the transmutation of an immutable rule into a mutable rule or vice versa.",
  },
  {
    number: 104,
    mutable: false,
    text: "All rule-changes proposed in the proper way shall be voted on. They will be adopted if and only if they receive the required number of votes.",
  },
  {
    number: 105,
    mutable: false,
    text: "Every player is an eligible voter. Every eligible voter must participate in every vote on rule-changes.",
  },
  {
    number: 106,
    mutable: false,
    text: "All proposed rule-changes shall be written down before they are voted on. If they are adopted, they shall guide play in the form in which they were voted on.",
  },
  {
    number: 107,
    mutable: false,
    text: "No rule-change may take effect earlier than the moment of the completion of the vote that adopted it, even if its wording explicitly states otherwise. No rule-change may have retroactive application.",
  },
  {
    number: 108,
    mutable: false,
    text: "Each proposed rule-change shall be given a number for reference. The numbers shall begin with 301, and each rule-change proposed in the proper way shall receive the next successive integer, whether or not the proposal is adopted. If a rule is repealed and reenacted, it receives the number of the proposal to reenact it. If a rule is amended or transmuted, it receives the number of the proposal to amend or transmute it. If an amendment is amended or repealed, the entire rule of which it is a part receives the number of the proposal to amend or repeal the amendment.",
  },
  {
    number: 109,
    mutable: false,
    text: "Rule-changes that transmute immutable rules into mutable rules may be adopted if and only if the vote is unanimous among the eligible voters. Transmutation shall not be implied, but must be stated explicitly in a proposal to take effect.",
  },
  {
    number: 110,
    mutable: false,
    text: 'In a conflict between a mutable and an immutable rule, the immutable rule takes precedence and the mutable rule shall be entirely void. For the purposes of this rule a proposal to transmute an immutable rule does not "conflict" with that immutable rule.',
  },
  {
    number: 111,
    mutable: false,
    text: "If a rule-change as proposed is unclear, ambiguous, paradoxical, or destructive of play, or if it arguably consists of two or more rule-changes compounded or is an amendment that makes no difference, or if it is otherwise of questionable value, then the other players may suggest amendments or argue against the proposal before the vote. A reasonable time must be allowed for this debate. The proponent decides the final form in which the proposal is to be voted on and, unless the Judge has been asked to do so, also decides the time to end debate and vote.",
  },
  {
    number: 112,
    mutable: false,
    text: "The state of affairs that constitutes winning may not be altered from achieving n points to any other state of affairs. The magnitude of n and the means of earning points may be changed, and rules that establish a winner when play cannot continue may be enacted and (while they are mutable) be amended or repealed.",
  },
  {
    number: 113,
    mutable: false,
    text: "A player always has the option to forfeit the game rather than continue to play or incur a game penalty. No penalty worse than losing, in the judgment of the player to incur it, may be imposed.",
  },
  {
    number: 114,
    mutable: false,
    text: "There must always be at least one mutable rule. The adoption of rule-changes must never become completely impermissible.",
  },
  {
    number: 115,
    mutable: false,
    text: "Rule-changes that affect rules needed to allow or apply rule-changes are as permissible as other rule-changes. Even rule-changes that amend or repeal their own authority are permissible. No rule-change or type of move is impermissible solely on account of the self-reference or self-application of a rule.",
  },
  {
    number: 116,
    mutable: false,
    text: "Whatever is not prohibited or regulated by a rule is permitted and unregulated, with the sole exception of changing the rules, which is permitted only when a rule or set of rules explicitly or implicitly permits it.",
  },
  {
    number: 201,
    mutable: true,
    text: "Players shall alternate in clockwise order, taking one whole turn apiece. Turns may not be skipped or passed, and parts of turns may not be omitted. All players begin with zero points. In mail and computer games, players shall alternate in alphabetical order by surname.",
  },
  {
    number: 202,
    mutable: true,
    text: "One turn consists of two parts in this order: (1) proposing one rule-change and having it voted on, and (2) throwing one die once and adding the number of points on its face to one's score. In mail and computer games, instead of throwing a die, players subtract 291 from the ordinal number of their proposal and multiply the result by the fraction of favorable votes it received, rounded to the nearest integer.",
  },
  {
    number: 203,
    mutable: true,
    text: "A rule-change is adopted if and only if the vote is unanimous among the eligible voters. If this rule is not amended by the end of the second complete circuit of turns, it automatically changes to require only a simple majority.",
  },
  {
    number: 204,
    mutable: true,
    text: "If and when rule-changes can be adopted without unanimity, the players who vote against winning proposals shall receive 10 points each.",
  },
  {
    number: 205,
    mutable: true,
    text: "An adopted rule-change takes full effect at the moment of the completion of the vote that adopted it.",
  },
  {
    number: 206,
    mutable: true,
    text: "When a proposed rule-change is defeated, the player who proposed it loses 10 points.",
  },
  {
    number: 207,
    mutable: true,
    text: "Each player always has exactly one vote.",
  },
  {
    number: 208,
    mutable: true,
    text: "The winner is the first player to achieve 100 (positive) points. In mail and computer games, the winner is the first player to achieve 200 (positive) points.",
  },
  {
    number: 209,
    mutable: true,
    text: "At no time may there be more than 25 mutable rules.",
  },
  {
    number: 210,
    mutable: true,
    text: "Players may not conspire or consult on the making of future rule-changes unless they are team-mates. The first paragraph of this rule does not apply to games by mail or computer.",
  },
  {
    number: 211,
    mutable: true,
    text: "If two or more mutable rules conflict with one another, or if two or more immutable rules conflict with one another, then the rule with the lowest ordinal number takes precedence. If at least one of the rules in conflict explicitly says of itself that it defers to another rule (or type of rule) or takes precedence over another rule (or type of rule), then such provisions shall supersede the numerical method for determining precedence. If two or more rules claim to take precedence over one another or to defer to one another, then the numerical method again governs.",
  },
  {
    number: 212,
    mutable: true,
    text: "If players disagree about the legality of a move or the interpretation or application of a rule, then the player preceding the one moving is to be the Judge and decide the question. Disagreement for the purposes of this rule may be created by the insistence of any player. This process is called invoking Judgment. Judgment, overruling, and related procedures are handled by the players; the chamber software does not decide interpretive disputes.",
  },
  {
    number: 213,
    mutable: true,
    text: "If the rules are changed so that further play is impossible, or if the legality of a move cannot be determined with finality, or if by the Judge's best reasoning, not overruled, a move appears equally legal and illegal, then the first player unable to complete a turn is the winner. This rule takes precedence over every other rule determining the winner.",
  },
];

export const DEFAULT_WIN_THRESHOLD = 200;
export const DEFAULT_PASS_THRESHOLD_PERCENT = 100;

export function buildInitialRules(at: string): Rule[] {
  return SEED.map((r) => ({
    id: `initial_${r.number}`,
    number: r.number,
    text: r.text,
    mutable: r.mutable,
    status: "active" as const,
    enactedById: null,
    enactedByName: "Initial Set",
    enactedAt: at,
  }));
}
