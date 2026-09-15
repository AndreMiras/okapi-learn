import AxeBuilder from "@axe-core/playwright";

import {
  E2E_FORBIDDEN_BROWSER_VALUES,
  FICTIONAL_PASSWORD,
} from "../fixtures/upstream";
import { expect, test, type Page, type TestInfo } from "./test";

const gameOrigin = "http://localhost:3104";
const gameExpiryOrigin = "http://localhost:3105";

async function installGameHarness(page: Page) {
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

    const active = new Set<string>();
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      active.add(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      active.delete(url);
      revoke(url);
    };
    Object.defineProperty(window, "__activeGameObjectUrls", { value: active });
  });
}

async function signIn(page: Page, testInfo: TestInfo, origin = gameOrigin) {
  const username = `flow-game-${testInfo.project.name}-${testInfo.workerIndex}-${testInfo.title.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}@example.test`;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": username });
  await page.goto(`${origin}/login`);
  await page.getByLabel("Email or username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(FICTIONAL_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: /Nova/ }).click();
  await page.setExtraHTTPHeaders({});
}

async function openActivity(page: Page, name: string) {
  await page.getByRole("link", { name, exact: true }).first().click();
  await expect(
    page.getByRole("heading", { name: /^Activity(?: [23])?$/ }),
  ).toBeVisible();
}

async function expectNoSeriousA11yIssues(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
}

async function expectNoGamePersistence(page: Page) {
  const persistence = await page.evaluate(async () => ({
    cacheKeys: "caches" in window ? await caches.keys() : [],
    databases:
      "indexedDB" in window && "databases" in indexedDB
        ? (await indexedDB.databases()).map(({ name }) => name)
        : [],
    local: localStorage.length,
    serviceWorker:
      "serviceWorker" in navigator
        ? await navigator.serviceWorker.getRegistration()
        : undefined,
    session: sessionStorage.length,
  }));
  expect(persistence).toEqual({
    cacheKeys: [],
    databases: [],
    local: 0,
    serviceWorker: undefined,
    session: 0,
  });
}

async function expectSuccessfulDelivery(
  page: Page,
  action: () => Promise<void>,
) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/games/") &&
      response.url().endsWith("/package"),
  );
  await action();
  const response = await responsePromise;
  const error = response.ok()
    ? null
    : ((await response.json()) as { error?: unknown }).error;
  expect({ error, status: response.status() }).toEqual({
    error: null,
    status: 200,
  });

  const [apiResponse, packageResponse] = await Promise.all([
    page.request.get("http://127.0.0.1:4100/__fixture__/ledger"),
    page.request.get("http://127.0.0.1:4300/__fixture__/ledger"),
  ]);
  const apiLedger = (await apiResponse.json()) as Array<{
    accepted: boolean;
    path: string;
  }>;
  const packageLedger = (await packageResponse.json()) as Array<{
    accepted: boolean;
    path: string;
  }>;
  expect(
    apiLedger.filter(({ path }) => path.includes("GetGame")).at(-1),
  ).toMatchObject({
    accepted: true,
  });
  expect(packageLedger.at(-1)).toMatchObject({ accepted: true });
}

test.beforeEach(async ({ page }) => {
  await installGameHarness(page);
  await page.request.post("http://127.0.0.1:4300/__fixture__/reset");
});

