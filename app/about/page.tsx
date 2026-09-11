import { englishMessages } from "@/lib/i18n/messages/en";
import { getMessages } from "@/lib/i18n/server";

export const metadata = { title: englishMessages.about.title };

export default function AboutPage() {
  const { about } = getMessages();
  return (
    <article className="relative max-w-4xl overflow-hidden rounded-[clamp(1rem,4vw,2rem)] border border-[#16324f26] bg-[#fffdf7] p-[clamp(1.5rem,6vw,4.5rem)] shadow-[0_18px_50px_#16324f18] max-[420px]:p-5">
      <p className="mb-3 text-xs font-bold tracking-[0.14em] text-[#8a403b] uppercase">
        {about.eyebrow}
      </p>
      <h1 className="m-0 max-w-3xl font-['Fraunces_Variable',serif] text-[clamp(2.5rem,7vw,4.8rem)] leading-[1.05] tracking-[-0.045em]">
        {about.heading}
      </h1>
      <p className="mt-6 max-w-3xl text-[clamp(1.1rem,2vw,1.3rem)]">
        {about.introduction}
      </p>
      <h2 className="mt-9 mb-2 font-['Fraunces_Variable',serif] text-[clamp(1.5rem,4vw,2rem)] leading-[1.05]">
        {about.privacyHeading}
      </h2>
      <p className="max-w-3xl">{about.privacyText}</p>
      <h2 className="mt-9 mb-2 font-['Fraunces_Variable',serif] text-[clamp(1.5rem,4vw,2rem)] leading-[1.05]">
        {about.limitationsHeading}
      </h2>
      <p className="max-w-3xl">{about.limitationsText}</p>
      <h2 className="mt-9 mb-2 font-['Fraunces_Variable',serif] text-[clamp(1.5rem,4vw,2rem)] leading-[1.05]">
        {about.refreshHeading}
      </h2>
      <p className="max-w-3xl">{about.refreshText}</p>
    </article>
  );
}
