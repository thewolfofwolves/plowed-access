import { NextResponse } from "next/server";
import nacl from "tweetnacl";
import { supaAdmin } from "@/lib/supa";

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const ALLOWED_CHANNEL = process.env.DISCORD_ALLOWED_CHANNEL_ID;
const EPHEMERAL = 1 << 6; // 64

function verifySignature(req, rawBody) {
  const sig = req.headers.get("X-Signature-Ed25519");
  const ts  = req.headers.get("X-Signature-Timestamp");
  if (!sig || !ts) return false;
  return nacl.sign.detached.verify(
    Buffer.from(ts + rawBody),
    Buffer.from(sig, "hex"),
    Buffer.from(PUBLIC_KEY, "hex")
  );
}

export async function POST(req) {
  const raw = await req.text();
  if (!verifySignature(req, raw)) {
    return new NextResponse("Bad signature", { status: 401 });
  }

  const body = JSON.parse(raw);

  // PING
  if (body.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // Channel gate (optional but recommended)
  if (ALLOWED_CHANNEL && body.channel_id !== ALLOWED_CHANNEL) {
    return NextResponse.json({
      type: 4,
      data: { content: "Use this command in the designated channel.", flags: EPHEMERAL }
    });
  }

  const name = body.data?.name;
  const discordId = body.member?.user?.id || body.user?.id;

  if (name === "referral") {
    if (!discordId) {
      return NextResponse.json({
        type: 4,
        data: { content: "Could not read your Discord ID.", flags: EPHEMERAL }
      });
    }

    // Ask Postgres to assign or fetch an existing code atomically
    const supa = supaAdmin();
    const { data, error } = await supa.rpc("assign_discord_code", { p_discord_id: discordId });

    if (error) {
      return NextResponse.json({
        type: 4,
        data: { content: `Database error: ${error.message}`, flags: EPHEMERAL }
      });
    }

    if (!data) {
      return NextResponse.json({
        type: 4,
        data: { content: "No codes left in the pool. Please contact an admin.", flags: EPHEMERAL }
      });
    }

    // Success
    return NextResponse.json({
      type: 4,
      data: {
        content: `Your referral code: **${data}**`,
        flags: EPHEMERAL
      }
    });
  }

  // Unknown command
  return NextResponse.json({
    type: 4,
    data: { content: "Unknown command.", flags: EPHEMERAL }
  });
}
