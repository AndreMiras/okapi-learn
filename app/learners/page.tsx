import type { Metadata } from "next";
import Link from "next/link";

import { ProtectedTools } from "@/components/protected-tools";
import { requireSession } from "@/lib/session/dal";

export const metadata: Metadata = { title: "Choose a learner" };

export default async function LearnersPage() {
  const session = await requireSession();
  return (
    <div className="grid w-full gap-[clamp(2rem,6vw,5rem)]">
      <section aria-labelledby="learners-heading">
        <p className="mb-3 text-xs font-bold tracking-[0.14em] text-[#8a403b] uppercase">
          Learning notebook
        </p>
        <h1
          className="m-0 max-w-3xl font-['Fraunces_Variable',serif] text-[clamp(2.3rem,6vw,4.7rem)] leading-[1.05] tracking-[-0.045em]"
          id="learners-heading"
        >
          Who is learning today?
        </h1>
        <p className="mt-6 max-w-2xl text-[clamp(1.1rem,2vw,1.3rem)]">
          Choose a learner to open the course catalog for this session.
        </p>
        {session.learners.length ? (
          <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-5">
            {session.learners.map((learner, index) => (
              <Link
                className="relative grid min-h-52 content-start gap-2 overflow-hidden rounded-[clamp(1rem,4vw,2rem)] border border-[#16324f26] bg-[#fffdf7] p-5 font-['Fraunces_Variable',serif] text-2xl font-bold no-underline shadow-[0_18px_50px_#16324f18] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#dd796f]"
                href={`/learn/${learner.alias}`}
                key={learner.alias}
              >
                <span
                  className={`grid size-20 place-items-center rounded-[43%_57%_54%_46%] border-2 border-[#16324f] ${["-rotate-3 bg-[#a8d5ba]", "rotate-4 bg-[#f4b942]", "-rotate-6 bg-[#dd796f]", "rotate-2 bg-[#b9cae5]"][index % 4]}`}
                  aria-hidden="true"
                >
                  {learner.name.slice(0, 1).toLocaleUpperCase("en")}
                </span>
                <span>{learner.name}</span>
                <small className="font-['Atkinson_Hyperlegible_Next',sans-serif] text-sm font-normal">
                  Open course
                </small>
              </Link>
            ))}
          </div>
        ) : (
          <div className="relative mt-8 overflow-hidden rounded-[clamp(1rem,4vw,2rem)] border border-[#16324f26] bg-[#fffdf7] p-[clamp(1.5rem,5vw,3rem)] shadow-[0_18px_50px_#16324f18]">
            <h2 className="mt-0 mb-2 font-['Fraunces_Variable',serif] text-[clamp(1.5rem,4vw,2rem)] leading-[1.05]">
              No learners are available
            </h2>
            <p>
              This session did not include a learner catalog. Sign in again
              later to refresh.
            </p>
          </div>
        )}
      </section>
      <ProtectedTools />
    </div>
  );
}
