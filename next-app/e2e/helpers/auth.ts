import { type Page } from "@playwright/test"

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL("**/dashboard**")
}

export const SEED_ADMIN = {
  email: "admin@example.com",
  password: "Admin123!",
}

export const SEED_EDITOR = {
  email: "editor@example.com",
  password: "Editor123!",
}

export const SEED_VIEWER = {
  email: "viewer@example.com",
  password: "Viewer123!",
}
