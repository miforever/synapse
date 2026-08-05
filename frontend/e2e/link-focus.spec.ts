/**
 * Which connections recede when a memory is open.
 *
 * Both canvases dim differently — 2D swaps the stroke, 3D scales a shader
 * attribute — but they share this rule, so it is worth pinning down once
 * rather than judging by eye across two renderers.
 */

import { expect, test } from "@playwright/test";

import { isLinkLit } from "../lib/link-focus";

const NEIGHBOURS = new Set(["b", "c"]);

test.describe("link focus", () => {
  test("everything is lit when nothing is open", () => {
    expect(isLinkLit({ source: "x", target: "y" }, null, new Set())).toBe(true);
  });

  test("connections of the open memory stay lit", () => {
    expect(isLinkLit({ source: "a", target: "b" }, "a", NEIGHBOURS)).toBe(true);
    expect(isLinkLit({ source: "c", target: "a" }, "a", NEIGHBOURS)).toBe(true);
  });

  test("connections between its neighbours stay lit", () => {
    // The neighbourhood should read as a shape, not a spray of lines out of
    // one point.
    expect(isLinkLit({ source: "b", target: "c" }, "a", NEIGHBOURS)).toBe(true);
  });

  test("unrelated connections recede", () => {
    expect(isLinkLit({ source: "x", target: "y" }, "a", NEIGHBOURS)).toBe(false);
    // One end in the neighbourhood is not enough: this is the line leaving the
    // neighbourhood, and it belongs in the background with its far end.
    expect(isLinkLit({ source: "b", target: "y" }, "a", NEIGHBOURS)).toBe(false);
  });

  test("endpoints work as ids or as node objects", () => {
    // The simulation swaps ids for node references once it starts.
    expect(isLinkLit({ source: { id: "a" }, target: { id: "y" } }, "a", NEIGHBOURS)).toBe(
      true,
    );
    expect(isLinkLit({ source: { id: "x" }, target: { id: "y" } }, "a", NEIGHBOURS)).toBe(
      false,
    );
  });
});
