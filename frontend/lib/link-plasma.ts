/**
 * Plasma pulses travelling along the links.
 *
 * Replaces the renderer's particle spheres, which are measured in world units
 * and therefore swell into beads as the camera closes in. A line primitive is
 * always one pixel wide whatever the zoom, and the pulse is computed per
 * fragment *inside* that line — so the effect keeps its shape at any scale.
 *
 * One shared material draws every link. Per-link variation comes from a vertex
 * attribute rather than separate materials, which matters at a few thousand
 * edges: distinct materials would mean a draw call each.
 */

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Line,
  ShaderMaterial,
  type Object3D,
} from "three";

interface Endpoint {
  x?: number;
  y?: number;
  z?: number;
}

const VERTEX = /* glsl */ `
  attribute float aProgress;
  attribute float aPhase;
  varying float vProgress;
  varying float vPhase;

  void main() {
    vProgress = aProgress;
    vPhase = aPhase;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uWidth;
  uniform float uBase;
  uniform vec3 uColor;
  uniform vec3 uPulseColor;
  varying float vProgress;
  varying float vPhase;

  void main() {
    // Position within the travelling cycle, offset per link so the graph does
    // not pulse in unison.
    float cycle = fract(vProgress - uTime * uSpeed + vPhase);

    // Distance to the nearest pulse centre, wrapping at both ends so the band
    // fades in and out symmetrically instead of snapping.
    float distance = min(cycle, 1.0 - cycle);

    // smoothstep gives the fade-in, plateau and fade-out in one expression.
    float intensity = smoothstep(uWidth, 0.0, distance);

    vec3 color = mix(uColor, uPulseColor, intensity);
    gl_FragColor = vec4(color, uBase + intensity * (1.0 - uBase));
  }
`;

let material: ShaderMaterial | null = null;

function sharedMaterial(): ShaderMaterial {
  if (material) return material;

  material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: 0.14 },
      // Fraction of the link the pulse spans. Kept short so it reads as a
      // travelling spark rather than a streak lighting the whole edge.
      uWidth: { value: 0.035 },
      // Resting visibility of the line, matched to the 2D view so structure
      // is legible between pulses rather than nearly invisible.
      uBase: { value: 0.55 },
      uColor: { value: new Color("#BAC8DC") },
      uPulseColor: { value: new Color("#7FF6FF") },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    /*
     * Normal blending, not additive.
     *
     * Additive lets the line's resting colour wash out against the dark
     * canvas — a base bright enough to read would then blow out wherever
     * links cross. Blending normally keeps the line as legible as the 2D
     * view, and the pulse carries the brightness on its own.
     */
  });
  return material;
}

/** Advance every pulse. Called once per frame, not once per link. */
export function advancePlasma(seconds: number): void {
  if (material) material.uniforms.uTime.value = seconds;
}

export function buildLinkObject(): Object3D {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(6), 3));
  // 0 at the source end, 1 at the target, so pulses travel with the edge's
  // direction and the fragment stage can interpolate between them.
  geometry.setAttribute(
    "aProgress",
    new BufferAttribute(new Float32Array([0, 1]), 1),
  );
  const phase = Math.random();
  geometry.setAttribute(
    "aPhase",
    new BufferAttribute(new Float32Array([phase, phase]), 1),
  );

  return new Line(geometry, sharedMaterial());
}

/** Keep a link's geometry on its endpoints as the simulation moves them. */
export function updateLinkObject(
  object: Object3D,
  coords: { start: Endpoint; end: Endpoint },
): boolean {
  const { start, end } = coords;
  const geometry = (object as Line).geometry as BufferGeometry;
  const position = geometry.getAttribute("position") as BufferAttribute;

  position.setXYZ(0, start.x ?? 0, start.y ?? 0, start.z ?? 0);
  position.setXYZ(1, end.x ?? 0, end.y ?? 0, end.z ?? 0);
  position.needsUpdate = true;
  geometry.computeBoundingSphere();

  // Tells the renderer this object is positioned already and should be left
  // alone.
  return true;
}

export function disposePlasma(): void {
  material?.dispose();
  material = null;
}
