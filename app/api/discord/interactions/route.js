export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import * as nacl from "tweetnacl";
import { supaAdmin } from "@/lib/supa";

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
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export function HEAD() { return new Response("ok", { status: 200 }); }
export function GET()  { return new Response("ok", { status: 200 }); }

export async function POST(req) {
  const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
  if (!PUBLIC_KEY) return new Response("Missing DISCORD_PUBLIC_KEY", { status: 500 });

  const sig = req.headers.get("x-signature-ed25519");
  const ts  = req.headers.get("x-signature-timestamp");
  if (!sig || !ts) return new Response("Missing signature headers", { status: 401 });

  const bodyText = await req.text();

  let ok = false;
  try {
    ok = nacl.sign.detached.verify(enc(ts + bodyText), hexToUint8Array(sig), hexToUint8Array(PUBLIC_KEY));
  } catch {
    return new Response("Signature error", { status: 401 });
  }
  if (!ok) return new Response("Bad signature", { status: 401 });

  const body = JSON.parse(bodyText);

  // PING -> PONG
  if (body?.type === 1) return json({ type: 1 });

  if (body?.type === 2) {
    const name = body?.data?.name;

    if (name === "claim") {
      const discordUserId = body?.member?.user?.id || body?.user?.id;
      if (!discordUserId) {
        return json({ type: 4, data: { flags: 64, content: "Could not identify your Discord user." } });
      }

      try {
        const supa = supaAdmin();

        // Call the SQL function that allocates from discord_code_pool
        const { data, error } = await supa.rpc("allocate_discord_early_code", {
          p_discord_user_id: discordUserId,
          p_tier: "Early Access",
        });

        if (error) throw error;
        if (!data?.code) {
          return json({ type: 4, data: { flags: 64, content: "No Early Access codes left. Please ping an admin." } });
        }

        return json({
          type: 4,
          data: {
            flags: 64,
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

    return json({ type: 4, data: { flags: 64, content: "Unknown command." } });
  }

  return new Response("ok", { status: 200 });
}
