import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "./tests/e2e/helpers/env";

loadEnv();

// One id per run, inherited by workers: test users are namespaced so concurrent runs never clash.
process.env.E2E_RUN_ID ??= Date.now().toString(36);
const PORT = Number(process.env.E2E_PORT ?? 3105);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
// In sandboxes with an HTTPS egress proxy, route the browser through it so Supabase is reachable.
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    trace: "off",
    screenshot: "only-on-failure",
    proxy,
    ignoreHTTPSErrors: Boolean(proxy),
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /public\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm build && pnpm start -p ${PORT}`,
        url: `${BASE_URL}/hy`,
        timeout: 300_000,
        // Never attach to a stale server from another worktree; pick a unique E2E_PORT per worktree.
        reuseExistingServer: false,
        // Node's fetch ignores HTTPS_PROXY unless asked; harmless where there is no proxy.
        env: { NODE_USE_ENV_PROXY: "1" },
      },
});
