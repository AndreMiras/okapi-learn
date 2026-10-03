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
    Math.random = () => 0.99;
    Object.defineProperty(window, "__gameAudioStarts", {
      value: 0,
      writable: true,
    });
    class ImmediateAudio {
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = "";

      load() {}
      pause() {}
      play() {
        (
          window as typeof window & { __gameAudioStarts: number }
        ).__gameAudioStarts += 1;
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

async function completePaint(page: Page, testInfo: TestInfo) {
  const playCount = () =>
    page.evaluate(
      () =>
        (window as typeof window & { __gameAudioStarts: number })
          .__gameAudioStarts,
    );
  await expect(
    page.getByRole("heading", { name: "Paint the picture" }),
  ).toBeVisible();
  await expect(
    page.getByText(/neutral control names do not describe/),
  ).toBeVisible();
  await expectNoSeriousA11yIssues(page);
  const activate = async (name: string) => {
    const button = page.getByRole("button", { name, exact: true });
    await expect(button).toBeEnabled();
    if (testInfo.project.use.isMobile) await button.tap();
    else await button.click();
  };
  await activate("Colour 2");
  await expect(page.getByText(/not the requested choice/)).toBeVisible();
  await expectNoSeriousA11yIssues(page);
  const correctColour = page.getByRole("button", { name: "Colour 1, area 1" });
  await correctColour.focus();
  const beforeColour = await playCount();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Choose where it goes", { exact: true }),
  ).toBeVisible();
  expect(await playCount()).toBe(beforeColour + 1);
  await expectNoSeriousA11yIssues(page);
  await activate("Target 2");
  await expect(page.getByText(/not the requested choice/)).toBeVisible();
  const correctTarget = page.getByRole("button", { name: "Target 1" });
  await correctTarget.focus();
  const beforeTarget = await playCount();
  await page.keyboard.press("Space");
  await expect(page.getByText("1 of 2 complete")).toBeVisible();
  await expect.poll(playCount).toBe(beforeTarget + 2); // Feedback, then the next target prompt.
  await expectNoSeriousA11yIssues(page);
  await activate("Replay prompt");
  await activate("Colour 2");
  const beforeFinalTarget = await playCount();
  await activate("Target 1"); // The first target is already solved; this button now represents the remaining target.
  await expect(
    page.getByRole("heading", { name: "Play complete" }),
  ).toBeVisible();
  expect(await playCount()).toBe(beforeFinalTarget + 1);
  await expect(page.getByRole("status").first()).toContainText("2 errors");
  await expectNoSeriousA11yIssues(page);
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
  await page.request.post("http://127.0.0.1:4400/__fixture__/reset");
});

