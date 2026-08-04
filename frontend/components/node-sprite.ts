/**
 * Builds the Three.js object drawn for each 3D node.
 *
 * Materials and textures are cached per class rather than per node. A graph
 * with a thousand memories across a dozen classes then allocates a dozen
 * materials instead of a thousand, which is the difference between a smooth
 * canvas and a stuttering one.
 */

import {
  CanvasTexture,
  Group,
  Sprite,
  SpriteMaterial,
  type Object3D,
} from "three";
import SpriteText from "three-spritetext";

import { colorForClass } from "@/lib/node-classes";
import type { GraphNode } from "@/lib/types";

const materials = new Map<string, SpriteMaterial>();
const textures = new Map<string, CanvasTexture>();

const DISC_SIZE = 128;

/** A soft radial disc, tinted per class — nodes read as glowing points. */
function discTexture(color: string): CanvasTexture {
  const cached = textures.get(color);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = DISC_SIZE;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const half = DISC_SIZE / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.55, color);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(half, half, half, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new CanvasTexture(canvas);
  textures.set(color, texture);
  return texture;
}

function materialFor(type: string): SpriteMaterial {
  const cached = materials.get(type);
  if (cached) return cached;

  const material = new SpriteMaterial({
    map: discTexture(colorForClass(type)),
    transparent: true,
    depthWrite: false,
  });
  materials.set(type, material);
  return material;
}

export function buildNodeObject(node: GraphNode): Object3D {
  const group = new Group();

  const sprite = new Sprite(materialFor(node.type));
  sprite.scale.set(10, 10, 1);
  group.add(sprite);

  // Labels scale with camera distance for free via SpriteText.
  const label = new SpriteText(node.title);
  label.color = "#E2E8F0";
  label.textHeight = 3;
  label.position.set(0, -8, 0);
  group.add(label);

  return group;
}

/** Frees GPU resources when the canvas unmounts. */
export function disposeSpriteCache(): void {
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  materials.clear();
  textures.clear();
}
