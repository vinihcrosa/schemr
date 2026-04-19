import { describe, it, expect, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "@/app/api/auth/register/route"
import { db } from "@/lib/db"

const TEST_EMAIL_DOMAIN = "@register-test.example"

afterEach(async () => {
  await db.$executeRaw`DELETE FROM "User" WHERE email LIKE ${`%${TEST_EMAIL_DOMAIN}`}`
})

describe("POST /api/auth/register", () => {
  it("creates a user and returns 201 with id and email", async () => {
    const email = `user${Date.now()}${TEST_EMAIL_DOMAIN}`
    const req = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123" }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body).toHaveProperty("email", email)
    expect(body).toHaveProperty("id")
    expect(body).not.toHaveProperty("password")

    const user = await db.user.findUnique({ where: { email } })
    expect(user).not.toBeNull()
    expect(user!.password).not.toBe("password123")
  })

  it("returns 409 when email already exists", async () => {
    const email = `dupe${Date.now()}${TEST_EMAIL_DOMAIN}`
    await db.user.create({
      data: { email, password: "hashed", name: null },
    })

    const req = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123" }),
    })

    const res = await POST(req)
    expect(res.status).toBe(409)

    const body = await res.json()
    expect(body.error).toMatch(/already exists/i)
  })

  it("returns 400 with field errors for invalid input", async () => {
    const req = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", password: "short" }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body).toHaveProperty("errors")
  })
})
