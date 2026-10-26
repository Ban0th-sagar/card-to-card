import { test, expect, type Page } from "@playwright/test";
const headers = {
  "X-Requested-With": "CardRoute",
  Origin: "http://localhost:5173",
};
async function account(page: Page) {
  const email = `route-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const user = {
    name: "Route Tester",
    email,
    password: "StrongPass123!",
    confirm_password: "StrongPass123!",
  };
  expect(
    (
      await page.request.post("/api/auth/register", { headers, data: user })
    ).status(),
  ).toBe(201);
  expect(
    (
      await page.request.post("/api/auth/login", { headers, data: user })
    ).status(),
  ).toBe(200);
}
async function card(
  page: Page,
  nickname: string,
  outstanding = "10000",
  status = "ACTIVE",
) {
  const response = await page.request.post("/api/cards", {
    headers,
    data: {
      nickname,
      issuer_name: nickname.split(" ")[0] + " Bank",
      card_name: nickname.split(" ")[1] || "Platinum",
      last_four: nickname.startsWith("Nova") ? "1234" : "5678",
      outstanding_balance: outstanding,
      status,
      due_date: "2027-11-15",
    },
  });
  expect(response.status()).toBe(201);
  return response.json();
}
async function selectPair(page: Page, source: string, destination: string) {
  await page.getByLabel("FROM CARD", { exact: true }).selectOption(source);
  await page.getByLabel("TO CARD", { exact: true }).selectOption(destination);
}
async function check(page: Page) {
  await page
    .getByRole("button", { name: "Check Request", exact: true })
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
    for (const c of await response.json())
      await page.request.delete("/api/cards/" + c.id, { headers });
});
test("selectors, quick amounts, validation, stale field changes and swap", async ({
  page,
}) => {
  await account(page);
  const nova = await card(page, "Nova Platinum");
  const zenith = await card(page, "Zenith Rewards", "30000");
  const low = await card(page, "Orbit Prime", "92000");
  const inactive = await card(page, "Vertex Classic", "10000", "INACTIVE");
  const blocked = await card(page, "Other Classic", "10000", "BLOCKED");
  const before = (await page.request.get("/api/cards")).json();
  await page.goto("/route");
  await expect(
    page.getByRole("heading", { name: "Pay Another Card." }),
  ).toBeVisible();
  const from = page.getByLabel("FROM CARD", { exact: true }),
    to = page.getByLabel("TO CARD", { exact: true }),
    amount = page.getByLabel("AMOUNT", { exact: true });
  for (const id of [inactive.id, blocked.id]) {
    await expect(from.locator(`option[value="${id}"]`)).toBeDisabled();
    await expect(to.locator(`option[value="${id}"]`)).toBeDisabled();
  }
  await from.selectOption(nova.id);
  await expect(to.locator(`option[value="${nova.id}"]`)).toBeDisabled();
  await to.selectOption(zenith.id);
  await expect(from.locator(`option[value="${zenith.id}"]`)).toBeDisabled();
  await expect(page.locator(".source")).toContainText("₹90,000");
  await expect(page.locator(".destination")).toContainText("₹30,000");
  await amount.fill("0");
  await check(page);
  await expect(page.getByRole("alert")).toContainText("greater than zero");
  await amount.fill("not money");
  await check(page);
  await expect(page.getByRole("alert")).toContainText("greater than zero");
  await amount.fill("1.001");
  await check(page);
  await expect(page.getByRole("alert")).toContainText("two decimal places");
  for (const [label, value] of [
    ["Minimum Due", "2000.00"],
    ["25% of Outstanding", "7500.00"],
    ["50% of Outstanding", "15000.00"],
    ["Full Outstanding", "30000.00"],
    ["Custom", ""],
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(amount).toHaveValue(value);
  }
  await amount.fill("10000");
  await check(page);
  await expect(
    page.getByRole("heading", { name: "REQUEST VALID", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".route-checks .passed")).toHaveCount(10);
  await noOverflow(page);
  await page.screenshot({
    path: `test-results/route-valid-${test.info().project.name}.png`,
    fullPage: true,
  });
  await amount.fill("40000");
  await expect(page.locator(".route-result")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Continue to Route Options" }),
  ).toHaveCount(0);
  await check(page);
  await expect(
    page.getByRole("heading", { name: "REQUEST CANNOT CONTINUE" }),
  ).toBeVisible();
  await expect(page.locator(".route-failures")).toContainText(
    "The amount cannot exceed the destination card's current outstanding balance.",
  );
  await page.getByRole("button", { name: "Change Request" }).click();
  await expect(page.locator(".route-result")).toHaveCount(0);
  await amount.fill("10000");
  await check(page);
  await expect(
    page.getByRole("heading", { name: "REQUEST VALID", exact: true }),
  ).toBeVisible();
  await from.selectOption(low.id);
  await expect(page.locator(".route-result")).toHaveCount(0);
  await check(page);
  await expect(page.locator(".route-failures")).toContainText(
    "Your selected source card does not have enough available credit for this amount.",
  );
  await from.selectOption(nova.id);
  await check(page);
  await expect(
    page.getByRole("heading", { name: "REQUEST VALID", exact: true }),
  ).toBeVisible();
  await to.selectOption(low.id);
  await expect(page.locator(".route-result")).toHaveCount(0);
  await check(page);
  await expect(
    page.getByRole("heading", { name: "REQUEST VALID", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Swap Cards" }).click();
  await expect(from).toHaveValue(low.id);
  await expect(to).toHaveValue(nova.id);
  await expect(page.locator(".route-result")).toHaveCount(0);
  await check(page);
  await expect(page.locator(".route-failures")).toContainText(
    "Your selected source card does not have enough available credit for this amount.",
  );
  await page.getByRole("button", { name: "Swap Cards" }).click();
  await to.selectOption(zenith.id);
  await amount.fill("10000.05");
  await check(page);
  await expect(
    page.getByRole("heading", { name: "REQUEST VALID", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue to Route Options" }).click();
  await expect(page).toHaveURL(/\/route-options\?quote=/);
  await expect(
    page.getByRole("heading", { name: "ELIGIBLE", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Simulation eligibility only. No real provider is connected.",
    ),
  ).toBeVisible();
  expect(await (await page.request.get("/api/cards")).json()).toEqual(
    await before,
  );
});
test("zero and one-card states, dashboard CTA and source preselection", async ({
  page,
}) => {
  await account(page);
  await page.goto("/route");
  await expect(
    page.getByRole("heading", { name: "Add your first card to get started." }),
  ).toBeVisible();
  await expect(page.getByLabel("AMOUNT", { exact: true })).toHaveCount(0);
  await page.goto("/dashboard");
  await expect(
    page.getByText(
      "You need at least two active cards before creating a card-to-card route.",
    ),
  ).toBeVisible();
  const nova = await card(page, "Nova Platinum");
  await page.goto("/route");
  await expect(
    page.getByRole("heading", {
      name: "Add another card to create a card-to-card route.",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("AMOUNT", { exact: true })).toHaveCount(0);
  await card(page, "Zenith Rewards", "30000");
  await page.goto("/dashboard");
  await page
    .getByRole("link", { name: "Pay Another Card", exact: true })
    .click();
  await expect(page).toHaveURL("/route");
  await page.goto("/cards");
  await page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: "Nova Platinum", exact: true }),
    })
    .getByRole("link", { name: "Use as Source" })
    .click();
  await expect(page.getByLabel("FROM CARD", { exact: true })).toHaveValue(
    nova.id,
  );
  await noOverflow(page);
});
test("authoritative recheck, request error recovery and in-flight response invalidation", async ({
  page,
}) => {
  await account(page);
  const nova = await card(page, "Nova Platinum");
  const zenith = await card(page, "Zenith Rewards", "30000");
  await page.goto("/route");
  await selectPair(page, nova.id, zenith.id);
  const amount = page.getByLabel("AMOUNT", { exact: true });
  await amount.fill("10000");
  await check(page);
  await expect(
    page.getByRole("heading", { name: "REQUEST VALID", exact: true }),
  ).toBeVisible();
  expect(
    (
      await page.request.patch("/api/cards/" + zenith.id, {
        headers,
        data: { outstanding_balance: "7000" },
      })
    ).status(),
  ).toBe(200);
  await check(page);
  await expect(page.locator(".route-failures")).toContainText(
    "The amount cannot exceed the destination card's current outstanding balance.",
  );
  await expect(page.locator(".validated-pair")).toContainText("₹7,000");
  await page.request.patch("/api/cards/" + zenith.id, {
    headers,
    data: { outstanding_balance: "30000" },
  });
  let release: () => void = () => {};
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fetched: () => void = () => {};
  const snapshot = new Promise<void>((resolve) => {
    fetched = resolve;
  });
  await page.route("**/api/card-route/validate", async (route) => {
    const response = await route.fetch();
    fetched();
    await hold;
    try {
      await route.fulfill({ response });
    } catch {
      /* Browser cancellation after an input change is expected. */
    }
  });
  await check(page);
  await snapshot;
  await expect(
    page.getByRole("button", { name: "Checking Request…" }),
  ).toBeDisabled();
  await amount.fill("4000");
  release();
  await expect(page.locator(".route-result")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Continue to Route Options" }),
  ).toHaveCount(0);
  await page.unroute("**/api/card-route/validate");
  await check(page);
  await expect(
    page.getByRole("heading", { name: "REQUEST VALID", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".validated-amount")).toContainText("₹4,000");
  await page.route("**/api/card-route/validate", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        detail: "Unable to check the request. Try again.",
      }),
    }),
  );
  await check(page);
  await expect(page.getByRole("alert")).toHaveText(
    "Unable to check the request. Try again.",
  );
  await expect(page.locator(".route-result")).toHaveCount(0);
  await noOverflow(page);
});
test("route pages require authentication", async ({ page }) => {
  for (const path of ["/route", "/route-options"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/login");
  }
});
