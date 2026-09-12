const CHANNEL = "merriloop-session";
const STORAGE_KEY = "merriloop-logout";

export function announceLogout() {
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage("logout");
    channel.close();
  }
  localStorage.setItem(STORAGE_KEY, `${Date.now()}:${crypto.randomUUID()}`);
}

export function subscribeToLogout(listener: () => void) {
  const channel =
    "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL) : null;
  const storage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  channel?.addEventListener("message", listener);
  window.addEventListener("storage", storage);
  const timestampText = localStorage.getItem(STORAGE_KEY)?.split(":", 1)[0];
  const timestamp = Number(timestampText);
  if (
    /^\d{1,16}$/.test(timestampText ?? "") &&
    timestamp >= performance.timeOrigin
  ) {
    queueMicrotask(listener);
  }
  return () => {
    channel?.removeEventListener("message", listener);
    channel?.close();
    window.removeEventListener("storage", storage);
  };
}
