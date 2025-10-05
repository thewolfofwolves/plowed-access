// app/api/x/callback/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // avoid any static caching of this route

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { supaAdmin } from "@/lib/supa";

// ---- build tag so you can verify the deployed file in DevTools → Network → Response Headers
const BUILD_TAG = "cb-2025-10-05b";

// ---- cookie signer (for plowed_session)
const APP_SECRET =
  process.env.APP_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret";

function signSession(payload) {
  const raw = JSON.stringify(payload);
  const mac = crypto.createHmac("sha256", APP_SECRET).update(raw).digest("base64url");
  return `${mac}.${Buffer.from(raw).toString("base64url")}`;
}

// attach our build tag to every response so you can see it's the new file
function withTag(res) {
  res.headers.set("x-callback-version", BUILD_TAG);
  return res;
}

function bounceError(req, state, reason) {
  const u = new URL("/", req.url);
  u.searchParams.set("x", "error");
  if (state) u.searchParams.set("id", state);
  if (reason) u.searchParams.set("reason", String(reason));
  return withTag(NextResponse.redirect(u));
}

export async function GET(req) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const authCode = url.searchParams.get("code");

  if (!state || !authCode) {
    return bounceError(req, state, "missing_state_or_code");
  }

  const supa = supaAdmin();

  // 1) Load PKCE verifier + purpose from DB
  const { data: stateRow, error: stateErr } = await supa
    .from("oauth_states")
    .select("state, code_verifier, purpose, claim_id")
    .eq("state", state)
    .single();

  if (stateErr || !stateRow?.code_verifier) {
    return bounceError(req, state, "state_not_found");
  }

  const redirectUri = `${process.env.APP_BASE_URL}/api/x/callback`;

  // 2) Exchange code → tokens
  let tokenJson;
  try {
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", authCode);
    body.set("client_id", process.env.TW_CLIENT_ID);
    // Twitter requires client_secret for confidential clients (web apps). Keep if you have it.
    if (process.env.TW_CLIENT_SECRET) {
      body.set("client_secret", process.env.TW_CLIENT_SECRET);
    }
    body.set("redirect_uri", redirectUri);
    body.set("code_verifier", stateRow.code_verifier);

    const resp = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    tokenJson = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const reason =
        tokenJson?.error_description || tokenJson?.error || `token_http_${resp.status}`;
      return bounceError(req, state, reason);
    }
  } catch (e) {
    return bounceError(req, state, e?.message || "token_exchange_failed");
  }

  const accessToken = tokenJson?.access_token;
  if (!accessToken) {
    return bounceError(req, state, "no_access_token");
  }

  // 3) Fetch user profile
  let userJson;
  try {
    const resp = await fetch(
      "https://api.twitter.com/2/users/me?user.fields=name,username",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    userJson = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const reason = userJson?.title || userJson?.detail || `me_http_${resp.status}`;
      return bounceError(req, state, reason);
    }
  } catch (e) {
    return bounceError(req, state, e?.message || "profile_fetch_failed");
  }

  const user = userJson?.data;
  if (!user?.id || !user?.username) {
    return bounceError(req, state, "invalid_profile");
  }

  // 4) If linking, update the claim with X info
  if (stateRow.purpose === "link") {
    if (!stateRow.claim_id) {
      return bounceError(req, state, "missing_claim_for_link");
    }
    const { error: updErr } = await supa
      .from("claims")
      .update({
        x_user_id: String(user.id),
        x_username: user.username || null,
        x_name: user.name || null,
      })
      .eq("id", stateRow.claim_id);

    if (updErr) {
      return bounceError(req, state, `claim_update_failed:${updErr.message}`);
    }
  } else if (stateRow.purpose !== "signin") {
    // unknown purpose
    return bounceError(req, state, "invalid_purpose");
  }

  // Optional: delete the oauth_state row now that it's used
  await supa.from("oauth_states").delete().eq("state", state);

  // 5) Set session and go to /profile
  const session = signSession({
    xUserId: String(user.id),
    claimId: stateRow.purpose === "link" ? stateRow.claim_id : null,
    iat: Math.floor(Date.now() / 1000),
  });

  const res = NextResponse.redirect(new URL("/profile", req.url));
  res.cookies.set({
    name: "plowed_session",
    value: session,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return withTag(res);
}
