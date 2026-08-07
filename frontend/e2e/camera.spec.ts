import { expect, test } from "@playwright/test";

async function camera(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("synapsse.camera.v1");
    return raw ? JSON.parse(raw) : null;
  });
}

test("the camera survives a mode switch and a reload", async ({ page }) => {
  await page.goto("/canvas/3d");
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.waitForTimeout(9000);

  // Drive the 3D camera somewhere of our own choosing.
  await page.mouse.move(640, 360);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(2500);

  const after3d = await camera(page);
  expect(after3d["3d"].position).toBeTruthy();

  await page.getByRole("link", { name: "2D", exact: true }).click();
  await page.waitForTimeout(4000);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(2500);

  const both = await camera(page);
  expect(both["2d"].zoom).toBeGreaterThan(0);
  // The 3D view's camera is still remembered while the 2D one is open. Its
  // distance is what is asserted, not its exact position: the ambient
  // rotation keeps moving the camera around the graph, and that is the point
  // — the viewpoint that has to survive is how far out you had pulled.
  const reach = (p: { x: number; y: number; z: number }) =>
    Math.hypot(p.x, p.y, p.z);
  // Within a tenth: the orbit target rides the drifting graph, so measuring
  // from the origin wanders a little even when nothing has zoomed.
  expect(reach(both["3d"].position)).toBeGreaterThan(
    reach(after3d["3d"].position) * 0.9,
  );
  expect(reach(both["3d"].position)).toBeLessThan(
    reach(after3d["3d"].position) * 1.1,
  );

  // Back to 3D: it must return to where it was, not reframe from scratch.
  await page.getByRole("link", { name: "3D", exact: true }).click();
  await page.waitForTimeout(2500);
  const back = await camera(page);
  const drift = Math.abs(
    reach(back["3d"].position) - reach(after3d["3d"].position),
  );
  expect(drift).toBeLessThan(reach(after3d["3d"].position) * 0.25);

  const zoom2d = both["2d"].zoom;
  await page.reload();
  await page.getByRole("link", { name: "2D", exact: true }).click();
  await page.waitForTimeout(3000);
  const reloaded = await camera(page);
  expect(reloaded["2d"].zoom).toBeCloseTo(zoom2d, 1);
});
