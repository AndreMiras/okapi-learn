import { describe, expect, it } from "vitest";

import { extractValidatedArchive } from "@/lib/games/package/archive";
import { PACKAGE_LIMITS, type PackageLimits } from "@/lib/games/package/limits";
import { createGameZip, type GameZipEntry } from "@/tests/fixtures/games";

const signal = () => new AbortController().signal;
const jsonEntry = (name = "game.json", text = "{}") => ({ name, text });
const limits = (overrides: Partial<PackageLimits>): PackageLimits => ({
  ...PACKAGE_LIMITS,
  ...overrides,
});

async function rejects(
  entries: readonly GameZipEntry[],
  customLimits?: PackageLimits,
) {
  const bytes = await createGameZip(entries);
  await expect(
    extractValidatedArchive(bytes, signal(), customLimits),
  ).rejects.toMatchObject({ category: "unsupported" });
}

describe("extractValidatedArchive", () => {
  it("extracts allowed entries and ignores harmless directories", async () => {
    const bytes = await createGameZip([
      { name: "assets/", options: { directory: true } },
      jsonEntry(),
      { bytes: new Uint8Array([0x49, 0x44, 0x33]), name: "assets/cue.mp3" },
    ]);
    const files = await extractValidatedArchive(bytes, signal());
    expect([...files.keys()]).toEqual(["game.json", "assets/cue.mp3"]);
    expect(new TextDecoder().decode(files.get("game.json"))).toBe("{}");
  });

  it("rejects empty archives and response or entry-count limits", async () => {
    await rejects([]);
    const one = await createGameZip([jsonEntry()]);
    await expect(
      extractValidatedArchive(
        one,
        signal(),
        limits({ maximumResponseBytes: one.byteLength - 1 }),
      ),
    ).rejects.toMatchObject({ category: "unsupported" });
    await rejects(
      [jsonEntry(), jsonEntry("other.json")],
      limits({ maximumEntries: 1 }),
    );
  });

  it.each([
    "../game.json",
    "./game.json",
    "/game.json",
    "folder//game.json",
    "folder\\game.json",
    "C:game.json",
    "bad\u0000.json",
    "active.html",
    "archive.zip",
    "no-extension",
  ])("rejects unsafe or unsupported path %s", async (name) => {
    await rejects([jsonEntry(name)]);
  });

  it("rejects path byte and depth limits", async () => {
    await rejects(
      [jsonEntry("wide-name.json")],
      limits({ maximumPathBytes: 8 }),
    );
    await rejects(
      [jsonEntry("a/b/c/game.json")],
      limits({ maximumPathDepth: 3 }),
    );
  });

  it.each([
    ["case collisions", [jsonEntry("GAME.json"), jsonEntry("game.json")]],
    [
      "Unicode normalization collisions",
      [jsonEntry("cafe\u0301.json"), jsonEntry("caf\u00e9.json")],
    ],
    [
      "Unicode case-fold collisions",
      [jsonEntry("stra\u00dfe.json"), jsonEntry("STRASSE.json")],
    ],
  ] as const)("rejects %s", async (_name, entries) => {
    await rejects(entries);
  });

  it("enforces descriptor, entry, aggregate, and compression-ratio limits", async () => {
    await rejects(
      [jsonEntry("game.json", "12345")],
      limits({ maximumDescriptorBytes: 4 }),
    );
    await rejects(
      [{ bytes: new Uint8Array(5), name: "asset.mp3" }],
      limits({ maximumEntryBytes: 4 }),
    );
    await rejects(
      [jsonEntry("one.json", "123"), jsonEntry("two.json", "456")],
      limits({ maximumExpandedBytes: 5 }),
    );
    const compressed = await createGameZip(
      [{ name: "game.json", text: "a".repeat(2_000) }],
      { level: 9 },
    );
    await expect(
      extractValidatedArchive(
        compressed,
        signal(),
        limits({ maximumCompressionRatio: 2 }),
      ),
    ).rejects.toMatchObject({ category: "unsupported" });
  });

  it("rejects encrypted, executable, and ZIP64 entries", async () => {
    await rejects([{ ...jsonEntry(), options: { password: "fictional" } }]);
    await rejects([{ ...jsonEntry(), options: { executable: true } }]);
    await rejects([{ ...jsonEntry(), options: { zip64: true } }]);
  });

  it("rejects a classic archive marked as multidisk", async () => {
    const bytes = await createGameZip([jsonEntry()]);
    const view = new DataView(bytes);
    const end = bytes.byteLength - 22;
    view.setUint16(end + 4, 1, true);
    await expect(
      extractValidatedArchive(bytes, signal()),
    ).rejects.toMatchObject({
      category: "unsupported",
    });
  });

  it("rejects CRC corruption and local-header ambiguity", async () => {
    const crcBytes = await createGameZip([
      jsonEntry("game.json", "fictional-body"),
    ]);
    const crcData = new Uint8Array(crcBytes);
    const offset = crcData.findIndex(
      (value, index) =>
        value === 0x66 &&
        crcData[index + 1] === 0x69 &&
        crcData[index + 2] === 0x63,
    );
    expect(offset).toBeGreaterThan(0);
    crcData[offset] ^= 1;
    await expect(
      extractValidatedArchive(crcBytes, signal()),
    ).rejects.toMatchObject({
      category: "unsupported",
    });

    const ambiguous = await createGameZip([jsonEntry()]);
    const local = new Uint8Array(ambiguous);
    const filenameOffset = 30;
    expect(
      new TextDecoder().decode(
        local.subarray(filenameOffset, filenameOffset + 9),
      ),
    ).toBe("game.json");
    local[filenameOffset] = 0x47;
    await expect(
      extractValidatedArchive(ambiguous, signal()),
    ).rejects.toMatchObject({
      category: "unsupported",
    });
  });

  it("maps cancellation to the safe aborted category", async () => {
    const controller = new AbortController();
    controller.abort();
    const bytes = await createGameZip([jsonEntry()]);
    await expect(
      extractValidatedArchive(bytes, controller.signal),
    ).rejects.toMatchObject({
      category: "aborted",
    });
  });
});
