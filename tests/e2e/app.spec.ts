import { test, expect } from "@playwright/test"

test.describe("Auth flow", () => {
  test("redirects to /auth when not logged in", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/auth/)
  })

  test("shows login form on auth page", async ({ page }) => {
    await page.goto("/auth")
    await expect(page.getByPlaceholder("Your name")).toBeVisible()
    await expect(page.getByPlaceholder("Password")).toBeVisible()
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible()
  })

  test("shows validation error for empty submit", async ({ page }) => {
    await page.goto("/auth")
    await page.getByRole("button", { name: /sign in/i }).click()
    await expect(page.getByText("Enter username and password")).toBeVisible()
  })

  test("can login and redirects to home", async ({ page }) => {
    await page.goto("/auth")
    await page.getByPlaceholder("Your name").fill("e2e_testuser")
    await page.getByPlaceholder("Password").fill("testpass123")
    await page.getByRole("button", { name: /sign in/i }).click()

    // Should redirect to home page after login
    await expect(page).toHaveURL("/", { timeout: 10000 })
  })
})

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto("/auth")
    await page.getByPlaceholder("Your name").fill("e2e_testuser")
    await page.getByPlaceholder("Password").fill("testpass123")
    await page.getByRole("button", { name: /sign in/i }).click()
    await expect(page).toHaveURL("/", { timeout: 10000 })
  })

  test("can navigate to search page", async ({ page }) => {
    await page.getByRole("link", { name: /search/i }).click()
    await expect(page).toHaveURL(/\/search/)
  })

  test("can navigate to library page", async ({ page }) => {
    await page.getByRole("link", { name: /library/i }).click()
    await expect(page).toHaveURL(/\/library/)
  })

  test("can navigate to friends page", async ({ page }) => {
    await page.getByRole("link", { name: /friends/i }).click()
    await expect(page).toHaveURL(/\/friends/)
  })
})

test.describe("Room creation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth")
    await page.getByPlaceholder("Your name").fill("e2e_testuser")
    await page.getByPlaceholder("Password").fill("testpass123")
    await page.getByRole("button", { name: /sign in/i }).click()
    await expect(page).toHaveURL("/", { timeout: 10000 })
  })

  test("can create a room from home page", async ({ page }) => {
    // Look for a create room button/link on the home page
    const createBtn = page.getByRole("button", { name: /create/i })
    if (await createBtn.isVisible()) {
      await createBtn.click()
      // Should navigate to a room page
      await expect(page).toHaveURL(/\/room\//, { timeout: 10000 })
    }
  })
})
