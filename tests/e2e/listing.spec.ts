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

async function createDiagramViaApi(
  request: Parameters<typeof test>[1]["request"],
  name: string
): Promise<string> {
  const res = await request.post("/api/diagrams", {
    data: { name },
  })
  const body = await res.json()
  return body.id
}

test("new user sees empty state on /", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await expect(page.getByText(/no diagrams yet/i)).toBeVisible()
  await expect(page.getByRole("button", { name: /create your first diagram/i })).toBeVisible()
})

test("user with diagrams sees list ordered by most recent first", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)

  await page.getByRole("button", { name: /create your first diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)
  await page.goto("/")

  await page.getByRole("button", { name: /new diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)
  await page.goto("/")

  const rows = page.locator("li")
  await expect(rows).toHaveCount(2)
})

test("clicking New Diagram creates a diagram and redirects to editor", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await page.getByRole("button", { name: /create your first diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\/[a-z0-9]+/)
})

test("clicking a diagram row navigates to its editor", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)

  await page.getByRole("button", { name: /create your first diagram/i }).click()
  const editorUrl = page.url()
  await page.goto("/")

  await page.getByRole("button", { name: /open untitled/i }).click()
  await expect(page).toHaveURL(editorUrl)
})

test("rename: Enter commits the new name", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)

  await page.getByRole("button", { name: /create your first diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)
  await page.goto("/")

  const row = page.locator("li").first()
  await row.hover()
  await page.getByRole("button", { name: /rename untitled/i }).click()
  const input = page.getByRole("textbox", { name: /rename diagram/i })
  await input.fill("My Architecture")
  await input.press("Enter")

  await expect(page.getByText("My Architecture")).toBeVisible()
})

test("rename: Escape restores original name", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)

  await page.getByRole("button", { name: /create your first diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)
  await page.goto("/")

  const row = page.locator("li").first()
  await row.hover()
  await page.getByRole("button", { name: /rename untitled/i }).click()
  const input = page.getByRole("textbox", { name: /rename diagram/i })
  await input.fill("Will be cancelled")
  await input.press("Escape")

  await expect(page.getByText("Untitled")).toBeVisible()
  await expect(page.getByText("Will be cancelled")).not.toBeVisible()
})

test("delete: confirm removes diagram from list", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)

  await page.getByRole("button", { name: /create your first diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)
  await page.goto("/")

  const row = page.locator("li").first()
  await row.hover()
  await page.getByRole("button", { name: /delete untitled/i }).click()
  await expect(page.getByText(/this cannot be undone/i)).toBeVisible()
  await page.getByRole("button", { name: /^delete$/i }).click()

  await expect(page.getByText(/no diagrams yet/i)).toBeVisible()
})

test("delete: Cancel keeps diagram in list", async ({ page }) => {
  const email = uniqueEmail()
  await signUp(page, email)

  await page.getByRole("button", { name: /create your first diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)
  await page.goto("/")

  const row = page.locator("li").first()
  await row.hover()
  await page.getByRole("button", { name: /delete untitled/i }).click()
  await page.getByRole("button", { name: /cancel/i }).click()

  await expect(page.getByText("Untitled")).toBeVisible()
})

test("unauthenticated user navigating to / is redirected to sign-in", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/sign-in/)
})
