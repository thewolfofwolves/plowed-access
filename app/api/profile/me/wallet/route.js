// app/api/profile/me/wallet/route.js
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

export async function PATCH(req) {
  const token = cookies().get("plowed_session")?.value || null;
  const sess = parseSigned(token);
  if (!sess?.xUserId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

  const { wallet } = await req.json().catch(() => ({}));
  if (!wallet || typeof wallet !== "string" || wallet.length < 20) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }

  const supa = supaAdmin();

  // find most recent claim for this user
  const { data: claim } = await supa
    .from("claims")
    .select("id")
    .eq("x_user_id", String(sess.xUserId))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!claim?.id) {
    return NextResponse.json({ error: "No claim found for this account" }, { status: 400 });
  }

  const { data: updated, error: updErr } = await supa
    .from("claims")
    .update({ wallet_address: wallet })
    .eq("id", claim.id)
    .select("id, wallet_address")
    .single();

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, claim: updated });
}
