import { redirect } from "next/navigation";

import { readCurrentSession } from "@/lib/session/server";

export default async function HomePage() {
  redirect((await readCurrentSession()) ? "/learners" : "/login");
}
