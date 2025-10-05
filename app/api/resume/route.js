// app/api/resume/route.js
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supaAdmin } from "@/lib/supa";

/** Normalise code like your check flow: remove spaces/delims, upper-case */
function normaliseCode(s = "") {
  return String(s).trim().replace(/[^0-9a-z]/gi, "").toUpperCase();
}
/** Wallet: just trim (case kept as-is) */
function normaliseWallet(s = "") {
  return String(s).trim();
}

// POST { code, wallet }  ->  { ok:true, url:"/api/x/start?mode=link&claim=..." }
export async function POST(req) {
  try {
    const { code, wallet } = await req.json();
    const c = normaliseCode(code);
    const w = normaliseWallet(wallet);

    if (!c || !w) {
      return NextResponse.json({ error: "Missing code or wallet" }, { status: 400 });
    }

    const supa = supaAdmin();

    // 1) Find the matching code row (used or unused). We compare to the hash.
    const { data: codes, error: codesErr } = await supa
      .from("codes")
      .select("id, code_hash");
    if (codesErr) {
      return NextResponse.json({ error: codesErr.message }, { status: 400 });
    }

    const matchedCode = (codes || []).find(row => bcrypt.compareSync(c, row.code_hash));
    if (!matchedCode) {
      // Generic so we don't leak whether a specific code exists
      return NextResponse.json({ error: "Invalid or used code" }, { status: 400 });
    }

    // 2) Find a claim for THIS wallet that used THIS code and is not yet linked
    const { data: openClaims, error: claimsErr } = await supa
      .from("claims")
      .select("id, wallet_address, code_id, x_user_id")
      .eq("wallet_address", w)
      .eq("code_id", matchedCode.id)
      .is("x_user_id", null)
      .limit(1);

    if (claimsErr) {
      return NextResponse.json({ error: claimsErr.message }, { status: 400 });
    }

    const claim = openClaims && openClaims[0];
    if (!claim) {
      // Check if there is a claim for (wallet + code) but it's already linked,
      // to return a clearer message.
      const { data: anyClaims } = await supa
        .from("claims")
        .select("id, x_user_id")
        .eq("wallet_address", w)
        .eq("code_id", matchedCode.id)
        .limit(1);

      if (anyClaims && anyClaims[0]?.x_user_id) {
        return NextResponse.json({ error: "Twitter already linked for this claim" }, { status: 409 });
      }
      return NextResponse.json({ error: "No eligible claim found for that wallet + code" }, { status: 404 });
    }

    // 3) Hand off to your existing OAuth start (no new tables / tokens)
    const url = `/api/x/start?mode=link&claim=${encodeURIComponent(claim.id)}`;
    return NextResponse.json({ ok: true, url });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
