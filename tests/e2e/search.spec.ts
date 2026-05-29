// E2E tests require: npm run build and npm start. Run: npm run test:e2e

import { test, expect } from "@playwright/test"

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

async function createDiagram(page: Parameters<typeof test>[1]["page"]) {
  const btn = page.getByRole("button", { name: /create your first diagram|new diagram/i })
  await btn.click()
  await expect(page).toHaveURL(/\/diagrams\//)
}

// ─── Search input visibility ──────────────────────────────────────────────────

test("search input visible in expanded sidebar", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await createDiagram(page)

  await expect(page.getByTestId("sidebar-expanded")).toBeVisible()
  await expect(page.getByLabel("Search diagrams")).toBeVisible()
})

// ─── Filter by partial name ───────────────────────────────────────────────────

test("typing partial name filters diagrams", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)

  // create first diagram and rename it
  await createDiagram(page)
  const firstItem = page.locator('[aria-current="page"]').locator("..")
  await firstItem.hover()
  await page.getByRole("button", { name: /rename untitled/i }).click()
  const firstInput = page.getByRole("textbox", { name: /rename diagram/i })
  await firstInput.fill("Alpha Diagram")
  await firstInput.press("Enter")
  await expect(page.getByText("Alpha Diagram")).toBeVisible()

  // create second diagram and rename it
  await page.getByRole("button", { name: /new diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)
  const secondItem = page.locator('[aria-current="page"]').locator("..")
  await secondItem.hover()
  await page.getByRole("button", { name: /rename untitled/i }).click()
  const secondInput = page.getByRole("textbox", { name: /rename diagram/i })
  await secondInput.fill("Beta Diagram")
  await secondInput.press("Enter")
  await expect(page.getByText("Beta Diagram")).toBeVisible()

  // search for "Alpha" — only Alpha should appear
  await page.getByLabel("Search diagrams").fill("Alpha")
  await expect(page.getByText("Alpha Diagram")).toBeVisible()
  await expect(page.getByText("Beta Diagram")).not.toBeVisible()
})

// ─── No match message ─────────────────────────────────────────────────────────

test("no match shows \"No diagrams match\"", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await createDiagram(page)

  await page.getByLabel("Search diagrams").fill("zzz-no-match-xyz")
  await expect(page.getByText(/no diagrams match/i)).toBeVisible()
})

// ─── Clear search restores list ───────────────────────────────────────────────

test("clearing search restores full list", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)

  // create two diagrams
  await createDiagram(page)
  await page.getByRole("button", { name: /new diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)

  const sidebarItems = page.locator('[data-testid="sidebar-expanded"] [role="button"]')
  const countBefore = await sidebarItems.count()
  expect(countBefore).toBeGreaterThanOrEqual(2)

  // filter to produce fewer results
  const searchInput = page.getByLabel("Search diagrams")
  await searchInput.fill("zzz-no-match-xyz")
  await expect(page.getByText(/no diagrams match/i)).toBeVisible()

  // clear the search
  await searchInput.clear()

  // full list restored
  await expect(sidebarItems).toHaveCount(countBefore, { timeout: 5000 })
})

// ─── Search hidden when sidebar collapsed ─────────────────────────────────────

test("search hidden when sidebar collapsed", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await createDiagram(page)

  // collapse the sidebar
  await page.getByRole("button", { name: /collapse sidebar/i }).click()
  await expect(page.getByTestId("sidebar-collapsed")).toBeVisible()

  // search input must not be visible in collapsed state
  await expect(page.getByLabel("Search diagrams")).not.toBeVisible()
})
