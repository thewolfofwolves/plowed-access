// app/api/x/callback/route.js  (TEMP TEST)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
const BUILD_TAG = "cb-probe-01";

export async function GET(req) {
  const u = new URL(req.url);
  const payload = {
    tag: BUILD_TAG,
    got: Object.fromEntries(u.searchParams.entries()),
  };
  const res = NextResponse.json(payload);
  res.headers.set("x-callback-version", BUILD_TAG);
  return res;
}
