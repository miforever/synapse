/**
 * Work laid out as a path.
 *
 * A wrong level here does not look wrong — it looks like a plan. These pin
 * down the cases where the layout could quietly claim something can start
 * before the thing it is waiting on is finished.
 */

import { expect, test } from "@playwright/test";

import { buildPath, progressOf } from "../lib/roadmap-path";
import type { GraphEdge, GraphNode, Status } from "../lib/types";

function node(id: string, status: Status = "todo"): GraphNode {
  return {
    id,
    type: "plan",
    title: id,
    summary: "",
    thumbnail_url: null,
    tags: [],
    status,
    target_date: null,
  };
}

/** `a` waits on `b`. */
function needs(a: string, b: string): GraphEdge {
  return {
    id: `${a}<-${b}`,
    source: a,
    target: b,
    relation_type: "depends_on",
    weight: 1,
  };
}

const TODAY = "2026-08-07";

test.describe("path layering", () => {
  test("unblocked work is all one step", () => {
    const path = buildPath([node("a"), node("b"), node("c")], [], TODAY);

    expect(path.steps).toHaveLength(1);
    expect(path.steps[0].items.map((i) => i.node.id).sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  test("a chain becomes one step each", () => {
    const path = buildPath(
      [node("first"), node("second"), node("third")],
      [needs("second", "first"), needs("third", "second")],
      TODAY,
    );

    expect(path.steps.map((s) => s.items.map((i) => i.node.id))).toEqual([
      ["first"],
      ["second"],
      ["third"],
    ]);
  });

  test("a step sits below its slowest prerequisite, not its first", () => {
    /*
     * A diamond: `end` waits on both `quick` and `slow`, and `slow` waits on
     * `start`. Layering by the shortest path would put `end` at step 2, level
     * with the thing it is waiting on — which reads as "these can happen at
     * the same time" and is exactly the lie this view must not tell.
     */
    const path = buildPath(
      [node("start"), node("quick"), node("slow"), node("end")],
      [
        needs("slow", "start"),
        needs("end", "quick"),
        needs("end", "slow"),
      ],
      TODAY,
    );

    expect(path.levelOf.get("end")).toBe(2);
    expect(path.levelOf.get("slow")).toBe(1);
    expect(path.levelOf.get("quick")).toBe(0);
  });

  test("dropped work is not a step on the way to anything", () => {
    const path = buildPath(
      [node("abandoned", "dropped"), node("live")],
      [needs("live", "abandoned")],
      TODAY,
    );

    // `live` is not held back by work nobody is doing.
    expect(path.levelOf.get("live")).toBe(0);
    expect(path.levelOf.has("abandoned")).toBe(false);
    expect(path.total).toBe(1);
  });

  test("work waiting on itself is surfaced, not dropped", () => {
    const path = buildPath(
      [node("a"), node("b"), node("free")],
      [needs("a", "b"), needs("b", "a")],
      TODAY,
    );

    expect(path.cyclic.map((i) => i.node.id).sort()).toEqual(["a", "b"]);
    // The rest of the plan still lays out around the loop.
    expect(path.steps[0].items.map((i) => i.node.id)).toEqual(["free"]);
  });

  test("only memories with a status are steps", () => {
    const path = buildPath([node("work"), { ...node("note"), status: null }], [], TODAY);
    expect(path.total).toBe(1);
  });
});

test.describe("step progress", () => {
  test("a step is done only when all of it is", () => {
    expect(
      progressOf({
        level: 0,
        items: [
          { node: node("a", "done"), blockedBy: [], blocking: [], overdue: false },
          { node: node("b", "done"), blockedBy: [], blocking: [], overdue: false },
        ],
      }),
    ).toBe("done");

    expect(
      progressOf({
        level: 0,
        items: [
          { node: node("a", "done"), blockedBy: [], blocking: [], overdue: false },
          { node: node("b", "todo"), blockedBy: [], blocking: [], overdue: false },
        ],
      }),
    ).toBe("doing");

    expect(
      progressOf({
        level: 0,
        items: [
          { node: node("a", "todo"), blockedBy: [], blocking: [], overdue: false },
        ],
      }),
    ).toBe("todo");
  });
});

test.describe("the path view", () => {
  test("shows numbered steps and switches to the board", async ({ page }) => {
    await page.goto("/roadmap/path");
    await expect(page.getByTestId("memory-count")).toBeVisible();

    await expect(page.getByText(/^Step 1/)).toBeVisible();

    await page.getByRole("link", { name: "Board" }).click();
    await expect(page.getByRole("heading", { name: "In flight" })).toBeVisible();

    await page.getByRole("link", { name: "Path" }).click();
    await expect(page.getByText(/^Step 1/)).toBeVisible();
  });
});
