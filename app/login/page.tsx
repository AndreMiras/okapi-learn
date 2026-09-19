import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { readCurrentSession } from "@/lib/session/server";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await readCurrentSession()) redirect("/learners");
  const { reason } = await searchParams;
  return (
    <section className="grid grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] items-stretch gap-[clamp(1.25rem,4vw,3rem)] max-md:grid-cols-1">
      <div className="relative overflow-hidden rounded-[clamp(1rem,4vw,2rem)] border border-[#16324f26] bg-[#fffdf7] p-[clamp(1.5rem,5vw,4rem)] shadow-[0_18px_50px_#16324f18] max-[420px]:p-5">
        <p className="mb-3 text-xs font-bold tracking-[0.14em] text-[#8a403b] uppercase">
          Adult sign in
        </p>
        <h1 className="m-0 max-w-3xl font-['Fraunces_Variable',serif] text-[clamp(2.3rem,6vw,4.7rem)] leading-[1.05] tracking-[-0.045em]">
          Open the learning notebook
        </h1>
        <p className="mt-6 max-w-2xl text-[clamp(1.1rem,2vw,1.3rem)]">
          Your details are sent once to the service and are never stored by
          Okapi Learn.
        </p>
        {(reason === "expired" || reason === "signed-out") && (
          <p
            className="mt-6 border-l-4 border-[#f4b942] bg-[#f4b94224] px-4 py-3"
            role="status"
          >
            {reason === "expired"
              ? "Your session is unavailable or has expired. Please sign in again."
              : "You have been signed out."}
          </p>
        )}
        <LoginForm />
      </div>
      <aside className="self-center border-l-3 border-[#dd796f] p-[clamp(1.5rem,4vw,2.5rem)] max-md:border-t-3 max-md:border-l-0">
        <span
          className="font-['Fraunces_Variable',serif] text-5xl font-bold"
          aria-hidden="true"
        >
          01
        </span>
        <h2 className="mt-2 mb-2 font-['Fraunces_Variable',serif] text-[clamp(1.5rem,4vw,2rem)] leading-[1.05]">
          Private by default
        </h2>
        <p>
          Your temporary session stays server-side for no more than eight hours,
          either in this server process or encrypted in the deployment&apos;s
          shared session store. The browser receives only an opaque session
          cookie.
        </p>
        <p>
          If terms need attention, an adult must use an official Kids&amp;Us
          channel. Okapi Learn cannot accept terms for you.
        </p>
      </aside>
    </section>
  );
}