test("delivers and completes the mixed package with local-only state", async ({
  page,
}, testInfo) => {
  const browserRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/games/")) {
      browserRequests.push(request.url());
    }
  });

  await signIn(page, testInfo);
  await expectNoSeriousA11yIssues(page);
  await openActivity(page, "Activity");
  const gamePageUrl = page.url();
  expect(gamePageUrl).toMatch(
    /^http:\/\/localhost:3104\/learn\/[A-Za-z0-9_-]+\/media\/[A-Za-z0-9_-]+\/game\/[A-Za-z0-9_-]+$/,
  );
  for (const forbidden of E2E_FORBIDDEN_BROWSER_VALUES) {
    expect(gamePageUrl).not.toContain(forbidden);
  }
  await expectNoSeriousA11yIssues(page);
  await expectSuccessfulDelivery(page, () =>
    page.getByRole("button", { name: "Play activity" }).click(),
  );

  await expect(
    page.getByRole("heading", { name: "Listen and choose" }),
  ).toBeVisible();
  await expectNoSeriousA11yIssues(page);
  await page.getByRole("button", { name: "Blue drum" }).click();
  for (const label of ["Amber kite", "Blue drum", "Coral boat", "Daisy bell"]) {
    const choice = page.getByRole("button", { name: label });
    await expect(choice).toBeEnabled();
    await choice.click();
  }

  const comet = page.getByRole("button", { name: "Green comet" });
  await expect(comet).toBeEnabled();
  await comet.click();
  await expect(
    page.getByRole("heading", { name: "Explore the picture" }),
  ).toBeVisible();
  await expectNoSeriousA11yIssues(page);
  const star = page.getByRole("button", { name: "Bright star" });
  await expect(star).toBeEnabled();
  await star.click();
  await expect(
    page.getByRole("heading", { name: "Cloud break" }),
  ).toBeVisible();
  await expectNoSeriousA11yIssues(page);
  await page.getByRole("button", { name: "Continue" }).click();

  const complete = page.getByRole("heading", { name: "Play complete" });
  await expect(complete).toBeVisible();
  await expect(page.getByText(/not sent to MyLocker/)).toBeVisible();
  await expect(page.getByRole("status")).toContainText("1 error");
  await expectNoSeriousA11yIssues(page);
  expect(browserRequests).toHaveLength(1);
  expect(browserRequests[0]).toMatch(
    /^http:\/\/localhost:3104\/api\/learn\/[A-Za-z0-9_-]+\/media\/[A-Za-z0-9_-]+\/games\/[A-Za-z0-9_-]+\/package$/,
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __activeGameObjectUrls: Set<string> })
            .__activeGameObjectUrls.size,
      ),
    )
    .toBe(0);
  await expectNoGamePersistence(page);
});

test("shows safe unsupported and retryable package failures", async ({
  page,
}, testInfo) => {
  await signIn(page, testInfo);
  await openActivity(page, "Activity 2");
  await expectSuccessfulDelivery(page, () =>
    page.getByRole("button", { name: "Play activity" }).click(),
  );
  await expect(
    page.getByRole("alert").filter({ hasText: "not compatible" }),
  ).toBeVisible();
  await expectNoSeriousA11yIssues(page);
  await page.getByRole("button", { name: "Exit activity" }).click();

  await openActivity(page, "Activity 3");
  await page.getByRole("button", { name: "Play activity" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "temporarily unavailable" }),
  ).toBeVisible();
  await page.request.post("http://127.0.0.1:4300/__fixture__/advance");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "not compatible" }),
  ).toBeVisible();
  await expectNoSeriousA11yIssues(page);
});

test("keeps delivery private and allows Blob-backed game assets through CSP", async ({
  page,
}, testInfo) => {
  await signIn(page, testInfo);
  await openActivity(page, "Activity");
  const response = await page.request.get(page.url());
  const csp = response.headers()["content-security-policy"] ?? "";
  expect(csp).toMatch(/img-src[^;]*blob:/);
  expect(csp).toMatch(/media-src[^;]*blob:/);
  expect(csp).toMatch(/connect-src 'self'/);
  await page.getByRole("button", { name: "Play activity" }).click();
  const image = page.getByRole("button", { name: "Amber kite" }).locator("img");
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate((value) => (value as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);

  const packageResponse = await page.request.get(
    "http://127.0.0.1:4300/__fixture__/ledger",
  );
  const packageLedger = (await packageResponse.json()) as Array<{
    accepted: boolean;
    headerNames: string[];
    method: string;
    path: string;
  }>;
  expect(packageLedger).toHaveLength(1);
  expect(packageLedger[0]).toMatchObject({
    accepted: true,
    method: "GET",
    path: "/objects/mixed.zip",
  });
  for (const privateHeader of [
    "authorization",
    "cookie",
    "forwarded",
    "referer",
    "x-forwarded-for",
  ]) {
    expect(packageLedger[0]!.headerNames).not.toContain(privateHeader);
  }
});

test("rejects stale activity aliases and clears an active play on expiry", async ({
  page,
}, testInfo) => {
  await signIn(page, testInfo);
  const staleHref = await page
    .getByRole("link", { name: "Activity", exact: true })
    .first()
    .getAttribute("href");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\?reason=signed-out$/);
  await signIn(page, testInfo);
  await page.goto(new URL(staleHref!, gameOrigin).href);
  await expect(
    page.getByRole("heading", { name: "This catalog item cannot be opened" }),
  ).toBeVisible();

  await signIn(page, testInfo, gameExpiryOrigin);
  await openActivity(page, "Activity");
  await page.getByRole("button", { name: "Play activity" }).click();
  await expect(
    page.getByRole("heading", { name: "Listen and choose" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login\?reason=expired$/, { timeout: 8_000 });
  await expect(page.locator("audio, video")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __activeGameObjectUrls: Set<string> })
            .__activeGameObjectUrls.size,
      ),
    )
    .toBe(0);
});
