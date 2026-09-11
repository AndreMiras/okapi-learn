import { E2E_USERS, FICTIONAL_PASSWORD } from "../fixtures/upstream";
import { expect, test, type Page, type TestInfo } from "./test";

async function signIn(page: Page, username: string, testInfo: TestInfo) {
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `${testInfo.project.name}-visual-${username}`,
  });
  await page.goto("/login");
  await page.getByLabel("Email or username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(FICTIONAL_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function capture(page: Page, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    document.body.tabIndex = -1;
    document.body.focus();
  });
  await page.waitForTimeout(100);
  await expect(page).toHaveScreenshot(name, { fullPage: true });
}

test.beforeEach(({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-webkit",
    "Visual baselines use pinned Chromium rendering.",
  );
  return page.emulateMedia({ reducedMotion: "reduce" });
});

test("@visual fictional desktop and mobile release states", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await capture(page, "login.png");

  await signIn(page, E2E_USERS.success, testInfo);
  await capture(page, "learners.png");
  await page.getByRole("link", { name: /Nova/ }).click();
  await capture(page, "catalog-populated.png");
  await page.getByRole("link", { name: /Moonlight Story/ }).click();
  await capture(page, "media-catalog-only.png");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\?reason=signed-out$/);
  await capture(page, "logout.png");

  await signIn(page, E2E_USERS.emptyCatalog, testInfo);
  await page.getByRole("link", { name: /Nova/ }).click();
  await capture(page, "catalog-empty.png");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\?reason=signed-out$/);

  await signIn(page, E2E_USERS.serviceError, testInfo);
  await capture(page, "service-error.png");
  await page.goto("/login?reason=expired");
  await capture(page, "expiry.png");
});
