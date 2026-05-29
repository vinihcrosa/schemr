import { expect, type Page } from "@playwright/test"

export const PASSWORD = "password123"

export function uniqueEmail() {
  return `test+${Date.now()}+${Math.random().toString(36).slice(2)}@example.com`
}

export async function signUp(page: Page, email: string) {
  await page.goto("/sign-up")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page).toHaveURL("/")
}

export async function createDiagram(page: Page) {
  const btn = page.getByRole("button", { name: /create your first diagram|new diagram/i })
  await btn.click()
  await expect(page).toHaveURL(/\/diagrams\//)
}

export async function openTagManager(page: Page) {
  await page.getByLabel("Manage tags").click()
}
