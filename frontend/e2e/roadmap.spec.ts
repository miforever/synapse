/**
 * Reading the graph as work.
 *
 * The grouping and the dependency resolution are pure functions over a
 * snapshot, so they are pinned down here rather than judged by looking at the
 * board — which lane a blocked, overdue plan lands in is exactly the kind of
 * thing that is easy to get wrong and hard to see.
 */

import { expect, test } from "@playwright/test";

import { buildRoadmap, relativeDate } from "../lib/roadmap";
import type { GraphEdge, GraphNode } from "../lib/types";

function node(
  id: string,
  status: GraphNode["status"] = null,
  target: string | null = null,
): GraphNode {
  return {
    id,
    type: "plan",
    title: id,
    summary: "",
    thumbnail_url: null,
    tags: [],
    status,
    target_date: target,
  };
}

function edge(
  source: string,
  target: string,
  relation: GraphEdge["relation_type"],
): GraphEdge {
  return { id: `${source}-${target}`, source, target, relation_type: relation, weight: 1 };
}

const TODAY = "2026-08-07";

test.describe("roadmap grouping", () => {
  test("only memories with a status are work", () => {
    const roadmap = buildRoadmap(
      [node("a", "todo"), node("b"), node("c", "done")],
      [],
      TODAY,
    );

    expect(roadmap.total).toBe(2);
    expect(roadmap.lanes.todo.map((i) => i.node.id)).toEqual(["a"]);
    expect(roadmap.lanes.done.map((i) => i.node.id)).toEqual(["c"]);
  });

  test("dated work sorts before undated, soonest first", () => {
    const roadmap = buildRoadmap(
      [
        node("someday", "todo"),
        node("later", "todo", "2026-12-01"),
        node("sooner", "todo", "2026-09-01"),
      ],
      [],
      TODAY,
    );

    expect(roadmap.lanes.todo.map((i) => i.node.id)).toEqual([
      "sooner",
      "later",
      "someday",
    ]);
  });

  test("depends_on and blocks describe the same constraint from either end", () => {
    const roadmap = buildRoadmap(
      [node("release", "todo"), node("feature", "doing"), node("bug", "todo")],
      [
        edge("release", "feature", "depends_on"),
        edge("bug", "release", "blocks"),
      ],
      TODAY,
    );

    // The release waits on the feature it depends on, and on the bug that
    // blocks it — two edge directions, one meaning.
    expect(roadmap.byId.get("release")?.blockedBy.sort()).toEqual([
      "bug",
      "feature",
    ]);
    expect(roadmap.byId.get("feature")?.blocking).toEqual(["release"]);
    expect(roadmap.byId.get("bug")?.blocking).toEqual(["release"]);
  });

  test("relates_to is not a sequencing constraint", () => {
    const roadmap = buildRoadmap(
      [node("a", "todo"), node("b", "todo")],
      [edge("a", "b", "relates_to")],
      TODAY,
    );

    expect(roadmap.byId.get("a")?.blockedBy).toEqual([]);
    expect(roadmap.byId.get("b")?.blocking).toEqual([]);
  });

  test("a dependency on something that is not work is not a blocker", () => {
    // Plans depend on decisions and people all the time; none of that is
    // sequencing, and a roadmap claiming otherwise would never look clear.
    const roadmap = buildRoadmap(
      [node("plan", "todo"), node("decision")],
      [edge("plan", "decision", "depends_on")],
      TODAY,
    );

    expect(roadmap.byId.get("plan")?.blockedBy).toEqual([]);
  });

  test("late work is flagged, but finished work is never late", () => {
    const roadmap = buildRoadmap(
      [
        node("late", "todo", "2026-07-01"),
        node("shipped", "done", "2026-07-01"),
        node("abandoned", "dropped", "2026-07-01"),
        node("upcoming", "todo", "2026-09-01"),
      ],
      [],
      TODAY,
    );

    expect(roadmap.byId.get("late")?.overdue).toBe(true);
    expect(roadmap.byId.get("shipped")?.overdue).toBe(false);
    expect(roadmap.byId.get("abandoned")?.overdue).toBe(false);
    expect(roadmap.byId.get("upcoming")?.overdue).toBe(false);
  });

  test("work due today is not yet late", () => {
    const roadmap = buildRoadmap([node("due", "todo", TODAY)], [], TODAY);
    expect(roadmap.byId.get("due")?.overdue).toBe(false);
  });
});

test.describe("relative dates", () => {
  const today = new Date("2026-08-07T12:00:00Z");

  test("reads as a person would say it", () => {
    expect(relativeDate("2026-08-07", today)).toBe("today");
    expect(relativeDate("2026-08-08", today)).toBe("tomorrow");
    expect(relativeDate("2026-08-06", today)).toBe("yesterday");
    expect(relativeDate("2026-08-10", today)).toBe("in 3 days");
    expect(relativeDate("2026-08-28", today)).toBe("in 3 weeks");
    expect(relativeDate("2026-07-01", today)).toBe("5 weeks ago");
    expect(relativeDate("2026-12-01", today)).toBe("in 4 months");
  });
});

test.describe("the roadmap page", () => {
  test("shows the work in the graph, and opens a memory from it", async ({
    page,
  }) => {
    await page.goto("/roadmap");

    const count = page.getByTestId("roadmap-count");
    await expect(count).toBeVisible();
    expect(Number(await count.textContent())).toBeGreaterThan(0);

    // Every lane is present whether or not it holds anything, so the board
    // has the same shape however the work is distributed.
    for (const lane of ["Planned", "In flight", "Done", "Dropped"]) {
      await expect(page.getByRole("heading", { name: lane })).toBeVisible();
    }

    // A card opens the same drawer the canvas uses — the roadmap is a view of
    // the memories, not a separate store.
    // By structure rather than by label: the class names are uppercased in
    // CSS, so the text in the DOM is not what the board reads as.
    await page.locator("ul button").first().click();
    await expect(page.locator("aside")).toBeVisible();
  });

  test("the canvas links to it and back", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas").first()).toBeVisible();

    await page.getByRole("link", { name: "Roadmap" }).click();
    await expect(page.getByTestId("roadmap-count")).toBeVisible();

    await page.getByRole("link", { name: /Canvas/ }).click();
    await expect(page.locator("canvas").first()).toBeVisible();
  });
});
