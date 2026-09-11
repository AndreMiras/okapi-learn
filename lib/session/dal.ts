import "server-only";

import { redirect } from "next/navigation";

import { readCurrentSession } from "./server";

export async function requireSession() {
  const session = await readCurrentSession();
  if (!session) redirect("/login?reason=expired");
  return session;
}
