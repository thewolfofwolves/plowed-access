// app/api/discord/interactions/route.js
//
// - HEAD/GET => 200 so the Dev Portal can verify the URL
// - POST verifies Discord signatures (tweetnacl) and handles PING + /claim
// - Forces Node.js runtime, disables caching to avoid weirdness

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import * as nacl from "tweetnacl"; // <-- works in all envs

// ---- Simple reachability checks for the portal ----
export function HEAD() {
  return new Response("ok", { status: 200 });
}
export function GET() {
  return new Response("ok", { status: 200 });
}

// ---- helpers for signature verification ----
function hexToUint8Array(hex) {
  if (!hex) return new Uint8Array();
  hex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const len = hex.length / 2;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}
function strToUint8Array(str) {
  return new TextEncoder().encode(str);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---- POST: Discord interactions ----
export async function POST(req) {
  try {
    const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
    if (!PUBLIC_KEY) return new Response("Missing DISCORD_PUBLIC_KEY", { status: 500 });

    const sig = req.headers.get("x-signature-ed25519");
    const ts = req.headers.get("x-signature-timestamp");
    if (!sig || !ts) return new Response("Missing signature headers", { status: 401 });

    // MUST verify the raw body (text)
    const bodyText = await req.text();

    let isValid = false;
    try {
      isValid = nacl.sign.detached.verify(
        strToUint8Array(ts + bodyText),
        hexToUint8Array(sig),
        hexToUint8Array(PUBLIC_KEY)
      );
    } catch (e) {
      console.error("Signature verify threw:", e);
      return new Response("Signature error", { status: 401 });
    }

    if (!isValid) return new Response("Bad signature", { status: 401 });

    // Safe to parse
    const body = JSON.parse(bodyText);

    // PING ↔ PONG
    if (body?.type === 1) {
      return json({ type: 1 });
    }

    // Application command
    if (body?.type === 2) {
      const command = body?.data?.name;

      if (command === "claim") {
        // 4 = CHANNEL_MESSAGE_WITH_SOURCE ; flags 64 = ephemeral
        return json({
          type: 4,
          data: {
            flags: 64,
            content:
              "🌱 Endpoint is live and verified. Your **Early Access** request is noted.\n" +
              "Once registered on the site, your referral code will show on your profile.",
          },
        });
      }

      return json({
        type: 4,
        data: { flags: 64, content: "Unknown command." },
      });
    }

    // Any other type
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("Route error:", e);
    return new Response("Internal error", { status: 500 });
  }
}
