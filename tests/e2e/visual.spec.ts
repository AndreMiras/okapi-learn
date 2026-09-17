import { E2E_USERS, FICTIONAL_PASSWORD } from "../fixtures/upstream";
import { expect, test, type Page, type TestInfo } from "./test";

async function signIn(
  page: Page,
  username: string,
  testInfo: TestInfo,
  origin = "http://localhost:3100",
) {
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `${testInfo.project.name}-visual-${username}`,
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("Email or username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(FICTIONAL_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function installImmediateGameAudio(page: Page) {
  await page.addInitScript(() => {
    class ImmediateAudio {
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = "";
      load() {}
      pause() {}
      play() {
        queueMicrotask(() => this.onended?.());
        return Promise.resolve();
      }
      removeAttribute() {
        this.src = "";
      }
    }
    Object.defineProperty(window, "Audio", { value: ImmediateAudio });
  });
}

async function capture(page: Page, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const skipLink = document.querySelector<HTMLElement>(
      'a[href="#main-content"]',
    );
    if (skipLink) skipLink.style.visibility = "hidden";
    document.body.tabIndex = -1;
    document.body.focus();
  });
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

test("@visual fictional game states", async ({ page }, testInfo) => {
  await installImmediateGameAudio(page);
  await page.request.post("http://127.0.0.1:4300/__fixture__/reset");
  await signIn(
    page,
    `flow-game-visual-${testInfo.project.name}@example.test`,
    testInfo,
    "http://localhost:3104",
  );
  await page.getByRole("link", { name: /Nova/ }).click();
  await capture(page, "game-launchers.png");
  await page
    .getByRole("link", { name: "Activity", exact: true })
    .first()
    .click();
  await capture(page, "game-idle.png");
  await page.getByRole("button", { name: "Play activity" }).click();
  await page.getByRole("heading", { name: "Listen and choose" }).waitFor();
  await capture(page, "game-listen.png");

  for (const label of [
    "Picture 1",
    "Picture 2",
    "Picture 3: Shared picture",
    "Picture 4: Shared picture",
  ]) {
    const choice = page.getByRole("button", { name: label, exact: true });
    await expect(choice).toBeEnabled();
    await choice.click();
  }
  const comet = page.getByRole("button", {
    name: /^Picture \d+: Green comet$/,
  });
  await expect(comet).toBeEnabled();
  await comet.click();
  await page.getByRole("heading", { name: "Explore the picture" }).waitFor();
  await capture(page, "game-explore.png");
  const star = page.getByRole("button", { name: "Hotspot 1" });
  await expect(star).toBeEnabled();
  await star.click();
  await page.getByRole("heading", { name: "Cloud break" }).waitFor();
  await capture(page, "game-wildcard.png");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "Play complete" }).waitFor();
  await capture(page, "game-complete.png");

  await page.getByRole("button", { name: "Exit activity" }).click();
  await page.getByRole("link", { name: "Activity 2", exact: true }).click();
  await page.getByRole("button", { name: "Play activity" }).click();
  await page.getByRole("alert").waitFor();
  await capture(page, "game-unsupported.png");
});
