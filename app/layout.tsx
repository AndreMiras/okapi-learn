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
    default: "Merriloop",
    template: "%s | Merriloop",
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
      <body>
        <a className="skip-link" href="#main-content">
          {shell.skipLink}
        </a>
        <header className="site-header">
          <Link className="wordmark" href="/" aria-label={shell.homeLabel}>
            <span aria-hidden="true" className="wordmark-mark">
              M
            </span>
            Merriloop
          </Link>
          <nav aria-label={shell.primaryNavigation}>
            <Link href="/about">{shell.about}</Link>
          </nav>
        </header>
        <main id="main-content">{children}</main>
        <footer className="site-footer">
          <p>{shell.nonAffiliation}</p>
        </footer>
      </body>
    </html>
  );
}
