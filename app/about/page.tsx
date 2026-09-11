import { englishMessages } from "@/lib/i18n/messages/en";
import { getMessages } from "@/lib/i18n/server";

export const metadata = { title: englishMessages.about.title };

export default function AboutPage() {
  const { about } = getMessages();
  return (
    <article className="article paper-panel">
      <p className="eyebrow">{about.eyebrow}</p>
      <h1>{about.heading}</h1>
      <p className="lede">{about.introduction}</p>
      <h2>{about.privacyHeading}</h2>
      <p>{about.privacyText}</p>
      <h2>{about.limitationsHeading}</h2>
      <p>{about.limitationsText}</p>
      <h2>{about.refreshHeading}</h2>
      <p>{about.refreshText}</p>
    </article>
  );
}
