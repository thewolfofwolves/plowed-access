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
    maxAge: 0, // expire now
  });
  return res;
}

export async function GET(req) {
  const res = NextResponse.redirect(new URL("/", req.url));
  return clear(res);
}

export async function POST() {
  // return JSON so buttons using fetch() can handle it
  const res = NextResponse.json({ ok: true });
  return clear(res);
}
