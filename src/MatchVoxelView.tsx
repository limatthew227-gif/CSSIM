import React, { useEffect, useMemo, useRef, useState } from "react";
import { Expand, Focus, Map as MapIcon, Minimize, RotateCcw } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { MapId } from "./gameData";
import type { FieldTeam, MatchState } from "./sim";
import { mapName } from "./sim";
import { getStepDelay, MAP_LAYOUTS, simulateRadarPlayers } from "./radarSim";
import { useAnimatedStep } from "./useAnimatedStep";
import {
  getVoxelMap,
  VOXEL_MAP_PROFILES,
  VOXEL_SOURCE_LABEL,
  voxelCellHeight,
  voxelSurfaceAt,
  type VoxelProp,
} from "./voxelMaps";

type MatchVoxelViewProps = {
  match: MatchState;
  you: FieldTeam;
  opponent: FieldTeam;
  speed?: number;
};

type SimulatedPlayer = ReturnType<typeof simulateRadarPlayers>["players"][number];

type VoxelPlayerRig = {
  group: THREE.Group;
  head: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  nameplate: THREE.Sprite;
  floorRing: THREE.Mesh;
  initialized: boolean;
  motion: number;
  gaitPhase: number;
  targetPosition: THREE.Vector3;
};

type VoxelRuntime = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  playerLayer: THREE.Group;
  effectLayer: THREE.Group;
  traceLayer: THREE.Group;
  playerRigs: Map<string, VoxelPlayerRig>;
  bomb: THREE.Group;
  frameId: number;
  resizeObserver: ResizeObserver;
};

const WORLD_SIZE = 36;

function hash2d(x: number, y: number) {
  let value = x * 374761393 + y * 668265263;
  value = (value ^ (value >> 13)) * 1274126177;
  return Math.abs(value ^ (value >> 16));
}

function worldPoint(point: { x: number; y: number }) {
  return {
    x: (point.x / 100 - 0.5) * WORLD_SIZE,
    z: (point.y / 100 - 0.5) * WORLD_SIZE,
  };
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function createLabelTexture(title: string, subtitle: string, accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d")!;
  roundedRect(context, 4, 4, 504, 120, 18);
  context.fillStyle = "rgba(4, 9, 13, 0.9)";
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, 0.24)";
  context.lineWidth = 4;
  context.stroke();
  roundedRect(context, 14, 15, 13, 98, 6);
  context.fillStyle = accent;
  context.fill();
  context.fillStyle = "#f4f8f8";
  context.font = "800 42px Arial, sans-serif";
  context.textBaseline = "middle";
  context.fillText(title.toUpperCase(), 46, 52, 445);
  context.fillStyle = "rgba(214, 226, 228, 0.72)";
  context.font = "700 20px Arial, sans-serif";
  context.fillText(subtitle.toUpperCase(), 47, 91, 440);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createLabelSprite(
  title: string,
  subtitle: string,
  accent: string,
  width: number,
  height: number,
) {
  const material = new THREE.SpriteMaterial({
    map: createLabelTexture(title, subtitle, accent),
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width, height, 1);
  sprite.renderOrder = 30;
  return sprite;
}

function createSmokeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 192;
  const context = canvas.getContext("2d")!;
  const cloud = context.createRadialGradient(96, 92, 8, 96, 96, 92);
  cloud.addColorStop(0, "rgba(242, 246, 247, 0.92)");
  cloud.addColorStop(0.35, "rgba(205, 215, 218, 0.72)");
  cloud.addColorStop(0.68, "rgba(142, 154, 159, 0.32)");
  cloud.addColorStop(1, "rgba(91, 103, 108, 0)");
  context.fillStyle = cloud;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createPlayerRig(player: SimulatedPlayer) {
  const side = player.side;
  const accent = side === "CT" ? "#58a9ff" : "#efb642";
  const group = new THREE.Group();
  const uniform = new THREE.MeshStandardMaterial({
    color: side === "CT" ? "#3d8fff" : "#e2a92e",
    roughness: 0.82,
    metalness: 0.05,
  });
  const darkUniform = new THREE.MeshStandardMaterial({
    color: side === "CT" ? "#1c4e8f" : "#72531b",
    roughness: 0.9,
  });
  const skin = new THREE.MeshStandardMaterial({
    color: side === "CT" ? "#d7aa83" : "#bd825e",
    roughness: 0.95,
  });
  const weaponMaterial = new THREE.MeshStandardMaterial({
    color: "#20252a",
    roughness: 0.38,
    metalness: 0.65,
  });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.32, 0.76, 8), uniform);
  torso.position.y = 1.02;
  torso.castShadow = true;
  group.add(torso);

  const vest = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.52, 0.38),
    new THREE.MeshStandardMaterial({
      color: side === "CT" ? "#233f5f" : "#4e3b20",
      roughness: 0.88,
      metalness: 0.08,
    }),
  );
  vest.position.set(0, 1.07, 0.02);
  vest.castShadow = true;
  group.add(vest);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.255, 12, 8), skin);
  head.position.y = 1.64;
  head.castShadow = true;
  group.add(head);

  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.275, 12, 8),
    new THREE.MeshStandardMaterial({
      color: side === "CT" ? "#22394d" : "#554326",
      roughness: 0.72,
      metalness: 0.14,
    }),
  );
  helmet.scale.set(1, 0.58, 1);
  helmet.position.y = 1.79;
  helmet.castShadow = true;
  group.add(helmet);

  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.115, 0.62, 7), darkUniform);
  leftLeg.position.set(-0.16, 0.36, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.115, 0.62, 7), darkUniform);
  rightLeg.position.set(0.16, 0.36, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.64, 7), uniform);
  leftArm.position.set(-0.37, 1.03, 0.08);
  leftArm.rotation.x = -0.58;
  leftArm.rotation.z = -0.08;
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = leftArm.clone();
  rightArm.position.x = 0.37;
  rightArm.rotation.z = 0.08;
  group.add(rightArm);

  const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.86), weaponMaterial);
  weapon.position.set(0, 1.05, -0.52);
  weapon.castShadow = true;
  group.add(weapon);

  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.5, 0.22),
    darkUniform,
  );
  backpack.position.set(0, 1.08, 0.27);
  backpack.castShadow = true;
  group.add(backpack);

  const floorRing = new THREE.Mesh(
    new THREE.RingGeometry(0.48, 0.63, 28),
    new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.y = -0.17;
  floorRing.renderOrder = 6;
  group.add(floorRing);

  const forwardMarker = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.34, 5),
    new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  );
  forwardMarker.rotation.x = -Math.PI / 2;
  forwardMarker.position.set(0, -0.16, -0.72);
  group.add(forwardMarker);

  const nameplate = createLabelSprite(
    player.handle,
    `${side} · ${player.role}`,
    accent,
    2.7,
    0.68,
  );
  nameplate.position.y = 2.35;
  group.add(nameplate);

  return {
    group,
    head,
    leftLeg,
    rightLeg,
    nameplate,
    floorRing,
    initialized: false,
    motion: 0,
    gaitPhase: 0,
    targetPosition: new THREE.Vector3(),
  };
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    const disposeMaterial = (material: THREE.Material) => {
      const materialWithMaps = material as THREE.Material & {
        map?: THREE.Texture | null;
        alphaMap?: THREE.Texture | null;
      };
      materialWithMaps.map?.dispose();
      materialWithMaps.alphaMap?.dispose();
      material.dispose();
    };
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(disposeMaterial);
    } else {
      if (mesh.material) disposeMaterial(mesh.material);
    }
  });
}

