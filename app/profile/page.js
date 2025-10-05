// app/profile/page.js
import { cookies } from "next/headers";
import crypto from "crypto";
import { redirect } from "next/navigation";

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

export default async function ProfileGate() {
  const token = cookies().get("plowed_session")?.value || null;
  const sess = parseSigned(token);

  if (sess?.xUserId) {
    // Already signed in → show the pretty client page
    redirect("/me");
  }

  // Not signed in → show the sign-in prompt (unchanged styling)
  const card = {
    maxWidth: 760,
    margin: "64px auto",
    padding: "36px 40px",
    background: "rgba(6,10,7,0.75)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
  };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px 16px" }}>
      <div style={card}>
        <h1 style={{ fontSize: 40, lineHeight: 1.15, margin: "0 0 12px" }}>Your profile</h1>
        <p style={{ opacity: 0.9, lineHeight: 1.6, margin: "0 0 20px" }}>
          Sign in with Twitter to view your profile and registered wallet.
        </p>
        <a
          href="/api/x/start?mode=signin"
          style={{
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
          }}
        >
          Sign in with Twitter
        </a>
      </div>
    </main>
  );
}
