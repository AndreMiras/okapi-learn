import { expect, test } from "@playwright/test";

test("renders the shell without external or tracking requests", async ({
  page,
}) => {
  const externalRequests: string[] = [];
  const consoleErrors: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1") externalRequests.push(url.origin);
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  const response = await page.request.get("/");
  expect(response.headers()["content-security-policy"]).toContain("'nonce-");
  expect(response.headers()["strict-transport-security"]).toContain(
    "max-age=31536000",
  );
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "quiet place",
  );
  await expect(page.getByText("independent, unofficial client")).toBeVisible();
  await page.getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/about$/);
  expect(externalRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("exposes the privacy and limitations page", async ({ page }) => {
  await page.goto("/about");
  await expect(
    page.getByRole("heading", { name: "Independent by design" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Known limitations" }),
  ).toBeVisible();
});
