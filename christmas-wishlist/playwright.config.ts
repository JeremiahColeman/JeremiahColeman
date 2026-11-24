import { defineConfig, devices } from "@playwright/test";

// iPhone-sized viewport, run in Chromium (the browser installed here).
const iPhone = { ...devices["iPhone 13"], browserName: "chromium" as const };

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "off",
    ...iPhone,
  },
  webServer: {
    // Auth redirect URLs are allowed for localhost:3000 in supabase/config.toml.
    command: "npm run build && npm run start -- -p 3000",
    url: "http://localhost:3000/sign-in",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
