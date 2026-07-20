export type ProposalType = "enact" | "amend" | "repeal" | "transmute";
export type VoteChoice = "aye" | "nay";
export type GamePhase = "lobby" | "playing" | "finished";
export type ChatChannel = "floor" | "cloakroom";
export type RuleStatus = "active" | "amended" | "repealed";

/** How a voter splits their vote weight between aye and nay. */
export interface Ballot {
  aye: number;
  nay: number;
}

export interface Rule {
  /** Stable identity across amendments. */
  id: string;
  number: number;
  text: string;
  mutable: boolean;
  status: RuleStatus;
  enactedById: string | null;
  enactedByName: string;
  enactedAt: string;
  /** Prior rule number this version replaced. */
  replacesNumber?: number | null;
  /** Proposal/rule number that amended or repealed this entry. */
  supersededByNumber?: number | null;
  /** Text before this amending version (for diffs). */
  previousText?: string | null;
  /** If this rule is repealed, restore that lineage rule to active. */
  restoresRuleId?: string | null;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  /** Voting power; 0 means excluded from roll calls. Default 1. */
  voteWeight: number;
  /** Secret; only ever sent to that player (and stored server-side). */
  seatToken: string;
}

export interface PublicPlayer {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  voteWeight: number;
}

export interface Proposal {
  number: number;
  proponentId: string;
  type: ProposalType;
  title: string;
  text: string;
  targetRuleNumber?: number;
  targetRuleId?: string;
  makeMutable?: boolean;
  /** Snapshot of target text before amendment (for debate/vote diffs). */
  previousText?: string;
  previousMutable?: boolean;
  status: "debate" | "voting" | "adopted" | "defeated";
  /** Player id -> ballot. Legacy string votes are normalized on load. */
  votes: Record<string, Ballot>;
  createdAt: string;
  resolvedAt?: string;
}

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  fromId: string;
  fromName: string;
  toId?: string;
  toName?: string;
  text: string;
  at: string;
}

export interface LogEntry {
  id: string;
  at: string;
  text: string;
}

export interface Chamber {
  code: string;
  title: string;
  hostId: string;
  phase: GamePhase;
  players: Player[];
  rules: Rule[];
  proposals: Proposal[];
  nextProposalNumber: number;
  /** Percent of aye votes required to adopt (100 = unanimity). */
  passThresholdPercent: number;
  winThreshold: number;
  winnerId: string | null;
  messages: ChatMessage[];
  log: LogEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicChamber {
  code: string;
  title: string;
  hostId: string;
  phase: GamePhase;
  players: PublicPlayer[];
  rules: Rule[];
  proposals: Proposal[];
  nextProposalNumber: number;
  passThresholdPercent: number;
  winThreshold: number;
  winnerId: string | null;
  messages: ChatMessage[];
  log: LogEntry[];
  createdAt: string;
  updatedAt: string;
}

export type ClientToServerEvents = {
  create_chamber: (
    payload: { title: string; hostName: string },
    ack: (res: JoinAck) => void,
  ) => void;
  join_chamber: (
    payload: { code: string; name: string },
    ack: (res: JoinAck) => void,
  ) => void;
  resume_seat: (
    payload: { code: string; seatToken: string },
    ack: (res: JoinAck) => void,
  ) => void;
  start_session: (payload: { code: string }, ack: (res: ActionAck) => void) => void;
  submit_proposal: (
    payload: {
      code: string;
      type: ProposalType;
      title?: string;
      text?: string;
      targetRuleNumber?: number;
      makeMutable?: boolean;
    },
    ack: (res: ActionAck) => void,
  ) => void;
  open_roll_call: (payload: { code: string }, ack: (res: ActionAck) => void) => void;
  edit_proposal: (
    payload: {
      code: string;
      title?: string;
      text?: string;
      makeMutable?: boolean;
    },
    ack: (res: ActionAck) => void,
  ) => void;
  cast_vote: (
    payload: { code: string; aye: number; nay: number },
    ack: (res: ActionAck) => void,
  ) => void;
  adjust_score: (
    payload: { code: string; playerId: string; delta: number },
    ack: (res: ActionAck) => void,
  ) => void;
  set_win_threshold: (
    payload: { code: string; value: number },
    ack: (res: ActionAck) => void,
  ) => void;
  set_pass_threshold: (
    payload: { code: string; value: number },
    ack: (res: ActionAck) => void,
  ) => void;
  set_vote_weight: (
    payload: { code: string; playerId: string; weight: number },
    ack: (res: ActionAck) => void,
  ) => void;
  floor_message: (
    payload: { code: string; text: string },
    ack: (res: ActionAck) => void,
  ) => void;
  cloakroom_message: (
    payload: { code: string; toId: string; text: string },
    ack: (res: ActionAck) => void,
  ) => void;
  /** Omnibus admin control — ledger overrides for play. */
  admin_action: (
    payload: { code: string; action: AdminAction },
    ack: (res: ActionAck) => void,
  ) => void;
};

export type AdminAction =
  | { type: "force_adopt_proposal" }
  | { type: "force_defeat_proposal" }
  | { type: "withdraw_proposal" }
  | { type: "open_roll_call" }
  | {
      type: "set_ballot";
      playerId: string;
      aye: number;
      nay: number;
    }
  | { type: "resolve_vote_now" }
  | {
      type: "enact_rule";
      text: string;
      mutable?: boolean;
      number?: number;
      title?: string;
    }
  | {
      type: "edit_rule";
      ruleId: string;
      text?: string;
      number?: number;
      mutable?: boolean;
      status?: RuleStatus;
    }
  | { type: "set_rule_mutable"; ruleId: string; mutable: boolean }
  | { type: "repeal_rule"; ruleId: string }
  | { type: "restore_rule"; ruleId: string }
  | { type: "set_score"; playerId: string; score: number }
  | { type: "set_player_name"; playerId: string; name: string }
  | { type: "set_vote_weight"; playerId: string; weight: number }
  | { type: "set_host"; playerId: string }
  | { type: "set_chamber_title"; title: string }
  | { type: "set_phase"; phase: GamePhase }
  | { type: "set_next_proposal_number"; value: number }
  | { type: "set_win_threshold"; value: number }
  | { type: "set_pass_threshold"; value: number }
  | { type: "clear_winner" }
  | { type: "declare_winner"; playerId: string };

export type ServerToClientEvents = {
  chamber_update: (chamber: PublicChamber) => void;
  personal: (payload: { seatToken: string; playerId: string }) => void;
  error_message: (payload: { message: string }) => void;
};

export type JoinAck =
  | {
      ok: true;
      chamber: PublicChamber;
      seatToken: string;
      playerId: string;
    }
  | { ok: false; error: string };

export type ActionAck = { ok: true } | { ok: false; error: string };
