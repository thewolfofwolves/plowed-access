import { NextResponse } from "next/server";
import { supaAdmin } from "@/lib/supa";
import bs58 from "bs58";

function isSol(addr) {
  try { return bs58.decode(addr.trim()).length === 32; } catch { return false; }
}

export async function PATCH(req) {
  try {
    const xuid = req.cookies.get("x_uid")?.value;
    if (!xuid) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { wallet } = await req.json();
    const w = (wallet || "").trim();
    if (!w) return NextResponse.json({ error: "Wallet is required" }, { status: 400 });
    if (!isSol(w)) return NextResponse.json({ error: "Invalid Solana address" }, { status: 400 });

    const supa = supaAdmin();

    // Find the most recent claim for this Twitter user
    const { data: claim, error: findErr } = await supa
      .from("claims")
      .select("id, tier")
      .eq("x_user_id", xuid)
      .order("claimed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 400 });
    if (!claim) return NextResponse.json({ error: "No profile found" }, { status: 404 });

    // Update the wallet. Unique index on (wallet_address, tier) may reject duplicates.
    const { data: updated, error: updErr } = await supa
      .from("claims")
      .update({ wallet_address: w })
      .eq("id", claim.id)
      .select("id, wallet_address, tier, x_user_id, x_username, x_name, x_avatar_url")
      .single();

    if (updErr) {
      // Postgres unique violation code
      if (updErr.code === "23505") {
        return NextResponse.json({ error: "That wallet is already registered for this tier." }, { status: 409 });
      }
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, claim: updated });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
