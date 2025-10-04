// app/api/discord/interactions/route.js
//
// ✅ HEAD/GET return 200 so Discord Dev Portal can verify the URL.
// ✅ POST verifies signatures and handles PING/commands.
// ✅ /claim replies ephemerally (only the user sees it).

import nacl from "tweetnacl";

// --- HEAD/GET used by the portal to verify reachability ---
export function HEAD() {
  return new Response("ok", { status: 200 });
}
export function GET() {
  return new Response("ok", { status: 200 });
}

// ---- helpers for signature verification ----
function hexToUint8Array(hex) {
  if (hex.startsWith("0x")) hex = hex.slice(2);
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return arr;
}
function strToUint8Array(str) {
  return new TextEncoder().encode(str);
}

// ---- POST: Discord interactions ----
export async function POST(req) {
  const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
  if (!PUBLIC_KEY) return new Response("Missing DISCORD_PUBLIC_KEY", { status: 500 });

  const sig = req.headers.get("x-signature-ed25519");
  const ts  = req.headers.get("x-signature-timestamp");
  if (!sig || !ts) return new Response("Bad request", { status: 401 });

  // IMPORTANT: verify against the raw body
  const bodyText = await req.text();
  try {
    const ok = nacl.sign.detached.verify(
      strToUint8Array(ts + bodyText),
      hexToUint8Array(sig),
      hexToUint8Array(PUBLIC_KEY)
    );
    if (!ok) return new Response("Bad signature", { status: 401 });
  } catch {
    return new Response("Signature check failed", { status: 401 });
  }

  const body = JSON.parse(bodyText);

  // Ping ↔ Pong
  if (body?.type === 1) {
    return Response.json({ type: 1 });
  }

  // Slash command
  if (body?.type === 2) {
    const command = body?.data?.name;

    if (command === "claim") {
      // 4 = CHANNEL_MESSAGE_WITH_SOURCE, flags 64 = ephemeral
      return Response.json({
        type: 4,
        data: {
          flags: 64,
          content:
            "🌱 Thanks! Endpoint is live.\n" +
            "Your **Early Access** claim is noted. Once you’ve registered on the site, your referral code shows in your profile.",
        },
      });
    }

    return Response.json({
      type: 4,
      data: { flags: 64, content: "Unknown command." }
    });
  }

  return new Response("ok", { status: 200 });
}
