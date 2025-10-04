// app/api/discord/interactions/route.js
export const runtime = "edge";           // <-- ensures raw body handling is clean
export const dynamic = "force-dynamic";  // (avoid caching)

import { NextResponse } from "next/server";
import { verifyKey } from "discord-interactions";
import { supaAdmin } from "@/lib/supa";

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const ALLOWED_CHANNEL = process.env.DISCORD_ALLOWED_CHANNEL_ID;
const EPHEMERAL = 1 << 6; // 64

const ok = (data) => NextResponse.json(data);

function verifyRequest(req, rawBody) {
  const sig = req.headers.get("X-Signature-Ed25519");
  const ts  = req.headers.get("X-Signature-Timestamp");
  if (!sig || !ts || !PUBLIC_KEY) return false;
  try {
    return verifyKey(rawBody, sig, ts, PUBLIC_KEY);
  } catch {
    return false;
  }
}

export async function POST(req) {
  // IMPORTANT: read raw body for verification
  const raw = await req.text();

  // Verify signature first
  const valid = verifyRequest(req, raw);
  if (!valid) {
    // Log a tiny hint without leaking secrets
    console.log("Discord verify failed. Have PUBLIC_KEY?", !!PUBLIC_KEY);
    return new NextResponse("Bad signature", { status: 401 });
  }

  const body = JSON.parse(raw);

  // PING -> PONG
  if (body.type === 1) {
    return ok({ type: 1 });
  }

  // Channel gate (optional)
  if (ALLOWED_CHANNEL && body.channel_id !== ALLOWED_CHANNEL) {
    return ok({
      type: 4,
      data: { content: "Use this command in the designated channel.", flags: EPHEMERAL }
    });
  }

  const name = body.data?.name;
  const discordId = body.member?.user?.id || body.user?.id;

  if (name === "claim") {
    if (!discordId) {
      return ok({ type: 4, data: { content: "Could not read your Discord ID.", flags: EPHEMERAL } });
    }
    const supa = supaAdmin();
    const { data, error } = await supa.rpc("assign_discord_code", { p_discord_id: discordId });
    if (error) {
      return ok({ type: 4, data: { content: `Database error: ${error.message}`, flags: EPHEMERAL } });
    }
    if (!data) {
      return ok({ type: 4, data: { content: "No codes left in the pool. Please contact an admin.", flags: EPHEMERAL } });
    }
    return ok({ type: 4, data: { content: `Your code: **${data}**`, flags: EPHEMERAL } });
  }

  return ok({ type: 4, data: { content: "Unknown command.", flags: EPHEMERAL } });
}
