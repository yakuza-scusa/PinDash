import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const pins = [
  {
    id: "1",
    workspaceId: "w1",
    boardId: "Ideas",
    title: "Home office lighting ideas",
    description: "Lighting guide",
    status: "DRAFT",
    scheduledForUtc: null,
    scheduleTimezone: null,
    createdAt: "2026-09-30T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
  },
  {
    id: "2",
    workspaceId: "w1",
    boardId: "Garden",
    title: "Balcony garden checklist",
    description: "Garden guide",
    status: "SCHEDULED",
    scheduledForUtc: "2026-10-04T18:30:00.000Z",
    scheduleTimezone: "Europe/Paris",
    createdAt: "2026-09-30T10:00:00.000Z",
    updatedAt: "2026-10-01T09:00:00.000Z",
  },
];

async function mockApi(page: Page) {
  await page.route("**/api/v1/pins", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(pins),
    }),
  );
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        user: {
          displayName: "Alex Morgan",
          workspaces: [{ id: "w1", name: "Atelier Studio", role: "OWNER" }],
        },
      }),
    }),
  );
  await page.route("**/api/v1/pinterest/connections", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route("**/api/v1/media", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
}

test.beforeEach(async ({ page }) => mockApi(page));

for (const [path, heading] of [
  ["/", "Publishing dashboard"],
  ["/pins", "Pins"],
  ["/drafts", "Drafts"],
  ["/calendar", "Calendar"],
  ["/media", "Media library"],
  ["/connections", "Connections"],
  ["/settings", "Settings"],
  ["/support", "Help & support"],
  ["/pins/new", "Create a Pin"],
] as const) {
  test(`${path} renders and meets automated WCAG checks`, async ({ page }) => {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test("Pins can be searched from API-backed results", async ({ page }) => {
  await page.goto("/pins");
  await page.getByRole("searchbox", { name: "Search Pins" }).fill("Balcony");
  await expect(page.getByText("Balcony garden checklist")).toBeVisible();
  await expect(page.getByText("Home office lighting ideas")).toBeHidden();
});

test("expired sessions show a recovery action", async ({ page }) => {
  await page.route("**/api/v1/pins", (route) =>
    route.fulfill({ status: 401, body: "{}" }),
  );
  await page.goto("/pins");
  await expect(
    page.getByRole("heading", { name: "Your session has expired" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start local session" }),
  ).toBeVisible();
});

test("an existing draft loads and autosaves edits", async ({ page }) => {
  await page.route("**/api/v1/pins/1", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...pins[0], title: "Updated lighting guide" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(pins[0]),
    });
  });
  await page.goto("/pins/new?draft=1");
  const title = page.getByRole("textbox", { name: /Title/ });
  await expect(title).toHaveValue("Home office lighting ideas");
  const autosave = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/v1/pins/1") && request.method() === "PATCH",
  );
  await title.fill("Updated lighting guide");
  await autosave;
  await expect(page.getByRole("status")).toContainText("All changes saved");
});

test("review requires explicit confirmation before approval", async ({
  page,
}) => {
  await page.route("**/api/v1/pins/1/review", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...pins[0],
        version: 2,
        altText: "Bright office",
        destinationUrl: "https://example.com",
        connection: {
          displayName: "Atelier",
          pinterestUserId: "atelier",
          status: "CONNECTED",
        },
        mediaAsset: {
          originalFilename: "office.png",
          width: 1000,
          height: 1500,
          status: "READY",
        },
      }),
    }),
  );
  await page.route("**/api/v1/pins/1/approve", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "APPROVED" }),
    }),
  );
  await page.goto("/pins/1/review");
  const approve = page.getByRole("button", { name: "Approve this Pin" });
  await expect(approve).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(approve).toBeEnabled();
  await approve.click();
  await expect(page.getByRole("status")).toContainText("Pin approved");
});
