import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext } from "@playwright/test";

import {
  E2E_FORBIDDEN_BROWSER_VALUES,
  E2E_USERS,
  FICTIONAL_PASSWORD,
} from "../fixtures/upstream";
import { expect, test, type Page, type TestInfo } from "./test";

const appOrigin = "http://localhost:3100";
const expiryOrigin = "http://localhost:3101";
const logoutStorageKey = "merriloop-logout";

function flowUser(name: string) {
  return `flow-${name}@example.test`;
}

async function signIn(
  page: Page,
  username: string,
  testInfo: TestInfo,
  origin = appOrigin,
) {
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `${testInfo.project.name}-${username}`,
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("Email or username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(FICTIONAL_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function signInSuccessfully(
  page: Page,
  username: string,
  testInfo: TestInfo,
  origin = appOrigin,
) {
  await signIn(page, username, testInfo, origin);
  await expect(page).toHaveURL(`${origin}/learners`);
}

async function expectNoSeriousA11yIssues(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
}

async function firstLearnerHref(page: Page) {
  const href = await page
    .getByRole("link", { name: /Open course/ })
    .first()
    .getAttribute("href");
  expect(href).toMatch(/^\/learn\/[A-Za-z0-9_-]+$/);
  return href!;
}

async function assertNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

async function stressLocalizedLayout(page: Page) {
  await page.evaluate(() => {
    document.documentElement.dir = "rtl";
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    let node = walker.nextNode();
    while (node) {
      const value = node.textContent?.trim();
      if (value)
        node.textContent = `${node.textContent} ${value.slice(0, Math.ceil(value.length * 0.4))}`;
      node = walker.nextNode();
    }
  });
  await assertNoHorizontalOverflow(page);
}

async function disableBroadcastChannel(context: BrowserContext) {
  await context.addInitScript(() => {
    Reflect.deleteProperty(window, "BroadcastChannel");
  });
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\?reason=signed-out$/);
}

test("protects routes and supports valid catalog navigation", async ({
  page,
}, testInfo) => {
  await page.goto("/learners");
  await expect(page).toHaveURL(/\/login\?reason=expired$/);
  await page.goto("/learn/arbitrary-alias");
  await expect(page).toHaveURL(/\/login\?reason=expired$/);

  await signInSuccessfully(page, flowUser("catalog-navigation"), testInfo);
  await expect(
    page.getByRole("heading", { name: "Who is learning today?" }),
  ).toBeVisible();
  await page.reload();
  const learnerHref = await firstLearnerHref(page);
  await page.goto(learnerHref);
  await expect(
    page.getByRole("heading", { name: "Nova's catalog" }),
  ).toBeVisible();
  await expect(page.getByText("There are no listen items")).toBeVisible();
  await page.reload();
  const mediaHref = await page
    .getByRole("link", { name: /Moonlight Story/ })
    .getAttribute("href");
  expect(mediaHref).toMatch(/^\/learn\/[A-Za-z0-9_-]+\/media\/[A-Za-z0-9_-]+$/);
  await page.goto(mediaHref!);
  await expect(
    page.getByText("Playback is not available in this version."),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Nova's catalog" }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Moonlight Story" }),
  ).toBeVisible();

  const protectedResponse = await page.request.get("/learners");
  expect(protectedResponse.headers()["cache-control"]).toContain("no-store");
});

