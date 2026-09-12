import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { announceLogout, subscribeToLogout } from "@/lib/session/client-events";

const storageKey = "merriloop-logout";

class FakeStorage {
  readonly values = new Map<string, string>();
  readonly removeItem = vi.fn((key: string) => this.values.delete(key));
  readonly setItem = vi.fn((key: string, value: string) => {
    this.values.set(key, value);
  });

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
}

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];

  readonly addEventListener = vi.fn(
    (_type: string, listener: EventListenerOrEventListenerObject) => {
      this.listener = listener;
    },
  );
  readonly close = vi.fn();
  readonly postMessage = vi.fn();
  readonly removeEventListener = vi.fn();
  listener?: EventListenerOrEventListenerObject;

  constructor(readonly name: string) {
    FakeBroadcastChannel.instances.push(this);
  }
}

describe("client logout events", () => {
  let storage: FakeStorage;
  let storageListener: ((event: StorageEvent) => void) | undefined;
  const removeEventListener = vi.fn();

  beforeEach(() => {
    storage = new FakeStorage();
    storageListener = undefined;
    FakeBroadcastChannel.instances = [];
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("performance", { timeOrigin: 1_000 });
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
        .mockReturnValueOnce("00000000-0000-4000-8000-000000000002"),
    });
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    vi.stubGlobal("window", {
      BroadcastChannel: FakeBroadcastChannel,
      addEventListener: vi.fn(
        (type: string, listener: (event: StorageEvent) => void) => {
          if (type === "storage") storageListener = listener;
        },
      ),
      removeEventListener,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("retains a unique timestamped marker for every logout", () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(2_000).mockReturnValueOnce(2_001);

    announceLogout();
    expect(storage.getItem(storageKey)).toBe(
      "2000:00000000-0000-4000-8000-000000000001",
    );
    announceLogout();
    expect(storage.getItem(storageKey)).toBe(
      "2001:00000000-0000-4000-8000-000000000002",
    );
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it("handles only storage events for the logout key", () => {
    const listener = vi.fn();
    subscribeToLogout(listener);

    storageListener?.({ key: "unrelated" } as StorageEvent);
    expect(listener).not.toHaveBeenCalled();
    storageListener?.({ key: storageKey } as StorageEvent);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("notifies a late subscriber for a marker newer than the document", async () => {
    storage.values.set(storageKey, "1001:recent");
    const listener = vi.fn();

    subscribeToLogout(listener);
    await Promise.resolve();

    expect(listener).toHaveBeenCalledOnce();
  });

  it.each([
    "malformed",
    "Infinity:id",
    "0x3e9:hex",
    "1e3:exponential",
    "1001.5:decimal",
    "999:old",
  ])("ignores retained marker %s", async (marker) => {
    storage.values.set(storageKey, marker);
    const listener = vi.fn();

    subscribeToLogout(listener);
    await Promise.resolve();

    expect(listener).not.toHaveBeenCalled();
  });

  it("broadcasts logout and cleans up all listeners", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToLogout(listener);
    const subscription = FakeBroadcastChannel.instances[0]!;

    expect(subscription.name).toBe("merriloop-session");
    expect(subscription.addEventListener).toHaveBeenCalledWith(
      "message",
      listener,
    );
    unsubscribe();
    expect(subscription.removeEventListener).toHaveBeenCalledWith(
      "message",
      listener,
    );
    expect(subscription.close).toHaveBeenCalledOnce();
    expect(removeEventListener).toHaveBeenCalledWith(
      "storage",
      expect.any(Function),
    );

    announceLogout();
    const announcement = FakeBroadcastChannel.instances[1]!;
    expect(announcement.postMessage).toHaveBeenCalledWith("logout");
    expect(announcement.close).toHaveBeenCalledOnce();
  });
});
