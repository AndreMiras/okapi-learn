import Link from "next/link";
import { notFound } from "next/navigation";

import { ProtectedTools } from "@/components/protected-tools";
import { requireSession } from "@/lib/session/dal";
import { selectMedia } from "@/lib/session/selectors";

export default async function MediaPage({
  params,
}: PageProps<"/learn/[learnerAlias]/media/[mediaAlias]">) {
  const { learnerAlias, mediaAlias } = await params;
  const selection = selectMedia(
    await requireSession(),
    learnerAlias,
    mediaAlias,
  );
  if (!selection) notFound();
  return (
    <div className="grid w-full gap-[clamp(2rem,6vw,5rem)]">
      <article className="relative overflow-hidden rounded-[clamp(1rem,4vw,2rem)] border border-[#16324f26] bg-[#fffdf7] p-[clamp(1.5rem,5vw,4rem)] shadow-[0_18px_50px_#16324f18] max-[420px]:p-5">
        <Link
          className="mb-5 inline-flex min-h-11 items-center font-bold underline-offset-4 focus-visible:rounded focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#dd796f]"
          href={`/learn/${learnerAlias}`}
        >
          ← Back to catalog
        </Link>
        <div
          className={`mb-8 h-[clamp(10rem,30vw,18rem)] w-[min(100%,34rem)] border-2 border-[#16324f] bg-[linear-gradient(155deg,#a8d5ba_0_48%,#f4b942_49%_64%,#dd796f_65%)] ${selection.media.kind === "audio" ? "rounded-full" : "rounded-[48%_48%_1rem_1rem]"}`}
          aria-hidden="true"
        />
        <p className="mb-3 text-xs font-bold tracking-[0.14em] text-[#8a403b] uppercase">
          {selection.media.kind === "audio" ? "Listen" : "Watch"}
        </p>
        <h1 className="m-0 max-w-3xl font-['Fraunces_Variable',serif] text-[clamp(2.3rem,6vw,4.7rem)] leading-[1.05] tracking-[-0.045em]">
          {selection.media.title}
        </h1>
        {selection.media.description && (
          <p className="mt-6 max-w-2xl text-[clamp(1.1rem,2vw,1.3rem)]">
            {selection.media.description}
          </p>
        )}
        <dl className="my-8 flex flex-wrap gap-x-12 gap-y-6">
          <div className="grid">
            <dt className="text-sm font-bold uppercase">Course</dt>
            <dd className="m-0">{selection.course.name}</dd>
          </div>
          <div className="grid">
            <dt className="text-sm font-bold uppercase">Type</dt>
            <dd className="m-0">
              {selection.media.kind === "audio" ? "Audio" : "Video"}
            </dd>
          </div>
          {selection.media.duration && (
            <div className="grid">
              <dt className="text-sm font-bold uppercase">Duration</dt>
              <dd className="m-0">{selection.media.duration}</dd>
            </div>
          )}
        </dl>
        <div
          className="mt-6 grid gap-1 border-l-4 border-[#f4b942] bg-[#f4b94224] px-4 py-3"
          role="status"
        >
          <strong>Catalog only</strong>
          <span>Playback is not available in this version.</span>
        </div>
      </article>
      <ProtectedTools />
    </div>
  );
}
