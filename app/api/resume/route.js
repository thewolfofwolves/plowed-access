// app/api/resume/route.js
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supaAdmin } from "@/lib/supa";

/** Normalise code the same way as your check flow */
function normaliseCode(s = "") {
  return String(s).trim().replace(/[^0-9a-z]/gi, "").toUpperCase();
}
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

    // 1) Find any UNLINKED claim(s) for this wallet
    const { data: openClaims, error: claimsErr } = await supa
      .from("claims")
      .select("id, wallet_address, code_id, x_user_id")
      .eq("wallet_address", w)
      .is("x_user_id", null);

    if (claimsErr) {
      return NextResponse.json({ error: claimsErr.message }, { status: 400 });
    }

    if (!openClaims || openClaims.length === 0) {
      // Determine if the wallet has a claim but it's already linked, to return a clearer message.
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

    // 2) Fetch code rows for those claims and compare the input code
    const codeIds = Array.from(new Set(openClaims.map(c => c.code_id).filter(Boolean)));
    if (codeIds.length === 0) {
      return NextResponse.json({ error: "No eligible claim found for that wallet" }, { status: 404 });
    }

    const { data: codeRows, error: codesErr } = await supa
      .from("codes")
      .select("id, code_hash")
      .in("id", codeIds);

    if (codesErr) {
      return NextResponse.json({ error: codesErr.message }, { status: 400 });
    }
    if (!codeRows || codeRows.length === 0) {
      return NextResponse.json({ error: "No eligible claim found for that wallet" }, { status: 404 });
    }

    // 3) Find the claim whose code_id matches the provided code
    const byId = new Map(codeRows.map(r => [r.id, r]));
    const matchedClaim = openClaims.find(claim => {
      const row = byId.get(claim.code_id);
      return row ? bcrypt.compareSync(c, row.code_hash) : false;
    });

    if (!matchedClaim) {
      return NextResponse.json({ error: "Code does not match this wallet" }, { status: 400 });
    }

    // 4) Hand off to your existing OAuth start (no new tables / tokens)
    const url = `/api/x/start?mode=link&claim=${encodeURIComponent(matchedClaim.id)}`;
    return NextResponse.json({ ok: true, url });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
