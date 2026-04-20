import { test, expect } from "@playwright/test"

function uniqueEmail() {
  return `test+${Date.now()}@example.com`
}

const PASSWORD = "password123"

test("new user signs up and lands on /", async ({ page }) => {
  const email = uniqueEmail()

  await page.goto("/sign-up")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Create account" }).click()

  // new user has no diagrams — stays at / showing no-diagrams landing
  await expect(page).toHaveURL("/")
  await expect(page.getByText(/no diagrams yet/i)).toBeVisible()
})

test("existing user signs in and lands on most recent diagram", async ({ page }) => {
  const email = uniqueEmail()

  // register and create a diagram
  await page.goto("/sign-up")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page).toHaveURL("/")
  await page.getByRole("button", { name: /create your first diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)

  // sign out then sign back in
  await page.goto("/api/auth/signout")
  await page.getByRole("button", { name: /sign out/i }).click()
  await expect(page).toHaveURL(/sign-in/)

  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()

  // / redirects to most recent diagram
  await expect(page).toHaveURL(/\/diagrams\//)
})

test("signed-in user signs out and is redirected to sign-in", async ({ page }) => {
  const email = uniqueEmail()

  await page.goto("/sign-up")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page).toHaveURL("/")

  await page.goto("/api/auth/signout")
  await page.getByRole("button", { name: /sign out/i }).click()

  await expect(page).toHaveURL(/sign-in/)
})

test("unauthenticated user navigating to / is redirected to sign-in", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/sign-in/)
})

test("already-authenticated user visiting /sign-in is redirected to /", async ({ page }) => {
  const email = uniqueEmail()

  await page.goto("/sign-up")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page).toHaveURL("/")

  await page.goto("/sign-in")
  await expect(page).toHaveURL("/")
})
