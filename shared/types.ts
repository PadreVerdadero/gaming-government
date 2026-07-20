export type ProposalType = "enact" | "amend" | "repeal" | "transmute";
export type VoteChoice = "aye" | "nay";
export type GamePhase = "lobby" | "playing" | "finished";
export type ChatChannel = "floor" | "cloakroom";
export type RuleStatus = "active" | "amended" | "repealed";

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
  votes: Record<string, VoteChoice>;
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
    payload: { code: string; choice: VoteChoice },
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
};

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
