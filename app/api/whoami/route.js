export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const APP_SECRET = process.env.APP_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret";

function parseSigned(token) {
  if (!token) return null;
  const [mac, b64] = token.split(".");
  if (!mac || !b64) return null;
  const raw = Buffer.from(b64, "base64url").toString();
  const expect = crypto.createHmac("sha256", APP_SECRET).update(raw).digest("base64url");
  if (mac !== expect) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function GET() {
  const jar = cookies();
  const token = jar.get("plowed_session")?.value || null;
  const session = parseSigned(token);
  return NextResponse.json({ hasCookie: !!token, session });
}
