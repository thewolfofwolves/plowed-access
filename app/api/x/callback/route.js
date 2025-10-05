export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supaAdmin } from "@/lib/supa";

/**
 * Small helpers
 */
function redirectWith(query) {
  // e.g. redirectWith({ x: "error", stage: "state" })
  const params = new URLSearchParams(query);
  return NextResponse.redirect(`/profile?${params.toString()}`, 302);
}

function isFresh(iso, maxMinutes = 10) {
  try {
    const created = new Date(iso).getTime();
    const now = Date.now();
    return now - created <= maxMinutes * 60_000;
  } catch {
    return false;
  }
}

/**
 * GET /api/x/callback?state=...&code=...
 */
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    const err = url.searchParams.get("error");

    if (err) {
      // User denied, or X returned an OAuth error
      return redirectWith({ x: "error", stage: err });
    }
    if (!state || !code) {
      return redirectWith({ x: "error", stage: "missing_params" });
    }

    // ---- 1) Load & verify state / PKCE data ----
    const supa = supaAdmin();
    const { data: st, error: stErr } = await supa
      .from("oauth_states")
      .select("state, claim_id, code_verifier, purpose, created_at")
      .eq("state", state)
      .maybeSingle();

    if (stErr || !st) {
      return redirectWith({ x: "error", stage: "state" });
    }
    if (!isFresh(st.created_at, 15)) {
      // expire after 15 minutes
      await supa.from("oauth_states").delete().eq("state", state).catch(() => {});
      return redirectWith({ x: "error", stage: "expired" });
    }
    if (!st.code_verifier) {
      return redirectWith({ x: "error", stage: "missing_verifier" });
    }

    const mode = st.purpose === "view" ? "view" : "link";
    const claimId = st.claim_id || null;

    // If linking a profile, we need a claim id
    if (mode === "link" && !claimId) {
      return redirectWith({ x: "error", stage: "missing_claim" });
    }

    // ---- 2) Exchange code for access token (PKCE) ----
    const CLIENT_ID = process.env.TW_CLIENT_ID;
    const CLIENT_SECRET = process.env.TW_CLIENT_SECRET; // required for "confidential" apps
    const APP_BASE_URL = process.env.APP_BASE_URL;
    if (!CLIENT_ID || !CLIENT_SECRET || !APP_BASE_URL) {
      return NextResponse.json(
        { error: "Missing TW_CLIENT_ID / TW_CLIENT_SECRET / APP_BASE_URL" },
        { status: 500 }
      );
    }
    const redirectUri = `${APP_BASE_URL}/api/x/callback`;

    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code_verifier: st.code_verifier,
      }),
    });

    if (!tokenRes.ok) {
      const t = await tokenRes.text().catch(() => "");
      console.error("token exchange failed:", tokenRes.status, t);
      return redirectWith({ x: "error", stage: "token" });
    }
    const tokenJson = await tokenRes.json();
    const accessToken = tokenJson?.access_token;
    if (!accessToken) {
      console.error("no access_token in tokenJson:", tokenJson);
      return redirectWith({ x: "error", stage: "token_missing" });
    }

    // ---- 3) Fetch the X profile ----
    const userRes = await fetch(
      "https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!userRes.ok) {
      const txt = await userRes.text().catch(() => "");
      console.error("users/me failed:", userRes.status, txt);
      return redirectWith({ x: "error", stage: "profile" });
    }
    const u = await userRes.json();
    const xId = u?.data?.id;
    const xUsername = u?.data?.username;
    const xName = u?.data?.name;
    const xAvatar = u?.data?.profile_image_url;

    if (!xId) {
      return redirectWith({ x: "error", stage: "profile_missing" });
    }

    // ---- 4) If linking, update the claim row with X info ----
    if (mode === "link" && claimId) {
      const { error: upErr } = await supa
        .from("claims")
        .update({
          x_user_id: xId,
          x_username: xUsername || null,
          x_name: xName || null,
          x_avatar_url: xAvatar || null,
        })
        .eq("id", claimId);

      if (upErr) {
        console.error("claims update error:", upErr);
        return redirectWith({ x: "error", stage: "update_claim" });
      }
    }

    // ---- 5) Cleanup state and set session cookie ----
    await supa.from("oauth_states").delete().eq("state", state).catch(() => {});

    const res = NextResponse.redirect("/profile/me", 302);

    // session cookie for /api/profile/me
    res.cookies.set("x_uid", xId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    // clear short-lived fallback claim cookie if present
    res.cookies.set("x_claim", "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (e) {
    console.error("x/callback error:", e);
    return redirectWith({ x: "error", stage: "server" });
  }
}
