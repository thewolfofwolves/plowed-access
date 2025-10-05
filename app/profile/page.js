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
  const jar = cookies();
  const token = jar.get("plowed_session")?.value || null;
  const sess = parseSigned(token);

  if (!sess?.claimId || !sess?.xUserId) {
    // no session — fall back to your existing sign-in UI
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div style={{ maxWidth: 760, margin: "48px auto", padding: 28, background: "rgba(6,10,7,0.72)", borderRadius: 16 }}>
          <h1>Your profile</h1>
          <p>Sign in with Twitter to view your profile and registered wallet.</p>
          <a href="/api/x/start?mode=signin" style={{
            padding: "12px 18px", borderRadius: 12, background: "rgba(87,214,127,0.22)", color: "#eaf8eb", textDecoration: "none"
          }}>
            Sign in with Twitter
          </a>
        </div>
      </main>
    );
  }

  // Have a valid session → fetch claim details and show them immediately
  const supa = supaAdmin();
  const { data: claim } = await supa
    .from("claims")
    .select("id, wallet_address, x_username, x_name")
    .eq("id", sess.claimId)
    .single();

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ maxWidth: 760, margin: "48px auto", padding: 28, background: "rgba(6,10,7,0.72)", borderRadius: 16 }}>
        <h1>Your profile</h1>
        {claim ? (
          <>
            <p><strong>Wallet:</strong> {claim.wallet_address}</p>
            <p><strong>Twitter:</strong> {claim.x_username || "(linked)"} {claim.x_name ? `— ${claim.x_name}` : ""}</p>
          </>
        ) : (
          <p>Couldn’t load your claim. Try refreshing.</p>
        )}
        <p style={{ opacity: 0.8, marginTop: 16 }}>
          Tip: You can clear this device’s session by clearing site cookies.
        </p>
      </div>
    </main>
  );
}
