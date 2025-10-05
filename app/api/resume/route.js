// app/api/resume/route.js
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supaAdmin } from "@/lib/supa";

// POST { code, wallet } → { ok:true, url:"/api/x/start?mode=link&claim=..." }
export async function POST(req) {
  try {
    const { code, wallet } = await req.json();
    const c = (code || "").trim();
    const w = (wallet || "").trim();
    if (!c || !w) {
      return NextResponse.json({ error: "Missing code or wallet" }, { status: 400 });
    }

    const supa = supaAdmin();

    // 1) Validate the code against hashes (allow used codes too)
    const { data: codes, error: codesErr } = await supa
      .from("codes")
      .select("id, code_hash, expires_at");
    if (codesErr) {
      return NextResponse.json({ error: codesErr.message }, { status: 400 });
    }

    const now = new Date();
    const match = (codes || []).find(row => {
      const notExpired = !row.expires_at || new Date(row.expires_at) > now;
      return notExpired && bcrypt.compareSync(c, row.code_hash);
    });

    if (!match) {
      // Generic so we don’t leak whether the code exists/was used
      return NextResponse.json({ error: "Invalid or used code" }, { status: 400 });
    }

    // 2) Find a claim for this wallet that hasn't linked Twitter yet
    const { data: claims, error: claimsErr } = await supa
      .from("claims")
      .select("id, wallet_address, x_user_id")
      .eq("wallet_address", w)
      .is("x_user_id", null)   // only unlinked
      .limit(1);

    if (claimsErr) {
      return NextResponse.json({ error: claimsErr.message }, { status: 400 });
    }

    const claim = claims && claims[0];

    if (!claim) {
      // Either no claim for that wallet, or it’s already linked.
      // Check if it exists but already linked to give a clearer message.
      const { data: anyClaim } = await supa
        .from("claims")
        .select("id, x_user_id")
        .eq("wallet_address", w)
        .limit(1);

      if (anyClaim && anyClaim[0]?.x_user_id) {
        return NextResponse.json({ error: "Twitter already linked for this claim" }, { status: 409 });
      }

      return NextResponse.json({ error: "No eligible claim found for that wallet" }, { status: 404 });
    }

    // 3) Hand off to existing OAuth start (no new tables / tokens)
    const url = `/api/x/start?mode=link&claim=${encodeURIComponent(claim.id)}`;
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