test("renders an authorized alias-only map with accessible progression", async ({
  page,
}, testInfo) => {
  const packageRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/package")) {
      packageRequests.push(request.url());
    }
  });
  await signIn(page, testInfo);
  const artworkResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/game-map/sections/") &&
      response.status() === 200,
  );
  await page.getByRole("link", { name: /Game map/ }).click();
  await artworkResponse;

  await expect(
    page.getByRole("heading", { name: "Orbit game map" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Game 1, completed" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Game 2, available" }),
  ).toBeVisible();
  await expect(page.getByLabel("Game 3, locked")).toBeVisible();
  await expect(page.getByRole("link", { name: /Game 3/ })).toHaveCount(0);
  await expect(page.getByRole("listitem")).toHaveCount(3);
  const mapImages = page.getByRole("img", { name: /Map section/ });
  await expect(mapImages).toHaveCount(3);

  const mapUrl = page.url();
  expect(mapUrl).toMatch(
    /^http:\/\/localhost:3104\/learn\/[A-Za-z0-9_-]+\/games$/,
  );
  const imageSources = await mapImages.evaluateAll((images) =>
    images.map((image) => (image as HTMLImageElement).src),
  );
  for (const value of [mapUrl, ...imageSources]) {
    for (const forbidden of E2E_FORBIDDEN_BROWSER_VALUES) {
      expect(value).not.toContain(forbidden);
    }
  }
  expect(imageSources).toEqual(
    expect.arrayContaining([
      expect.stringMatching(
        /^http:\/\/localhost:3104\/api\/learn\/[A-Za-z0-9_-]+\/game-map\/sections\/[A-Za-z0-9_-]+\/artwork$/,
      ),
    ]),
  );

  const firstMarker = page.getByRole("link", { name: "Game 1, completed" });
  await firstMarker.focus();
  await expect(firstMarker).toBeFocused();
  const verticalFlow = await page.evaluate(() => {
    const key = document.querySelector<HTMLElement>(".game-map-key")!;
    const footer = document.querySelector<HTMLElement>("body > footer")!;
    return {
      footerTop: footer.getBoundingClientRect().top + window.scrollY,
      keyBottom: key.getBoundingClientRect().bottom + window.scrollY,
    };
  });
  expect(verticalFlow.footerTop).toBeGreaterThanOrEqual(verticalFlow.keyBottom);
  await expectNoSeriousA11yIssues(page);
  expect(packageRequests).toEqual([]);

  const ledgerResponse = await page.request.get(
    "http://127.0.0.1:4400/__fixture__/ledger",
  );
  const ledger = (await ledgerResponse.json()) as Array<{
    accepted: boolean;
    headerNames: string[];
    path: string;
  }>;
  expect(ledger.length).toBeGreaterThan(0);
  expect(ledger.every(({ accepted }) => accepted)).toBe(true);
  for (const entry of ledger) {
    expect(entry.path).toMatch(/^\/maps\/section-\d\.png$/);
    expect(entry.headerNames).not.toContain("authorization");
    expect(entry.headerNames).not.toContain("cookie");
    expect(entry.headerNames).not.toContain("referer");
  }
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
  await page.getByRole("button", { name: "Picture 2" }).click();
  await expect(
    page.getByRole("heading", { name: "Listen and choose" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Replay prompt" }).click();
  await page.getByRole("heading", { name: "Listen and choose" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Picture 1" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Listen and choose" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Picture 2" })).toBeFocused();
  await page.keyboard.press("Space");
  for (const label of [
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
  if (testInfo.project.use.isMobile) await comet.tap();
  else await comet.click();
  await expect(
    page.getByRole("heading", { name: "Explore the picture" }),
  ).toBeVisible();
  await expectNoSeriousA11yIssues(page);
  const star = page.getByRole("button", { name: "Hotspot 1" });
  await expect(star).toBeEnabled();
  if (testInfo.project.use.isMobile) await star.tap();
  else await star.click();
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

test("completes a standalone game, unlocks the next marker, and resets on reload", async ({
  page,
}, testInfo) => {
  const browserRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/package")) {
      browserRequests.push(request.url());
    }
  });

  await signIn(page, testInfo);
  await page.getByRole("link", { name: /Game map/ }).click();
  await expect(page.getByLabel("Game 3, locked")).toBeVisible();
  await page.getByRole("link", { name: "Game 2, available" }).click();
  await expect(page.getByRole("heading", { name: "Game 2" })).toBeVisible();
  const gamePageUrl = page.url();
  expect(gamePageUrl).toMatch(
    /^http:\/\/localhost:3104\/learn\/[A-Za-z0-9_-]+\/games\/[A-Za-z0-9_-]+$/,
  );
  for (const forbidden of E2E_FORBIDDEN_BROWSER_VALUES) {
    expect(gamePageUrl).not.toContain(forbidden);
  }
  await expect(page.getByText(/unlocks the next map game only/)).toBeVisible();
  await expectNoSeriousA11yIssues(page);
  await expectSuccessfulDelivery(page, () =>
    page.getByRole("button", { name: "Play activity" }).click(),
  );

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
  if (testInfo.project.use.isMobile) await comet.tap();
  else await comet.click();
  const star = page.getByRole("button", { name: "Hotspot 1" });
  await expect(star).toBeEnabled();
  if (testInfo.project.use.isMobile) await star.tap();
  else await star.click();
  await page.getByRole("button", { name: "Continue" }).click();
  await completePaint(page, testInfo);
  await expect(
    page.getByRole("heading", { name: "Play complete" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __activeGameObjectUrls: Set<string> })
            .__activeGameObjectUrls.size,
      ),
    )
    .toBe(0);
  await page.getByRole("button", { name: "Exit activity" }).click();

  await expect(
    page.getByRole("heading", { name: "Orbit game map" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Game 2, completed" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Game 3, available" }),
  ).toBeVisible();
  expect(browserRequests).toHaveLength(1);
  expect(browserRequests[0]).toMatch(
    /^http:\/\/localhost:3104\/api\/learn\/[A-Za-z0-9_-]+\/games\/[A-Za-z0-9_-]+\/package$/,
  );
  await expectNoGamePersistence(page);

  await page.reload();
  await expect(
    page.getByRole("link", { name: "Game 2, available" }),
  ).toBeVisible();
  await expect(page.getByLabel("Game 3, locked")).toBeVisible();
  await expect(page.getByRole("link", { name: /Game 3/ })).toHaveCount(0);
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
  const image = page.getByRole("button", { name: "Picture 1" }).locator("img");
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
  await expect(
    page.getByRole("heading", { name: "Nova's catalog" }),
  ).toBeVisible();
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
