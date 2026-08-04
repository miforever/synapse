import { defineConfig, devices } from "@playwright/test";

/**
 * The suite drives a real browser against a running daemon, because the parts
 * worth testing here — WebGL rendering, the force simulation, live WebSocket
 * injection — have no meaningful unit-test surface.
 *
 * Start the stack yourself, or let `webServer` boot the canvas. The daemon is
 * expected at SYNAPSE_API (default http://localhost:8000).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,

  use: {
    baseURL: process.env.SYNAPSE_CANVAS ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // Software WebGL so the suite runs on headless CI boxes; real GPUs
          // will only do better than the numbers measured here.
          args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
        },
      },
    },
  ],
});
