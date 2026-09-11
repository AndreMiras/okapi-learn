"use client";

import Link from "next/link";

export default function LearningError({ reset }: { reset: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-[clamp(1rem,4vw,2rem)] border border-[#16324f26] bg-[#fffdf7] p-[clamp(1.5rem,5vw,3rem)] shadow-[0_18px_50px_#16324f18]">
      <p className="mb-3 text-xs font-bold tracking-[0.14em] text-[#8a403b] uppercase">
        Notebook unavailable
      </p>
      <h1 className="m-0 max-w-3xl font-['Fraunces_Variable',serif] text-[clamp(2.3rem,6vw,4.7rem)] leading-[1.05] tracking-[-0.045em]">
        This page could not be opened
      </h1>
      <p>
        No catalog changes were made. You can try this page once more or choose
        a learner.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 max-[420px]:flex-col max-[420px]:items-stretch">
        <button
          className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-[#16324f] bg-[#f4b942] px-4 py-3 font-bold text-[#16324f] shadow-[4px_4px_0_#16324f] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#dd796f]"
          onClick={reset}
          type="button"
        >
          Try again
        </button>
        <Link
          className="min-h-11 py-2 font-bold underline-offset-4 focus-visible:rounded focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#dd796f]"
          href="/learners"
        >
          Choose a learner
        </Link>
      </div>
    </section>
  );
}
