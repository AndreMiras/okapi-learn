import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const username = "family@example.test";
const password = "fictional-passphrase";
const token = "fictional-upstream-token";
const rawIds = ["learner-nova", "course-orbit", "video-moonlight"];

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/learners$/);
}

async function expectNoSeriousA11yIssues(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
}

test("protects pages and supports the catalog-only flow", async ({ page }) => {
  await page.goto("/learners");
  await expect(page).toHaveURL(/\/login\?reason=expired$/);
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "Who is learning today?" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: /Nova/ }).click();
  await expect(
    page.getByRole("heading", { name: "Nova's catalog" }),
  ).toBeVisible();
  await expect(page.getByText("There are no listen items")).toBeVisible();
  await page.getByRole("link", { name: /Moonlight Story/ }).click();
  await expect(
    page.getByText("Playback is not available in this version."),
  ).toBeVisible();

  const browserData = await page.evaluate(() => ({
    html: document.documentElement.innerHTML,
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
  }));
  for (const secret of [password, token, ...rawIds]) {
    expect(JSON.stringify(browserData)).not.toContain(secret);
  }
  const protectedResponse = await page.request.get("/learners");
  expect(protectedResponse.headers()["cache-control"]).toContain("no-store");
});

test("rejects stale and raw deep links", async ({ page }) => {
  await signIn(page);
  await page.goto("/learn/learner-nova");
  await expect(
    page.getByRole("heading", { name: "This catalog item cannot be opened" }),
  ).toBeVisible();
  await page.goto("/learn/missing/media/video-moonlight");
  await expect(
    page.getByRole("heading", { name: "This catalog item cannot be opened" }),
  ).toBeVisible();
});

test("logs out locally, invalidates Back, and coordinates tabs", async ({
  page,
  context,
}) => {
  await signIn(page);
  const otherTab = await context.newPage();
  await otherTab.goto("/learners");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\?reason=signed-out$/);
  await expect(otherTab).toHaveURL(/\/login\?reason=signed-out$/);
  await page.goBack();
  await expect(page).not.toHaveURL(/\/learners$/);
  await page.goto("/learners");
  await expect(page).toHaveURL(/\/login\?reason=expired$/);
  const repeated = await page.request.post("/api/auth/logout", {
    headers: { Origin: "http://localhost:3100" },
  });
  expect(repeated.ok()).toBe(true);
});

test("has no serious accessibility violations in primary states", async ({
  page,
}) => {
  await page.goto("/login");
  await expectNoSeriousA11yIssues(page);
  await signIn(page);
  await expectNoSeriousA11yIssues(page);
  await page.getByRole("link", { name: /Nova/ }).click();
  await expectNoSeriousA11yIssues(page);
  await page.getByRole("link", { name: /Moonlight Story/ }).click();
  await expectNoSeriousA11yIssues(page);
  await page.goto("/learn/missing");
  await expectNoSeriousA11yIssues(page);
});
