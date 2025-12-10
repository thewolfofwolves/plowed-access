export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import * as nacl from "tweetnacl";
import { supaAdmin } from "../../../../lib/supa";

/* ---------- helpers ---------- */
function hexToUint8Array(hex) {
  if (!hex) return new Uint8Array();
  hex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const len = hex.length / 2;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return arr;
}

const enc = (s) => new TextEncoder().encode(s);
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Build the allowed-channel Set from env (supports one or many). */
function getAllowedChannelSet() {
  const one = process.env.DISCORD_ALLOWED_CHANNEL_ID || "";
  const many = process.env.DISCORD_ALLOWED_CHANNEL_IDS || "";
  const all = [one, ...many.split(/[,\s]+/)].filter(Boolean);
  return new Set(all);
}
const ALLOWED_CHANNELS = getAllowedChannelSet();

/* ---------- health endpoints ---------- */
export function HEAD() { return new Response("ok", { status: 200 }); }
export function GET()  { return new Response("ok", { status: 200 }); }

/* ---------- main interaction handler ---------- */
export async function POST(req) {
  const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
  if (!PUBLIC_KEY) return new Response("Missing DISCORD_PUBLIC_KEY", { status: 500 });

  // Verify signature
  const sig = req.headers.get("x-signature-ed25519");
  const ts  = req.headers.get("x-signature-timestamp");
  if (!sig || !ts) return new Response("Missing signature headers", { status: 401 });

  const bodyText = await req.text();
  let ok = false;
  try {
    ok = nacl.sign.detached.verify(
      enc(ts + bodyText),
      hexToUint8Array(sig),
      hexToUint8Array(PUBLIC_KEY),
    );
  } catch {
    return new Response("Signature error", { status: 401 });
  }
  if (!ok) return new Response("Bad signature", { status: 401 });

  const body = JSON.parse(bodyText);

  // 1 = PING
  if (body?.type === 1) return json({ type: 1 });

  // 2 = Application command
  if (body?.type === 2) {
    const name = body?.data?.name;

    if (name === "claim") {
      // Restrict to allowed channels (if any specified)
      const channelId = body?.channel_id || "";
      if (ALLOWED_CHANNELS.size > 0 && !ALLOWED_CHANNELS.has(channelId)) {
        const mentions = Array.from(ALLOWED_CHANNELS).map(id => `<#${id}>`).join(", ");
        return json({
          type: 4,
          data: {
            flags: 64, // ephemeral
            content:
              `This command can only be used in ${mentions}.`,
          },
        });
      }

      // Normal flow
      const discordUserId = body?.member?.user?.id || body?.user?.id;
      if (!discordUserId) {
        return json({
          type: 4,
          data: { flags: 64, content: "Could not identify your Discord user." },
        });
      }

      try {
        const supa = supaAdmin();
        // Allocates from public.discord_code_pool via your SQL function
        const { data, error } = await supa.rpc("allocate_discord_early_code", {
          p_discord_user_id: discordUserId,
          p_tier: "Early Access",
        });

        if (error) throw error;
        if (!data?.code) {
          return json({
            type: 4,
            data: { flags: 64, content: "No Early Access codes left. Please ping an admin." },
          });
        }

        return json({
          type: 4,
          data: {
            flags: 64, // ephemeral
            content:
              `🎟️ Your **Early Access** code:\n` +
              `\`\`\`${data.code}\`\`\`\n` +
              `Use it at https://access.plowed.earth`,
          },
        });
      } catch (e) {
        console.error("claim error:", e);
        return json({
          type: 4,
          data: { flags: 64, content: "Something went wrong allocating your code. Try again in a moment." },
        });
      }
    }

    // Unknown command
    return json({ type: 4, data: { flags: 64, content: "Unknown command." } });
  }

  return new Response("ok", { status: 200 });
}
