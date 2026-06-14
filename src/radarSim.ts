import { MatchState, FieldTeam } from "./sim";
import { MapId, Player } from "./gameData";

export interface Position {
  x: number;
  y: number;
}

export interface MapLayout {
  tSpawn: Position;
  ctSpawn: Position;
  bombsiteA: Position;
  bombsiteB: Position;
  mid: Position;
  chokePoints: Record<string, Position>;
  paths: string[];
}

export const MAP_LAYOUTS: Record<MapId, MapLayout> = {
  mirage: {
    tSpawn: { x: 88, y: 36 },
    ctSpawn: { x: 28, y: 70 },
    bombsiteA: { x: 54, y: 76 },
    bombsiteB: { x: 23, y: 28 },
    mid: { x: 50, y: 50 },
    chokePoints: {
      "A Ramp": { x: 65, y: 65 },
      "Palace": { x: 72, y: 52 },
      "Banana": { x: 58, y: 28 }, // B Apps
      "Mid": { x: 50, y: 50 },
      "Connector": { x: 46, y: 58 },
      "Market": { x: 38, y: 48 },
      "Apps": { x: 58, y: 28 }
    },
    paths: [
      "M 88 36 L 80 50 L 65 65 L 54 76",         // T Spawn -> A Ramp -> A Site
      "M 88 36 L 80 36 L 72 52 L 54 76",         // T Spawn -> Palace -> A Site
      "M 88 36 L 70 48 L 60 48 L 50 50",         // T Spawn -> Underpass -> Mid
      "M 28 70 L 44 70 L 54 76",                 // CT Spawn -> Ticket/A Site
      "M 28 70 L 35 58 L 46 58 L 50 50",         // CT Spawn -> Connector -> Mid
      "M 28 70 L 38 48 L 38 28 L 23 28",         // CT Spawn -> Market -> B Site
      "M 50 50 L 45 38 L 38 38 L 23 28",         // Mid -> Short -> B Site
      "M 88 36 L 80 28 L 58 28 L 23 28"          // T Spawn -> B Apartments -> B Site
    ]
  },
  inferno: {
    tSpawn: { x: 9, y: 66 },
    ctSpawn: { x: 89, y: 35 },
    bombsiteA: { x: 81, y: 68 },
    bombsiteB: { x: 49, y: 21 },
    mid: { x: 40, y: 55 },
    chokePoints: {
      "A Ramp": { x: 55, y: 55 },
      "Banana": { x: 35, y: 35 },
      "Alt Mid": { x: 28, y: 60 },
      "Arch": { x: 78, y: 45 },
      "Pit": { x: 72, y: 68 }
    },
    paths: [
      "M 9 66 L 20 66 L 28 60 L 45 68 L 58 68 L 81 68", // T Spawn -> Alt Mid -> Apartments -> Pit -> A Site
      "M 9 66 L 20 66 L 40 55 L 55 55 L 68 55 L 81 68", // T Spawn -> Mid -> A Long -> Arch -> CT Spawn
      "M 89 35 L 82 35 L 78 45 L 68 55 L 81 68",         // CT Spawn -> Arch -> Speedway -> A Site
      "M 89 35 L 80 22 L 72 22 L 49 21",                 // CT Spawn -> CT Spawn to B -> B Site
      "M 9 66 L 20 52 L 35 35 L 49 21",                 // T Spawn -> Banana -> B Site
      "M 89 35 L 81 55 L 81 68"                          // CT Spawn -> Library -> A Site
    ]
  },
  dust2: {
    tSpawn: { x: 38, y: 90 },
    ctSpawn: { x: 58, y: 21 },
    bombsiteA: { x: 80, y: 17 },
    bombsiteB: { x: 21, y: 12 },
    mid: { x: 48, y: 55 },
    chokePoints: {
      "Long A": { x: 82, y: 50 },
      "Short A": { x: 65, y: 35 },
      "Mid Doors": { x: 48, y: 30 },
      "Upper Tunnel": { x: 20, y: 55 },
      "Lower Tunnel": { x: 32, y: 50 }
    },
    paths: [
      "M 38 90 L 58 90 L 70 80 L 82 80 L 82 50 L 80 17", // T Spawn -> Long Doors -> Long A -> A Site
      "M 38 90 L 48 72 L 48 55 L 55 42 L 65 35 L 80 17", // T Spawn -> Catwalk -> Short A -> A Site
      "M 38 90 L 48 55 L 48 30 L 58 21",                 // T Spawn -> Mid -> Mid Doors -> CT Spawn
      "M 58 21 L 70 21 L 80 17",                         // CT Spawn -> A Ramp -> A Site
      "M 58 21 L 32 21 L 21 12",                         // CT Spawn -> B Doors -> B Site
      "M 38 90 L 25 80 L 20 55 L 21 12",                 // T Spawn -> Upper Tunnels -> B Site
      "M 48 55 L 32 50 L 20 55"                          // Mid -> Lower Tunnels -> Upper Tunnels
    ]
  },
  nuke: {
    tSpawn: { x: 20, y: 55 },
    ctSpawn: { x: 81, y: 46 },
    bombsiteA: { x: 57, y: 49 },
    bombsiteB: { x: 57, y: 57 },
    mid: { x: 72, y: 52 }, // Outside
    chokePoints: {
      "Outside": { x: 72, y: 52 },
      "Secret": { x: 68, y: 58 },
      "Lobby": { x: 42, y: 42 },
      "Ramp": { x: 45, y: 58 },
      "Main": { x: 52, y: 42 }
    },
    paths: [
      "M 20 55 L 35 55 L 42 42 L 48 42 L 57 49",         // T Spawn -> Lobby -> Hut -> A Site
      "M 20 55 L 35 55 L 42 42 L 48 48 L 57 49",         // T Spawn -> Lobby -> Squeaky -> A Site
      "M 20 55 L 32 60 L 52 60 L 72 52 L 68 58 L 57 57", // T Spawn -> Outside -> Secret -> B Site
      "M 81 46 L 72 52",                                 // CT Spawn -> Outside
      "M 81 46 L 68 42 L 52 42 L 57 49",                 // CT Spawn -> Main -> A Site
      "M 81 46 L 65 49 L 45 58 L 57 57"                  // CT Spawn -> Hell -> Ramp -> B Site
    ]
  },
  ancient: {
    tSpawn: { x: 48, y: 86 },
    ctSpawn: { x: 50, y: 12 },
    bombsiteA: { x: 30, y: 26 },
    bombsiteB: { x: 74, y: 40 },
    mid: { x: 50, y: 48 },
    chokePoints: {
      "A Hall": { x: 35, y: 45 },
      "Cheetah": { x: 58, y: 45 },
      "B Main": { x: 68, y: 55 },
      "Temple": { x: 42, y: 26 },
      "Donut": { x: 42, y: 38 }
    },
    paths: [
      "M 48 86 L 30 75 L 30 55 L 35 45 L 30 26",         // T Spawn -> A Hall -> A Site
      "M 48 86 L 50 62 L 50 48 L 58 45 L 74 40",         // T Spawn -> Mid -> Cheetah -> B Site
      "M 48 86 L 68 75 L 68 55 L 74 40",                 // T Spawn -> B Main -> B Site
      "M 50 12 L 42 20 L 42 26 L 30 26",                 // CT Spawn -> Temple -> A Site
      "M 50 12 L 68 20 L 68 32 L 74 40",                 // CT Spawn -> B Alley -> B Site
      "M 50 12 L 50 32 L 42 38 L 30 26"                  // CT Spawn -> Mid -> Donut -> A Site
    ]
  },
  anubis: {
    tSpawn: { x: 50, y: 88 },
    ctSpawn: { x: 50, y: 12 },
    bombsiteA: { x: 26, y: 36 },
    bombsiteB: { x: 74, y: 36 },
    mid: { x: 50, y: 48 },
    chokePoints: {
      "B Waters": { x: 75, y: 55 },
      "Canal": { x: 50, y: 65 },
      "Bridge": { x: 62, y: 48 },
      "A Main": { x: 22, y: 55 },
      "A Connector": { x: 32, y: 18 }
    },
    paths: [
      "M 50 88 L 70 75 L 75 55 L 74 36",         // T Spawn -> Canal -> B Waters -> B Site
      "M 50 88 L 50 65 L 50 48 L 62 48 L 74 36", // T Spawn -> Canal -> Mid -> Bridge -> B Site
      "M 50 88 L 28 78 L 22 55 L 26 36",         // T Spawn -> A Drop -> A Main -> A Site
      "M 50 12 L 68 18 L 74 36",                 // CT Spawn -> B Connector -> B Site
      "M 50 12 L 32 18 L 26 36",                 // CT Spawn -> A Connector -> A Site
      "M 50 12 L 50 35 L 38 42 L 26 36"          // CT Spawn -> Mid -> A Connector
    ]
  },
  train: {
    tSpawn: { x: 12, y: 22 },
    ctSpawn: { x: 88, y: 76 },
    bombsiteA: { x: 63, y: 50 },
    bombsiteB: { x: 53, y: 76 },
    mid: { x: 48, y: 48 },
    chokePoints: {
      "Ivy": { x: 72, y: 22 },
      "Popdog": { x: 48, y: 35 },
      "B Ramp": { x: 35, y: 65 },
      "Z Connector": { x: 60, y: 65 },
      "Alley": { x: 80, y: 55 }
    },
    paths: [
      "M 12 22 L 45 22 L 72 22 L 72 35 L 63 50",         // T Spawn -> Ivy -> A Site
      "M 12 22 L 32 35 L 48 35 L 63 50",                 // T Spawn -> Popdog -> A Site
      "M 12 22 L 22 35 L 22 60 L 35 65 L 53 76",         // T Spawn -> B Halls -> B Ramp -> B Site
      "M 88 76 L 80 76 L 80 55 L 63 50",                 // CT Spawn -> Alley -> A Site
      "M 88 76 L 72 76 L 60 65 L 53 76",                 // CT Spawn -> Z Connector -> B Site
      "M 88 76 L 68 85 L 53 76"                          // CT Spawn -> B Site
    ]
  }
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export interface SimulatedRadarPlayer extends Player {
  x: number;
  y: number;
  alive: boolean;
  side: "CT" | "T";
  team: "you" | "opponent";
}

export function simulateRadarPlayers(
  match: MatchState,
  you: FieldTeam,
  opponent: FieldTeam
): SimulatedRadarPlayer[] {
  const mapId = match.map;
  const layout = MAP_LAYOUTS[mapId] || MAP_LAYOUTS.mirage;
  const yourSide = match.side;
  const opponentSide: "CT" | "T" = yourSide === "CT" ? "T" : "CT";

  // Reconstruct round event stream
  const activeRound = match.pendingEvents?.[0]?.round ?? match.feed[0]?.round ?? match.round;
  const completedEvents = match.feed.filter((e) => e.round === activeRound);
  const remainingEvents = (match.pendingEvents || []).filter((e) => e.round === activeRound);
  const allEvents = [...[...completedEvents].reverse(), ...remainingEvents];
  const stepIndex = completedEvents.length;
  const totalSteps = allEvents.length;

  const deadIds = new Set(completedEvents.filter((e) => !e.type || e.type === "kill").map((e) => e.victimId));

  // Determine if there is a bomb plant event, and if so, at what index and which site
  const plantEventIndex = allEvents.findIndex((e) => e.type === "plant");
  let plantSite: "A" | "B" = "A";
  if (plantEventIndex !== -1) {
    const plantEvent = allEvents[plantEventIndex];
    // Deterministic site based on planter ID length + round number
    const seed = activeRound + (plantEvent.killerId ? plantEvent.killerId.length : 0);
    plantSite = seed % 2 === 0 ? "A" : "B";
  }

  // Determine T strategy for the round (0 = Default, 1 = A Execute, 2 = B Execute)
  // Determined by team names + round number
  const tTeamName = yourSide === "T" ? you.name : opponent.name;
  const strategySeed = hashString(tTeamName) + activeRound;
  const tStrategy = strategySeed % 3;

  function interpolate(p1: Position, p2: Position, t: number): Position {
    const clampedT = Math.max(0, Math.min(1, t));
    return {
      x: p1.x + (p2.x - p1.x) * clampedT,
      y: p1.y + (p2.y - p1.y) * clampedT,
    };
  }

  function getPathPosition(path: Position[], t: number): Position {
    if (path.length === 0) return { x: 50, y: 50 };
    if (path.length === 1) return path[0];
    const segmentCount = path.length - 1;
    const segment = Math.min(segmentCount - 1, Math.floor(t * segmentCount));
    const segmentT = (t * segmentCount) - segment;
    return interpolate(path[segment], path[segment + 1], segmentT);
  }

  function calculatePlayerPosition(
    player: Player,
    playerIndex: number,
    side: "CT" | "T"
  ): Position {
    // 1. Determine spawn and targets
    const spawn = side === "CT" ? layout.ctSpawn : layout.tSpawn;
    const targetA = layout.bombsiteA;
    const targetB = layout.bombsiteB;

    let holdSite: "A" | "B" | "mid" = "A";
    let routeNodes: Position[] = [];

    if (side === "CT") {
      // CT hold positions
      if (playerIndex === 0 || playerIndex === 3) holdSite = "A";
      else if (playerIndex === 1 || playerIndex === 4) holdSite = "B";
      else holdSite = "mid";

      const dest = holdSite === "A" ? targetA : holdSite === "B" ? targetB : layout.mid;
      routeNodes = [spawn, dest];
    } else {
      // T site pushing strategy
      if (tStrategy === 1) {
        // A execute
        holdSite = playerIndex === 4 ? "mid" : "A";
      } else if (tStrategy === 2) {
        // B execute
        holdSite = playerIndex === 4 ? "mid" : "B";
      } else {
        // Default split
        if (playerIndex === 0 || playerIndex === 1) holdSite = "A";
        else if (playerIndex === 2 || playerIndex === 3) holdSite = "B";
        else holdSite = "mid";
      }

      // Add map-specific choke point details
      const dest = holdSite === "A" ? targetA : holdSite === "B" ? targetB : layout.mid;
      let choke: Position | null = null;
      if (holdSite === "A") {
        choke = layout.chokePoints["A Ramp"] || layout.chokePoints["Palace"] || null;
      } else if (holdSite === "B") {
        choke = layout.chokePoints["Banana"] || layout.chokePoints["Apps"] || null;
      }
      routeNodes = choke ? [spawn, choke, dest] : [spawn, dest];
    }

    // 2. Check if the player dies in this round
    const deathEventIdx = allEvents.findIndex(
      (e) => (!e.type || e.type === "kill") && e.victimId === player.id
    );

    // 3. Check if there is a plant in this round
    const isPlanted = plantEventIndex !== -1;

    // Time calculations
    const endMoveIdx = Math.max(1, Math.floor(totalSteps * 0.35));

    // Calculate position for current stepIndex
    if (deathEventIdx !== -1 && stepIndex >= deathEventIdx) {
      // Player is dead. They die at the fight location.
      // Fight location is at the end of their route nodes or slightly adjusted towards target
      return routeNodes[routeNodes.length - 1];
    }

    // If stepIndex is before the plant event (or if there is no plant)
    if (!isPlanted || stepIndex < plantEventIndex) {
      if (deathEventIdx !== -1) {
        // Player will die. Interpolate to death position between step 0 and deathEventIdx.
        const t = deathEventIdx > 0 ? stepIndex / deathEventIdx : 0;
        return getPathPosition(routeNodes, t);
      } else {
        // Player survives (or hasn't died yet, and no plant happened).
        // They move to their default holdSite by endMoveIdx, then stay there.
        if (stepIndex <= endMoveIdx) {
          const t = stepIndex / endMoveIdx;
          return getPathPosition(routeNodes, t);
        } else {
          // Add small passive breathing movement (jitter) at hold position
          const base = routeNodes[routeNodes.length - 1];
          const jitterSeed = hashString(player.handle) + stepIndex;
          const jX = ((jitterSeed % 5) - 2) * 0.4;
          const jY = (((jitterSeed >> 2) % 5) - 2) * 0.4;
          return { x: base.x + jX, y: base.y + jY };
        }
      }
    } else {
      // StepIndex is after the plant event.
      // All alive players move/rotate to the planted bombsite.
      const targetSitePos = plantSite === "A" ? targetA : targetB;

      if (side === "T") {
        // T players defend the plant site. They should already be at or near targetSitePos.
        // Interpolate remaining steps to spread out around the site.
        const base = targetSitePos;
        const offsetSeed = hashString(player.handle);
        const oX = ((offsetSeed % 7) - 3) * 1.5;
        const oY = (((offsetSeed >> 3) % 7) - 3) * 1.5;
        const finalPos = { x: base.x + oX, y: base.y + oY };

        const t = (stepIndex - plantEventIndex) / Math.max(1, totalSteps - plantEventIndex);
        // Start from where they were at plant, move to final def position
        const startPos = getPathPosition(routeNodes, 1);
        return interpolate(startPos, finalPos, t);
      } else {
        // CT players rotate from their positions at the plant step to the planted site.
        const startPos = getPathPosition(routeNodes, Math.min(1, plantEventIndex / endMoveIdx));
        const finalPos = targetSitePos;

        const t = (stepIndex - plantEventIndex) / Math.max(1, totalSteps - plantEventIndex);
        return interpolate(startPos, finalPos, t);
      }
    }
  }

  const youSimulated = you.players.map((p, idx) => ({
    ...p,
    x: calculatePlayerPosition(p, idx, yourSide).x,
    y: calculatePlayerPosition(p, idx, yourSide).y,
    alive: !deadIds.has(p.id),
    side: yourSide,
    team: "you" as const,
  }));

  const opponentSimulated = opponent.players.map((p, idx) => ({
    ...p,
    x: calculatePlayerPosition(p, idx, opponentSide).x,
    y: calculatePlayerPosition(p, idx, opponentSide).y,
    alive: !deadIds.has(p.id),
    side: opponentSide,
    team: "opponent" as const,
  }));

  return [...youSimulated, ...opponentSimulated];
}
