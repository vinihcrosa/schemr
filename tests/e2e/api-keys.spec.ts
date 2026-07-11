import { test, expect, request as playwrightRequest } from "@playwright/test"
import { signUp, uniqueEmail } from "./helpers"

const BASE_URL = "http://localhost:3000"

test("api key lifecycle: create, reveal, authenticate, revoke", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)

  // Reach the settings page via the user menu (needs a diagram for the sidebar).
  await page.getByRole("button", { name: /create your first diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)
  await page.getByRole("button", { name: "User menu" }).click()
  await page.getByRole("link", { name: "API keys" }).click()
  await expect(page).toHaveURL(/\/settings\/api-keys/)

  // Create a key — the raw secret is revealed exactly once.
  await page.getByLabel("New key label").fill("e2e")
  await page.getByRole("button", { name: "Create key" }).click()
  const rawKey = (
    await page.getByTestId("revealed-key-value").textContent()
  )?.trim()
  expect(rawKey).toMatch(/^sk_/)

  // Reloading the page must not resurface the raw secret.
  await page.reload()
  await expect(page.getByTestId("revealed-key-value")).toHaveCount(0)
  await expect(page.getByText("e2e")).toBeVisible()

  // The key authenticates a headless request against the diagram API.
  const anon = await playwrightRequest.newContext({ baseURL: BASE_URL })
  const okRes = await anon.get("/api/diagrams", {
    headers: { Authorization: `Bearer ${rawKey}` },
  })
  expect(okRes.status()).toBe(200)

  // No key at all → 401 (not a sign-in redirect).
  const noAuth = await anon.get("/api/diagrams")
  expect(noAuth.status()).toBe(401)

  // Revoke the key in the UI (with the confirm step).
  await page.getByRole("button", { name: "Revoke" }).click()
  await page.getByRole("button", { name: "Confirm" }).click()
  await expect(page.getByText("revoked")).toBeVisible()

  // The same bearer key no longer authenticates.
  const revokedRes = await anon.get("/api/diagrams", {
    headers: { Authorization: `Bearer ${rawKey}` },
  })
  expect(revokedRes.status()).toBe(401)

  await anon.dispose()
})
