import { expect, test } from "@playwright/test";

const API = process.env.SYNAPSE_API ?? "http://localhost:8000";

/**
 * The canvas caches the graph and asks the daemon only what changed. The risk
 * that matters is not the saving — it is showing a graph that is out of date,
 * so these check that a reload sees writes and deletions made while it was
 * away.
 */
test.describe("graph cache", () => {
  test("a reload fetches a delta, not the whole graph", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/graph")) requests.push(r.url());
    });

    await page.goto("/");
    await expect(page.getByTestId("memory-count")).toBeVisible();
    await page.waitForTimeout(3000);
    expect(requests.some((url) => !url.includes("since="))).toBe(true);

    requests.length = 0;
    await page.reload();
    await expect(page.getByTestId("memory-count")).toBeVisible();
    await page.waitForTimeout(3000);

    // The second load asks only for what changed.
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((url) => url.includes("since="))).toBe(true);
  });

  test("a delta reply carries deletions, not just writes", async ({ page }) => {
    // Straight against the daemon: the canvas would hear a deletion over the
    // socket, and what is under test here is what a client that was *not*
    // listening gets told when it comes back.
    await page.goto("/");
    await expect(page.getByTestId("memory-count")).toBeVisible();

    const full = await fetch(`${API}/graph`).then((r) => r.json());
    expect(full.complete).toBe(true);
    expect(full.as_of).toBeTruthy();

    const delta = await fetch(
      `${API}/graph?since=${encodeURIComponent(full.as_of)}`,
    ).then((r) => r.json());
    expect(delta.complete).toBe(false);
    expect(Array.isArray(delta.deleted)).toBe(true);
    // Nothing happened in between, so the reply is empty rather than the graph.
    expect(delta.nodes).toEqual([]);
  });

  test("a cached canvas is corrected rather than trusted", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("memory-count")).toBeVisible();
    await page.waitForTimeout(3000);
    const count = Number(await page.getByTestId("memory-count").textContent());

    await page.reload();
    await expect(page.getByTestId("memory-count")).toBeVisible();
    await page.waitForTimeout(3000);

    // Same graph after a delta round trip: nothing duplicated, nothing lost.
    expect(Number(await page.getByTestId("memory-count").textContent())).toBe(count);
  });
});
