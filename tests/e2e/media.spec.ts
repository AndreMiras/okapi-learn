import { FICTIONAL_PASSWORD } from "../fixtures/upstream";
import { expect, test, type Page, type TestInfo } from "./test";

const mediaAppOrigin = "http://localhost:3102";

async function loadResult(player: ReturnType<Page["locator"]>) {
  return player.evaluate(
    (media: HTMLMediaElement) =>
      new Promise<"canplay" | "error">((resolve) => {
        media.addEventListener("canplay", () => resolve("canplay"), {
          once: true,
        });
        media.addEventListener("error", () => resolve("error"), { once: true });
        media.load();
      }),
  );
}

async function signIn(page: Page, testInfo: TestInfo, origin = mediaAppOrigin) {
  const username = `flow-media-${testInfo.project.name}-${testInfo.workerIndex}-${testInfo.title.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}@example.test`;
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": username,
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("Email or username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(FICTIONAL_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: /Nova/ }).click();
  await page.setExtraHTTPHeaders({});
}

test("uses native controls without autoplay or persistent playback state", async ({
  page,
}, testInfo) => {
  await signIn(page, testInfo);
  await page.getByRole("link", { name: /Synthetic Tone/ }).click();
  const player = page.getByLabel("Audio player for Synthetic Tone");
  await expect(player).toHaveAttribute("controls", "");
  await expect(player).not.toHaveAttribute("autoplay", "");
  await player.evaluate(async (element: HTMLAudioElement) => {
    await element.play();
    element.pause();
    if (Number.isFinite(element.duration) && element.duration > 0.2) {
      element.currentTime = 0.1;
    }
  });
  await expect
    .poll(() => player.evaluate((media: HTMLAudioElement) => media.paused))
    .toBe(true);
  const persistence = await page.evaluate(async () => ({
    cacheKeys: "caches" in window ? await caches.keys() : [],
    local: localStorage.length,
    serviceWorker:
      "serviceWorker" in navigator
        ? await navigator.serviceWorker.getRegistration()
        : undefined,
    session: sessionStorage.length,
  }));
  expect(persistence).toEqual({
    cacheKeys: [],
    local: 0,
    serviceWorker: undefined,
    session: 0,
  });
  const catalogPath = (await page
    .getByRole("link", { name: /Back to catalog/ })
    .getAttribute("href"))!;
  await page.goto(new URL(catalogPath, mediaAppOrigin).href);
  await expect(player).toHaveCount(0);
  await page.getByRole("link", { name: /Synthetic Theatre/ }).click();
  await expect(
    page.getByLabel("Video player for Synthetic Theatre"),
  ).toHaveAttribute("controls", "");
});

test("handles protocol failures with one user-driven retry", async ({
  page,
}, testInfo) => {
  await signIn(page, testInfo);
  await page.getByRole("link", { name: /Expired fixture/ }).click();
  const expired = page.getByLabel("Audio player for Expired fixture");
  expect(await loadResult(expired)).toBe("error");
  await page.getByRole("button", { name: "Try playback again" }).click();
  expect(
    await loadResult(page.getByLabel("Audio player for Expired fixture")),
  ).toBe("error");

  const variants = [
    ["/media/ok.wav", 200],
    ["/media/ok.wav", 206, { Range: "bytes=0-31" }],
    ["/media/ok.wav", 416, { Range: "bytes=999999-" }],
    ["/media/octet-stream", 200],
    ["/media/no-ranges", 200],
    ["/media/truncated", 200],
    ["/media/unsupported", 200],
    ["/media/expired", 403],
    ["/media/redirect-allowed", 200],
    ["/media/redirect-disallowed", 200],
  ] as const;
  for (const [path, status, headers] of variants) {
    const response = await page.request.get(`http://127.0.0.1:4200${path}`, {
      headers,
    });
    expect(response.status()).toBe(status);
  }

  const catalogPath = (await page
    .getByRole("link", { name: /Back to catalog/ })
    .getAttribute("href"))!;
  for (const title of [
    "Octet stream fixture",
    "Allowed redirect fixture",
    "No range fixture",
    "Truncated fixture",
  ]) {
    await page.goto(new URL(catalogPath, mediaAppOrigin).href);
    await page.getByRole("link", { name: new RegExp(title) }).click();
    expect(await loadResult(page.getByLabel(`Audio player for ${title}`))).toBe(
      "canplay",
    );
  }
  for (const title of ["Unsupported fixture", "Disallowed redirect fixture"]) {
    await page.goto(new URL(catalogPath, mediaAppOrigin).href);
    await page.getByRole("link", { name: new RegExp(title) }).click();
    expect(await loadResult(page.getByLabel(`Audio player for ${title}`))).toBe(
      "error",
    );
  }
});

test("sends no private application data to the media origin", async ({
  page,
}, testInfo) => {
  await signIn(page, testInfo);
  await page.getByRole("link", { name: /Synthetic Tone/ }).click();
  await page
    .getByLabel("Audio player for Synthetic Tone")
    .evaluate(async (media: HTMLAudioElement) => {
      await media.play();
      media.pause();
    });
  const response = await page.request.get(
    "http://127.0.0.1:4200/__fixture__/ledger",
  );
  const ledger = (await response.json()) as Array<{
    cookiePresent: boolean;
    referrerPresent: boolean;
    upstreamAuthorizationPresent: boolean;
  }>;
  expect(ledger.length).toBeGreaterThan(0);
  for (const entry of ledger) {
    expect(entry).toMatchObject({
      cookiePresent: false,
      referrerPresent: false,
      upstreamAuthorizationPresent: false,
    });
  }
  const proxyAttempt = await page.request.get("/api/media/anything");
  expect(proxyAttempt.status()).toBe(404);
});

test("clears an open player when the absolute session expires", async ({
  page,
}, testInfo) => {
  await signIn(page, testInfo, "http://localhost:3103");
  await page.getByRole("link", { name: /Synthetic Tone/ }).click();
  await expect(
    page.getByLabel("Audio player for Synthetic Tone"),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login\?reason=expired$/, { timeout: 5_000 });
  await expect(page.locator("audio, video")).toHaveCount(0);
});
