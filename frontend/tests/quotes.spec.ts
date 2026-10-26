import { test, expect, type Page } from "@playwright/test";
const headers = {
  "X-Requested-With": "CardRoute",
  Origin: "http://localhost:5173",
};
async function account(page: Page) {
  const email = `quote-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const data = {
    name: "Quote Tester",
    email,
    password: "StrongPass123!",
    confirm_password: "StrongPass123!",
  };
  expect(
    (await page.request.post("/api/auth/register", { headers, data })).status(),
  ).toBe(201);
  expect(
    (await page.request.post("/api/auth/login", { headers, data })).status(),
  ).toBe(200);
  const base = {
    issuer_name: "Nova Bank",
    card_name: "Platinum",
    last_four: "1234",
    due_date: "2027-11-15",
  };
  const source = await (
    await page.request.post("/api/cards", {
      headers,
      data: { ...base, nickname: "Nova Platinum" },
    })
  ).json();
  const destination = await (
    await page.request.post("/api/cards", {
      headers,
      data: {
        ...base,
        nickname: "Zenith Rewards",
        issuer_name: "Zenith Bank",
        last_four: "5678",
        outstanding_balance: "30000",
      },
    })
  ).json();
  return { source, destination };
}
async function analyze(
  page: Page,
  source: string,
  destination: string,
  amount = "10000",
) {
  await page.goto("/route");
  await page.getByLabel("FROM CARD", { exact: true }).selectOption(source);
  await page.getByLabel("TO CARD", { exact: true }).selectOption(destination);
  await page.getByLabel("AMOUNT", { exact: true }).fill(amount);
  await page
    .getByRole("button", { name: "Check Request", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "REQUEST VALID", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Continue to Route Options", exact: true })
    .click();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
}
test.afterEach(async ({ page }) => {
  const response = await page.request.get("/api/cards");
  if (response.status() === 200)
    for (const card of await response.json())
      await page.request.delete("/api/cards/" + card.id, { headers });
});
test("eligible quote fees, previews, persistence and Step 5-only continuation", async ({
  page,
}) => {
  const { source, destination } = await account(page);
  const before = await (await page.request.get("/api/cards")).json();
  const calls: string[] = [];
  page.on("request", (r) => {
    if (
      r.method() === "POST" &&
      (r.url().endsWith("/card-route/validate") ||
        r.url().endsWith("/routes/quote"))
    )
      calls.push(new URL(r.url()).pathname);
  });
  await analyze(page, source.id, destination.id);
  await expect(
    page.getByRole("heading", { name: "ELIGIBLE", exact: true }),
  ).toBeVisible();
  expect(calls).toEqual(["/api/card-route/validate", "/api/routes/quote"]);
  for (const [label, value] of [
    ["Transfer Amount", "₹10,000"],
    ["Estimated Fee", "₹125"],
    ["Tax", "₹0"],
    ["Total Source Impact", "₹10,125"],
    ["Destination Payment", "₹10,000"],
  ])
    await expect(page.getByTestId(label).locator("dd")).toHaveText(value);
  await expect(page.locator(".quote-previews")).toContainText("₹90,000");
  await expect(page.locator(".quote-previews")).toContainText("₹79,875");
  await expect(page.locator(".quote-previews")).toContainText("₹30,000");
  await expect(page.locator(".quote-previews")).toContainText("₹20,000");
  await expect(page.locator(".quote-checklist .passed")).toHaveCount(13);
  await expect(page.getByLabel("Quote countdown")).toHaveText(
    /0[45]:[0-5][0-9]/,
  );
  await noOverflow(page);
  await page.screenshot({
    path: `test-results/quote-eligible-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "ELIGIBLE", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Continue to Payment", exact: true })
    .click();
  await expect(page).toHaveURL("/payment");
  await expect(
    page.getByRole("heading", {
      name: "Payment transaction execution will be implemented in Step 5.",
    }),
  ).toBeVisible();
  expect(await (await page.request.get("/api/cards")).json()).toEqual(before);
});
test("quote countdown expiration disables Continue and refresh creates a new quote", async ({
  page,
}) => {
  await page.clock.install();
  const { source, destination } = await account(page);
  await analyze(page, source.id, destination.id);
  await expect(
    page.getByRole("heading", { name: "ELIGIBLE", exact: true }),
  ).toBeVisible();
  const oldUrl = page.url();
  await page.clock.fastForward("05:01");
  await expect(
    page.getByRole("heading", { name: "QUOTE EXPIRED", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Quote countdown")).toHaveText("00:00");
  await expect(
    page.getByRole("button", { name: "Continue to Payment" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Refresh Quote", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "ELIGIBLE", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue to Payment" }),
  ).toBeEnabled();
  expect(page.url()).not.toBe(oldUrl);
  await noOverflow(page);
});
test("fee-inclusive failure, route limit failure, and unsupported simulation flags", async ({
  page,
}) => {
  const { source, destination } = await account(page);
  await page.request.patch("/api/cards/" + source.id, {
    headers,
    data: { outstanding_balance: "89950" },
  });
  await analyze(page, source.id, destination.id);
  await expect(
    page.getByRole("heading", { name: "NOT ELIGIBLE", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "INSUFFICIENT CREDIT AFTER FEES" }),
  ).toBeVisible();
  await expect(
    page.getByTestId("Total Source Impact").locator("dd"),
  ).toHaveText("₹10,125");
  await expect(page.locator(".current-availability")).toContainText("₹10,050");
  await expect(
    page.getByRole("button", { name: "Continue to Payment" }),
  ).toHaveCount(0);
  await noOverflow(page);
  await page.request.patch("/api/cards/" + source.id, {
    headers,
    data: { outstanding_balance: "10000" },
  });
  await analyze(page, source.id, destination.id, "30000");
  await expect(
    page.getByRole("heading", { name: "ROUTE LIMIT EXCEEDED" }),
  ).toBeVisible();
  await expect(page.locator(".quote-failures")).toContainText("₹25,000");
  await expect(page.getByTestId("Transfer Amount").locator("dd")).toHaveText(
    "₹30,000",
  );
  await page.request.patch("/api/cards/" + source.id, {
    headers,
    data: { card_to_card_source_enabled: false },
  });
  await analyze(page, source.id, destination.id);
  await expect(page.locator(".quote-failures")).toContainText(
    "not currently enabled as a source",
  );
  await noOverflow(page);
});
test("backend rechecks stale quote before Continue", async ({ page }) => {
  const { source, destination } = await account(page);
  await analyze(page, source.id, destination.id);
  await expect(
    page.getByRole("heading", { name: "ELIGIBLE", exact: true }),
  ).toBeVisible();
  await page.request.patch("/api/cards/" + source.id, {
    headers,
    data: { outstanding_balance: "11000" },
  });
  await page.getByRole("button", { name: "Continue to Payment" }).click();
  await expect(
    page.getByRole("heading", { name: "QUOTE INVALIDATED", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue to Payment" }),
  ).toBeDisabled();
  await expect(page.locator(".quote-failures")).toContainText(
    "Card details changed",
  );
  await page.getByRole("button", { name: "Refresh Quote" }).click();
  await expect(
    page.getByRole("heading", { name: "ELIGIBLE", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
});
