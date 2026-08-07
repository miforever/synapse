import { expect, test } from "@playwright/test";

const API = process.env.SYNAPSSE_API ?? "http://localhost:8000";

test.describe("canvas", () => {
  test("loads the graph and reports its size", async ({ page }) => {
    await page.goto("/canvas/3d");

    // The control bar count is driven by the loaded snapshot.
    const count = page.getByTestId("memory-count");
    await expect(count).toBeVisible();
    await expect(page.getByText(/memor(y|ies)/)).toBeVisible();
  });

  test("renders a WebGL canvas", async ({ page }) => {
    await page.goto("/canvas/3d");
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();

    const size = await canvas.evaluate(
      (el) => (el as HTMLCanvasElement).width * (el as HTMLCanvasElement).height,
    );
    expect(size).toBeGreaterThan(0);
  });

  test("switches between 3D and 2D", async ({ page }) => {
    await page.goto("/canvas/3d");
    await expect(page.locator("canvas").first()).toBeVisible();

    await page.getByRole("link", { name: "2D", exact: true }).click();
    await expect(page.locator("canvas").first()).toBeVisible();

    await page.getByRole("link", { name: "3D", exact: true }).click();
    await expect(page.locator("canvas").first()).toBeVisible();
  });

  test("search finds a memory by prefix", async ({ page }) => {
    const seeded = await fetch(`${API}/graph`).then((r) => r.json());
    const title: string = seeded.nodes[0].title;
    const prefix = title.split(" ")[0].slice(0, 4);

    await page.goto("/canvas/3d");
    await page.getByLabel("Search memories").fill(prefix);

    const results = page.locator("ul >> button");
    await expect(results.first()).toBeVisible({ timeout: 10_000 });
  });

  test("search survives hostile input", async ({ page }) => {
    await page.goto("/canvas/3d");
    const box = page.getByLabel("Search memories");

    for (const hostile of ['"', "AND", "*", "a:b", "((("]) {
      await box.fill(hostile);
      await page.waitForTimeout(250);
    }

    // A 500 would surface as an unhandled rejection; the canvas must survive.
    await expect(page.locator("canvas").first()).toBeVisible();
  });

  test("a class filter narrows what is shown", async ({ page }) => {
    await page.goto("/canvas/3d");
    await expect(page.locator("canvas").first()).toBeVisible();

    const chip = page.locator("button", { hasText: /^Idea$|^Fact$|^Person$/ }).first();
    await chip.click();

    await expect(page.getByText(/\d+ shown · filters active/)).toBeVisible();
  });

  test("clicking a node opens the drawer with its content", async ({ page }) => {
    const graph = await fetch(`${API}/graph`).then((r) => r.json());
    const node = graph.nodes[0];

    await page.goto("/canvas/3d");
    // Reaching a specific node by canvas coordinates is brittle, so drive the
    // same path the search results use.
    await page.getByLabel("Search memories").fill(node.title.slice(0, 6));
    await page.locator("ul >> button").first().click();

    await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
    await expect(page.getByText("Connections")).toBeVisible({ timeout: 10_000 });
  });

  test("the graph and its controls stay live", async ({ page }) => {
    await page.goto("/canvas/3d");
    await expect(page.locator("canvas").first()).toBeVisible();

    const graph = await fetch(`${API}/graph`).then((r) => r.json());
    expect(graph.nodes.length).toBeGreaterThan(0);

    // The websocket indicator turns green only once the stream connects.
    await expect(page.getByTitle("Live")).toBeVisible({ timeout: 10_000 });
  });
});
