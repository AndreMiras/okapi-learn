import { deflateSync } from "node:zlib";

import {
  TextReader,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipWriter,
  type ZipWriterAddDataOptions,
  type ZipWriterConstructorOptions,
} from "@zip.js/zip.js";

export type GameZipEntry = Readonly<{
  bytes?: Uint8Array<ArrayBuffer>;
  name: string;
  options?: ZipWriterAddDataOptions;
  text?: string;
}>;

const encoder = new TextEncoder();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function join(parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(
    parts.reduce((total, part) => total + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const typeBytes = encoder.encode(type);
  const result = new Uint8Array(data.byteLength + 12);
  const view = new DataView(result.buffer);
  view.setUint32(0, data.byteLength);
  result.set(typeBytes, 4);
  result.set(data, 8);
  view.setUint32(data.byteLength + 8, crc32(join([typeBytes, data])));
  return result;
}

export function createPng(
  width = 8,
  height = 6,
  rgba: readonly [number, number, number, number] = [51, 102, 153, 255],
): Uint8Array<ArrayBuffer> {
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header[8] = 8;
  header[9] = 6;
  const scanlines = new Uint8Array(height * (1 + width * 4));
  for (let row = 0; row < height; row += 1) {
    const rowStart = row * (1 + width * 4);
    scanlines[rowStart] = 0;
    for (let column = 0; column < width; column += 1) {
      const pixel = rowStart + 1 + column * 4;
      scanlines.set(rgba, pixel);
    }
  }
  const compressed = new Uint8Array(deflateSync(scanlines));
  return join([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", new Uint8Array()),
  ]);
}

export function createIndexedPng(
  width = 8,
  height = 6,
): Uint8Array<ArrayBuffer> {
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header[8] = 1;
  header[9] = 3;
  const rowBytes = Math.ceil(width / 8);
  const scanlines = new Uint8Array(height * (1 + rowBytes));
  for (let row = 0; row < height; row += 1) {
    const rowStart = row * (1 + rowBytes);
    scanlines[rowStart] = 0;
    for (let column = 0; column < width; column += 1) {
      if ((row + column) % 2 === 0) {
        scanlines[rowStart + 1 + Math.floor(column / 8)]! |=
          1 << (7 - (column % 8));
      }
    }
  }
  return join([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("PLTE", new Uint8Array([42, 75, 110, 238, 178, 74])),
    pngChunk("IDAT", new Uint8Array(deflateSync(scanlines))),
    pngChunk("IEND", new Uint8Array()),
  ]);
}

export const FICTIONAL_MP3 = new Uint8Array([
  0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

export const FICTIONAL_M4A = new Uint8Array([
  0x00, 0x00, 0x00, 0x10, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20, 0x00,
  0x00, 0x00, 0x00,
]);

const common = (id: string, name: string) => ({
  errorSound: [],
  finalSound: [],
  id,
  initialSound: [],
  name,
  okSound: [],
  rgb: "#336699",
  textureImage: null,
});

function element(id: string, name: string, image: string, prompt = false) {
  return {
    Id: id,
    Name: name,
    errorSound: [],
    frames: [],
    image,
    initialSound: prompt ? ["audio/prompt.mp3"] : [],
    okSound: [],
  };
}

export function createFictionalDescriptors(): Record<string, unknown> {
  const allSelectable = [
    element("answer-a", "Amber kite", "images/amber.png", true),
    element("answer-b", "Blue drum", "images/blue.png", true),
    element("answer-c", "Coral boat", "images/coral.png", true),
    element("answer-d", "Daisy bell", "images/daisy.png", true),
  ];
  const oneSelectable = [
    element("target", "Green comet", "images/green.png", true),
  ];
  const fuzzy = [
    element("fuzzy-a", "Orange moon", "images/orange.png"),
    element("fuzzy-b", "Purple cup", "images/purple.png"),
    element("fuzzy-c", "Silver leaf", "images/silver.png"),
  ];
  return {
    "game.json": {
      book: false,
      dynamics: [
        { id: "listen-all", json: "dynamics/listen-all.json", type: "LISTEN" },
        {
          id: "listen-fuzzy",
          json: "dynamics/listen-fuzzy.json",
          type: "LISTEN",
        },
        { id: "explore", json: "dynamics/explore.json", type: "EXPLORE" },
        { id: "wildcard", json: "dynamics/wildcard.json", type: "WILDCARD" },
      ],
      id: "fictional-package",
      name: "Fictional sky journey",
    },
    "dynamics/explore.json": {
      ...common("explore", "Find the bright star"),
      backgroundImage: "images/background.png",
      counter: null,
      elements: [
        {
          ...element("star", "Bright star", "images/star.png", true),
          frames: [{ x1: 1, x2: 4, y1: 1, y2: 4 }],
        },
      ],
      listen: true,
      newCounter: {},
    },
    "dynamics/listen-all.json": {
      ...common("listen-all", "Choose each picture"),
      fuzzyElements: [],
      fuzzyElementsCount: 0,
      random: false,
      selectableElements: allSelectable,
      selectableElementsCount: allSelectable.length,
    },
    "dynamics/listen-fuzzy.json": {
      ...common("listen-fuzzy", "Find the green comet"),
      fuzzyElements: fuzzy,
      fuzzyElementsCount: fuzzy.length,
      random: true,
      selectableElements: oneSelectable,
      selectableElementsCount: oneSelectable.length,
    },
    "dynamics/wildcard.json": {
      ...common("wildcard", "Cloud break"),
      automatic: false,
      backgroundImage: "images/background.png",
      initialSound: ["audio/transition.m4a"],
      nextImage: null,
      position: 0,
      speaker: true,
      waitSeconds: 2,
    },
  };
}

export function createUnnamedFictionalDescriptors(): Record<string, unknown> {
  const descriptors = structuredClone(createFictionalDescriptors()) as Record<
    string,
    any
  >;
  for (const path of [
    "dynamics/listen-all.json",
    "dynamics/listen-fuzzy.json",
  ]) {
    for (const item of [
      ...descriptors[path].selectableElements,
      ...descriptors[path].fuzzyElements,
    ]) {
      delete item.Name;
    }
  }
  for (const item of descriptors["dynamics/explore.json"].elements) {
    delete item.Name;
  }
  return descriptors;
}

export function createMixedNameFictionalDescriptors(): Record<string, unknown> {
  const descriptors = structuredClone(createFictionalDescriptors()) as Record<
    string,
    any
  >;
  const listenAll = descriptors["dynamics/listen-all.json"].selectableElements;
  delete listenAll[0].Name;
  listenAll[1].Name = "";
  listenAll[2].Name = "Shared picture";
  listenAll[3].Name = "Shared picture";

  const listenFuzzy = descriptors["dynamics/listen-fuzzy.json"];
  for (const item of listenFuzzy.fuzzyElements) delete item.Name;
  // Keep one useful name so the shuffled single-target stage remains locatable.
  listenFuzzy.selectableElements[0].Name = "Green comet";
  delete descriptors["dynamics/explore.json"].elements[0].Name;
  return descriptors;
}

export function createFictionalGameEntries(
  descriptors: Record<string, unknown> = createFictionalDescriptors(),
): GameZipEntry[] {
  const imageNames = [
    "amber",
    "background",
    "blue",
    "coral",
    "daisy",
    "green",
    "orange",
    "purple",
    "silver",
    "star",
  ];
  return [
    ...Object.entries(descriptors).map(([name, value]) => ({
      name,
      text: JSON.stringify(value),
    })),
    ...imageNames.map((name, index) => ({
      bytes:
        name === "amber"
          ? createIndexedPng()
          : createPng(8, 6, [
              (55 + index * 37) % 220,
              (95 + index * 53) % 220,
              (135 + index * 29) % 220,
              255,
            ]),
      name: `images/${name}.png`,
    })),
    { bytes: FICTIONAL_MP3, name: "audio/prompt.mp3" },
    { bytes: FICTIONAL_M4A, name: "audio/transition.m4a" },
  ];
}

export async function createGameZip(
  entries: readonly GameZipEntry[],
  options: ZipWriterConstructorOptions = {},
): Promise<ArrayBuffer> {
  const writer = new ZipWriter(new Uint8ArrayWriter(), {
    level: 0,
    useWebWorkers: false,
    ...options,
  });
  for (const entry of entries) {
    const reader =
      entry.text === undefined
        ? new Uint8ArrayReader(entry.bytes ?? new Uint8Array())
        : new TextReader(entry.text);
    await writer.add(entry.name, reader, {
      lastModDate: new Date("2026-01-01T00:00:00.000Z"),
      useWebWorkers: false,
      ...entry.options,
    });
  }
  const bytes = await writer.close();
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

export async function createFictionalGameZip(): Promise<ArrayBuffer> {
  return createGameZip(createFictionalGameEntries());
}

export async function createUnnamedFictionalGameZip(): Promise<ArrayBuffer> {
  return createGameZip(
    createFictionalGameEntries(createUnnamedFictionalDescriptors()),
  );
}

export async function createMixedNameFictionalGameZip(): Promise<ArrayBuffer> {
  return createGameZip(
    createFictionalGameEntries(createMixedNameFictionalDescriptors()),
  );
}
