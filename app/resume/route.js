// app/api/resume/route.js
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supaAdmin } from "@/lib/supa";

export async function POST(req) {
  try {
    const { code, wallet } = await req.json();
    const c = (code || "").trim();
    const w = (wallet || "").trim();

    if (!c || !w) {
      return NextResponse.json({ error: "Missing code or wallet" }, { status: 400 });
    }

    const supa = supaAdmin();

    // 1) Verify code exists (used or unused) by comparing with bcrypt hash
    const { data: codes, error: codesErr } = await supa
      .from("codes")
      .select("id, code_hash, used_at, expires_at");

    if (codesErr) return NextResponse.json({ error: codesErr.message }, { status: 400 });

    const now = new Date();
    const hit = (codes || []).find(row => {
      const okDate = !row.expires_at || new Date(row.expires_at) > now;
      return okDate && bcrypt.compareSync(c, row.code_hash);
    });

    if (!hit) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    // 2) Find the user's latest claim by wallet
    const { data: claims, error: claimsErr } = await supa
      .from("claims")
      .select("id, wallet_address, x_user_id")
      .eq("wallet_address", w)
      .order("created_at", { ascending: false })
      .limit(1);

    if (claimsErr) return NextResponse.json({ error: claimsErr.message }, { status: 400 });

    const claim = (claims && claims[0]) || null;
    if (!claim) {
      return NextResponse.json({ error: "No claim found for that wallet" }, { status: 404 });
    }

    if (claim.x_user_id) {
      return NextResponse.json({ error: "Twitter already linked for this claim" }, { status: 409 });
    }

    // 3) Hand off to your existing X OAuth start
    const url = `/api/x/start?mode=link&claim=${encodeURIComponent(claim.id)}`;
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
