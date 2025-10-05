export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { supaAdmin } from "@/lib/supa";

// You already have your OAuth exchange logic elsewhere.
// Here we assume you’ve just obtained the X user fields you keep.
// Pseudocode below shows the integration point.

export async function GET(req) {
  const url = new URL(req.url);
  const supa = supaAdmin();

  try {
    // 0) Grab the session cookie we set in /api/claim
    const cookies = req.headers.get("cookie") || "";
    const match = cookies.match(/(?:^|;\s*)claim_session_id=([^;]+)/);
    const sessionId = match ? decodeURIComponent(match[1]) : null;

    if (!sessionId) {
      // No claim session: show a helpful error or send back to landing
      return NextResponse.redirect(`${process.env.APP_BASE_URL || ""}/profile?x=error&stage=missing_session`);
    }

    // 1) Look up the ephemeral claim session
    const { data: session, error: sErr } = await supa
      .from("claim_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sErr || !session) {
      return NextResponse.redirect(`${process.env.APP_BASE_URL || ""}/profile?x=error&stage=session_not_found`);
    }
    if (new Date(session.expires_at) < new Date()) {
      // Expired
      await supa.from("claim_sessions").delete().eq("id", sessionId);
      const r = NextResponse.redirect(`${process.env.APP_BASE_URL || ""}/profile?x=error&stage=session_expired`);
      r.cookies.set("claim_session_id", "", { path: "/", maxAge: 0 });
      return r;
    }

    // 2) Complete Twitter OAuth *here* and capture X user info
    // --- Exchange the `code` param with X, verify, and obtain:
    // x_user_id, x_username, x_name, x_avatar_url
    // (Use your existing code; omitted for brevity.)
    //
    // For illustration only:
    const x_user_id   = url.searchParams.get("x_mock_uid")   || "12345";
    const x_username  = url.searchParams.get("x_mock_uname") || "user";
    const x_name      = url.searchParams.get("x_mock_name")  || "User";
    const x_avatar_url= url.searchParams.get("x_mock_avatar")|| null;

    // 3) Atomically consume the code & create the claim
    //    Reuse your existing 'claim_code' SQL function.
    const { data: claim, error: claimErr } = await supa.rpc("claim_code", {
      p_code: session.code_plain,
      p_wallet_address: session.wallet,
      p_tier: "Early Access",
      p_ip_hash: session.ip_hash || "",
      p_user_agent: session.user_agent || "",
    });

    if (claimErr) {
      // Code may have been used by someone else first, or invalid now
      // Tear down the session and inform user
      await supa.from("claim_sessions").delete().eq("id", sessionId);
      const r = NextResponse.redirect(`${process.env.APP_BASE_URL || ""}/profile?x=error&stage=claim_failed`);
      r.cookies.set("claim_session_id", "", { path: "/", maxAge: 0 });
      return r;
    }

    // 4) (Optional) Store/merge X profile info into the claim if you keep it
    //    You can either:
    //    - extend claim_code to accept X fields, OR
    //    - update the claim row by id, OR
    //    - keep a separate profile table.
    // Here’s a trivial direct update of the claim row if you have columns:
    if (claim?.id) {
      await supa
        .from("claims")
        .update({
          x_user_id,
          x_username,
          x_name,
          x_avatar_url
        })
        .eq("id", claim.id);
    }

    // 5) Clean up the ephemeral session + cookie
    await supa.from("claim_sessions").delete().eq("id", sessionId);
    const res = NextResponse.redirect(`${process.env.APP_BASE_URL || ""}/profile/me`);
    res.cookies.set("claim_session_id", "", { path: "/", maxAge: 0 });
    return res;

  } catch (e) {
    // Defensive cleanup
    const r = NextResponse.redirect(`${process.env.APP_BASE_URL || ""}/profile?x=error&stage=callback_exception`);
    r.cookies.set("claim_session_id", "", { path: "/", maxAge: 0 });
    return r;
  }
}
