import { test, expect, request as playwrightRequest } from "@playwright/test"
import { signUp, uniqueEmail } from "./helpers"

const BASE_URL = "http://localhost:3000"
const FLOW = "flowchart TD\n  A[Start] --> B[End]"

test("generate a diagram from a spec and open it in the editor", async ({
  page,
}) => {
  const email = uniqueEmail()
  await signUp(page, email)

  // page.request shares the authenticated browser context (session cookie).
  const res = await page.request.post("/api/diagrams/from-spec", {
    data: { spec: FLOW, format: "mermaid", name: "From spec" },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  expect(body.id).toBeTruthy()
  expect(body.data.elements.length).toBeGreaterThan(0)

  // The generated diagram opens in the editor with no crash.
  await page.goto(`${BASE_URL}/diagrams/${body.id}`)
  await expect(page.locator("canvas").first()).toBeVisible()
})

test("from-spec requires authentication", async () => {
  const anon = await playwrightRequest.newContext({ baseURL: BASE_URL })
  const res = await anon.post("/api/diagrams/from-spec", {
    data: { spec: FLOW, format: "mermaid" },
  })
  expect(res.status()).toBe(401)
})
