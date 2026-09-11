import Link from "next/link";
import { notFound } from "next/navigation";

import { ProtectedTools } from "@/components/protected-tools";
import { requireSession } from "@/lib/session/dal";
import { selectLearner } from "@/lib/session/selectors";
import type { SessionMedia } from "@/lib/session/types";

function MediaGroup({
  items,
  learnerAlias,
  title,
}: Readonly<{
  items: readonly SessionMedia[];
  learnerAlias: string;
  title: string;
}>) {
  return (
    <section
      className="mt-12"
      aria-labelledby={`${title.toLowerCase()}-heading`}
    >
      <h2
        className="mt-0 mb-2 font-['Fraunces_Variable',serif] text-[clamp(1.5rem,4vw,2rem)] leading-[1.05]"
        id={`${title.toLowerCase()}-heading`}
      >
        {title}
      </h2>
      {items.length ? (
        <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-5">
          {items.map((item, index) => (
            <Link
              className="relative grid min-h-36 grid-cols-[6rem_minmax(0,1fr)] overflow-hidden rounded-[clamp(1rem,4vw,2rem)] border border-[#16324f26] bg-[#fffdf7] no-underline shadow-[0_18px_50px_#16324f18] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#dd796f]"
              href={`/learn/${learnerAlias}/media/${item.alias}`}
              key={item.alias}
            >
              <span
                className={`min-h-full border-r-2 border-[#16324f] ${["bg-[linear-gradient(145deg,#a8d5ba_48%,#f4b942_49%_65%,#dd796f_66%)]", "bg-[radial-gradient(circle_at_35%_35%,#f4b942_0_20%,transparent_21%),#a8d5ba]", "bg-[linear-gradient(35deg,#dd796f_0_45%,#fff8e8_46%_55%,#b9cae5_56%)]"][index % 3]}`}
                aria-hidden="true"
              />
              <span className="flex min-w-0 flex-col gap-2 p-4 [overflow-wrap:anywhere]">
                <strong className="font-['Fraunces_Variable',serif] text-xl">
                  {item.title}
                </strong>
                {item.description && <span>{item.description}</span>}
                <small className="text-sm font-normal">
                  {item.duration ? `${item.duration} · ` : ""}
                  {item.kind === "audio" ? "Audio" : "Video"}
                </small>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="p-[clamp(1.5rem,5vw,3rem)]">
          There are no {title.toLowerCase()} items in this catalog.
        </p>
      )}
    </section>
  );
}

export default async function CatalogPage({
  params,
}: PageProps<"/learn/[learnerAlias]">) {
  const { learnerAlias } = await params;
  const selection = selectLearner(await requireSession(), learnerAlias);
  if (!selection) notFound();
  return (
    <div className="grid w-full gap-[clamp(2rem,6vw,5rem)]">
      <div>
        <Link
          className="mb-5 inline-flex min-h-11 items-center font-bold underline-offset-4 focus-visible:rounded focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#dd796f]"
          href="/learners"
        >
          ← All learners
        </Link>
        <p className="mb-3 text-xs font-bold tracking-[0.14em] text-[#8a403b] uppercase">
          {selection.course.name}
        </p>
        <h1 className="m-0 max-w-3xl font-['Fraunces_Variable',serif] text-[clamp(2.3rem,6vw,4.7rem)] leading-[1.05] tracking-[-0.045em]">
          {selection.learner.name}&apos;s catalog
        </h1>
        <p className="mt-6 max-w-2xl text-[clamp(1.1rem,2vw,1.3rem)]">
          Browse what is available in this sign-in session.
        </p>
        <MediaGroup
          items={selection.course.audios}
          learnerAlias={learnerAlias}
          title="Listen"
        />
        <MediaGroup
          items={selection.course.videos}
          learnerAlias={learnerAlias}
          title="Watch"
        />
      </div>
      <ProtectedTools />
    </div>
  );
}
