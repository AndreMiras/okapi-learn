import { NextResponse } from "next/server";

import { getServerConfig } from "@/lib/config/server";
import { getSessionStore } from "@/lib/session/server";

const headers = { "Cache-Control": "no-store" };

export function GET() {
  getServerConfig();
  getSessionStore();
  return NextResponse.json({ status: "ready" }, { headers });
}
