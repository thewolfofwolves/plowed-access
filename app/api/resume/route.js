// app/api/resume/route.js
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supaAdmin } from "@/lib/supa";

/** Match the normalisation used by your code-check flow */
function normaliseCode(s = "") {
  return String(s).trim().replace(/[^0-9a-z]/gi, "").toUpperCase();
}

/** Basic wallet trim only (don’t alter case) */
function normaliseWallet(s = "") {
  return String(s).trim();
}

// POST { code, wallet } -> { ok:true, url:"/api/x/start?mode=link&claim=..." }
export async function POST(req) {
  try {
    const { code, wallet } = await req.json();
    const c = normaliseCode(code);
    const w = normaliseWallet(wallet);

    if (!c || !w) {
      return NextResponse.json({ error: "Missing code or wallet" }, { status: 400 });
    }

    const supa = supaAdmin();

    // 1) Validate code against stored hashes (allow *used* codes, only block expired)
    const { data: codes, error: codesErr } = await supa
      .from("codes")
      .select("id, code_hash, expires_at");

    if (codesErr) {
      return NextResponse.json({ error: codesErr.message }, { status: 400 });
    }

    const now = new Date();
    const matched = (codes || []).some((row) => {
      const notExpired = !row.expires_at || new Date(row.expires_at) > now;
      // compare against the *normalised* input
      return notExpired && bcrypt.compareSync(c, row.code_hash);
    });

    if (!matched) {
      // Do not leak which part failed; keep it generic
      return NextResponse.json({ error: "Invalid or used code" }, { status: 400 });
    }

    // 2) Find any claim for this wallet that has not yet linked Twitter
    const { data: claims, error: claimsErr } = await supa
      .from("claims")
      .select("id, wallet_address, x_user_id")
      .eq("wallet_address", w)
      .is("x_user_id", null)
      .limit(1);

    if (claimsErr) {
      return NextResponse.json({ error: claimsErr.message }, { status: 400 });
    }

    const claim = claims && claims[0];
    if (!claim) {
      // If there is a claim but already linked, say so; otherwise generic not-found.
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
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
