export const runtime = "nodejs";

import crypto from "crypto";
import { NextResponse } from "next/server";
import { supaAdmin } from "@/lib/supa";

/**
 * Helpers
 */
function toBase64Url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest();
}

function readCookie(req, name) {
  // Plain header parse (no NextRequest wrapper here)
  const header = req.headers.get("cookie") || "";
  const parts = header.split(";").map((s) => s.trim());
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx > -1) {
      const k = decodeURIComponent(p.slice(0, idx));
      const v = decodeURIComponent(p.slice(idx + 1));
      if (k === name) return v;
    }
  }
  return null;
}

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/x/start?mode=link&claim=<uuid>
 *
 * - Accepts claim via query OR the short-lived x_claim cookie (fallback)
 * - Saves PKCE + state into oauth_states
 * - Redirects to X authorize URL
 */
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "link";
    let claimId = url.searchParams.get("claim");

    // fallback to cookie if query is missing
    if (!claimId) {
      const cookieVal = readCookie(req, "x_claim");
      if (cookieVal && uuidRegex.test(cookieVal)) {
        claimId = cookieVal;
      }
    }

    // Require a valid UUID for link mode
    if (mode === "link" && (!claimId || !uuidRegex.test(claimId))) {
      // Soft redirect back to /profile with an error flag
      return NextResponse.redirect("/profile?x=error&stage=missing_claim", 302);
    }

    const CLIENT_ID = process.env.TW_CLIENT_ID;
    const APP_BASE_URL = process.env.APP_BASE_URL; // e.g. https://access.plowed.earth
    if (!CLIENT_ID || !APP_BASE_URL) {
      return NextResponse.json(
        { error: "Missing TW_CLIENT_ID or APP_BASE_URL" },
        { status: 500 }
      );
    }

    const redirectUri = `${APP_BASE_URL}/api/x/callback`;

    // Create PKCE verifier/challenge + state
    const codeVerifier = toBase64Url(crypto.randomBytes(32));
    const codeChallenge = toBase64Url(sha256(codeVerifier));
    const state = crypto.randomUUID();

    // Persist oauth state
    const supa = supaAdmin();
    const insert = {
      state,
      code_verifier: codeVerifier,
      purpose: mode === "view" ? "view" : "link",
      created_at: new Date().toISOString(),
    };
    if (claimId) insert.claim_id = claimId;

    const { error } = await supa.from("oauth_states").insert(insert);
    if (error) {
      console.error("oauth_states insert error:", error);
      return NextResponse.json(
        { error: "Could not start Twitter OAuth" },
        { status: 500 }
      );
    }

    // Scopes: we only need profile info
    const scope = encodeURIComponent("tweet.read users.read offline.access");

    const authUrl =
      "https://twitter.com/i/oauth2/authorize" +
      `?response_type=code` +
      `&client_id=${encodeURIComponent(CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${scope}` +
      `&state=${encodeURIComponent(state)}` +
      `&code_challenge=${encodeURIComponent(codeChallenge)}` +
      `&code_challenge_method=S256`;

    return NextResponse.redirect(authUrl, 302);
  } catch (e) {
    console.error("x/start error:", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
