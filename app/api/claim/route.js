export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supaAdmin } from "@/lib/supa";
import bs58 from "bs58";
import crypto from "crypto";

// Validate Solana address simply by bs58 length == 32
function isSol(addr) {
  try {
    return bs58.decode(addr.trim()).length === 32;
  } catch {
    return false;
  }
}

export async function POST(req) {
  try {
    const { code, wallet } = await req.json();

    if (!code || !wallet) {
      return NextResponse.json({ error: "Missing code or wallet." }, { status: 400 });
    }
    if (!isSol(wallet)) {
      return NextResponse.json({ error: "Invalid Solana address." }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for") || "";
    const ua = req.headers.get("user-agent") || "";
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);

    const supa = supaAdmin();

    // 1) Verify the code exists, not used/expired
    const { data: codeRowId, error: vErr } = await supa.rpc("check_code_for_start", {
      p_code: code.trim(),
    });
    if (vErr) {
      return NextResponse.json({ error: vErr.message }, { status: 400 });
    }
    if (!codeRowId) {
      return NextResponse.json({ error: "Invalid or already-used code." }, { status: 400 });
    }

    // 2) Create a short-lived session (do NOT consume the code yet)
    const { data: session, error: iErr } = await supa
      .from("claim_sessions")
      .insert({
        code_plain: code.trim(),
        wallet: wallet.trim(),
        ip_hash: ipHash,
        user_agent: ua,
        // expires_at default is now() + 2 hours in the table
      })
      .select("id, expires_at")
      .single();

    if (iErr) {
      return NextResponse.json({ error: iErr.message }, { status: 400 });
    }

    // 3) Set a secure HTTP-only cookie so the callback can finalize
    const res = NextResponse.json({
      ok: true,
      message: "Step 1 saved. Please connect Twitter to finalize.",
      session_expires: session.expires_at,
    });
    res.cookies.set("claim_session_id", session.id, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 2 * 60 * 60, // 2 hours
    });

    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
