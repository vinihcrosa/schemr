import { test, expect } from "@playwright/test"
import { signUp, uniqueEmail } from "./helpers"

type PWPage = import("@playwright/test").Page

// The popover stays open across operations, so re-clicking "Share" would toggle
// it closed. Only open it when neither action button is already showing.
async function ensurePopoverOpen(page: PWPage) {
  const enable = page.getByRole("button", { name: "Enable public link" })
  const stop = page.getByRole("button", { name: "Stop sharing" })
  if (!(await enable.isVisible()) && !(await stop.isVisible())) {
    await page.getByRole("button", { name: "Share" }).click()
  }
}

async function enableShareAndGetUrl(page: PWPage) {
  await ensurePopoverOpen(page)
  await page.getByRole("button", { name: "Enable public link" }).click()
  // Popover renders the full URL once shared (either a <p> or an <input> fallback).
  const urlLocator = page.getByTestId("share-url")
  await expect(urlLocator).toBeVisible()
  const url = (
    await urlLocator.evaluate(
      (n) => (n as HTMLInputElement).value || n.textContent || ""
    )
  ).trim()
  expect(url).toMatch(/\/share\/.+/)
  return url
}

async function revokeShare(page: PWPage) {
  await ensurePopoverOpen(page)
  await page.getByRole("button", { name: "Stop sharing" }).click()
  await page.getByRole("button", { name: "Confirm" }).click()
  // Wait until it flips back to the private state
  await expect(page.getByRole("button", { name: "Enable public link" })).toBeVisible()
}

test("owner enables a share link, anon views it read-only, revoke kills it", async ({
  page,
  browser,
}) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await page.getByRole("button", { name: /create your first diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)

  // Enable sharing
  const shareUrl = await enableShareAndGetUrl(page)

  // Open the share URL in a fresh, UNAUTHENTICATED context
  const anonContext = await browser.newContext()
  const anonPage = await anonContext.newPage()
  await anonPage.goto(shareUrl)

  // No redirect to sign-in — stays on the share URL
  await expect(anonPage).toHaveURL(/\/share\//)
  // Read-only canvas renders (Excalidraw mounted) + name header present
  await expect(anonPage.getByTestId("share-name")).toBeVisible()
  await expect(anonPage.locator(".excalidraw")).toBeVisible()
  // No sidebar on the public view
  await expect(anonPage.getByTestId("sidebar-expanded")).toHaveCount(0)

  // Owner revokes (confirm gate)
  await revokeShare(page)

  // Old link is now dead
  await anonPage.goto(shareUrl)
  await expect(anonPage.getByText(/no longer available/i)).toBeVisible()

  await anonContext.close()
})

test("re-enabling after revoke mints a new URL; the old one stays dead", async ({
  page,
  browser,
}) => {
  const email = uniqueEmail()
  await signUp(page, email)
  await page.getByRole("button", { name: /create your first diagram/i }).click()
  await expect(page).toHaveURL(/\/diagrams\//)

  const firstUrl = await enableShareAndGetUrl(page)

  // Revoke
  await revokeShare(page)

  // Re-enable → new URL
  const secondUrl = await enableShareAndGetUrl(page)
  expect(secondUrl).not.toBe(firstUrl)

  const anonContext = await browser.newContext()
  const anonPage = await anonContext.newPage()

  // Old URL dead
  await anonPage.goto(firstUrl)
  await expect(anonPage.getByText(/no longer available/i)).toBeVisible()

  // New URL works
  await anonPage.goto(secondUrl)
  await expect(anonPage.getByTestId("share-name")).toBeVisible()

  await anonContext.close()
})

test("unknown share token shows the not-available page without sign-in redirect", async ({
  page,
}) => {
  await page.goto("/share/definitely-not-a-real-token")
  await expect(page).toHaveURL(/\/share\//)
  await expect(page.getByText(/no longer available/i)).toBeVisible()
})
