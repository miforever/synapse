import { expect, test } from "@playwright/test";

/**
 * Guards the project's hard requirement: the canvas must not lag, in 2D or 3D.
 *
 * Run against a daemon seeded with a large graph — the numbers only mean
 * something at scale. Thresholds are deliberately generous because CI runs on
 * SwiftShader (software WebGL); real GPUs do considerably better.
 */

const MIN_FPS = Number(process.env.SYNAPSE_MIN_FPS ?? 20);
const SAMPLE_MS = 4000;

/** Counts real animation frames, which is what the user actually perceives. */
async function measureFps(
  page: import("@playwright/test").Page,
  ms: number,
): Promise<number> {
  return page.evaluate(async (duration) => {
    return new Promise<number>((resolve) => {
      let frames = 0;
      const start = performance.now();
      const tick = () => {
        frames += 1;
        if (performance.now() - start < duration) {
          requestAnimationFrame(tick);
        } else {
          resolve((frames * 1000) / (performance.now() - start));
        }
      };
      requestAnimationFrame(tick);
    });
  }, ms);
}

async function nodeCount(page: import("@playwright/test").Page): Promise<number> {
  const text = await page.getByTestId("memory-count").textContent();
  return parseInt(text ?? "0", 10);
}

test.describe("performance at scale", () => {
  test("3D holds frame rate with the graph settled and drifting", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("canvas").first()).toBeVisible();

    const nodes = await nodeCount(page);
    // Let the layout settle so this measures the steady state, not the
    // initial burst of force resolution.
    await page.waitForTimeout(6000);

    const fps = await measureFps(page, SAMPLE_MS);
    console.log(`3D: ${nodes} nodes -> ${fps.toFixed(1)} fps`);

    expect(nodes).toBeGreaterThan(0);
    expect(fps).toBeGreaterThan(MIN_FPS);
  });

  test("2D holds frame rate", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas").first()).toBeVisible();
    await page.getByRole("button", { name: "2d", exact: true }).click();

    const nodes = await nodeCount(page);
    await page.waitForTimeout(6000);

    const fps = await measureFps(page, SAMPLE_MS);
    console.log(`2D: ${nodes} nodes -> ${fps.toFixed(1)} fps`);

    expect(fps).toBeGreaterThan(MIN_FPS);
  });

  test("hovering does not stall the canvas", async ({ page }) => {
    await page.goto("/");
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
    await page.waitForTimeout(5000);

    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas has no box");

    // Sweep the pointer across the graph while sampling, which is the case
    // that would expose hover re-rendering the whole canvas.
    const sweep = (async () => {
      for (let i = 0; i < 40; i++) {
        await page.mouse.move(
          box.x + box.width * (0.2 + 0.6 * (i / 40)),
          box.y + box.height * (0.35 + 0.3 * Math.sin(i / 4)),
        );
        await page.waitForTimeout(50);
      }
    })();

    const fps = await measureFps(page, 3000);
    await sweep;

    console.log(`3D while hovering -> ${fps.toFixed(1)} fps`);
    expect(fps).toBeGreaterThan(MIN_FPS);
  });

  test("the initial snapshot arrives quickly", async ({ page }) => {
    const started = Date.now();
    await page.goto("/");
    await expect(page.getByText(/memor(y|ies)/)).toBeVisible({ timeout: 20_000 });
    const elapsed = Date.now() - started;

    console.log(`graph visible after ${elapsed} ms`);
    expect(elapsed).toBeLessThan(15_000);
  });
});
