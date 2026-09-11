import Link from "next/link";

import { LogoutButton } from "./logout-button";

export function ProtectedTools() {
  return (
    <aside
      className="flex items-center justify-between gap-6 border-t border-[#16324f26] pt-5 text-sm max-md:flex-col max-md:items-start"
      aria-label="Adult utilities"
    >
      <p className="m-0">
        Need fresh catalog data? Sign out, then sign in again to refresh.
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Link
          className="min-h-11 py-2 font-bold underline-offset-4 focus-visible:rounded focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#dd796f]"
          href="/learners"
        >
          Switch learner
        </Link>
        <Link
          className="min-h-11 py-2 font-bold underline-offset-4 focus-visible:rounded focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#dd796f]"
          href="/about"
        >
          About
        </Link>
        <LogoutButton />
      </div>
    </aside>
  );
}
