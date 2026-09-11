import {
  expect,
  test as base,
  type Page,
  type TestInfo,
} from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, run) => {
    const externalOrigins = new Set<string>();
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
        externalOrigins.add(url.origin);
      }
    });
    await run(page);
    expect([...externalOrigins]).toEqual([]);
  },
});

export { expect };
export type { Page, TestInfo };
