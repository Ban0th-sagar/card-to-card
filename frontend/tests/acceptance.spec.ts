import { test, expect } from "@playwright/test";
test("Step 1 complete account journey", async ({ page }) => {
  const email = `journey-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Manage your credit cards from one intelligent platform.",
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Get Started" }).last().click();
  await page.getByLabel("Full Name", { exact: true }).fill("Avery Shah");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("StrongPass123!");
  await page
    .getByLabel("Confirm Password", { exact: true })
    .fill("StrongPass123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Account created. Sign in to get started.",
  );
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("StrongPass123!");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL("/dashboard");
  await expect(
    page.getByRole("heading", { name: "No cards added yet." }),
  ).toBeVisible();
  await expect(page.getByText("₹0", { exact: true })).toHaveCount(3);
  await page.getByRole("link", { name: "Add Your First Card" }).click();
  await expect(page.getByRole("heading", { name: "Add Card." })).toBeVisible();
  await page.goto("/profile");
  await page.getByRole("button", { name: "Edit Profile" }).click();
  await page.getByLabel("Full Name").fill("Avery Updated");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Your name has been updated.",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Avery Updated" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL("/login");
  for (const path of [
    "/dashboard",
    "/cards",
    "/route",
    "/activity",
    "/profile",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL("/login");
  }
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("StrongPass123!");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Avery Updated." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: `test-results/dashboard-${test.info().project.name}.png`,
    fullPage: true,
  });
  const health = await page.request.get("/api/health");
  expect((await health.json()).database).toBe("connected");
});
test("form validation and forgot password", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Full Name", { exact: true }).fill("Avery");
  await page.getByLabel("Email", { exact: true }).fill("avery@example.com");
  await page.getByLabel("Password", { exact: true }).fill("StrongPass123!");
  await page.getByLabel("Confirm Password", { exact: true }).fill("different");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByRole("alert")).toHaveText("Passwords must match.");
  await page.goto("/login");
  await page.getByRole("button", { name: "Forgot Password" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Password recovery will be available soon.",
  );
});
