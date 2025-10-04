import { NextResponse } from "next/server";
import crypto from "crypto";
import { supaAdmin } from "@/lib/supa";

function b64url(buf){
  return Buffer.from(buf).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

export async function GET(req){
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") || "link").toLowerCase(); // "link" | "view"
  const claimId = searchParams.get("claim"); // required for 'link'

  if (mode === "link" && !claimId)
    return NextResponse.json({ error: "Missing claim id" }, { status: 400 });

  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());

  const supa = supaAdmin();
  const { data, error } = await supa
    .from("oauth_states")
    .insert({ claim_id: claimId || null, code_verifier: verifier, purpose: mode })
    .select("state")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const auth = new URL("https://twitter.com/i/oauth2/authorize");
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("client_id", process.env.TW_CLIENT_ID);
  auth.searchParams.set("redirect_uri", `${process.env.APP_BASE_URL}/api/x/callback`);
  auth.searchParams.set("scope", "users.read");
  auth.searchParams.set("state", data.state);
  auth.searchParams.set("code_challenge", challenge);
  auth.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(auth.toString());
}
