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

async function openTagManager(page: Parameters<typeof test>[1]["page"]) {
  await page.getByLabel("Manage tags").click()
}

async function createTagInManager(page: Parameters<typeof test>[1]["page"], name: string) {
  const input = page.getByRole("textbox", { name: /tag name/i })
  await input.fill(name)
  await page.getByRole("button", { name: /^add tag$|^create tag$/i }).click()
}

// ─── 1. Create tag "infra" appears in manager ─────────────────────────────────

test("create tag 'infra' appears in tag manager list", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await createDiagram(page)

  await openTagManager(page)
  await createTagInManager(page, "infra")

  await expect(page.getByText("infra")).toBeVisible()
})

// ─── 2. Duplicate shows "Tag already exists" ──────────────────────────────────

test("creating duplicate tag shows 'Tag already exists' error", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await createDiagram(page)

  await openTagManager(page)
  await createTagInManager(page, "infra")
  await expect(page.getByText("infra")).toBeVisible()

  // Try to create the same tag again
  await createTagInManager(page, "infra")

  await expect(page.getByText(/tag already exists/i)).toBeVisible()
})

// ─── 3. Assign tag shows chip on diagram ─────────────────────────────────────

test("assigning tag to diagram shows chip on sidebar item", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await createDiagram(page)

  // Create the tag first
  await openTagManager(page)
  await createTagInManager(page, "infra")
  // Close the manager
  await page.getByRole("button", { name: /close|dismiss/i }).click()

  // Open the tag picker on the current diagram sidebar item
  const currentItem = page.locator('[aria-current="page"]').locator("..")
  await currentItem.hover()
  await page.getByRole("button", { name: /add tag/i }).click()

  // Select "infra" from the picker
  await page.getByRole("option", { name: "infra" }).click()

  // Chip should appear on the sidebar item
  await expect(currentItem.getByText("infra")).toBeVisible()
})

// ─── 4. Remove chip disappears ────────────────────────────────────────────────

test("removing tag chip from diagram causes chip to disappear", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await createDiagram(page)

  // Create tag and assign it
  await openTagManager(page)
  await createTagInManager(page, "infra")
  await page.getByRole("button", { name: /close|dismiss/i }).click()

  const currentItem = page.locator('[aria-current="page"]').locator("..")
  await currentItem.hover()
  await page.getByRole("button", { name: /add tag/i }).click()
  await page.getByRole("option", { name: "infra" }).click()
  await expect(currentItem.getByText("infra")).toBeVisible()

  // Remove the chip by clicking the × on the tag chip
  await currentItem.getByRole("button", { name: /remove infra|×/i }).click()

  await expect(currentItem.getByText("infra")).not.toBeVisible()
})

// ─── 5. Delete tag from manager ───────────────────────────────────────────────

test("deleting tag from tag manager removes it from the list", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await createDiagram(page)

  await openTagManager(page)
  await createTagInManager(page, "infra")
  await expect(page.getByText("infra")).toBeVisible()

  // Click delete on the "infra" tag (first confirm step)
  await page.getByRole("button", { name: /delete infra/i }).click()
  // Confirm deletion
  await page.getByRole("button", { name: /confirm/i }).click()

  await expect(page.getByText("infra")).not.toBeVisible()
})

// ─── 6. Tag filter shows only tagged diagrams ─────────────────────────────────

test("selecting tag filter shows only diagrams tagged with that tag", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)

  // Create 3 diagrams
  await createDiagram(page)
  await page.getByRole("button", { name: /new diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)
  await page.getByRole("button", { name: /new diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)

  // Create the "infra" tag
  await openTagManager(page)
  await createTagInManager(page, "infra")
  await page.getByRole("button", { name: /close|dismiss/i }).click()

  // Assign "infra" only to the current (most recent) diagram
  const currentItem = page.locator('[aria-current="page"]').locator("..")
  await currentItem.hover()
  await page.getByRole("button", { name: /add tag/i }).click()
  await page.getByRole("option", { name: "infra" }).click()

  // Click the "infra" tag filter pill
  await page.getByRole("button", { name: /^infra$/i }).first().click()

  // Only 1 diagram should appear in the sidebar list
  const items = page.locator('[data-testid="sidebar-expanded"] [role="button"]')
  await expect(items).toHaveCount(1, { timeout: 5000 })
})

