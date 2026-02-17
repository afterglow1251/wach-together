import { defineWorkspace } from "vitest/config"
import solid from "vite-plugin-solid"

export default defineWorkspace([
  {
    test: {
      name: "server",
      include: ["src/server/**/*.test.ts"],
      environment: "node",
    },
  },
  {
    plugins: [solid()],
    test: {
      name: "client",
      include: ["src/client/**/*.test.{ts,tsx}"],
      environment: "jsdom",
      setupFiles: ["./tests/setup-client.ts"],
    },
    resolve: {
      conditions: ["development", "browser"],
    },
  },
  {
    test: {
      name: "shared",
      include: ["src/shared/**/*.test.ts"],
      environment: "node",
    },
  },
])