function buildVoxelProp(world: THREE.Group, mapId: MapId, prop: VoxelProp) {
  const profile = VOXEL_MAP_PROFILES[mapId];
  const at = worldPoint(prop);
  const baseY = voxelSurfaceAt(mapId, prop);
  const width = ((prop.width ?? 2.1) / 100) * WORLD_SIZE;
  const depth = (("depth" in prop ? prop.depth : prop.width) ?? 2.1) / 100 * WORLD_SIZE;
  const color = prop.color ?? profile.palette.crate;
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: prop.type === "train" || prop.type === "silo" ? 0.58 : 0.88,
    metalness: prop.type === "train" || prop.type === "silo" ? 0.28 : 0.02,
    transparent: prop.type === "water",
    opacity: prop.type === "water" ? 0.72 : 1,
  });
  const group = new THREE.Group();
  group.position.set(at.x, baseY, at.z);
  group.rotation.y = "rotation" in prop ? prop.rotation ?? 0 : 0;
  group.userData.landmark = prop.type;

  const addBlock = (
    blockWidth: number,
    blockHeight: number,
    blockDepth: number,
    x: number,
    y: number,
    z: number,
    blockMaterial = material,
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(blockWidth, blockHeight, blockDepth),
      blockMaterial,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = prop.type !== "water";
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  if (prop.type === "water") {
    addBlock(width, 0.13, depth, 0, -0.04, 0);
    const glow = new THREE.MeshStandardMaterial({
      color: "#50b8c3",
      emissive: "#173e48",
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.46,
      roughness: 0.35,
    });
    for (let index = -1; index <= 1; index += 1) {
      addBlock(width * 0.78, 0.05, 0.1, 0, 0.04, index * (depth / 3.5), glow);
    }
  } else if (prop.type === "train") {
    addBlock(width, 1.18, depth, 0, 0.66, 0);
    addBlock(width * 0.84, 0.3, depth * 0.9, 0, 1.36, 0);
    const dark = new THREE.MeshStandardMaterial({ color: "#22282c", roughness: 0.75, metalness: 0.35 });
    for (const z of [-depth * 0.3, depth * 0.3]) {
      addBlock(width * 1.04, 0.28, 0.34, 0, 0.16, z, dark);
    }
  } else if (prop.type === "bridge") {
    const height = prop.height ?? 2.6;
    addBlock(width, 0.44, depth, 0, height, 0);
    addBlock(Math.max(0.34, width * 0.2), height, depth, -width * 0.38, height / 2, 0);
    addBlock(Math.max(0.34, width * 0.2), height, depth, width * 0.38, height / 2, 0);
  } else if (prop.type === "silo") {
    const levels = Math.max(3, Math.round(prop.height ?? 5));
    for (let level = 0; level < levels; level += 1) {
      const inset = level === 0 || level === levels - 1 ? 0.88 : 1;
      addBlock(width * inset, 0.72, depth * inset, 0, 0.36 + level * 0.7, 0);
    }
  } else if (prop.type === "pillar") {
    const height = prop.height ?? 3;
    addBlock(width, height, depth, 0, height / 2, 0);
    addBlock(width * 1.35, 0.34, depth * 1.35, 0, 0.17, 0);
    addBlock(width * 1.25, 0.3, depth * 1.25, 0, height - 0.15, 0);
  } else {
    const levels = Math.max(1, Math.round(prop.height ?? 1));
    for (let level = 0; level < levels; level += 1) {
      addBlock(width, 0.82, depth, level % 2 ? width * 0.22 : 0, 0.41 + level * 0.8, 0);
    }
  }

  world.add(group);
}

