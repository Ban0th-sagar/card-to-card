import { test, expect, type Page } from "@playwright/test";
async function account(page: Page) {
  const email = `cards-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const headers = {
    "X-Requested-With": "CardRoute",
    Origin: "http://localhost:5173",
  };
  const registration = await page.request.post("/api/auth/register", {
    headers,
    data: {
      name: "Card Tester",
      email,
      password: "StrongPass123!",
      confirm_password: "StrongPass123!",
    },
  });
  expect(registration.status()).toBe(201);
  expect(
    (
      await page.request.post("/api/auth/login", {
        headers,
        data: { email, password: "StrongPass123!" },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/cards");
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
}
test("card management and live dashboard totals", async ({ page }) => {
  await account(page);
  await expect(
    page.getByRole("heading", { name: "Your Cards." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No cards added yet." }),
  ).toBeVisible();
  await noOverflow(page);
  await page.getByRole("link", { name: "Add Card", exact: true }).click();
  await expect(page.getByLabel("Credit Limit", { exact: true })).toHaveValue(
    "100000",
  );
  await expect(
    page.getByLabel("Outstanding Balance", { exact: true }),
  ).toHaveValue("10000");
  await expect(page.getByLabel("Minimum Due", { exact: true })).toHaveValue(
    "2000",
  );
  await expect(page.getByText("₹90,000", { exact: true })).toBeVisible();
  await expect(page.getByText("10%", { exact: true })).toBeVisible();
  await page.getByLabel("Card Nickname").fill("Primary Card");
  await page.getByLabel("Issuer Name").fill("Demo Bank");
  await page.getByLabel("Card Name", { exact: true }).fill("Platinum");
  await page.getByLabel("Last 4 Digits").fill("1234");
  await page
    .getByLabel("Due Date", { exact: true })
    .fill(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  await page.getByLabel("Outstanding Balance").fill("100001");
  await page.getByRole("button", { name: "Save Card", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Outstanding balance cannot exceed credit limit.",
  );
  await page.getByLabel("Outstanding Balance").fill("10000");
  await noOverflow(page);
  await page.getByRole("button", { name: "Save Card", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Card added successfully.");
  await expect(page.getByText("₹90,000", { exact: true })).toBeVisible();
  await expect(page.getByText("10%", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("•••• 1234", { exact: true })).toBeVisible();
  await noOverflow(page);
  await page.getByRole("link", { name: "Back to Cards" }).click();
  await expect(
    page.getByRole("heading", { name: "Primary Card", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View Details" }).click();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByTestId("Total Cards").locator("strong")).toHaveText(
    "1",
  );
  await expect(
    page.getByTestId("Total Credit Limit").locator("strong"),
  ).toHaveText("₹1,00,000");
  await expect(
    page.getByTestId("Total Outstanding").locator("strong"),
  ).toHaveText("₹10,000");
  await expect(
    page.getByTestId("Total Available Credit").locator("strong"),
  ).toHaveText("₹90,000");
  await expect(
    page.locator(".portfolio-panel").getByRole("meter"),
  ).toHaveAttribute("aria-valuenow", "10");
  await expect(page.locator(".upcoming-panel")).toContainText("Primary Card");
  await noOverflow(page);
  await page.getByRole("link", { name: "View Details" }).click();
  await page.getByRole("link", { name: "Edit Card" }).click();
  await expect(page.getByLabel("Outstanding Balance")).toHaveValue("10000.00");
  await page.getByLabel("Outstanding Balance").fill("15000");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Card updated successfully.",
  );
  await expect(page.getByText("₹85,000", { exact: true })).toBeVisible();
  await expect(page.getByText("15%", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("₹15,000", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(
    page.getByTestId("Total Outstanding").locator("strong"),
  ).toHaveText("₹15,000");
  await expect(
    page.getByTestId("Total Available Credit").locator("strong"),
  ).toHaveText("₹85,000");
  await page.screenshot({
    path: `test-results/cards-dashboard-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "View Details" }).click();
  await page.getByRole("button", { name: "Remove Card", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading")).toHaveText("Remove this card?");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Primary Card." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove Card", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Remove Card", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Card removed." }),
  ).toHaveText("Card removed.");
  await expect(
    page.getByRole("heading", { name: "No cards added yet." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByTestId("Total Cards").locator("strong")).toHaveText(
    "0",
  );
  await expect(
    page.getByTestId("Total Available Credit").locator("strong"),
  ).toHaveText("₹0");
  await expect(page.getByText("No upcoming payments.")).toBeVisible();
});
test("card input constraints and API errors", async ({ page }) => {
  await account(page);
  await page.goto("/cards/new");
  await page.getByLabel("Last 4 Digits").fill("123");
  expect(
    await page
      .getByLabel("Last 4 Digits")
      .evaluate((e: HTMLInputElement) => e.validity.valid),
  ).toBe(false);
  await page.getByLabel("Card Nickname").fill("Precision Test");
  await page.getByLabel("Issuer Name").fill("Nova Bank");
  await page.getByLabel("Card Name", { exact: true }).fill("Platinum");
  await page.getByLabel("Last 4 Digits").fill("0001");
  await page
    .getByLabel("Due Date", { exact: true })
    .fill(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  await page.getByLabel("Minimum Due").fill("10001");
  await page.getByRole("button", { name: "Save Card" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Minimum due cannot exceed outstanding balance.",
  );
  await page.getByLabel("Minimum Due").fill("2000");
  let release: () => void = () => {};
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/cards", async (route) => {
    if (route.request().method() === "POST") {
      await hold;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "Service unavailable. Please try again.",
        }),
      });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Save Card" }).click();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
  release();
  await expect(page.getByRole("alert")).toHaveText(
    "Service unavailable. Please try again.",
  );
  await expect(page.getByRole("button", { name: "Save Card" })).toBeEnabled();
  await noOverflow(page);
});