// ─── 7. Deselect filter restores list ─────────────────────────────────────────

test("deselecting tag filter restores the full diagram list", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)

  // Create 2 diagrams
  await createDiagram(page)
  await page.getByRole("button", { name: /new diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)

  // Create the "infra" tag and assign it to the current diagram
  await openTagManager(page)
  await createTagInManager(page, "infra")
  await page.getByRole("button", { name: /close|dismiss/i }).click()

  const currentItem = page.locator('[aria-current="page"]').locator("..")
  await currentItem.hover()
  await page.getByRole("button", { name: /add tag/i }).click()
  await page.getByRole("option", { name: "infra" }).click()

  // Activate the filter — sidebar should show 1 diagram
  await page.getByRole("button", { name: /^infra$/i }).first().click()
  await expect(
    page.locator('[data-testid="sidebar-expanded"] [role="button"]')
  ).toHaveCount(1, { timeout: 5000 })

  // Deselect by clicking the active filter pill again
  await page.getByRole("button", { name: /^infra$/i }).first().click()

  // Both diagrams should be visible again
  await expect(
    page.locator('[data-testid="sidebar-expanded"] [role="button"]')
  ).toHaveCount(2, { timeout: 5000 })
})

// ─── 8. Search + tag filter compose ──────────────────────────────────────────

test("search query and tag filter compose to show intersection only", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)

  // Create diagram "alpha-infra"
  await createDiagram(page)
  const alphaItem = page.locator('[aria-current="page"]').locator("..")
  await alphaItem.hover()
  await page.getByRole("button", { name: /rename untitled/i }).click()
  const renameInput = page.getByRole("textbox", { name: /rename diagram/i })
  await renameInput.fill("alpha-infra")
  await renameInput.press("Enter")

  // Create diagram "beta-infra"
  await page.getByRole("button", { name: /new diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)
  const betaItem = page.locator('[aria-current="page"]').locator("..")
  await betaItem.hover()
  await page.getByRole("button", { name: /rename untitled/i }).click()
  const renameInput2 = page.getByRole("textbox", { name: /rename diagram/i })
  await renameInput2.fill("beta-infra")
  await renameInput2.press("Enter")

  // Create diagram "gamma-other"
  await page.getByRole("button", { name: /new diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)
  const gammaItem = page.locator('[aria-current="page"]').locator("..")
  await gammaItem.hover()
  await page.getByRole("button", { name: /rename untitled/i }).click()
  const renameInput3 = page.getByRole("textbox", { name: /rename diagram/i })
  await renameInput3.fill("gamma-other")
  await renameInput3.press("Enter")

  // Create "infra" tag
  await openTagManager(page)
  await createTagInManager(page, "infra")
  await page.getByRole("button", { name: /close|dismiss/i }).click()

  // Assign "infra" to alpha-infra and beta-infra (not gamma-other)
  // Navigate to alpha-infra
  await page.getByText("alpha-infra").click()
  const alphaCurrentItem = page.locator('[aria-current="page"]').locator("..")
  await alphaCurrentItem.hover()
  await page.getByRole("button", { name: /add tag/i }).click()
  await page.getByRole("option", { name: "infra" }).click()

  // Navigate to beta-infra
  await page.getByText("beta-infra").click()
  const betaCurrentItem = page.locator('[aria-current="page"]').locator("..")
  await betaCurrentItem.hover()
  await page.getByRole("button", { name: /add tag/i }).click()
  await page.getByRole("option", { name: "infra" }).click()

  // Activate "infra" tag filter — should show alpha-infra and beta-infra (2)
  await page.getByRole("button", { name: /^infra$/i }).first().click()
  await expect(
    page.locator('[data-testid="sidebar-expanded"] [role="button"]')
  ).toHaveCount(2, { timeout: 5000 })

  // Now also type "alpha" in the search input — should narrow to 1
  const searchInput = page.getByRole("searchbox").or(page.getByPlaceholder(/search diagrams/i))
  await searchInput.fill("alpha")

  await expect(
    page.locator('[data-testid="sidebar-expanded"] [role="button"]')
  ).toHaveCount(1, { timeout: 5000 })
  await expect(page.getByText("alpha-infra")).toBeVisible()
  await expect(page.getByText("beta-infra")).not.toBeVisible()
})