function buildVoxelWorld(scene: THREE.Scene, mapId: MapId) {
  const profile = VOXEL_MAP_PROFILES[mapId];
  const palette = profile.palette;
  const map = getVoxelMap(mapId);
  const resolution = map.res;
  const blockSize = WORLD_SIZE / resolution;
  const layout = MAP_LAYOUTS[mapId];
  const world = new THREE.Group();
  world.name = "voxel-world";
  world.userData.source = VOXEL_SOURCE_LABEL;

  const grass = new THREE.Mesh(
    new THREE.BoxGeometry(WORLD_SIZE + 8, 0.8, WORLD_SIZE + 8),
    new THREE.MeshStandardMaterial({ color: palette.base, roughness: 1 }),
  );
  grass.position.y = -2.72;
  grass.receiveShadow = true;
  world.add(grass);

  const underGrid = new THREE.GridHelper(
    WORLD_SIZE + 8,
    28,
    new THREE.Color("#6f948f"),
    new THREE.Color("#38504e"),
  );
  underGrid.position.y = -2.3;
  const underGridMaterial = underGrid.material as THREE.Material;
  underGridMaterial.transparent = true;
  underGridMaterial.opacity = 0.2;
  world.add(underGrid);

  const baseFrame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(WORLD_SIZE + 8, 0.82, WORLD_SIZE + 8)),
    new THREE.LineBasicMaterial({
      color: "#87b9ae",
      transparent: true,
      opacity: 0.24,
    }),
  );
  baseFrame.position.y = -2.71;
  world.add(baseFrame);

  const floorCells: Array<{ row: number; col: number; surface: number }> = [];
  const lowerFloorCells: Array<{ row: number; col: number; surface: number }> = [];
  const wallCells: Array<{ row: number; col: number; height: number; surface: number }> = [];
  const crateCells: Array<{ row: number; col: number; height: number; surface: number }> = [];

  for (let row = 0; row < resolution; row += 1) {
    for (let col = 0; col < resolution; col += 1) {
      const index = row * resolution + col;
      if (map.occupied[index]) {
        const surface = voxelCellHeight(map.heights[index]);
        floorCells.push({ row, col, surface });
        if (map.lowerOccupied?.[index] && map.lowerHeights) {
          lowerFloorCells.push({
            row,
            col,
            surface: voxelCellHeight(map.lowerHeights[index]),
          });
        }
        const p = {
          x: ((col + 0.5) / resolution) * 100,
          y: ((row + 0.5) / resolution) * 100,
        };
        const nearObjective = [layout.bombsiteA, layout.bombsiteB, layout.ctSpawn, layout.tSpawn]
          .some((objective) => Math.hypot(p.x - objective.x, p.y - objective.y) < 8);
        if (!nearObjective && hash2d(col, row) % 149 === 0) {
          crateCells.push({ row, col, height: 1 + (hash2d(row, col) % 2), surface });
        }
        continue;
      }

      const adjacentFloorIndexes = [
        [row - 1, col - 1],
        [row - 1, col],
        [row - 1, col + 1],
        [row, col - 1],
        [row, col + 1],
        [row + 1, col - 1],
        [row + 1, col],
        [row + 1, col + 1],
      ]
        .filter(
          ([nextRow, nextCol]) =>
            nextRow >= 0 &&
            nextRow < resolution &&
            nextCol >= 0 &&
            nextCol < resolution &&
            map.occupied[nextRow * resolution + nextCol],
        )
        .map(([nextRow, nextCol]) => nextRow * resolution + nextCol);
      const sourceWall = map.walls?.[index];
      if ((map.walls ? sourceWall : adjacentFloorIndexes.length) && adjacentFloorIndexes.length) {
        const surface = Math.max(
          ...adjacentFloorIndexes.map((nextIndex) => voxelCellHeight(map.heights[nextIndex])),
        );
        const height = map.wallHeights
          ? Math.max(1, Math.min(4, map.wallHeights[index]))
          : 2 + (hash2d(col, row) % 2);
        wallCells.push({ row, col, height, surface });
      }
    }
  }

  // Shallow, nearly seamless tiles keep the Source 2 height field legible without reading as a
  // Minecraft floor. Landmark props remain simplified while the navigation surface feels continuous.
  const blockGeometry = new THREE.BoxGeometry(blockSize * 1.018, 0.3, blockSize * 1.018);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.98,
    metalness: 0,
  });
  const floors = new THREE.InstancedMesh(blockGeometry, floorMaterial, floorCells.length);
  floors.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  floorCells.forEach(({ row, col, surface }, index) => {
    const x = (col - (resolution - 1) / 2) * blockSize;
    const z = (row - (resolution - 1) / 2) * blockSize;
    matrix.makeTranslation(x, surface - 0.16, z);
    floors.setMatrixAt(index, matrix);
    floors.setColorAt(index, new THREE.Color(palette.ground[hash2d(col, row) % palette.ground.length]));
  });
  floors.instanceMatrix.needsUpdate = true;
  if (floors.instanceColor) floors.instanceColor.needsUpdate = true;
  world.add(floors);

  if (lowerFloorCells.length) {
    const lowerMaterial = new THREE.MeshStandardMaterial({
      color: palette.lowerGround,
      roughness: 1,
      metalness: palette.metalness * 0.5,
    });
    const lowerFloors = new THREE.InstancedMesh(blockGeometry, lowerMaterial, lowerFloorCells.length);
    lowerFloors.receiveShadow = true;
    lowerFloorCells.forEach(({ row, col, surface }, index) => {
      const x = (col - (resolution - 1) / 2) * blockSize;
      const z = (row - (resolution - 1) / 2) * blockSize;
      matrix.makeTranslation(x, surface - 0.18, z);
      lowerFloors.setMatrixAt(index, matrix);
    });
    lowerFloors.instanceMatrix.needsUpdate = true;
    world.add(lowerFloors);
  }

  const wallGeometry = new THREE.BoxGeometry(blockSize * 1.01, 1, blockSize * 1.01);
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.86,
    metalness: palette.metalness,
  });
  const walls = new THREE.InstancedMesh(wallGeometry, wallMaterial, wallCells.length);
  walls.castShadow = true;
  walls.receiveShadow = true;
  const identityRotation = new THREE.Quaternion();
  wallCells.forEach(({ row, col, height, surface }, wallIndex) => {
    const x = (col - (resolution - 1) / 2) * blockSize;
    const z = (row - (resolution - 1) / 2) * blockSize;
    const wallHeight = height * 0.7;
    matrix.compose(
      new THREE.Vector3(x, surface + wallHeight / 2, z),
      identityRotation,
      new THREE.Vector3(1, wallHeight, 1),
    );
    walls.setMatrixAt(wallIndex, matrix);
    walls.setColorAt(
      wallIndex,
      new THREE.Color(palette.wall[hash2d(col + height, row) % palette.wall.length]),
    );
  });
  walls.instanceMatrix.needsUpdate = true;
  if (walls.instanceColor) walls.instanceColor.needsUpdate = true;
  world.add(walls);

  if (crateCells.length) {
    const crateBlockCount = crateCells.reduce((sum, cell) => sum + cell.height, 0);
    const crates = new THREE.InstancedMesh(
      new THREE.BoxGeometry(blockSize * 0.86, 0.78, blockSize * 0.86),
      new THREE.MeshStandardMaterial({ color: palette.crate, roughness: 0.88 }),
      crateBlockCount,
    );
    crates.castShadow = true;
    crates.receiveShadow = true;
    let crateIndex = 0;
    crateCells.forEach(({ row, col, height, surface }) => {
      const x = (col - (resolution - 1) / 2) * blockSize;
      const z = (row - (resolution - 1) / 2) * blockSize;
      for (let level = 0; level < height; level += 1) {
        matrix.makeTranslation(x, surface + 0.39 + level * 0.76, z);
        crates.setMatrixAt(crateIndex, matrix);
        crateIndex += 1;
      }
    });
    crates.instanceMatrix.needsUpdate = true;
    world.add(crates);
  }

  profile.props.forEach((prop) => buildVoxelProp(world, mapId, prop));

  const addMarker = (point: { x: number; y: number }, label: "A" | "B") => {
    const at = worldPoint(point);
    const surface = voxelSurfaceAt(mapId, point);
    const marker = new THREE.Group();
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.45, 0.12, 32),
      new THREE.MeshStandardMaterial({
        color: label === "A" ? "#d9a52e" : "#d66f31",
        emissive: label === "A" ? "#7c4d08" : "#792608",
        emissiveIntensity: 0.7,
        roughness: 0.72,
      }),
    );
    pad.position.y = 0.08;
    pad.receiveShadow = true;
    marker.add(pad);

    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.3, 0.52, 16),
      new THREE.MeshStandardMaterial({
        color: "#ffdc72",
        emissive: "#ff9d28",
        emissiveIntensity: 1.5,
      }),
    );
    beacon.position.y = 0.48;
    marker.add(beacon);
    const labelColor = label === "A" ? "#f0ba42" : "#ed7643";
    const siteLabel = createLabelSprite(label, "Bombsite", labelColor, 1.75, 0.46);
    siteLabel.position.y = 2.05;
    marker.add(siteLabel);
    marker.position.set(at.x, surface, at.z);
    marker.userData.site = label;
    world.add(marker);
  };

  addMarker(layout.bombsiteA, "A");
  addMarker(layout.bombsiteB, "B");

  const addSpawn = (point: { x: number; y: number }, color: string) => {
    const at = worldPoint(point);
    const surface = voxelSurfaceAt(mapId, point);
    const spawn = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 1.1, 32),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.38,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
      }),
    );
    spawn.rotation.x = -Math.PI / 2;
    spawn.position.set(at.x, surface + 0.04, at.z);
    world.add(spawn);
  };

  addSpawn(layout.ctSpawn, "#3d8fff");
  addSpawn(layout.tSpawn, "#e2a92e");

  scene.add(world);
  return world;
}

