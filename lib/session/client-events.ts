const CHANNEL = "merriloop-session";
const STORAGE_KEY = "merriloop-logout";

export function announceLogout() {
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage("logout");
    channel.close();
  }
  localStorage.setItem(STORAGE_KEY, String(Date.now()));
  localStorage.removeItem(STORAGE_KEY);
}

export function subscribeToLogout(listener: () => void) {
  const channel =
    "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL) : null;
  const storage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  channel?.addEventListener("message", listener);
  window.addEventListener("storage", storage);
  return () => {
    channel?.removeEventListener("message", listener);
    channel?.close();
    window.removeEventListener("storage", storage);
  };
}