test("supports multiple learners and never keeps the prior catalog", async ({
  page,
}, testInfo) => {
  await signInSuccessfully(page, E2E_USERS.multipleLearners, testInfo);
  const nova = page.getByRole("link", { name: /Nova/ });
  const milo = page.getByRole("link", { name: /Milo/ });
  await expect(nova).toBeVisible();
  await expect(milo).toBeVisible();
  await nova.click();
  await expect(
    page.getByRole("heading", { name: "Nova's catalog" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Switch learner" }).click();
  await milo.click();
  await expect(
    page.getByRole("heading", { name: "Milo's catalog" }),
  ).toBeVisible();
  await expect(page.getByText("Moonlight Story")).toHaveCount(0);
  await page.getByRole("link", { name: /Rain Rhythm/ }).click();
  await expect(
    page.getByRole("heading", { name: "Rain Rhythm" }),
  ).toBeVisible();
  await expect(
    page.getByText("Playback is not available in this version."),
  ).toBeVisible();
});

test("reveals video-linked activities only in learner-scoped browser memory", async ({
  context,
  page,
}, testInfo) => {
  await signInSuccessfully(page, flowUser("game-reveal"), testInfo);
  await page.getByRole("link", { name: /Nova/ }).click();

  const viewedCard = page.locator("article").filter({
    has: page.getByRole("link", { name: /Moonlight Story/ }),
  });
  const unviewedCard = page.locator("article").filter({
    has: page.getByRole("link", { name: /Unopened Comet Story/ }),
  });
  await expect(
    viewedCard.getByRole("link", { name: "Activity unavailable", exact: true }),
  ).toBeVisible();
  await expect(
    viewedCard.getByRole("link", {
      name: "Activity 2 unavailable",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    viewedCard.getByRole("link", {
      name: "Activity 3 unavailable",
      exact: true,
    }),
  ).toBeVisible();
  await expect(unviewedCard.getByLabel("Linked activities")).toHaveCount(0);

  const activityHref = await viewedCard
    .getByRole("link", { name: "Activity unavailable", exact: true })
    .getAttribute("href");
  expect(activityHref).toMatch(
    /^\/learn\/[A-Za-z0-9_-]+\/media\/[A-Za-z0-9_-]+\/game\/[A-Za-z0-9_-]+$/,
  );
  await unviewedCard
    .getByRole("link", { name: /Unopened Comet Story/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Unopened Comet Story" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Activity unavailable", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Back to catalog/ }).click();
  await expect(
    page.getByRole("heading", { name: "Nova's catalog" }),
  ).toBeVisible();
  await expect(
    page
      .locator("article")
      .filter({ hasText: "Unopened Comet Story" })
      .getByRole("link", { name: "Activity unavailable", exact: true }),
  ).toBeVisible();

  const newTab = await context.newPage();
  await newTab.goto(page.url());
  await expect(
    newTab
      .locator("article")
      .filter({ hasText: "Unopened Comet Story" })
      .getByLabel("Linked activities"),
  ).toHaveCount(0);
  await newTab.close();

  await page.reload();
  await expect(
    page
      .locator("article")
      .filter({ hasText: "Unopened Comet Story" })
      .getByLabel("Linked activities"),
  ).toHaveCount(0);
  await expect(
    page
      .locator("article")
      .filter({ hasText: "Moonlight Story" })
      .getByRole("link", { name: "Activity unavailable", exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: /All learners/ }).click();
  await page.getByRole("link", { name: /Lyra/ }).click();
  await expect(page.getByLabel("Linked activities")).toHaveCount(0);
});

test("shows the disabled activity state without requesting a package", async ({
  page,
}, testInfo) => {
  const packageRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/games/")) {
      packageRequests.push(request.url());
    }
  });
  await signInSuccessfully(page, flowUser("game-disabled"), testInfo);
  await page.getByRole("link", { name: /Nova/ }).click();
  await page
    .getByRole("link", { name: "Activity unavailable", exact: true })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
  await expect(
    page.getByText(/games are not enabled on this server/),
  ).toBeVisible();
  await expect(page).toHaveURL(
    /\/learn\/[A-Za-z0-9_-]+\/media\/[A-Za-z0-9_-]+\/game\/[A-Za-z0-9_-]+$/,
  );

  expect(packageRequests).toEqual([]);
});

test("handles empty, malformed, mismatched, and unavailable catalogs", async ({
  page,
}, testInfo) => {
  await signInSuccessfully(page, E2E_USERS.noLearners, testInfo);
  await expect(
    page.getByRole("heading", { name: "No learners are available" }),
  ).toBeVisible();
  await signOut(page);

  await signInSuccessfully(page, E2E_USERS.emptyCatalog, testInfo);
  await page.getByRole("link", { name: /Nova/ }).click();
  await expect(page.getByText("There are no listen items")).toBeVisible();
  await expect(page.getByText("There are no watch items")).toBeVisible();
  await signOut(page);

  for (const username of [
    E2E_USERS.malformedCatalog,
    E2E_USERS.mismatchedCourse,
    E2E_USERS.serviceError,
  ]) {
    await signIn(page, username, testInfo);
    await expect(
      page.getByText("Sign-in is temporarily unavailable."),
    ).toBeVisible();
  }
  await signIn(page, E2E_USERS.rejected, testInfo);
  await expect(page.getByText("Sign-in was not accepted.")).toBeVisible();
});

test("rejects raw, wrong-owner, removed, and stale aliases", async ({
  page,
}, testInfo) => {
  await signInSuccessfully(page, E2E_USERS.multipleLearners, testInfo);
  const learnerLinks = page.getByRole("link", { name: /Open course/ });
  const firstLearner = (await learnerLinks.nth(0).getAttribute("href"))!;
  const secondLearner = (await learnerLinks.nth(1).getAttribute("href"))!;
  await page.goto(firstLearner);
  const firstMedia = (await page
    .getByRole("link", { name: /Moonlight Story/ })
    .getAttribute("href"))!;
  const mediaAlias = firstMedia.split("/").at(-1)!;
  await page.goto(`${secondLearner}/media/${mediaAlias}`);
  await expect(
    page.getByRole("heading", { name: "This catalog item cannot be opened" }),
  ).toBeVisible();
  await page.goto("/learn/learner-nova");
  await expect(
    page.getByRole("heading", { name: "This catalog item cannot be opened" }),
  ).toBeVisible();

  const logout = await page.request.post("/api/auth/logout", {
    headers: { Origin: appOrigin },
  });
  expect(logout.ok()).toBe(true);
  await signInSuccessfully(page, flowUser("replacement-session"), testInfo);
  await page.goto(firstMedia);
  await expect(
    page.getByRole("heading", { name: "This catalog item cannot be opened" }),
  ).toBeVisible();
});

test("expires sessions and prevents Back from restoring protected content", async ({
  page,
}, testInfo) => {
  await signInSuccessfully(page, flowUser("expiry"), testInfo, expiryOrigin);
  await expect(
    page.getByRole("heading", { name: "Who is learning today?" }),
  ).toBeVisible();
  await page.waitForTimeout(1_100);
  await page.reload();
  await expect(page).toHaveURL(`${expiryOrigin}/login?reason=expired`);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Who is learning today?" }),
  ).toHaveCount(0);
  await page.goForward();
  await expect(page).toHaveURL(`${expiryOrigin}/login?reason=expired`);
});

test("logs out idempotently and coordinates tabs without BroadcastChannel", async ({
  page,
  context,
}, testInfo) => {
  await disableBroadcastChannel(context);
  await signInSuccessfully(page, flowUser("cross-tab-logout"), testInfo);
  const otherTab = await context.newPage();
  const learnerHref = await firstLearnerHref(page);
  await otherTab.goto(learnerHref);
  const otherDocumentStartedAt = await otherTab.evaluate(
    () => performance.timeOrigin,
  );
  await signOut(page);
  await expect(otherTab).toHaveURL(/\/login\?reason=signed-out$/);
  const logoutMarker = await page.evaluate(
    (key) => localStorage.getItem(key),
    logoutStorageKey,
  );
  expect(logoutMarker).toMatch(/^\d{13}:[0-9a-f-]{36}$/i);
  expect(Number(logoutMarker!.split(":", 1)[0])).toBeGreaterThanOrEqual(
    otherDocumentStartedAt,
  );
  for (const forbidden of E2E_FORBIDDEN_BROWSER_VALUES) {
    expect(logoutMarker).not.toContain(forbidden);
  }
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Who is learning today?" }),
  ).toHaveCount(0);
  await page.goForward();
  await expect(page).toHaveURL(/\/login\?reason=signed-out$/);
  const repeated = await page.request.post("/api/auth/logout", {
    headers: { Origin: appOrigin },
  });
  expect(repeated.ok()).toBe(true);
  const freshLogin = await context.newPage();
  await freshLogin.addInitScript(() => {
    const addEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (
      type,
      listener,
      options,
    ) {
      addEventListener.call(this, type, listener, options);
      if (this === window && type === "storage") {
        console.debug("test:logout-subscriber-ready");
      }
    };
  });
  const subscriberReady = freshLogin.waitForEvent(
    "console",
    (message) => message.text() === "test:logout-subscriber-ready",
  );
  await signInSuccessfully(freshLogin, flowUser("post-logout"), testInfo);
  await subscriberReady;
  await expect(freshLogin).toHaveURL(`${appOrigin}/learners`);
  await expect(
    freshLogin.getByRole("heading", { name: "Who is learning today?" }),
  ).toBeVisible();
  await freshLogin.close();
});

test("keeps secrets and upstream identifiers out of browser-visible data", async ({
  page,
}, testInfo) => {
  const responseBodies: string[] = [];
  const consoleOutput: string[] = [];
  const responseReads: Promise<void>[] = [];
  page.on("console", (message) => consoleOutput.push(message.text()));
  page.on("requestfinished", (request) => {
    if (!request.url().startsWith(appOrigin)) return;
    responseReads.push(
      request
        .response()
        .then((response) => response?.text())
        .then((body) => {
          if (body) responseBodies.push(body);
        })
        .catch(() => undefined),
    );
  });

  await signInSuccessfully(page, flowUser("privacy-boundary"), testInfo);
  await page.getByRole("link", { name: /Nova/ }).click();
  await page.getByRole("link", { name: /Moonlight Story/ }).click();
  await Promise.all(responseReads);
  const storage = await page.evaluate(() => ({
    html: document.documentElement.innerHTML,
    local: Array.from({ length: localStorage.length }, (_, index) => {
      const key = localStorage.key(index)!;
      return [key, localStorage.getItem(key)];
    }),
    session: Array.from({ length: sessionStorage.length }, (_, index) => {
      const key = sessionStorage.key(index)!;
      return [key, sessionStorage.getItem(key)];
    }),
  }));
  const cookies = await page.context().cookies();
  expect(cookies).toHaveLength(1);
  expect(cookies[0]).toMatchObject({
    httpOnly: true,
    name: "merriloop_session",
    sameSite: "Lax",
  });
  const ledger = await page.request.get(
    "http://127.0.0.1:4100/__fixture__/ledger",
  );
  expect(ledger.ok()).toBe(true);
  const relevantLedger = (
    (await ledger.json()) as Array<{ path: string }>
  ).filter(({ path }) => !path.includes("GetGame"));
  const visibleData = JSON.stringify({
    consoleOutput,
    cookies,
    responseBodies,
    storage,
    ledger: relevantLedger,
  });
  for (const forbidden of E2E_FORBIDDEN_BROWSER_VALUES) {
    expect(visibleData).not.toContain(forbidden);
  }
});

test("has no serious accessibility violations in required states", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await expectNoSeriousA11yIssues(page);
  await signIn(page, E2E_USERS.rejected, testInfo);
  await expectNoSeriousA11yIssues(page);
  await signInSuccessfully(page, E2E_USERS.noLearners, testInfo);
  await expectNoSeriousA11yIssues(page);
  await signOut(page);
  await expectNoSeriousA11yIssues(page);

  await signInSuccessfully(page, E2E_USERS.emptyCatalog, testInfo);
  await expectNoSeriousA11yIssues(page);
  await page.getByRole("link", { name: /Nova/ }).click();
  await expectNoSeriousA11yIssues(page);
  await page.goto("/learn/missing");
  await expectNoSeriousA11yIssues(page);
});

test("survives expanded copy and RTL without essential overflow", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await stressLocalizedLayout(page);
  await expect(page.getByRole("button", { name: /Sign in/ })).toBeVisible();

  await signInSuccessfully(page, E2E_USERS.longCatalog, testInfo);
  const learnerHref = await firstLearnerHref(page);
  await stressLocalizedLayout(page);
  await expect(page.getByRole("button", { name: /Sign out/ })).toBeVisible();

  await page.goto(learnerHref);
  const mediaHref = (await page
    .getByRole("link", { name: /Story beyond/ })
    .getAttribute("href"))!;
  await stressLocalizedLayout(page);
  await expect(page.getByRole("link", { name: /All learners/ })).toBeVisible();

  await page.goto(mediaHref);
  await stressLocalizedLayout(page);
  await expect(
    page.getByRole("link", { name: /Back to catalog/ }),
  ).toBeVisible();
});
