import type { MapId } from "./gameData";
import type { MatchEvent } from "./matchEvents";

// Pure round-replay timeline math, kept out of the React component so it is testable headlessly.
// Each renderable event gets a `revealAt` time; the animated player shows the events whose revealAt
// has passed the playhead. Events with a finite positive `time` use it (mirage carries real round
// times); everything else falls back to even index spacing so the feed still animates.

export const FALLBACK_STEP = 2; // seconds between untimed events
export const TAIL_PAD = 1.5; // seconds of padding after the last event so the round visibly "finishes"

export interface TimelineEntry {
  event: MatchEvent;
  revealAt: number; // seconds into the round when this event appears
}

export function isRenderableEvent(event: MatchEvent, mapId: MapId): boolean {
  if (event.type === "kill") return Boolean(event.actorId && event.targetId);
  // On mirage the bomb events carry positions worth plotting; other maps only render kills.
  if (mapId === "mirage") return event.type === "plant" || event.type === "defuse" || event.type === "explode";
  return false;
}

export function buildReplayTimeline(events: MatchEvent[], mapId: MapId): TimelineEntry[] {
  const renderable = events.filter((event) => isRenderableEvent(event, mapId));
  return renderable.map((event, index) => ({
    event,
    revealAt:
      typeof event.time === "number" && Number.isFinite(event.time) && event.time > 0
        ? event.time
        : (index + 1) * FALLBACK_STEP,
  }));
}

// Total duration of a round (for the scrubber max): the last reveal plus a tail, extended to the
// round_over time when that is later (so the scrub bar covers the whole round, not just the last kill).
export function replayRoundDuration(timeline: TimelineEntry[], events: MatchEvent[]): number {
  const last = timeline.reduce((max, entry) => Math.max(max, entry.revealAt), 0);
  const over = events.find((event) => event.type === "round_over");
  const overTime = over && typeof over.time === "number" && Number.isFinite(over.time) ? over.time : 0;
  return Math.max(last + TAIL_PAD, overTime);
}

export function visibleEntries(timeline: TimelineEntry[], currentTime: number): TimelineEntry[] {
  return timeline.filter((entry) => entry.revealAt <= currentTime);
}
