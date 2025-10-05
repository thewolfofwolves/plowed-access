// app/profile/page.js
import { cookies } from "next/headers";
import crypto from "crypto";
import { supaAdmin } from "@/lib/supa";

/* ----- session cookie parsing ----- */
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

export default async function ProfilePage() {
  // 1) session
  const token = cookies().get("plowed_session")?.value || null;
  const sess = parseSigned(token);

  // shared styles
  const card = {
    maxWidth: 820,
    margin: "64px auto",
    padding: "34px 38px",
    background: "rgba(6,10,7,0.75)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
  };
  const title = { fontSize: 44, margin: "0 0 18px" };
  const row = { margin: "8px 0" };
  const subtle = { opacity: 0.85 };

  // 2) unauthenticated → sign-in card
  if (!sess?.xUserId) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px 16px" }}>
        <div style={card}>
          <h1 style={title}>Your profile</h1>
          <p style={subtle}>Sign in with Twitter to view your profile and registered wallet.</p>
          <a
            href="/api/x/start?mode=signin"
            style={{
              display: "inline-flex",
              padding: "12px 18px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(87,214,127,0.22)",
              color: "#eaf8eb",
              textDecoration: "none",
              marginTop: 8,
            }}
          >
            Sign in with Twitter
          </a>
        </div>
      </main>
    );
  }

  // 3) signed in → fetch claim + code/tier
  const supa = supaAdmin();
  const { data: claim } = await supa
    .from("claims")
    .select("id, wallet_address, x_user_id, x_username, x_name, created_at, code_id")
    .eq("x_user_id", String(sess.xUserId))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let codeRow = null;
  if (claim?.code_id) {
    const { data } = await supa
      .from("codes")
      .select("id, code, tier")
      .eq("id", claim.code_id)
      .single();
    codeRow = data || null;
  }

  const wallet = claim?.wallet_address || "";
  const tier = codeRow?.tier || "Early Access";
  const referral = codeRow?.code || null;           // change if you store a separate referral field
  const handle = claim?.x_username ? `@${claim.x_username}` : "linked";

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px 16px" }}>
      <div style={card}>
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16 }}>
          <h1 style={title}>Your Farmer profile</h1>
          <a
            href="/api/signout"
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "#eaf8eb",
              textDecoration: "none",
              whiteSpace: "nowrap",
              marginTop: 6,
              height: 38,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Sign out
          </a>
        </div>

        {/* details */}
        <p style={row}><strong>Wallet:</strong> {wallet || "(no wallet found for this account)"}</p>
        <p style={row}><strong>Tier:</strong> {tier}</p>
        <p style={row}><strong>Referral code:</strong> {referral ?? "(not available)"}</p>

        {/* twitter block */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
          <div
            style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(255,255,255,0.12)",
              display: "inline-block",
            }}
          />
          <div>
            <div style={{ fontWeight: 600 }}>{claim?.x_name || "Linked account"}</div>
            <div style={{ opacity: 0.85 }}>{handle}</div>
          </div>
        </div>

        {/* update wallet (server-post — no client hooks) */}
        <form
          method="post"
          action="/api/profile/wallet"
          style={{ marginTop: 16 }}
        >
          <label htmlFor="wallet" style={{ display: "block", marginBottom: 8 }}>
            Update wallet address
          </label>
          <input
            id="wallet"
            name="wallet"
            defaultValue={wallet}
            placeholder="Paste a new Solana wallet"
            style={{
              display: "block",
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "#eaf8eb",
              boxSizing: "border-box",
              marginBottom: 10,
            }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(87,214,127,0.22)",
              color: "#eaf8eb",
              cursor: "pointer",
            }}
          >
            Save wallet
          </button>
          {!wallet && (
            <p style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
              If you didn’t finish linking earlier, resume from the main page using the same code and this wallet.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
