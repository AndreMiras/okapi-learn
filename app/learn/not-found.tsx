import Link from "next/link";

export default function LearningNotFound() {
  return (
    <section className="relative overflow-hidden rounded-[clamp(1rem,4vw,2rem)] border border-[#16324f26] bg-[#fffdf7] p-[clamp(1.5rem,5vw,3rem)] shadow-[0_18px_50px_#16324f18]">
      <p className="mb-3 text-xs font-bold tracking-[0.14em] text-[#8a403b] uppercase">
        Not available
      </p>
      <h1 className="m-0 max-w-3xl font-['Fraunces_Variable',serif] text-[clamp(2.3rem,6vw,4.7rem)] leading-[1.05] tracking-[-0.045em]">
        This catalog item cannot be opened
      </h1>
      <p>
        It is not part of the current signed-in session. It may have been
        removed or the link may be stale.
      </p>
      <Link
        className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-[#16324f] bg-[#f4b942] px-4 py-3 font-bold text-[#16324f] no-underline shadow-[4px_4px_0_#16324f] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#dd796f]"
        href="/learners"
      >
        Choose a learner
      </Link>
    </section>
  );
}
