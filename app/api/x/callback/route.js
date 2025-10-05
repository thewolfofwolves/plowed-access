// app/api/x/callback/route.js
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { supaAdmin } from "@/lib/supa";

// simple HMAC signer using an env secret
const APP_SECRET = process.env.APP_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret";
function sign(data) {
  const raw = JSON.stringify(data);
  const mac = crypto.createHmac("sha256", APP_SECRET).update(raw).digest("base64url");
  return `${mac}.${Buffer.from(raw).toString("base64url")}`;
}
function parse(token) {
  if (!token) return null;
  const [mac, b64] = token.split(".");
  if (!mac || !b64) return null;
  const raw = Buffer.from(b64, "base64url").toString();
  const expect = crypto.createHmac("sha256", APP_SECRET).update(raw).digest("base64url");
  if (mac !== expect) return null;
  return JSON.parse(raw);
}

export async function GET(req) {
  const url = new URL(req.url);
  const claimId = url.searchParams.get("state") || url.searchParams.get("claim"); // whatever you passed to X
  // ... your existing code: exchange code -> access token -> fetch profile
  // assume you resolved a profile object { id_str, screen_name, name }

  // --- BEGIN: replace this mock with your real profile fetch ---
  // If your code already has profile, delete this block.
  const profile = req.profile || null; // put your real profile here
  // --- END mock ---

  if (!claimId || !profile?.id_str) {
    // error path: do NOT set session, just bounce with error
    return NextResponse.redirect(new URL(`/?x=error&id=${encodeURIComponent(claimId || "")}`, req.url));
  }

  // Update the claim as linked (no placeholders!)
  const supa = supaAdmin();
  await supa
    .from("claims")
    .update({
      x_user_id: String(profile.id_str),
      x_username: profile.screen_name || null,
      x_name: profile.name || null,
    })
    .eq("id", claimId);

  // Create a short session cookie so /profile can open immediately
  const token = sign({ claimId, xUserId: String(profile.id_str) });
  const res = NextResponse.redirect(new URL("/profile", req.url));
  res.cookies.set({
    name: "plowed_session",
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
