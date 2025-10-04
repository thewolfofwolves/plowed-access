import { NextResponse } from "next/server";
import { supaAdmin } from "@/lib/supa";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return NextResponse.redirect(`${process.env.APP_BASE_URL}/profile?x=error`);

    const supa = supaAdmin();
    const { data: st, error: stErr } = await supa
      .from("oauth_states")
      .select("claim_id, code_verifier, purpose")
      .eq("state", state)
      .single();
    if (stErr || !st) return NextResponse.redirect(`${process.env.APP_BASE_URL}/profile?x=error`);

    // Exchange code for token (PKCE)
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.TW_CLIENT_ID,
      code,
      redirect_uri: `${process.env.APP_BASE_URL}/api/x/callback`,
      code_verifier: st.code_verifier
    });

    const tokRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });
    if (!tokRes.ok) return NextResponse.redirect(`${process.env.APP_BASE_URL}/profile?x=error`);
    const tok = await tokRes.json();

    // Fetch profile
    const meRes = await fetch(
      "https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username",
      { headers: { Authorization: `Bearer ${tok.access_token}` } }
    );
    if (!meRes.ok) return NextResponse.redirect(`${process.env.APP_BASE_URL}/profile?x=error`);
    const me = await meRes.json();
    const u = me.data || {};

    let resp;
    if (st.purpose === "link") {
      // Link to the specific claim
      const { error: updErr } = await supa
        .from("claims")
        .update({
          x_user_id: u.id || null,
          x_username: u.username || null,
          x_name: u.name || null,
          x_avatar_url: u.profile_image_url || null
        })
        .eq("id", st.claim_id);

      resp = updErr
        ? NextResponse.redirect(`${process.env.APP_BASE_URL}/profile?id=${encodeURIComponent(st.claim_id)}&x=error`)
        : NextResponse.redirect(`${process.env.APP_BASE_URL}/profile?id=${encodeURIComponent(st.claim_id)}&x=ok`);
    } else {
      // View mode: set a short-lived cookie and go to /profile/me
      resp = NextResponse.redirect(`${process.env.APP_BASE_URL}/profile/me`);
      resp.cookies.set("x_uid", u.id, {
        httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 15
      });
    }

    await supa.from("oauth_states").delete().eq("state", state);
    return resp;
  } catch {
    return NextResponse.redirect(`${process.env.APP_BASE_URL}/profile?x=error`);
  }
}
