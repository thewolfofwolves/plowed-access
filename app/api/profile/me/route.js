export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { supaAdmin } from "@/lib/supa";

const APP_SECRET = process.env.APP_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret";

function parseSigned(token) {
  if (!token) return null;
  const [mac, b64] = token.split(".");
  if (!mac || !b64) return null;
  const raw = Buffer.from(b64, "base64url").toString();
  const expect = crypto.createHmac("sha256", APP_SECRET).update(raw).digest("base64url");
  if (mac !== expect) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function GET() {
  const token = cookies().get("plowed_session")?.value || null;
  const sess = parseSigned(token);
  if (!sess?.xUserId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const supa = supaAdmin();

  // Keep it simple: find any claim for this x_user_id (no ORDER BY; works without timestamps)
  const { data: claim, error } = await supa
    .from("claims")
    .select("id, wallet_address, x_user_id, x_username, x_name, x_avatar_url, referral_code, code_id")
    .eq("x_user_id", String(sess.xUserId))
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // If nothing matched, return empty fields so the UI is consistent (and set a debug header)
  const res = NextResponse.json({
    wallet_address: claim?.wallet_address || "",
    tier: "Early Access",                    // default; your UI shows this by default
    referral_code: claim?.referral_code || null, // your table already has referral_code
    x_username: claim?.x_username || null,
    x_name: claim?.x_name || null,
    x_avatar_url: claim?.x_avatar_url || null,
  });

  res.headers.set(
    "x-me-debug",
    claim ? `found:${claim.id}` : `not_found_for_x:${String(sess.xUserId)}`
  );
  return res;
}
