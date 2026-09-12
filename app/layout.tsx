import "@fontsource-variable/fraunces/wght.css";
import "@fontsource/atkinson-hyperlegible-next/400.css";
import "@fontsource/atkinson-hyperlegible-next/700.css";
import "./globals.css";

import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { getMessages } from "@/lib/i18n/server";

export const metadata: Metadata = {
  description:
    "An independent web client for an authorized MyLocker learner catalog.",
  title: {
    default: "Okapi Learn",
    template: "%s | Okapi Learn",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#16324f",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const { shell } = getMessages();
  return (
    <html lang="en">
      <body className="min-h-screen min-w-80 bg-[#fff8e8] bg-[radial-gradient(#16324f14_0.75px,transparent_0.75px)] bg-[size:16px_16px] font-['Atkinson_Hyperlegible_Next',sans-serif] text-[1.0625rem] leading-[1.55] text-[#16324f]">
        <a
          className="fixed top-3 left-3 z-50 -translate-y-[200%] rounded-lg bg-[#16324f] px-4 py-3 text-[#fffdf7] focus:translate-y-0 focus:outline-3 focus:outline-offset-2 focus:outline-[#dd796f]"
          href="#main-content"
        >
          {shell.skipLink}
        </a>
        <header className="mx-auto flex min-h-20 w-[min(calc(100%-2rem),76rem)] items-center justify-between py-3 max-[420px]:min-h-18 max-[420px]:w-[min(calc(100%-1.25rem),76rem)]">
          <Link
            className="inline-flex items-center gap-3 font-['Fraunces_Variable',serif] text-[clamp(1.4rem,4vw,1.8rem)] font-bold no-underline focus-visible:rounded focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#dd796f]"
            href="/"
            aria-label={shell.homeLabel}
          >
            <span
              aria-hidden="true"
              className="grid size-10 -rotate-3 place-items-center rounded-[42%_58%_48%_52%] border-2 border-[#16324f] bg-[#f4b942] text-xl"
            >
              O
            </span>
            Okapi Learn
          </Link>
          <nav aria-label={shell.primaryNavigation}>
            <Link
              className="inline-flex min-h-11 items-center px-2 font-bold underline-offset-4 focus-visible:rounded focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#dd796f]"
              href="/about"
            >
              {shell.about}
            </Link>
          </nav>
        </header>
        <main
          className="mx-auto grid min-h-[calc(100vh-13rem)] w-[min(calc(100%-2rem),76rem)] items-center py-[clamp(1.5rem,5vw,4.5rem)] max-[420px]:w-[min(calc(100%-1.25rem),76rem)]"
          id="main-content"
        >
          {children}
        </main>
        <footer className="mx-auto w-[min(calc(100%-2rem),76rem)] border-t border-[#16324f26] pt-6 pb-8 text-sm max-[420px]:w-[min(calc(100%-1.25rem),76rem)]">
          <p className="m-0 max-w-3xl">{shell.nonAffiliation}</p>
        </footer>
      </body>
    </html>
  );
}
