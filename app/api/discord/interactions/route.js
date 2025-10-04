export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { verifyKey } from "discord-interactions";
import { supaAdmin } from "@/lib/supa";

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const APP_ID = process.env.DISCORD_APP_ID;
const ALLOWED_CHANNEL = process.env.DISCORD_ALLOWED_CHANNEL_ID;

const EPHEMERAL = 1 << 6; // 64
const ok = (data) => NextResponse.json(data);

function isValidSignature(req, rawBody) {
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
  const raw = await req.text();

  if (!isValidSignature(req, raw)) {
    console.log("Discord verify failed", {
      hasPK: !!PUBLIC_KEY, pkLen: (PUBLIC_KEY || "").length,
      hasSig: !!req.headers.get("X-Signature-Ed25519"),
      hasTs:  !!req.headers.get("X-Signature-Timestamp"),
      rawLen: raw.length
    });
    return new NextResponse("Bad signature", { status: 401 });
  }

  let body;
  try { body = JSON.parse(raw); } catch { return new NextResponse("Bad JSON", { status: 400 }); }

  // PING -> PONG
  if (body.type === 1) return ok({ type: 1 });

  const name = body.data?.name;
  const guildId = body.guild_id;
  const channelId = body.channel_id;
  const discordId = body.member?.user?.id || body.user?.id;
  const token = body.token;

  // Optional: channel gate (we still defer if wrong channel to avoid Discord error)
  if (ALLOWED_CHANNEL && channelId !== ALLOWED_CHANNEL) {
    return ok({
      type: 4,
      data: { content: "Use this command in the designated channel.", flags: EPHEMERAL }
    });
  }

  if (name === "claim") {
    // 1) ACK immediately (defer ephemeral)
    const immediate = ok({ type: 5, data: { flags: EPHEMERAL } });

    // 2) do the work and send a follow-up message
    (async () => {
      try {
        if (!discordId) throw new Error("No Discord ID on interaction.");

        const supa = supaAdmin();
        const { data, error } = await supa.rpc("assign_discord_code", { p_discord_id: discordId });
        if (error) throw new Error(error.message);

        const content = data
          ? `Your code: **${data}**`
          : "No codes left in the pool. Please contact an admin.";

        await fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, flags: EPHEMERAL })
        });
      } catch (e) {
        console.error("claim follow-up error:", e?.message || e);
        try {
          await fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: `Error: ${e?.message || "server error"}`, flags: EPHEMERAL })
          });
        } catch {}
      }
    })();

    return immediate;
  }

  // Unknown command
  return ok({ type: 4, data: { content: "Unknown command.", flags: EPHEMERAL } });
}