function clearLayer(layer: THREE.Group) {
  for (const child of [...layer.children]) {
    layer.remove(child);
    disposeObject(child);
  }
}

function voxelBeam(
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  sides = 6,
) {
  const direction = to.clone().sub(from);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, Math.max(0.01, direction.length()), sides),
    material,
  );
  beam.position.copy(from).add(to).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  return beam;
}

function VoxelScene({
  mapId,
  players,
  traces,
  bomb,
  utilities,
  running,
  roundKey,
  cameraMode,
  cameraNonce,
}: {
  mapId: MapId;
  players: SimulatedPlayer[];
  traces: ReturnType<typeof simulateRadarPlayers>["traces"];
  bomb: ReturnType<typeof simulateRadarPlayers>["bomb"];
  utilities: Array<{ type: string; at: { x: number; y: number } }>;
  running: boolean;
  roundKey: string | number;
  cameraMode: "broadcast" | "tactical";
  cameraNonce: number;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<VoxelRuntime | null>(null);
  const playersRef = useRef(players);
  const bombRef = useRef(bomb);
  const runningRef = useRef(running);
  const currentRoundRef = useRef(roundKey);
  const resetRigsRef = useRef(false);
  if (currentRoundRef.current !== roundKey) {
    currentRoundRef.current = roundKey;
    resetRigsRef.current = true;
  }
  playersRef.current = players;
  bombRef.current = bomb;
  runningRef.current = running;

  useEffect(() => {
    if (!mountRef.current) return;
    const palette = VOXEL_MAP_PROFILES[mapId].palette;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.backdrop);
    scene.fog = new THREE.Fog(palette.fog, 34, 64);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(25, 27, 28);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.24;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", `${mapName(mapId)} 3D tactical match observer`);
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.5, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 13;
    controls.maxDistance = 58;
    controls.maxPolarAngle = Math.PI / 2.05;

    scene.add(new THREE.HemisphereLight("#c6e5ff", "#1f3029", 2.15));
    const sunlight = new THREE.DirectionalLight("#fff1d3", 4.2);
    sunlight.position.set(16, 30, 12);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(2048, 2048);
    sunlight.shadow.camera.left = -24;
    sunlight.shadow.camera.right = 24;
    sunlight.shadow.camera.top = 24;
    sunlight.shadow.camera.bottom = -24;
    scene.add(sunlight);

    const rim = new THREE.DirectionalLight("#70a7ff", 1.7);
    rim.position.set(-18, 9, -17);
    scene.add(rim);
    const warmFill = new THREE.DirectionalLight("#ffb764", 0.72);
    warmFill.position.set(5, 8, -20);
    scene.add(warmFill);

    buildVoxelWorld(scene, mapId);

    const playerLayer = new THREE.Group();
    const effectLayer = new THREE.Group();
    const traceLayer = new THREE.Group();
    scene.add(playerLayer, effectLayer, traceLayer);

    const bombGroup = new THREE.Group();
    const bombCore = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.38, 0.42),
      new THREE.MeshStandardMaterial({
        color: "#292929",
        emissive: "#ff2f22",
        emissiveIntensity: 0.7,
        roughness: 0.45,
      }),
    );
    bombCore.castShadow = true;
    bombGroup.add(bombCore);
    const bombLight = new THREE.PointLight("#ff392e", 4, 6);
    bombLight.position.y = 0.25;
    bombGroup.add(bombLight);
    bombGroup.visible = false;
    scene.add(bombGroup);

    const resize = () => {
      if (!mountRef.current) return;
      const { width, height } = mountRef.current.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mountRef.current);
    resize();

    const runtime: VoxelRuntime = {
      scene,
      camera,
      renderer,
      controls,
      playerLayer,
      effectLayer,
      traceLayer,
      playerRigs: new Map(),
      bomb: bombGroup,
      frameId: 0,
      resizeObserver,
    };
    runtimeRef.current = runtime;

    let previousFrameTime = performance.now();
    const render = (time: number) => {
      const deltaSeconds = Math.min(0.05, Math.max(0.001, (time - previousFrameTime) / 1000));
      previousFrameTime = time;
      const followAlpha = 1 - Math.exp(-11 * deltaSeconds);
      const poseAlpha = 1 - Math.exp(-9 * deltaSeconds);
      const currentPlayers = playersRef.current;
      const resetRigs = resetRigsRef.current;
      resetRigsRef.current = false;
      const visibleKeys = new Set<string>();
      currentPlayers.forEach((player) => {
        visibleKeys.add(player.radarKey);
        let rig = runtime.playerRigs.get(player.radarKey);
        if (!rig) {
          rig = createPlayerRig(player);
          runtime.playerRigs.set(player.radarKey, rig);
          runtime.playerLayer.add(rig.group);
        }
        if (resetRigs) rig.initialized = false;

        const target = worldPoint(player);
        const targetY = voxelSurfaceAt(mapId, player) + (player.alive ? 0.22 : 0.18);
        if (!rig.initialized) {
          rig.group.position.set(target.x, targetY, target.z);
          rig.group.rotation.y = THREE.MathUtils.degToRad(-player.yaw);
          rig.initialized = true;
        }
        const horizontalGap = Math.hypot(
          target.x - rig.group.position.x,
          target.z - rig.group.position.z,
        );
        rig.targetPosition.set(target.x, targetY, target.z);
        rig.group.position.lerp(rig.targetPosition, followAlpha);
        const targetYaw = THREE.MathUtils.degToRad(-player.yaw);
        const yawDelta =
          THREE.MathUtils.euclideanModulo(targetYaw - rig.group.rotation.y + Math.PI, Math.PI * 2) -
          Math.PI;
        rig.group.rotation.y += yawDelta * poseAlpha;
        rig.group.rotation.z = THREE.MathUtils.lerp(
          rig.group.rotation.z,
          player.alive ? 0 : Math.PI / 2,
          poseAlpha,
        );
        const aliveScale = player.alive ? 1 : 0.72;
        const scale = THREE.MathUtils.lerp(rig.group.scale.x, aliveScale, poseAlpha);
        rig.group.scale.setScalar(scale);
        rig.nameplate.visible = player.alive;
        rig.floorRing.visible = player.alive;
        const moving = runningRef.current && player.alive && horizontalGap > 0.025;
        rig.motion = THREE.MathUtils.lerp(rig.motion, moving ? 1 : 0, poseAlpha);
        rig.gaitPhase += deltaSeconds * (7.5 + Math.min(4, horizontalGap * 3)) * rig.motion;
        const walk = Math.sin(rig.gaitPhase) * 0.16 * rig.motion;
        rig.leftLeg.rotation.x = walk;
        rig.rightLeg.rotation.x = -walk;
        rig.head.position.y = 1.64 + Math.abs(Math.sin(rig.gaitPhase)) * 0.018 * rig.motion;
      });

      runtime.playerRigs.forEach((rig, key) => {
        rig.group.visible = visibleKeys.has(key);
      });

      const currentBomb = bombRef.current;
      runtime.bomb.visible = Boolean(currentBomb);
      if (currentBomb) {
        const at = worldPoint(currentBomb);
        const surface = voxelSurfaceAt(mapId, currentBomb);
        runtime.bomb.position.set(at.x, surface + 0.48 + Math.sin(time * 0.008) * 0.06, at.z);
        runtime.bomb.rotation.y += 0.012;
      }

      runtime.effectLayer.traverse((effect) => {
        const mesh = effect as THREE.Mesh;
        const seed = mesh.userData.effectSeed as number | undefined;
        if (seed == null) return;
        if (mesh.userData.effectType === "smoke") {
          mesh.rotation.y = Math.sin(time * 0.00024 + seed) * 0.08;
          mesh.position.y =
            (mesh.userData.baseY as number) + Math.sin(time * 0.0008 + seed * 1.7) * 0.035;
          const breathe = 0.985 + Math.sin(time * 0.00065 + seed) * 0.018;
          const baseScale = mesh.userData.baseScale as { x: number; y: number };
          mesh.scale.set(baseScale.x * breathe, baseScale.y * breathe, 1);
        } else if (mesh.userData.effectType === "flame") {
          mesh.scale.y = 0.76 + Math.abs(Math.sin(time * 0.008 + seed)) * 0.62;
          mesh.rotation.y = Math.sin(time * 0.006 + seed) * 0.24;
        }
      });

      runtime.traceLayer.traverse((effect) => {
        const mesh = effect as THREE.Mesh;
        if (!mesh.userData.shotPulse) return;
        const material = mesh.material as THREE.MeshBasicMaterial;
        material.opacity =
          (mesh.userData.baseOpacity as number) *
          (0.72 + Math.abs(Math.sin(time * 0.018 + (mesh.userData.phase as number))) * 0.28);
      });

      runtime.controls.update();
      runtime.renderer.render(runtime.scene, runtime.camera);
      runtime.frameId = requestAnimationFrame(render);
    };
    runtime.frameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(runtime.frameId);
      resizeObserver.disconnect();
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
      runtimeRef.current = null;
    };
  }, [mapId]);

  const traceKey = useMemo(
    () =>
      traces
        .map((trace) => `${trace.killerPos.x.toFixed(1)}:${trace.killerPos.y.toFixed(1)}:${trace.victimPos.x.toFixed(1)}:${trace.victimPos.y.toFixed(1)}:${trace.opacity.toFixed(2)}`)
        .join("|"),
    [traces],
  );

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    clearLayer(runtime.traceLayer);
    traces.forEach((trace, traceIndex) => {
      const from = worldPoint(trace.killerPos);
      const to = worldPoint(trace.victimPos);
      const fromPoint = new THREE.Vector3(
        from.x,
        voxelSurfaceAt(mapId, trace.killerPos) + 1.22,
        from.z,
      );
      const toPoint = new THREE.Vector3(
        to.x,
        voxelSurfaceAt(mapId, trace.victimPos) + 0.92,
        to.z,
      );
      const color = trace.side === "CT" ? "#8fd0ff" : "#ffc247";
      const group = new THREE.Group();

      const glowOpacity = Math.max(0.22, trace.opacity * 0.46);
      const glow = voxelBeam(
        fromPoint,
        toPoint,
        0.105,
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: glowOpacity,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
        8,
      );
      glow.userData.shotPulse = true;
      glow.userData.baseOpacity = glowOpacity;
      glow.userData.phase = traceIndex * 1.73;
      group.add(glow);

      const coreOpacity = Math.max(0.58, trace.opacity);
      const core = voxelBeam(
        fromPoint,
        toPoint,
        0.034,
        new THREE.MeshBasicMaterial({
          color: "#fff7d0",
          transparent: true,
          opacity: coreOpacity,
          depthWrite: false,
        }),
      );
      core.userData.shotPulse = true;
      core.userData.baseOpacity = coreOpacity;
      core.userData.phase = traceIndex * 1.73 + 0.7;
      group.add(core);

      const muzzle = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 12, 8),
        new THREE.MeshStandardMaterial({
          color: "#fff3a8",
          emissive: "#ff9a22",
          emissiveIntensity: 4.4,
          roughness: 0.38,
        }),
      );
      muzzle.position.copy(fromPoint);
      muzzle.rotation.set(traceIndex * 0.7, traceIndex * 1.1, traceIndex * 0.43);
      group.add(muzzle);
      const muzzleLight = new THREE.PointLight("#ffbd55", 6.5, 6.5);
      muzzleLight.position.copy(fromPoint);
      group.add(muzzleLight);

      for (let index = 0; index < 5; index += 1) {
        const spark = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 7, 5),
          new THREE.MeshBasicMaterial({
            color: index % 2 ? "#fff7bb" : color,
            transparent: true,
            opacity: coreOpacity,
          }),
        );
        const angle = index * 2.39 + traceIndex;
        spark.position.set(
          toPoint.x + Math.cos(angle) * (0.18 + index * 0.045),
          toPoint.y + (index - 2) * 0.12,
          toPoint.z + Math.sin(angle) * (0.18 + index * 0.045),
        );
        spark.userData.shotPulse = true;
        spark.userData.baseOpacity = coreOpacity;
        spark.userData.phase = traceIndex + index * 0.82;
        group.add(spark);
      }

      const impactLight = new THREE.PointLight(color, 3.8, 3.5);
      impactLight.position.copy(toPoint);
      group.add(impactLight);
      runtime.traceLayer.add(group);
    });
  }, [mapId, traceKey, traces]);

  const utilityKey = useMemo(
    () => utilities.map((utility) => `${utility.type}:${utility.at.x.toFixed(1)}:${utility.at.y.toFixed(1)}`).join("|"),
    [utilities],
  );

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    clearLayer(runtime.effectLayer);
    utilities.forEach((utility, utilityIndex) => {
      const at = worldPoint(utility.at);
      const group = new THREE.Group();
      group.position.set(at.x, voxelSurfaceAt(mapId, utility.at) + 0.35, at.z);

      if (utility.type === "smoke") {
        const smokeTexture = createSmokeTexture();
        const smokeColors = ["#e5eaeb", "#c4cdcf", "#9fa9ac", "#7f8a8e"];
        for (let index = 0; index < 18; index += 1) {
          const layer = Math.floor(index / 6);
          const angle = index * 2.399 + utilityIndex * 0.91;
          const radius = layer === 0 ? 1.22 : layer === 1 ? 0.86 : 0.48;
          const size = 0.78 + ((index * 17 + utilityIndex * 11) % 7) * 0.065;
          const puff = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: smokeTexture,
              color: smokeColors[(index + utilityIndex) % smokeColors.length],
              transparent: true,
              opacity: 0.34 + (index % 3) * 0.045,
              depthWrite: false,
              depthTest: true,
            }),
          );
          puff.position.set(
            Math.sin(angle) * radius,
            0.34 + layer * 0.66 + (index % 2) * 0.1,
            Math.cos(angle) * radius,
          );
          const puffWidth = size * 2.25;
          const puffHeight = size * 1.78;
          puff.scale.set(puffWidth, puffHeight, 1);
          puff.userData.effectType = "smoke";
          puff.userData.effectSeed = index + utilityIndex * 23;
          puff.userData.baseY = puff.position.y;
          puff.userData.baseScale = { x: puffWidth, y: puffHeight };
          group.add(puff);
        }
        const smokeFootprint = new THREE.Mesh(
          new THREE.CircleGeometry(1.78, 32),
          new THREE.MeshBasicMaterial({
            color: "#667276",
            transparent: true,
            opacity: 0.16,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        smokeFootprint.rotation.x = -Math.PI / 2;
        smokeFootprint.position.y = -0.29;
        group.add(smokeFootprint);
      } else if (utility.type === "molotov") {
        for (let index = 0; index < 12; index += 1) {
          const angle = index * 2.17 + utilityIndex * 0.38;
          const radius = 0.42 + (index % 4) * 0.37;
          const patch = new THREE.Mesh(
            new THREE.CircleGeometry(0.42 + (index % 2) * 0.11, 12),
            new THREE.MeshStandardMaterial({
              color: index % 3 ? "#ef6424" : "#ffc43d",
              emissive: "#ff3208",
              emissiveIntensity: 2.1,
              roughness: 0.68,
            }),
          );
          patch.position.set(Math.sin(angle) * radius, -0.2, Math.cos(angle) * radius);
          patch.rotation.set(-Math.PI / 2, 0, angle);
          group.add(patch);
        }
        for (let index = 0; index < 15; index += 1) {
          const angle = index * 2.31 + utilityIndex;
          const radius = 0.32 + (index % 5) * 0.3;
          const height = 0.44 + (index % 4) * 0.17;
          const flame = new THREE.Mesh(
            new THREE.ConeGeometry(0.2 + (index % 2) * 0.05, height, 7),
            new THREE.MeshStandardMaterial({
              color: index % 2 ? "#ff7a22" : "#ffd45a",
              emissive: "#ff3d0a",
              emissiveIntensity: 2.8,
              roughness: 0.48,
            }),
          );
          flame.position.set(Math.sin(angle) * radius, 0.08 + height / 2, Math.cos(angle) * radius);
          flame.userData.effectType = "flame";
          flame.userData.effectSeed = index + utilityIndex * 19;
          group.add(flame);
        }
        const fireLight = new THREE.PointLight("#ff642e", 7, 9);
        fireLight.position.y = 1;
        group.add(fireLight);
      } else {
        const burst = new THREE.Mesh(
          new THREE.SphereGeometry(0.43, 14, 10),
          new THREE.MeshStandardMaterial({
            color: utility.type === "flash" ? "#ffffff" : "#ff6c42",
            emissive: utility.type === "flash" ? "#ffffff" : "#ff341f",
            emissiveIntensity: 3.2,
          }),
        );
        group.add(burst);
        group.add(
          new THREE.PointLight(utility.type === "flash" ? "#ffffff" : "#ff4a2b", 8, 10),
        );
      }

      runtime.effectLayer.add(group);
    });
  }, [mapId, utilities, utilityKey]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    if (cameraMode === "tactical") {
      runtime.camera.position.set(0.01, 45, 0.01);
      runtime.controls.target.set(0, 0, 0);
    } else {
      runtime.camera.position.set(25, 27, 28);
      runtime.controls.target.set(0, 0.5, 0);
    }
    runtime.camera.lookAt(runtime.controls.target);
    runtime.controls.update();
  }, [cameraMode, cameraNonce]);

  return <div className="voxel-canvas" ref={mountRef} />;
}

