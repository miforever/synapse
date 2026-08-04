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

/** Built objects, so focus can restyle them without rebuilding the scene. */
interface Entry {
  sprite: Sprite;
  label: SpriteText;
  type: string;
  bright?: SpriteMaterial;
  /** Animated toward, rather than set outright — see runFocusTween. */
  targetScale: number;
  targetOpacity: number;
  targetLabelOpacity: number;
}

const objects = new Map<string, Entry>();

const classMaterials = new Map<string, SpriteMaterial>();
const classTextures = new Map<string, CanvasTexture>();
const thumbnailMaterials = new Map<string, SpriteMaterial>();

const DISC_SIZE = 128;
const LABEL_HEIGHT = 1.7;
const LABEL_MAX_CHARS = 22;

/**
 * Above this, labelling everything is unreadable noise, so labels are kept for
 * the focused memory and its neighbours until you zoom into a selection.
 */
const LABEL_ALL_BELOW = 60;

/**
 * Where to anchor a label so it clears the node it belongs to.
 *
 * `center` is measured in the sprite's own heights, so the offset has to be
 * derived from the node's radius — a fixed value smaller than that radius
 * leaves the text sitting on top of the node.
 */
function labelAnchor(nodeScale: number): number {
  const gap = 1.4;
  return 0.5 + (nodeScale / 2 + gap) / LABEL_HEIGHT;
}

function truncate(title: string): string {
  return title.length > LABEL_MAX_CHARS
    ? `${title.slice(0, LABEL_MAX_CHARS - 1)}…`
    : title;
}
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

  // Titles are measured in world units, so a long one renders several times
  // wider than the node it belongs to. Truncating and shrinking keeps a label
  // attached to its node rather than sprawling across its neighbours.
  const label = new SpriteText(truncate(node.title));
  label.color = "#E2E8F0";
  label.textHeight = LABEL_HEIGHT;
  /*
   * Offset in screen space, not world space.
   *
   * A world-space offset is fixed to the scene's axes, so orbiting the camera
   * swings the label around the node and it ends up beside or behind it.
   * `center` shifts the sprite relative to its own anchor, which is evaluated
   * against the camera — so anchoring the label's top edge to the node keeps
   * it hanging directly below from every angle.
   */
  label.position.set(0, 0, 0);
  label.center.set(0.5, labelAnchor(BASE_SCALE));
  label.material.depthWrite = false;
  // Labels read as annotations, so they should not be swallowed by the nodes
  // they belong to.
  label.material.depthTest = false;
  group.add(label);

  objects.set(node.id, {
    sprite,
    label,
    type: node.type,
    targetScale: BASE_SCALE,
    targetOpacity: 1,
    targetLabelOpacity: 1,
  });
  return group;
}

const BASE_SCALE = 10;
// Neighbours sit between the focus and the background so the local
// neighbourhood reads as a group rather than as slightly-less-dim noise.
const NEIGHBOUR_SCALE = 13;
const FOCUS_SCALE = 17;
const NEIGHBOUR_OPACITY = 0.85;
const DIM_OPACITY = 0.12;

/**
 * Highlight the focused memory and its neighbours, dimming the rest.
 *
 * Class materials are shared, so dimming is applied to them once and the few
 * highlighted nodes get a cloned material instead. That keeps this O(focus)
 * in allocations rather than O(nodes), and avoids rebuilding scene objects —
 * a rebuild at a thousand nodes would stutter on every click.
 */
export function applyFocus(
  focusId: string | null,
  neighbours: ReadonlySet<string>,
): void {
  const focusing = focusId !== null;
  dimTarget = focusing ? DIM_OPACITY : 1;

  // In a large graph only the focused neighbourhood is labelled; in a small
  // one every label fits, so they all stay on.
  const labelAll = objects.size <= LABEL_ALL_BELOW;

  objects.forEach((entry, id) => {
    const isFocus = id === focusId;
    const highlighted = isFocus || neighbours.has(id);
    entry.label.visible = highlighted || (!focusing && labelAll);

    if (focusing && highlighted) {
      if (!entry.bright) entry.bright = classMaterial(entry.type).clone();
      entry.sprite.material = entry.bright;
      entry.targetOpacity = isFocus ? 1 : NEIGHBOUR_OPACITY;
    } else {
      entry.sprite.material = classMaterial(entry.type);
      entry.targetOpacity = focusing ? DIM_OPACITY : 1;
    }

    entry.targetScale = isFocus
      ? FOCUS_SCALE
      : focusing && highlighted
        ? NEIGHBOUR_SCALE
        : BASE_SCALE;

    entry.targetLabelOpacity = !focusing || highlighted ? 1 : DIM_OPACITY;
  });

  startFocusTween();
}

/**
 * Eases focus changes over a few frames.
 *
 * Snapping scale and opacity the instant a node is selected reads as a glitch
 * rather than a transition, so values are lerped toward their targets and the
 * loop stops once everything has arrived.
 */
const EASE = 0.18;
const EPSILON = 0.01;

let dimTarget = 1;
let tweening = false;

function startFocusTween(): void {
  if (tweening) return;
  tweening = true;

  const step = () => {
    let settled = true;

    classMaterials.forEach((material) => {
      // Only the shared materials of non-highlighted nodes ride this value.
      const next = material.opacity + (dimTarget - material.opacity) * EASE;
      if (Math.abs(dimTarget - next) > EPSILON) settled = false;
      material.opacity = next;
    });

    objects.forEach((entry) => {
      const scale = entry.sprite.scale.x;
      const nextScale = scale + (entry.targetScale - scale) * EASE;
      if (Math.abs(entry.targetScale - nextScale) > EPSILON) settled = false;
      entry.sprite.scale.set(nextScale, nextScale, 1);
      entry.label.center.setY(labelAnchor(nextScale));

      if (entry.bright && entry.sprite.material === entry.bright) {
        const opacity = entry.bright.opacity;
        const next = opacity + (entry.targetOpacity - opacity) * EASE;
        if (Math.abs(entry.targetOpacity - next) > EPSILON) settled = false;
        entry.bright.opacity = next;
      }

      const labelOpacity = entry.label.material.opacity;
      const nextLabel =
        labelOpacity + (entry.targetLabelOpacity - labelOpacity) * EASE;
      if (Math.abs(entry.targetLabelOpacity - nextLabel) > EPSILON)
        settled = false;
      entry.label.material.opacity = nextLabel;
    });

    if (settled) {
      tweening = false;
      return;
    }
    requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

/** Frees GPU resources when the canvas unmounts. */
export function disposeSpriteCache(): void {
  classMaterials.forEach((material) => material.dispose());
  classTextures.forEach((texture) => texture.dispose());
  thumbnailMaterials.forEach((material) => {
    material.map?.dispose();
    material.dispose();
  });
  objects.forEach((entry) => entry.bright?.dispose());
  objects.clear();
  classMaterials.clear();
  classTextures.clear();
  thumbnailMaterials.clear();
}
