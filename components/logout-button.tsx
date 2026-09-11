"use client";

import { useEffect, useState } from "react";

const CHANNEL = "merriloop-session";
const STORAGE_KEY = "merriloop-logout";

function announceLogout() {
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage("logout");
    channel.close();
  }
  localStorage.setItem(STORAGE_KEY, String(Date.now()));
  localStorage.removeItem(STORAGE_KEY);
}

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const channel =
      "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL) : null;
    const leave = () => window.location.replace("/login?reason=signed-out");
    channel?.addEventListener("message", leave);
    const storage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) leave();
    };
    window.addEventListener("storage", storage);
    return () => {
      channel?.removeEventListener("message", leave);
      channel?.close();
      window.removeEventListener("storage", storage);
    };
  }, []);

  async function signOut() {
    if (pending) return;
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      announceLogout();
      window.location.replace("/login?reason=signed-out");
    }
  }

  return (
    <button
      className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 border-[#16324f] bg-[#fffdf7] px-3 py-2 font-bold text-[#16324f] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#dd796f] disabled:cursor-wait disabled:opacity-65"
      disabled={pending}
      onClick={signOut}
      type="button"
    >
      {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}
