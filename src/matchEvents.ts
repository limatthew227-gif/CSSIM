import type { MapId } from "./gameData";
import type { FeedLine, MatchState } from "./sim";

export type MatchEventTeam = "left" | "right" | "neutral";
export type MatchEventType = NonNullable<FeedLine["type"]> | "kill";

export interface MatchEventPosition {
  x: number;
  y: number;
}

export interface MatchEvent {
  id: string;
  round: number;
  time?: number;
  type: MatchEventType;
  team: MatchEventTeam;
  actorId?: string;
  actor?: string;
  targetId?: string;
  target?: string;
  assistantId?: string;
  assistant?: string;
  weapon?: string;
  firstKill?: boolean;
  headshot?: boolean;
  flashAssist?: boolean;
  reason?: string;
  actorPos?: MatchEventPosition;
  targetPos?: MatchEventPosition;
  grenadeTargetPos?: MatchEventPosition;
  engage?: { from: string; to: string };
  ctAlive?: number;
  tAlive?: number;
  ctScore?: number;
  tScore?: number;
}

export interface MatchEventLog {
  schemaVersion: 1;
  map: MapId;
  events: MatchEvent[];
}

export function eventLogFromMatchState(map: MapId, state: MatchState): MatchEventLog {
  return eventLogFromFeed(map, state.eventFeed ?? [...state.feed].reverse());
}

export function eventLogFromFeed(map: MapId, feed: FeedLine[]): MatchEventLog {
  return {
    schemaVersion: 1,
    map,
    events: feed.map((line, index) => eventFromFeedLine(line, index)),
  };
}

function eventFromFeedLine(line: FeedLine, index: number): MatchEvent {
  return withoutUndefined({
    id: `${line.round}-${index}-${line.type ?? "kill"}-${line.killerId || "neutral"}-${line.victimId || "none"}`,
    round: line.round,
    time: line.t,
    type: line.type ?? "kill",
    team: eventTeam(line.team),
    actorId: line.killerId || undefined,
    actor: line.killer || undefined,
    targetId: line.victimId || undefined,
    target: line.victim || undefined,
    assistantId: line.assistantId || undefined,
    assistant: line.assistant || undefined,
    weapon: line.weapon || undefined,
    firstKill: line.first || undefined,
    headshot: line.isHeadshot || undefined,
    flashAssist: line.flashAssist || undefined,
    reason: line.reason || undefined,
    actorPos: line.killerPos,
    targetPos: line.victimPos,
    grenadeTargetPos: line.targetPos,
    engage: line.engage,
    ctAlive: line.ctAlive,
    tAlive: line.tAlive,
    ctScore: line.ctScore,
    tScore: line.tScore,
  });
}

function eventTeam(team: FeedLine["team"]): MatchEventTeam {
  if (team === "you") return "left";
  if (team === "opponent") return "right";
  return "neutral";
}

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
