/**
 * Derive an accurate walkable occupancy grid from a radar PNG (the authentic map) instead of
 * hand-tracing polygons. Floor pixels (the navy play area + coloured sites/spawns) are walkable;
 * black void and white wall lines are blocked. We keep only the connected component(s) reachable
 * from the spawns/sites so the logo and stray pixels drop out.
 *
 *   npx tsx scripts/derive-navgrid.ts            # mirage, writes src/navGrids.ts + overlay
 *
 * Emits:
 *   - src/navGrids.ts          baked base64 bitmask the app + tests load via getNavGrid()
 *   - scratch/<id>-navmask.png red overlay on the radar so you can verify the mask visually
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PNG } from "pngjs";

const RES = 128;
const DARK = 22; // <= this luma = void/black
const BRIGHT = 200; // >= this luma = white wall line
const FLOOR_FRAC = 0.4; // a cell is walkable if >40% of its pixels are floor

// normalized 0..100 seeds known to be inside the play area (used to keep the connected floor)
const SEEDS: Record<string, Array<[number, number]>> = {
  mirage: [
    [28, 71], // T spawn
    [87, 37], // CT spawn
    [22, 29], // A site
    [54, 76], // B site
    [42, 48], // mid
  ],
};

function luma(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function derive(id: string, pngPath: string) {
  const png = PNG.sync.read(readFileSync(pngPath));
  const { width: W, height: H, data } = png;
  const cw = W / RES;
  const ch = H / RES;

  // floor fraction per cell
  const walk = new Uint8Array(RES * RES);
  for (let cy = 0; cy < RES; cy += 1) {
    for (let cx = 0; cx < RES; cx += 1) {
      let floor = 0;
      let total = 0;
      const x0 = Math.floor(cx * cw);
      const x1 = Math.floor((cx + 1) * cw);
      const y0 = Math.floor(cy * ch);
      const y1 = Math.floor((cy + 1) * ch);
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * W + x) * 4;
          const L = luma(data[i], data[i + 1], data[i + 2]);
          total += 1;
          if (L > DARK && L < BRIGHT) floor += 1;
        }
      }
      walk[cy * RES + cx] = total > 0 && floor / total > FLOOR_FRAC ? 1 : 0;
    }
  }

  // keep only walkable cells connected to the seeds (drops logo / stray blobs)
  const keep = new Uint8Array(RES * RES);
  const queue: number[] = [];
  const snapPush = (nx: number, ny: number) => {
    const sx = Math.min(RES - 1, Math.max(0, Math.round((nx / 100) * RES)));
    const sy = Math.min(RES - 1, Math.max(0, Math.round((ny / 100) * RES)));
    // spiral to nearest walkable cell
    for (let r = 0; r < RES; r += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = sx + dx;
          const y = sy + dy;
          if (x < 0 || y < 0 || x >= RES || y >= RES) continue;
          const idx = y * RES + x;
          if (walk[idx] && !keep[idx]) {
            keep[idx] = 1;
            queue.push(idx);
            return;
          }
        }
      }
    }
  };
  for (const [nx, ny] of SEEDS[id]) snapPush(nx, ny);
  while (queue.length) {
    const idx = queue.pop()!;
    const x = idx % RES;
    const y = (idx / RES) | 0;
    const nb = [
      [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
    ];
    for (const [nx, ny] of nb) {
      if (nx < 0 || ny < 0 || nx >= RES || ny >= RES) continue;
      const nIdx = ny * RES + nx;
      if (walk[nIdx] && !keep[nIdx]) {
        keep[nIdx] = 1;
        queue.push(nIdx);
      }
    }
  }

  // blocked = NOT kept-walkable
  const blocked = new Uint8Array(RES * RES);
  let walkCount = 0;
  for (let i = 0; i < RES * RES; i += 1) {
    blocked[i] = keep[i] ? 0 : 1;
    if (keep[i]) walkCount += 1;
  }

  // bitpack -> base64
  const bytes = new Uint8Array(Math.ceil((RES * RES) / 8));
  for (let i = 0; i < RES * RES; i += 1) {
    if (blocked[i]) bytes[i >> 3] |= 1 << (7 - (i & 7));
  }
  const b64 = Buffer.from(bytes).toString("base64");

  // verification overlay (downscale to 512, tint blocked cells red)
  const OUT = 512;
  const out = new PNG({ width: OUT, height: OUT });
  for (let oy = 0; oy < OUT; oy += 1) {
    for (let ox = 0; ox < OUT; ox += 1) {
      const sx = Math.floor((ox / OUT) * W);
      const sy = Math.floor((oy / OUT) * H);
      const si = (sy * W + sx) * 4;
      const cx = Math.min(RES - 1, Math.floor((ox / OUT) * RES));
      const cy = Math.min(RES - 1, Math.floor((oy / OUT) * RES));
      const isBlocked = blocked[cy * RES + cx] === 1;
      const oi = (oy * OUT + ox) * 4;
      if (isBlocked) {
        out.data[oi] = Math.min(255, data[si] * 0.4 + 150);
        out.data[oi + 1] = data[si + 1] * 0.3;
        out.data[oi + 2] = data[si + 2] * 0.3;
      } else {
        out.data[oi] = data[si];
        out.data[oi + 1] = data[si + 1];
        out.data[oi + 2] = data[si + 2];
      }
      out.data[oi + 3] = 255;
    }
  }
  mkdirSync("scratch", { recursive: true });
  writeFileSync(`scratch/${id}-navmask.png`, PNG.sync.write(out));

  const pct = ((walkCount / (RES * RES)) * 100).toFixed(1);
  console.log(`${id}: ${walkCount}/${RES * RES} cells walkable (${pct}%), base64 ${b64.length} chars`);
  return { res: RES, bits: b64 };
}

const id = process.argv[2] || "mirage";
const grid = derive(id, `src/assets/radar/${id}.png`);

const file = `// AUTO-GENERATED by scripts/derive-navgrid.ts — do not edit by hand.
// Walkable occupancy masks derived from the radar PNGs (1 bit per cell, 1 = blocked), base64 of a
// bit-packed res*res grid. Regenerate with: npx tsx scripts/derive-navgrid.ts <map>
import type { MapId } from "./gameData";

export const navGrids: Partial<Record<MapId, { res: number; bits: string }>> = {
  ${id}: ${JSON.stringify(grid)},
};
`;
writeFileSync("src/navGrids.ts", file);
console.log("wrote src/navGrids.ts");
