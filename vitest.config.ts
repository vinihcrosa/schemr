import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import { resolve } from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  test: {
    projects: [
      {
        name: "unit",
        plugins: [react()],
        resolve: {
          alias: {
            "@": resolve(__dirname, "."),
          },
        },
        test: {
          name: "unit",
          globals: true,
          environment: "jsdom",
          include: ["**/*.unit.test.{ts,tsx}"],
          setupFiles: ["./tests/setup/unit-setup.ts"],
        },
      },
      {
        name: "integration",
        resolve: {
          alias: {
            "@": resolve(__dirname, "."),
          },
        },
        test: {
          name: "integration",
          environment: "node",
          include: ["**/*.integration.test.ts"],
          globalSetup: ["./tests/setup/integration-setup.ts"],
          setupFiles: ["./tests/setup/integration-env.ts"],
          maxConcurrency: 1,
        },
      },
    ],
  },
})
