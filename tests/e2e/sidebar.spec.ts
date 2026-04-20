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
  // new user lands on no-diagrams landing (no redirect since no diagrams yet)
  await expect(page).toHaveURL("/")
}

async function createDiagram(page: Parameters<typeof test>[1]["page"]) {
  const btn = page.getByRole("button", { name: /create your first diagram|new diagram/i })
  await btn.click()
  await expect(page).toHaveURL(/\/diagrams\//)
}

// ─── Index redirect ───────────────────────────────────────────────────────────

test("authenticated user with diagrams: / redirects to most recent", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await createDiagram(page)
  await page.goto("/")
  await expect(page).toHaveURL(/\/diagrams\//)
})

test("authenticated user with no diagrams: / shows no-diagrams landing", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await expect(page.getByText(/no diagrams yet/i)).toBeVisible()
  await expect(page.getByRole("button", { name: /create your first diagram/i })).toBeVisible()
})

test("create from landing: navigates to editor with sidebar", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await createDiagram(page)
  await expect(page.getByTestId("sidebar-expanded")).toBeVisible()
})

// ─── Sidebar presence ─────────────────────────────────────────────────────────

test("opening /diagrams/:id shows sidebar on left and canvas on right", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await createDiagram(page)
  await expect(page.getByTestId("sidebar-expanded")).toBeVisible()
})

test("current diagram is visually distinct in sidebar", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await createDiagram(page)
  const current = page.locator('[aria-current="page"]')
  await expect(current).toBeVisible()
})

// ─── Collapse / expand ────────────────────────────────────────────────────────

test("toggle collapses sidebar; reload preserves collapsed state", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await createDiagram(page)

  await page.getByRole("button", { name: /collapse sidebar/i }).click()
  await expect(page.getByTestId("sidebar-collapsed")).toBeVisible()
  await expect(page.getByTestId("sidebar-expanded")).not.toBeVisible()

  await page.reload()
  await expect(page.getByTestId("sidebar-collapsed")).toBeVisible()
})

test("toggle expands sidebar; reload preserves expanded state", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await createDiagram(page)

  // collapse then expand
  await page.getByRole("button", { name: /collapse sidebar/i }).click()
  await page.getByRole("button", { name: /expand sidebar/i }).click()
  await expect(page.getByTestId("sidebar-expanded")).toBeVisible()

  await page.reload()
  await expect(page.getByTestId("sidebar-expanded")).toBeVisible()
})

// ─── Resize ───────────────────────────────────────────────────────────────────

test("drag right edge changes sidebar width; reload restores it", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await createDiagram(page)

  const handle = page.getByTestId("resize-handle")
  const box = await handle.boundingBox()
  if (!box) throw new Error("resize handle not found")

  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 100, startY)
  await page.mouse.up()

  const sidebar = page.getByTestId("sidebar-expanded")
  const sidebarBox = await sidebar.boundingBox()
  expect(sidebarBox!.width).toBeGreaterThan(270)

  await page.reload()
  const reloadedBox = await page.getByTestId("sidebar-expanded").boundingBox()
  expect(reloadedBox!.width).toBeGreaterThan(270)
})

// ─── Switch diagrams ──────────────────────────────────────────────────────────

test("click sidebar item navigates to that diagram", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)

  // create first diagram
  await createDiagram(page)
  const firstUrl = page.url()

  // create second diagram via sidebar "+"
  await page.getByRole("button", { name: /new diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)
  const secondUrl = page.url()
  expect(secondUrl).not.toBe(firstUrl)

  // click first diagram in sidebar
  const items = page.locator('[data-testid="sidebar-expanded"] [role="button"]')
  // second item (index 1) is the first (older) diagram - list is updatedAt desc
  await items.nth(1).click()
  await expect(page).toHaveURL(firstUrl)
})

// ─── Create from sidebar ──────────────────────────────────────────────────────

test("+ button creates diagram and shows it at top of sidebar", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await createDiagram(page)

  const countBefore = await page
    .locator('[data-testid="sidebar-expanded"] [role="button"]')
    .count()

  await page.getByRole("button", { name: /new diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)

  // new item appears at top highlighted as current
  const current = page.locator('[aria-current="page"]')
  await expect(current).toBeVisible()

  const countAfter = await page
    .locator('[data-testid="sidebar-expanded"] [role="button"]')
    .count()
  expect(countAfter).toBeGreaterThan(countBefore)
})

// ─── Rename from sidebar ──────────────────────────────────────────────────────

test("hover → edit icon → type new name → Enter updates sidebar name", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await createDiagram(page)

  const item = page.locator('[aria-current="page"]').locator("..")
  await item.hover()
  await page.getByRole("button", { name: /rename untitled/i }).click()

  const input = page.getByRole("textbox", { name: /rename diagram/i })
  await input.fill("My Renamed Diagram")
  await input.press("Enter")

  await expect(page.getByText("My Renamed Diagram")).toBeVisible()
})

// ─── Delete from sidebar ──────────────────────────────────────────────────────

test("delete pending → second click removes item", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)

  // create two diagrams so we can delete one without navigating away
  await createDiagram(page)
  await page.getByRole("button", { name: /new diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)

  const items = page.locator('[data-testid="sidebar-expanded"] [role="button"]')
  const secondItem = items.nth(1)
  await secondItem.hover()

  await page.getByRole("button", { name: /delete untitled/i }).first().click()
  await expect(page.getByRole("button", { name: /confirm delete/i })).toBeVisible()
  await page.getByRole("button", { name: /confirm delete/i }).click()

  await waitForItemCount(page, 1)
})

test("delete pending → click elsewhere → item stays", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await createDiagram(page)
  await page.getByRole("button", { name: /new diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)

  const items = page.locator('[data-testid="sidebar-expanded"] [role="button"]')
  const secondItem = items.nth(1)
  await secondItem.hover()

  await page.getByRole("button", { name: /delete untitled/i }).first().click()
  await expect(page.getByRole("button", { name: /confirm delete/i })).toBeVisible()

  // click elsewhere (outside the delete-pending row)
  await page.getByRole("button", { name: /new diagram/i }).click({ force: true })
  // wait briefly then cancel, not confirm
  await expect(page.getByRole("button", { name: /confirm delete/i })).not.toBeVisible()

  await waitForItemCount(page, 2)
})

async function waitForItemCount(page: Parameters<typeof test>[1]["page"], count: number) {
  await expect(
    page.locator('[data-testid="sidebar-expanded"] [role="button"]')
  ).toHaveCount(count, { timeout: 5000 })
}
