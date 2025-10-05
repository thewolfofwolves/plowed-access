// app/profile/page.js
import { cookies } from "next/headers";
import crypto from "crypto";
import { supaAdmin } from "@/lib/supa";

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
  // 1) Read session from cookie
  const token = cookies().get("plowed_session")?.value || null;
  const sess = parseSigned(token);

  // --- shared styles (match your main card) ---
  const cardStyle = {
    maxWidth: 760,
    margin: "64px auto",
    padding: "36px 40px",
    background: "rgba(6,10,7,0.75)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
    boxSizing: "border-box",
  };
  const titleStyle = { fontSize: 40, lineHeight: 1.15, margin: "0 0 12px" };
  const leadStyle = { opacity: 0.9, lineHeight: 1.6, margin: "0 0 20px" };
  const buttonStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "12px 18px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(87,214,127,0.22)",
    color: "#eaf8eb",
    textDecoration: "none",
    marginTop: 12,
  };

  // 2) No session → show sign-in card (unchanged behaviour)
  if (!sess?.xUserId) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px 16px" }}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>Your profile</h1>
          <p style={leadStyle}>Sign in with Twitter to view your profile and registered wallet.</p>
          <a href="/api/x/start?mode=signin" style={buttonStyle}>Sign in with Twitter</a>
        </div>
      </main>
    );
  }

  // 3) Have a session → fetch their claim details by x_user_id
  // If there can be multiple claims, we just pick the most recent.
  const supa = supaAdmin();
  const { data: claim } = await supa
    .from("claims")
    .select("id, wallet_address, x_user_id, x_username, x_name, created_at")
    .eq("x_user_id", String(sess.xUserId))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px 16px" }}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Your profile</h1>

        <div style={{ lineHeight: 1.7 }}>
          <p style={{ margin: 0 }}>
            <strong>Twitter ID:</strong> {String(sess.xUserId)}
          </p>
          <p style={{ margin: "6px 0 0" }}>
            <strong>Twitter handle:</strong>{" "}
            {claim?.x_username ? `@${claim.x_username}` : "linked"}
            {claim?.x_name ? ` — ${claim.x_name}` : ""}
          </p>
          <p style={{ margin: "6px 0 0" }}>
            <strong>Wallet:</strong>{" "}
            {claim?.wallet_address || "(no wallet found for this account)"}
          </p>
        </div>

        <p style={{ opacity: 0.8, fontSize: 14, marginTop: 20 }}>
          Tip: to sign out on this device, clear site cookies or visit{" "}
          <a href="/api/signout" style={{ color: "#b9f6c5" }}>Sign out</a>.
        </p>
      </div>
    </main>
  );
}
