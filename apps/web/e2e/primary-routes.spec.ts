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
  await page.route("**/api/v1/auth/workspaces/w1/members", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        members: [
          {
            userId: "u1",
            email: "alex@example.com",
            displayName: "Alex Morgan",
            role: "OWNER",
          },
        ],
        invitations: [],
      }),
    }),
  );
  await page.route("**/api/v1/notifications/preferences", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ notifyInApp: true, notifyByEmail: false }),
    }),
  );
  await page.route("**/api/v1/pinterest/connections", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route("**/api/v1/media", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
}

test.beforeEach(async ({ page, context }) => {
  await context.addCookies([
    {
      name: "pindash_session",
      value: "browser-test-session",
      url: "http://127.0.0.1:3000",
    },
  ]);
  await mockApi(page);
});

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
  ["/product", "Plan, approve and publish Pins with confidence."],
  ["/privacy", "Privacy Policy"],
  ["/terms", "Terms of Service"],
  ["/contact", "How can we help?"],
  ["/data-controls", "Data controls"],
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

test("Settings sections follow their links", async ({ page }) => {
  await page.goto("/settings#members");
  await expect(
    page.getByRole("heading", { name: "Workspace members" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Members" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("link", { name: "Notifications" })
    .click();
  await expect(page).toHaveURL(/\/settings#notifications$/);
  await expect(
    page.getByRole("heading", { name: "Notification preferences" }),
  ).toBeVisible();
});

test("Member invitations use a secure setup flow", async ({ page }) => {
  await page.goto("/settings#members");
  await page.getByRole("button", { name: "Add new member" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a new member" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText("creates their own private password"),
  ).toBeVisible();
  await expect(dialog.getByLabel("Email address")).toBeVisible();
  await expect(dialog.getByLabel("Role")).toHaveValue("EDITOR");
});

test("Pin composer confirms a completed secure image upload", async ({
  page,
}) => {
  await page.route("**/api/v1/media/upload-intents", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ assetId: "media-1" }),
    }),
  );
  await page.route("**/api/v1/media/media-1/content", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "media-1",
        originalFilename: "demo.png",
        mimeType: "image/png",
        byteSize: "128",
        width: 600,
        height: 900,
        status: "READY",
      }),
    }),
  );
  await page.goto("/pins/new");
  await page.getByLabel("Choose Pin image").setInputFiles({
    name: "demo.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a", "hex"),
  });
  await expect(page.getByText("Image ready")).toBeVisible();
  await expect(
    page.getByText("demo.png is attached to this draft."),
  ).toBeVisible();
});

test("Log out revokes the API session", async ({ page }) => {
  await page.goto("/settings");
  if ((page.viewportSize()?.width ?? 1280) < 920) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  const requestPromise = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/v1/auth/session") &&
      request.method() === "DELETE",
  );
  await page.getByRole("button", { name: "Log out" }).click();
  await requestPromise;
});

test("responses include production security headers", async ({ page }) => {
  const response = await page.goto("/product");
  expect(response?.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(response?.headers()["strict-transport-security"]).toContain(
    "max-age=31536000",
  );
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
});

test("Pins can be searched from API-backed results", async ({ page }) => {
  await page.goto("/pins");
  await page.getByRole("searchbox", { name: "Search Pins" }).fill("Balcony");
  await expect(page.getByText("Balcony garden checklist")).toBeVisible();
  await expect(page.getByText("Home office lighting ideas")).toBeHidden();
});

test("protected routes redirect visitors without a session", async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await page.goto("/pins");
  await expect(page).toHaveURL(/\/signin\?next=%2Fpins$/);
  await expect(
    page.getByRole("heading", { name: "Sign in securely" }),
  ).toBeVisible();
});

test("sign-in and registration are separate public flows", async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await page.goto("/signin");
  await expect(page.getByLabel("Password")).toHaveAttribute(
    "autocomplete",
    "current-password",
  );
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  await expect(page.getByLabel("Confirm password")).toBeVisible();
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
    page.getByRole("button", { name: "Sign in again" }),
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
  await expect(page.getByRole("status")).toContainText("Draft loaded");
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
  await page.route("**/api/v1/pins/1/publish", (route) =>
    route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        publicationJobId: "job-1",
        pinDraftId: "1",
        status: "QUEUED",
      }),
    }),
  );
  await page.goto("/pins/1/review");
  const approve = page.getByRole("button", { name: "Approve and publish" });
  await expect(approve).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(approve).toBeEnabled();
  await approve.click();
  await expect(page).toHaveURL(/\/pins\/1\/publication$/);
});
