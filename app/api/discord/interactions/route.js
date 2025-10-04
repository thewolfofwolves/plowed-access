import { NextResponse } from "next/server";
import { verifyKey } from "discord-interactions";
import { supaAdmin } from "@/lib/supa";

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const ALLOWED_CHANNEL = process.env.DISCORD_ALLOWED_CHANNEL_ID;
const EPHEMERAL = 1 << 6; // 64

function ok(json) { return NextResponse.json(json); }

function verifyRequest(req, rawBody) {
  const sig = req.headers.get("X-Signature-Ed25519");
  const ts  = req.headers.get("X-Signature-Timestamp");
  if (!sig || !ts) return false;
  try {
    // verifyKey expects raw string body
    return verifyKey(rawBody, sig, ts, PUBLIC_KEY);
  } catch {
    return false;
  }
}

export async function POST(req) {
  // IMPORTANT: use raw text for signature verification
  const raw = await req.text();

  if (!verifyRequest(req, raw)) {
    return new NextResponse("Bad signature", { status: 401 });
  }

  const body = JSON.parse(raw);

  // PING -> PONG
  if (body.type === 1) return ok({ type: 1 });

  // Optionally restrict to one channel
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

    return ok({
      type: 4,
      data: { content: `Your code: **${data}**`, flags: EPHEMERAL }
    });
  }

  return ok({ type: 4, data: { content: "Unknown command.", flags: EPHEMERAL } });
}
