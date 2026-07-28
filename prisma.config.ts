import path from "node:path"
import { defineConfig } from "prisma/config"

// Prisma 7 no longer auto-loads env files. Load .env.local for local/dev CLI runs
// (migrate/generate); in production DATABASE_URL comes from the container env.
try {
  process.loadEnvFile(".env.local")
} catch {
  // no .env.local (e.g. production) — rely on existing process env
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
})
