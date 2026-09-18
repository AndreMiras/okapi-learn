import { type APIResponse } from "@playwright/test";

import { expect, test } from "./test";

const unreadyOrigin = "http://localhost:3106";
const unreadySecret = "a-fictional-e2e-unready-secret-long-enough";

async function expectJsonResponse(
  response: APIResponse,
  body: { status: string },
) {
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["content-type"]).toContain("application/json");
  expect(await response.json()).toEqual(body);
}

test("keeps liveness independent from readiness store configuration", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Operational HTTP contracts are browser-engine independent",
  );

  await expectJsonResponse(await page.request.get("/api/health"), {
    status: "ok",
  });
  await expectJsonResponse(await page.request.get("/api/ready"), {
    status: "ready",
  });
  await expectJsonResponse(
    await page.request.get(`${unreadyOrigin}/api/health`),
    { status: "ok" },
  );

  const unready = await page.request.get(`${unreadyOrigin}/api/ready`);
  expect(unready.status()).toBe(500);
  const errorBody = await unready.text();
  expect(errorBody).not.toContain("VERCEL");
  expect(errorBody).not.toContain(unreadySecret);
});
