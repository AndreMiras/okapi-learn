import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prepareGamePackage } from "@/lib/games/package/preflight";
import {
  createFictionalDescriptors,
  createFictionalGameEntries,
  createFictionalGameZip,
  createGameZip,
  createPng,
} from "@/tests/fixtures/games";

const signal = () => new AbortController().signal;

function descriptors(): Record<string, any> {
  return structuredClone(createFictionalDescriptors());
}

async function prepare(source = descriptors()) {
  return prepareGamePackage(
    await createGameZip(createFictionalGameEntries(source)),
    signal(),
  );
}

async function rejects(
  source: Record<string, unknown>,
  category: "inaccessible" | "unsupported" = "unsupported",
) {
  await expect(prepare(source)).rejects.toMatchObject({
    category,
  });
}

describe("prepareGamePackage", () => {
  const close = vi.fn();
  const createObjectURL = vi.fn(() => "blob:fictional-object");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    close.mockClear();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ close, height: 6, width: 8 })),
    );
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("atomically prepares all three types and both observed LISTEN variants", async () => {
    const prepared = await prepareGamePackage(
      await createFictionalGameZip(),
      signal(),
    );
    expect(prepared.game).toMatchObject({
      book: false,
      id: "fictional-package",
      name: "Fictional sky journey",
    });
    expect(prepared.game.dynamics.map(({ type }) => type)).toEqual([
      "LISTEN",
      "LISTEN",
      "EXPLORE",
      "WILDCARD",
    ]);
    expect(prepared.game.dynamics[0]).toMatchObject({
      fuzzyElements: [],
      selectableElements: { length: 4 },
    });
    expect(prepared.game.dynamics[1]).toMatchObject({
      fuzzyElements: { length: 3 },
      selectableElements: { length: 1 },
    });
    expect(prepared.game.dynamics[2]).toMatchObject({
      backgroundHeight: 6,
      backgroundWidth: 8,
    });
    expect(close).toHaveBeenCalledTimes(10);
    expect(createObjectURL).not.toHaveBeenCalled();

    expect(prepared.assets.getUrl("audio/prompt.mp3")).toBe(
      "blob:fictional-object",
    );
    expect(prepared.assets.getUrl("audio/prompt.mp3")).toBe(
      "blob:fictional-object",
    );
    expect(createObjectURL).toHaveBeenCalledOnce();
    prepared.assets.dispose();
    prepared.assets.dispose();
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    expect(() => prepared.assets.getUrl("audio/prompt.mp3")).toThrowError(
      "unsupported",
    );
  });

  it.each([
    [
      "book packages",
      (value: any) => {
        value["game.json"].book = true;
      },
    ],
    [
      "unsupported types",
      (value: any) => {
        value["game.json"].dynamics[0].type = "BOARD";
      },
    ],
    [
      "duplicate dynamic IDs",
      (value: any) => {
        value["game.json"].dynamics[1].id = "listen-all";
      },
    ],
    [
      "duplicate descriptor references",
      (value: any) => {
        value["game.json"].dynamics[1].json = "dynamics/listen-all.json";
      },
    ],
    [
      "descriptor ID mismatch",
      (value: any) => {
        value["dynamics/listen-all.json"].id = "other";
      },
    ],
    [
      "empty package names",
      (value: any) => {
        value["game.json"].name = "  ";
      },
    ],
    [
      "control characters",
      (value: any) => {
        value["dynamics/listen-all.json"].selectableElements[0].Name =
          "Amber\nKite";
      },
    ],
    [
      "empty labels",
      (value: any) => {
        value["dynamics/listen-all.json"].selectableElements[0].Name = "";
      },
    ],
    [
      "duplicate labels",
      (value: any) => {
        value["dynamics/listen-all.json"].selectableElements[1].Name =
          "AMBER KITE";
      },
    ],
    [
      "Unicode-folded duplicate labels",
      (value: any) => {
        value["dynamics/listen-all.json"].selectableElements[0].Name =
          "Stra\u00dfe";
        value["dynamics/listen-all.json"].selectableElements[1].Name =
          "STRASSE";
      },
    ],
    [
      "duplicate element IDs",
      (value: any) => {
        value["dynamics/listen-all.json"].selectableElements[1].Id = "answer-a";
      },
    ],
    [
      "LISTEN count mismatches",
      (value: any) => {
        value["dynamics/listen-all.json"].selectableElementsCount = 3;
      },
    ],
    [
      "LISTEN targets without prompts",
      (value: any) => {
        value["dynamics/listen-all.json"].selectableElements[0].initialSound =
          [];
      },
    ],
    [
      "active EXPLORE counters",
      (value: any) => {
        value["dynamics/explore.json"].counter = { active: true };
      },
    ],
    [
      "invalid EXPLORE frame order",
      (value: any) => {
        value["dynamics/explore.json"].elements[0].frames[0].x2 = 1;
      },
    ],
    [
      "out-of-bounds EXPLORE frames",
      (value: any) => {
        value["dynamics/explore.json"].elements[0].frames[0].x2 = 9;
      },
    ],
    [
      "unbounded wildcard waits",
      (value: any) => {
        value["dynamics/wildcard.json"].waitSeconds = 31;
      },
    ],
    [
      "invalid colors",
      (value: any) => {
        value["dynamics/wildcard.json"].rgb = "red";
      },
    ],
    [
      "wrong field kinds",
      (value: any) => {
        value["dynamics/wildcard.json"].automatic = "yes";
      },
    ],
    [
      "empty dynamic lists",
      (value: any) => {
        value["game.json"].dynamics = [];
      },
    ],
    [
      "too many dynamics",
      (value: any) => {
        value["game.json"].dynamics = Array.from({ length: 65 }, () => ({}));
      },
    ],
    [
      "too few LISTEN choices",
      (value: any) => {
        const dynamic = value["dynamics/listen-all.json"];
        dynamic.selectableElements = dynamic.selectableElements.slice(0, 1);
        dynamic.selectableElementsCount = 1;
      },
    ],
    [
      "too many EXPLORE elements",
      (value: any) => {
        value["dynamics/explore.json"].elements = Array.from(
          { length: 33 },
          () => ({}),
        );
      },
    ],
    [
      "too many frames",
      (value: any) => {
        value["dynamics/explore.json"].elements[0].frames = Array.from(
          { length: 33 },
          () => ({}),
        );
      },
    ],
    [
      "too many audio references",
      (value: any) => {
        value["dynamics/wildcard.json"].initialSound = Array.from(
          { length: 17 },
          () => "audio/transition.m4a",
        );
      },
    ],
    [
      "oversized labels",
      (value: any) => {
        value["dynamics/listen-all.json"].selectableElements[0].Name =
          "a".repeat(201);
      },
    ],
    [
      "oversized names",
      (value: any) => {
        value["dynamics/wildcard.json"].name = "a".repeat(501);
      },
    ],
    [
      "negative frame coordinates",
      (value: any) => {
        value["dynamics/explore.json"].elements[0].frames[0].x1 = -1;
      },
    ],
    [
      "fuzzy count mismatches",
      (value: any) => {
        value["dynamics/listen-fuzzy.json"].fuzzyElementsCount = 2;
      },
    ],
  ] as const)("rejects %s", async (name, mutate) => {
    const value = descriptors();
    mutate(value);
    await rejects(
      value,
      [
        "control characters",
        "duplicate labels",
        "empty labels",
        "oversized labels",
        "Unicode-folded duplicate labels",
      ].includes(name)
        ? "inaccessible"
        : "unsupported",
    );
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("rejects missing descriptors and assets", async () => {
    const missingDescriptor = descriptors();
    delete missingDescriptor["dynamics/listen-all.json"];
    await rejects(missingDescriptor);

    const entries = createFictionalGameEntries().filter(
      ({ name }) => name !== "images/star.png",
    );
    await expect(
      prepareGamePackage(await createGameZip(entries), signal()),
    ).rejects.toMatchObject({
      category: "unsupported",
    });
  });

  it("rejects malformed UTF-8 and JSON descriptors", async () => {
    const entries = createFictionalGameEntries().filter(
      ({ name }) => name !== "game.json",
    );
    await expect(
      prepareGamePackage(
        await createGameZip([
          { bytes: new Uint8Array([0xc3, 0x28]), name: "game.json" },
          ...entries,
        ]),
        signal(),
      ),
    ).rejects.toMatchObject({ category: "unsupported" });

    await expect(
      prepareGamePackage(
        await createGameZip([{ name: "game.json", text: "{" }, ...entries]),
        signal(),
      ),
    ).rejects.toMatchObject({ category: "unsupported" });
  });

  it("rejects excessive JSON depth and node count", async () => {
    const deep = descriptors();
    let nested: any = deep["game.json"];
    for (let index = 0; index < 18; index += 1) nested.extra = nested = {};
    await rejects(deep);

    const wide = descriptors();
    wide["game.json"].extra = Array.from({ length: 128 }, () =>
      Array.from({ length: 128 }, () => [null]),
    );
    await rejects(wide);
  });

  it("rejects orphan files, duplicate root descriptors, and active content", async () => {
    const base = createFictionalGameEntries();
    for (const extra of [
      { name: "orphan.json", text: "{}" },
      { name: "nested/game.json", text: "{}" },
      { name: "active.svg", text: "<svg/>" },
    ]) {
      await expect(
        prepareGamePackage(await createGameZip([...base, extra]), signal()),
      ).rejects.toMatchObject({ category: "unsupported" });
    }
  });

  it("rejects wrong asset signatures and failed PNG decode without Blob URLs", async () => {
    const entries = createFictionalGameEntries().map((entry) =>
      entry.name === "audio/prompt.mp3"
        ? { ...entry, bytes: new Uint8Array([1, 2, 3, 4]) }
        : entry,
    );
    await expect(
      prepareGamePackage(await createGameZip(entries), signal()),
    ).rejects.toMatchObject({ category: "unsupported" });

    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("decode");
      }),
    );
    await expect(
      prepareGamePackage(await createFictionalGameZip(), signal()),
    ).rejects.toMatchObject({ category: "unsupported" });
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it.each([
    ["M4A", "audio/transition.m4a", new Uint8Array(16)],
    ["PNG", "images/star.png", new Uint8Array(48)],
  ] as const)("rejects an invalid %s signature", async (_kind, name, bytes) => {
    const entries = createFictionalGameEntries().map((entry) =>
      entry.name === name ? { ...entry, bytes } : entry,
    );
    await expect(
      prepareGamePackage(await createGameZip(entries), signal()),
    ).rejects.toMatchObject({ category: "unsupported" });
  });

  it("accepts MPEG frame audio and automatic WILDCARD optional assets", async () => {
    const source = descriptors();
    source["dynamics/wildcard.json"].automatic = true;
    source["dynamics/wildcard.json"].nextImage = "images/star.png";
    source["dynamics/wildcard.json"].position = -100;
    source["dynamics/wildcard.json"].rgb = null;
    const entries = createFictionalGameEntries(source).map((entry) =>
      entry.name === "audio/prompt.mp3"
        ? { ...entry, bytes: new Uint8Array([0xff, 0xfb, 0x90, 0x64]) }
        : entry,
    );
    const prepared = await prepareGamePackage(
      await createGameZip(entries),
      signal(),
    );
    expect(prepared.game.dynamics[3]).toMatchObject({
      automatic: true,
      nextImage: "images/star.png",
      position: -100,
      rgb: null,
    });
    prepared.assets.dispose();
  });

  it("fails closed when image decoding is unavailable or reports wrong dimensions", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    await expect(
      prepareGamePackage(await createFictionalGameZip(), signal()),
    ).rejects.toMatchObject({ category: "unsupported" });

    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ close, height: 7, width: 8 })),
    );
    await expect(
      prepareGamePackage(await createFictionalGameZip(), signal()),
    ).rejects.toMatchObject({ category: "unsupported" });
    expect(close).toHaveBeenCalled();
  });

  it.each([
    ["zero dimensions", createPng(0, 1)],
    ["excessive dimensions", createPng(8_193, 1)],
  ] as const)("rejects PNG %s", async (_name, png) => {
    const entries = createFictionalGameEntries().map((entry) =>
      entry.name === "images/star.png" ? { ...entry, bytes: png } : entry,
    );
    await expect(
      prepareGamePackage(await createGameZip(entries), signal()),
    ).rejects.toMatchObject({ category: "unsupported" });
  });

  it("maps aborts safely and creates no object URLs", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      prepareGamePackage(await createFictionalGameZip(), controller.signal),
    ).rejects.toMatchObject({ category: "aborted" });
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
