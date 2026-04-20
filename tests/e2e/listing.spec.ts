import { test, expect } from "@playwright/test"

// M3 note: DiagramList at / is superseded by the M4 sidebar. These tests
// verify that the old listing surface at / is gone and the sidebar is the
// new navigation layer. Sidebar-specific flows live in sidebar.spec.ts.

const PASSWORD = "password123"

function uniqueEmail() {
  return `test+${Date.now()}+${Math.random().toString(36).slice(2)}@example.com`
}

async function signUp(page: Parameters<typeof test>[1]["page"], email: string) {
  await page.goto("/sign-up")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page).toHaveURL("/")
}

test("new user sees empty state on /", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await expect(page.getByText(/no diagrams yet/i)).toBeVisible()
  await expect(page.getByRole("button", { name: /create your first diagram/i })).toBeVisible()
})

test("/ with diagrams redirects to most recent diagram URL", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)

  await page.getByRole("button", { name: /create your first diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)
  const diagramUrl = page.url()

  await page.goto("/")
  await expect(page).toHaveURL(diagramUrl)
})

test("clicking New Diagram creates a diagram and redirects to editor", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await page.getByRole("button", { name: /create your first diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\/[a-z0-9]+/)
})

test("sidebar is visible on the editor page", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)

  await page.getByRole("button", { name: /create your first diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)
  await expect(page.getByTestId("sidebar-expanded")).toBeVisible()
})

test("unauthenticated user navigating to / is redirected to sign-in", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/sign-in/)
})
