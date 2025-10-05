export const runtime = "nodejs";
import { NextResponse } from "next/server";

function clear(res) {
  res.cookies.set({
    name: "plowed_session",
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function GET(req) {
  const res = NextResponse.redirect(new URL("/", req.url));
  return clear(res);
}

export async function POST() {
  const res = NextResponse.json({ ok: true });
  return clear(res);
}
