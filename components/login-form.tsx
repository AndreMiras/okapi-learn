"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ErrorCode =
  | "account_unavailable"
  | "invalid_request"
  | "service_unavailable"
  | "sign_in_failed"
  | "terms_pending"
  | "try_later";

const errors: Record<ErrorCode, string> = {
  account_unavailable:
    "This account mode is not supported. Please use an official channel.",
  invalid_request: "Check both fields and try again.",
  service_unavailable:
    "Sign-in is temporarily unavailable. Please try again later.",
  sign_in_failed: "Sign-in was not accepted. Check your details and try again.",
  terms_pending:
    "Terms need attention. An adult must complete this through an official channel, then sign in again.",
  try_later: "Too many attempts. Please wait before trying again.",
};

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const submitting = useRef(false);
  const password = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/auth/login", {
        body: JSON.stringify({
          password: data.get("password"),
          username: data.get("username"),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (password.current) password.current.value = "";
      if (response.ok) {
        router.replace("/learners");
        router.refresh();
        return;
      }
      const payload: unknown = await response.json().catch(() => null);
      const code =
        payload && typeof payload === "object" && "error" in payload
          ? (payload as { error?: unknown }).error
          : null;
      setError(
        typeof code === "string" && code in errors
          ? errors[code as ErrorCode]
          : errors.service_unavailable,
      );
    } catch {
      if (password.current) password.current.value = "";
      setError(errors.service_unavailable);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form
      className="mt-8 grid max-w-lg gap-4"
      onSubmit={submit}
      aria-busy={pending}
    >
      <div className="grid gap-1.5">
        <label className="font-bold" htmlFor="username">
          Email or username
        </label>
        <input
          className="min-h-12.5 w-full rounded-lg border-2 border-[#16324f] bg-white px-3 py-2.5 text-[#16324f] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#dd796f]"
          autoComplete="username"
          id="username"
          maxLength={320}
          name="username"
          required
        />
      </div>
      <div className="grid gap-1.5">
        <label className="font-bold" htmlFor="password">
          Password
        </label>
        <div className="relative">
          <input
            className="min-h-12.5 w-full rounded-lg border-2 border-[#16324f] bg-white py-2.5 pr-20 pl-3 text-[#16324f] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#dd796f]"
            autoComplete="current-password"
            id="password"
            maxLength={1024}
            name="password"
            ref={password}
            required
            type={showPassword ? "text" : "password"}
          />
          <button
            aria-pressed={showPassword}
            className="absolute inset-y-[3px] right-[3px] min-w-17 cursor-pointer rounded-md border-0 border-l border-[#16324f26] bg-[#fff8e8] font-bold focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#dd796f]"
            onClick={() => setShowPassword((visible) => !visible)}
            type="button"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      <div className="min-h-7 font-bold text-[#7d302b]" aria-live="polite">
        {error}
      </div>
      <button
        className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-[#16324f] bg-[#f4b942] px-4 py-3 font-bold text-[#16324f] shadow-[4px_4px_0_#16324f] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#dd796f] disabled:cursor-wait disabled:opacity-65"
        disabled={pending}
        type="submit"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