export function MatchVoxelView({ match, you, opponent, speed = 1 }: MatchVoxelViewProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const mapProfile = VOXEL_MAP_PROFILES[match.map];
  const activeRound = match.pendingEvents?.[0]?.round ?? match.feed[0]?.round ?? match.round;
  const roundEvents = match.feed.filter((event) => event.round === activeRound);
  const [cameraMode, setCameraMode] = useState<"broadcast" | "tactical">("broadcast");
  const [cameraNonce, setCameraNonce] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === shellRef.current);
    };
    document.addEventListener("fullscreenchange", syncFullscreenState);
    syncFullscreenState();
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  const toggleFullscreen = async () => {
    const shell = shellRef.current;
    if (!shell) return;
    try {
      if (document.fullscreenElement === shell) {
        await document.exitFullscreen();
        return;
      }
      if (document.fullscreenElement) await document.exitFullscreen();
      await shell.requestFullscreen();
    } catch {
      setIsFullscreen(false);
    }
  };

  const animatedStep = useAnimatedStep(
    activeRound,
    roundEvents.length,
    speed,
    () => getStepDelay(match, you, opponent, roundEvents.length, speed, "map"),
  );
  const stepIndex = Math.max(0, animatedStep);
  const { players, traces, bomb, flashed } = simulateRadarPlayers(match, you, opponent, stepIndex);
  const layout = MAP_LAYOUTS[match.map];
  const utilityAnchors = [
    layout.mid,
    layout.bombsiteA,
    layout.bombsiteB,
    ...Object.values(layout.chokePoints),
  ];
  const utilities = roundEvents
    .filter(
      (event) =>
        (event.type === "smoke" || event.type === "molotov" || event.type === "flash" || event.type === "he"),
    )
    .slice(-6)
    .map((event, eventIndex) => {
      const handleSeed = [...event.killerId].reduce((sum, character) => sum + character.charCodeAt(0), 0);
      return {
        type: event.type!,
        at:
          event.targetPos ??
          event.killerPos ??
          utilityAnchors[(handleSeed + activeRound + eventIndex) % utilityAnchors.length],
      };
    });

  const ctPlayers = players.filter((player) => player.side === "CT");
  const tPlayers = players.filter((player) => player.side === "T");
  const ctAlive = ctPlayers.filter((player) => player.alive).length;
  const tAlive = tPlayers.filter((player) => player.alive).length;
  const latestEvent = roundEvents.find((event) => event.type !== "round_start");
  const recentKills = roundEvents
    .filter(
      (event) =>
        (!event.type || event.type === "kill") &&
        Boolean(event.killer) &&
        Boolean(event.victim),
    )
    .slice(0, 3);
  const utilitySummary = Object.entries(
    utilities.reduce<Record<string, number>>((counts, utility) => {
      counts[utility.type] = (counts[utility.type] ?? 0) + 1;
      return counts;
    }, {}),
  )
    .map(([type, count]) => `${type.toUpperCase()}${count > 1 ? ` ×${count}` : ""}`)
    .join(" · ");
  const yourSide = match.side;

  const sideTeam = (side: "CT" | "T") => {
    const isYou = side === yourSide;
    return isYou ? you : opponent;
  };
  const eventSide = (team: string | undefined) => {
    if (team !== "you" && team !== "opponent") return "neutral";
    const side = team === "you" ? yourSide : yourSide === "CT" ? "T" : "CT";
    return side.toLowerCase();
  };
  const utilityLabel: Record<string, string> = {
    smoke: "SMK",
    molotov: "FIRE",
    flash: "FL",
    he: "HE",
  };

  return (
    <div
      className={`voxel-shell${isFullscreen ? " is-fullscreen" : ""}`}
      ref={shellRef}
    >
      <div className="voxel-toolbar">
        <div className="voxel-map-id">
          <span><MapIcon aria-hidden="true" size={13} /> MDL // LIVE 3D</span>
          <strong>{mapName(match.map)}</strong>
          <small title={mapProfile.identity}>ROUND {activeRound} · {mapProfile.identity}</small>
        </div>
        <div className="voxel-camera-controls segmented compact">
          <button className={cameraMode === "broadcast" ? "selected" : ""} onClick={() => setCameraMode("broadcast")}>
            <Focus aria-hidden="true" size={13} />
            Perspective
          </button>
          <button className={cameraMode === "tactical" ? "selected" : ""} onClick={() => setCameraMode("tactical")}>
            <MapIcon aria-hidden="true" size={13} />
            Tactical
          </button>
          <button onClick={() => setCameraNonce((nonce) => nonce + 1)} aria-label="Reset 3D camera">
            <RotateCcw aria-hidden="true" size={13} />
            Reset
          </button>
          <button
            className="voxel-fullscreen-toggle"
            onClick={() => void toggleFullscreen()}
            aria-label={isFullscreen ? "Exit fullscreen 3D observer" : "Open fullscreen 3D observer"}
          >
            {isFullscreen
              ? <Minimize aria-hidden="true" size={13} />
              : <Expand aria-hidden="true" size={13} />}
            {isFullscreen ? "Exit full screen" : "Full screen"}
          </button>
        </div>
      </div>

      <div className="voxel-stage" onDoubleClick={() => void toggleFullscreen()}>
        <VoxelScene
          mapId={match.map}
          players={players}
          traces={traces}
          bomb={bomb}
          utilities={utilities}
          running={match.running}
          roundKey={activeRound}
          cameraMode={cameraMode}
          cameraNonce={cameraNonce}
        />

        <div className="voxel-round-hud">
          <div className="voxel-side-card ct">
            <span>CT</span>
            <div>
              <strong>{sideTeam("CT").tag}</strong>
              <small>{sideTeam("CT").name}</small>
            </div>
            <b>{ctAlive}</b>
          </div>
          <div className="voxel-round-state">
            <b>R{activeRound}</b>
            <div>
              <span className={match.running ? "live" : ""} />
              {match.running ? "LIVE" : "PAUSED"}
            </div>
          </div>
          <div className="voxel-side-card t">
            <b>{tAlive}</b>
            <div>
              <strong>{sideTeam("T").tag}</strong>
              <small>{sideTeam("T").name}</small>
            </div>
            <span>T</span>
          </div>
        </div>

        {recentKills.length > 0 && (
          <div className="voxel-kill-feed" aria-label="Recent eliminations">
            {recentKills.map((event, index) => (
              <div key={`${event.killerId}:${event.victimId}:${index}`}>
                <strong className={eventSide(event.team)}>{event.killer}</strong>
                <span>{event.weapon || "RIFLE"}</span>
                <b>{event.victim}</b>
              </div>
            ))}
          </div>
        )}

        <div className="voxel-roster voxel-roster-ct">
          {ctPlayers.map((player) => (
            <span className={player.alive ? "" : "dead"} key={player.radarKey}>
              <i />
              {player.handle}
              {flashed[player.radarKey] > 0 && <em>FLASHED</em>}
            </span>
          ))}
        </div>
        <div className="voxel-roster voxel-roster-t">
          {tPlayers.map((player) => (
            <span className={player.alive ? "" : "dead"} key={player.radarKey}>
              {flashed[player.radarKey] > 0 && <em>FLASHED</em>}
              {player.handle}
              <i />
            </span>
          ))}
        </div>

        {utilities.length > 0 && (
          <div className="voxel-utility-dock" aria-label="Active utility">
            <small>ACTIVE UTILITY</small>
            {utilities.map((utility, index) => (
              <span className={utility.type} key={`${utility.type}:${index}`}>
                {utilityLabel[utility.type] ?? utility.type.toUpperCase()}
              </span>
            ))}
          </div>
        )}

        <div className="voxel-help">DRAG TO ORBIT · SCROLL TO ZOOM · DOUBLE CLICK FOR FULL SCREEN</div>
      </div>

      <div className="voxel-event-strip" aria-live="polite">
        <span className="voxel-event-label">ROUND SIGNAL</span>
        <strong>
          {latestEvent
            ? latestEvent.type === "plant"
              ? `${latestEvent.killer} planted the bomb`
              : latestEvent.type === "defuse"
                ? `${latestEvent.killer} is on the defuse`
                : latestEvent.type === "explode"
                  ? "Bomb detonated"
                  : latestEvent.type === "round_over"
                    ? latestEvent.reason
                    : latestEvent.killer && latestEvent.victim
                      ? `${latestEvent.killer} eliminated ${latestEvent.victim}`
                      : `${latestEvent.type ?? "Contact"} registered`
            : "Teams are leaving spawn"}
        </strong>
        <span className="voxel-event-meta">
          {VOXEL_SOURCE_LABEL} · {utilitySummary || "No utility active"}
        </span>
      </div>
    </div>
  );
}
