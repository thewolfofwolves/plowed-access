// app/api/x/callback/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supaAdmin } from "../../../../lib/supa";


export async function GET(req) {
  const APP_BASE_URL = process.env.APP_BASE_URL;
  const TW_CLIENT_ID = process.env.TW_CLIENT_ID;
  const TW_CLIENT_SECRET = process.env.TW_CLIENT_SECRET;
  if (!APP_BASE_URL || !TW_CLIENT_ID || !TW_CLIENT_SECRET) {
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  const url = req.nextUrl;
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");

  if (!state || !code) {
    return NextResponse.redirect(
      new URL("/profile?x=error&stage=missing_params", APP_BASE_URL)
    );
  }

  const supa = supaAdmin();

  // Look up state
  const { data: st, error: stErr } = await supa
    .from("oauth_states")
    .select("*")
    .eq("state", state)
    .maybeSingle();

  if (stErr || !st) {
    return NextResponse.redirect(
      new URL("/profile?x=error&stage=invalid_state", APP_BASE_URL)
    );
  }

  try {
    // Exchange code for token
    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(`${TW_CLIENT_ID}:${TW_CLIENT_SECRET}`).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: new URL("/api/x/callback", APP_BASE_URL).toString(),
        code_verifier: st.code_verifier,
      }),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(tokenJson.error || "Token exchange failed");
    }

    // Fetch the user
    const meRes = await fetch("https://api.twitter.com/2/users/me", {
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
      },
    });
    const meJson = await meRes.json();
    if (!meRes.ok || !meJson?.data?.id) {
      throw new Error("Could not fetch user");
    }

    const xUserId = meJson.data.id;
    const xUsername = meJson.data.username || null;
    const xName = meJson.data.name || null;
    const xAvatar =
      meJson.data?.profile_image_url ||
      `https://unavatar.io/twitter/${xUsername}`;

    // Update latest claim for this session/claim id (or however you track user)
    if (st.claim_id) {
      await supa
        .from("claims")
        .update({
          x_user_id: xUserId,
          x_username: xUsername,
          x_name: xName,
          x_avatar_url: xAvatar,
        })
        .eq("id", st.claim_id);
    }

    // Done — go to /profile/me
    return NextResponse.redirect(new URL("/profile/me", APP_BASE_URL));
  } catch (e) {
    console.error("x/callback error:", e);
    return NextResponse.redirect(
      new URL("/profile?x=error&stage=server", APP_BASE_URL)
    );
  }
}
