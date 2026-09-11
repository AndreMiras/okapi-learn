import Link from "next/link";

import { getMessages } from "@/lib/i18n/server";

export default function HomePage() {
  const { home } = getMessages();
  return (
    <section className="hero paper-panel" aria-labelledby="welcome-heading">
      <div className="hero-copy">
        <p className="eyebrow">{home.eyebrow}</p>
        <h1 id="welcome-heading">{home.heading}</h1>
        <p className="lede">{home.introduction}</p>
        <div className="actions">
          <span
            className="button-disabled"
            aria-label={home.signInPendingLabel}
          >
            {home.signInPending}
          </span>
          <Link className="text-link" href="/about">
            {home.aboutLink}
          </Link>
        </div>
      </div>
      <div className="paper-theatre" aria-hidden="true">
        <div className="sun" />
        <div className="hill hill-back" />
        <div className="hill hill-front" />
        <div className="paper-star star-one">+</div>
        <div className="paper-star star-two">+</div>
      </div>
    </section>
  );
}
