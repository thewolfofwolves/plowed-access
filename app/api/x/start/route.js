// app/api/x/start/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { supaAdmin } from "@/lib/supa";

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export async function GET(req) {
  const APP_BASE_URL = process.env.APP_BASE_URL; // e.g. https://access.plowed.earth
  const TW_CLIENT_ID = process.env.TW_CLIENT_ID;
  if (!APP_BASE_URL || !TW_CLIENT_ID) {
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  // Use nextUrl (safe for dynamic routes)
  const url = req.nextUrl;
  const mode = url.searchParams.get("mode") || "link"; // 'link' or 'view' (your choice)
  const claimId =
    url.searchParams.get("claim") || req.cookies.get("claim_id")?.value || null;

  // Generate PKCE code_verifier + code_challenge
  const code_verifier = base64url(crypto.randomBytes(32));
  const code_challenge = base64url(
    crypto.createHash("sha256").update(code_verifier).digest()
  );

  // Random state we store in DB so we can retrieve mode/claimId later
  const state = crypto.randomUUID();

  // Persist OAuth state
  const supa = supaAdmin();
  const { error } = await supa.from("oauth_states").insert({
    state,
    code_verifier,
    purpose: mode === "link" ? "link" : "view",
    claim_id: claimId,
  });
  if (error) {
    // absolute redirect on error
    const dest = new URL("/profile?x=error&stage=server", APP_BASE_URL);
    return NextResponse.redirect(dest);
  }

  // Build Twitter OAuth2 URL
  const callback = new URL("/api/x/callback", APP_BASE_URL).toString();
  const twitterAuth = new URL("https://twitter.com/i/oauth2/authorize");
  twitterAuth.searchParams.set("response_type", "code");
  twitterAuth.searchParams.set("client_id", TW_CLIENT_ID);
  twitterAuth.searchParams.set(
    "scope",
    // request only what you need
    "tweet.read users.read offline.access"
  );
  twitterAuth.searchParams.set("redirect_uri", callback);
  twitterAuth.searchParams.set("state", state);
  twitterAuth.searchParams.set("code_challenge", code_challenge);
  twitterAuth.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(twitterAuth.toString());
}
