import { execSync } from "child_process"

export async function setup() {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL
  if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL is required for integration tests")
  }

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "inherit",
  })
}

export async function teardown() {}
