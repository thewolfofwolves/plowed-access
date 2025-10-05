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

    // 1) Validate the code against hashes (allow used codes)
    const { data: codes, error: codesErr } = await supa
      .from("codes")
      .select("id, code_hash, expires_at");
    if (codesErr) return NextResponse.json({ error: codesErr.message }, { status: 400 });

    const now = new Date();
    const match = (codes || []).find(row => {
      const notExpired = !row.expires_at || new Date(row.expires_at) > now;
      return notExpired && bcrypt.compareSync(c, row.code_hash);
    });

    if (!match) {
      // Generic so we do not leak whether code exists/was used
      return NextResponse.json({ error: "Invalid or used code" }, { status: 400 });
    }

    // 2) Find most recent claim for this wallet
    const { data: claims, error: claimsErr } = await supa
      .from("claims")
      .select("id, wallet_address, x_user_id")
      .eq("wallet_address", w)
      .order("created_at", { ascending: false })
      .limit(1);

    if (claimsErr) return NextResponse.json({ error: claimsErr.message }, { status: 400 });

    const claim = claims && claims[0];
    if (!claim) {
      return NextResponse.json({ error: "No claim found for that wallet" }, { status: 404 });
    }

    if (claim.x_user_id) {
      return NextResponse.json({ error: "Twitter already linked for this claim" }, { status: 409 });
    }

    // 3) Hand off to existing OAuth start (no new tables, no tokens)
    const url = `/api/x/start?mode=link&claim=${encodeURIComponent(claim.id)}`;
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
