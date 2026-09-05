import { defineConfig } from "@playwright/test";
import path from "node:path";

const e2eHome = path.join(__dirname, ".e2e-home");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- -p 3100",
    url: "http://localhost:3100/api/current-config",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      USERPROFILE: e2eHome,
      HOME: e2eHome,
    },
  },
});
