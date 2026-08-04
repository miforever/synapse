/**
 * Builds the Three.js object drawn for each 3D node.
 *
 * Class materials and textures are cached per class rather than per node. A
 * graph with a thousand memories across a dozen classes then allocates a
 * dozen materials instead of a thousand, which is the difference between a
 * smooth canvas and a stuttering one.
 *
 * Thumbnails load asynchronously. A node renders as its class disc
 * immediately and swaps its texture in place once the image decodes — no
 * React state, so a late image never re-renders or re-heats the graph.
 */

import {
  CanvasTexture,
  Group,
  Sprite,
  SpriteMaterial,
  type Object3D,
} from "three";
import SpriteText from "three-spritetext";

import { getCircularThumbnail } from "@/lib/image-cache";
import { colorForClass } from "@/lib/node-classes";
import type { GraphNode } from "@/lib/types";

const classMaterials = new Map<string, SpriteMaterial>();
const classTextures = new Map<string, CanvasTexture>();
const thumbnailMaterials = new Map<string, SpriteMaterial>();

const DISC_SIZE = 128;
const THUMB_SIZE = 128;

/** A soft radial disc, tinted per class — nodes read as glowing points. */
function discTexture(color: string): CanvasTexture {
  const cached = classTextures.get(color);
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
  classTextures.set(color, texture);
  return texture;
}

function classMaterial(type: string): SpriteMaterial {
  const cached = classMaterials.get(type);
  if (cached) return cached;

  const material = new SpriteMaterial({
    map: discTexture(colorForClass(type)),
    transparent: true,
    depthWrite: false,
  });
  classMaterials.set(type, material);
  return material;
}

/** Shared per URL+class, so repeated thumbnails cost one texture. */
function thumbnailMaterial(url: string, type: string): SpriteMaterial | null {
  const key = `${url}@${type}`;
  const cached = thumbnailMaterials.get(key);
  if (cached) return cached;

  const canvas = getCircularThumbnail(url, colorForClass(type), THUMB_SIZE);
  if (!canvas) return null;

  const material = new SpriteMaterial({
    map: new CanvasTexture(canvas),
    transparent: true,
    depthWrite: false,
  });
  thumbnailMaterials.set(key, material);
  return material;
}

export function buildNodeObject(
  node: GraphNode,
  showThumbnails: boolean,
): Object3D {
  const group = new Group();

  const sprite = new Sprite(classMaterial(node.type));
  sprite.scale.set(10, 10, 1);
  group.add(sprite);

  if (showThumbnails && node.thumbnail_url) {
    const url = node.thumbnail_url;

    const applyThumbnail = () => {
      const material = thumbnailMaterial(url, node.type);
      if (material) sprite.material = material;
    };

    // Ready already? Swap now. Otherwise swap when the image decodes —
    // mutating the sprite directly keeps this off React's path entirely.
    getCircularThumbnail(url, colorForClass(node.type), THUMB_SIZE, () =>
      applyThumbnail(),
    );
    applyThumbnail();
  }

  const label = new SpriteText(node.title);
  label.color = "#E2E8F0";
  label.textHeight = 3;
  label.position.set(0, -8, 0);
  group.add(label);

  return group;
}

/** Frees GPU resources when the canvas unmounts. */
export function disposeSpriteCache(): void {
  classMaterials.forEach((material) => material.dispose());
  classTextures.forEach((texture) => texture.dispose());
  thumbnailMaterials.forEach((material) => {
    material.map?.dispose();
    material.dispose();
  });
  classMaterials.clear();
  classTextures.clear();
  thumbnailMaterials.clear();
}
