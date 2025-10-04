import { NextResponse } from "next/server";
import { supaAdmin } from "@/lib/supa";

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // helper for consistent error redirects + cleanup
  const fail = async (stage, stRow) => {
    if (stRow?.state) {
      try { await supaAdmin().from("oauth_states").delete().eq("state", stRow.state); } catch {}
    }
    return NextResponse.redirect(`${process.env.APP_BASE_URL}/profile?x=error&stage=${encodeURIComponent(stage)}`);
  };

  if (!code || !state) {
    return NextResponse.redirect(`${process.env.APP_BASE_URL}/profile?x=error&stage=missing_params`);
  }

  const supa = supaAdmin();

  // 1) find PKCE verifier + purpose
  const { data: st, error: stErr } = await supa
    .from("oauth_states")
    .select("state, claim_id, code_verifier, purpose")
    .eq("state", state)
    .single();

  if (stErr || !st) return NextResponse.redirect(`${process.env.APP_BASE_URL}/profile?x=error&stage=state_lookup`);

  // 2) exchange code for token (PKCE flow: client_id + code_verifier)
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

  if (!tokRes.ok) return fail(`token_${tokRes.status}`, st);
  const tok = await tokRes.json();
  if (!tok?.access_token) return fail("token_no_access_token", st);

  // 3) fetch profile
  const meRes = await fetch(
    "https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username",
    { headers: { Authorization: `Bearer ${tok.access_token}` } }
  );
  if (!meRes.ok) return fail(`profile_${meRes.status}`, st);
  const me = await meRes.json();
  const u = me?.data;
  if (!u?.id) return fail("profile_no_user", st);

  // 4) link or view
  let resp;
  if (st.purpose === "link") {
    const { error: updErr } = await supa
      .from("claims")
      .update({
        x_user_id: u.id,
        x_username: u.username || null,
        x_name: u.name || null,
        x_avatar_url: u.profile_image_url || null
      })
      .eq("id", st.claim_id);

    resp = updErr
      ? NextResponse.redirect(`${process.env.APP_BASE_URL}/profile?id=${encodeURIComponent(st.claim_id)}&x=error&stage=update_claim`)
      : NextResponse.redirect(`${process.env.APP_BASE_URL}/profile?id=${encodeURIComponent(st.claim_id)}&x=ok`);
  } else {
    // view mode: set cookie
    resp = NextResponse.redirect(`${process.env.APP_BASE_URL}/profile/me`);
    resp.cookies.set("x_uid", u.id, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 15 });
  }

  // 5) cleanup state even on success
  try { await supa.from("oauth_states").delete().eq("state", st.state); } catch {}

  return resp;
}
