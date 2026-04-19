// Override DATABASE_URL to point at the test database before any test modules load
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? ""
