import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: process.env.CI ? 2 : 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    launchOptions: {
      args: ["--disable-gpu"],
      ...(chromiumExecutable ? { executablePath: chromiumExecutable } : {}),
    },
    screenshot: "off",
    trace: "off",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 5"] } },
  ],
  webServer: [
    {
      command: "node tests/fixtures/e2e-upstream.mts",
      port: 4100,
      reuseExistingServer: !process.env.CI,
      timeout: 10_000,
    },
    {
      command: `NODE_ENV=test MYLOCKER_API_BASE_URL=http://127.0.0.1:4100 PUBLIC_APP_ORIGIN=http://localhost:${port} SESSION_SECRET=a-fictional-e2e-secret-that-is-long-enough SESSION_TTL_SECONDS=3600 npm start -- --hostname localhost --port ${port}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      url: `http://localhost:${port}`,
    },
    {
      command:
        "NODE_ENV=test MYLOCKER_API_BASE_URL=http://127.0.0.1:4100 PUBLIC_APP_ORIGIN=http://localhost:3101 SESSION_SECRET=a-fictional-e2e-expiry-secret-long-enough SESSION_TTL_SECONDS=1 npm start -- --hostname localhost --port 3101",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      url: "http://localhost:3101",
    },
  ],
});
