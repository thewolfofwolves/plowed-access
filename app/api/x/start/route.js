export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { supaAdmin } from "@/lib/supa";

function base64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function isUUID(v) {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "link"; // "link" | "view" | ...
  const claimParam = url.searchParams.get("claim");    // might be undefined
  const claim_id = isUUID(claimParam) ? claimParam : null;

  const CLIENT_ID = process.env.TW_CLIENT_ID;               // from X dev portal
  const REDIRECT = `${process.env.APP_BASE_URL}/api/x/callback`; // must match in X app settings
  if (!CLIENT_ID || !REDIRECT) {
    return NextResponse.json({ error: "Missing TW_CLIENT_ID or APP_BASE_URL" }, { status: 500 });
  }

  // PKCE
  const code_verifier = base64url(crypto.randomBytes(32));
  const code_challenge = base64url(crypto.createHash("sha256").update(code_verifier).digest());
  const state = crypto.randomUUID();

  const supa = supaAdmin();

  // Store state + verifier, and optionally claim_id if you passed a real UUID
  const { error } = await supa
    .from("oauth_states")
    .insert({
      state,
      code_verifier,
      purpose: mode,     // e.g. 'link'
      claim_id: claim_id // null if not provided/invalid
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Build the X OAuth 2.0 URL
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    scope: "tweet.read users.read offline.access", // adjust as needed
    state,
    code_challenge,
    code_challenge_method: "S256"
  });

  return NextResponse.redirect(`https://twitter.com/i/oauth2/authorize?${params.toString()}`);
}
