"use client";
import { useEffect, useState } from "react";

export default function Me() {
  const [rec, setRec] = useState(null);
  const [msg, setMsg] = useState("Loading…");
  const [formWallet, setFormWallet] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/profile/me");
      const j = await r.json();
      if (!r.ok) { setMsg(j.error || "Not signed in"); return; }
      setRec(j);
      setFormWallet(j.wallet_address || "");
      setMsg("");
    })();
  }, []);

  const shell = {
    maxWidth: 760,              // << tighter, consistent content width
    margin: "48px auto",
    padding: 28,
    background: "rgba(6,10,7,0.72)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 16,
    boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
    boxSizing: "border-box",
  };

  const inputStyle = {
    display: "block",
    width: "100%",
    padding: "12px 14px",
    margin: "8px 0 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "#eaf8eb",
    boxSizing: "border-box",
  };

  const button = {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(87,214,127,0.22)",
    color: "#eaf8eb",
    cursor: "pointer",
  };

  async function saveWallet(e) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg("");
    const r = await fetch("/api/profile/me/wallet", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: formWallet }),
    });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) { setSaveMsg(j.error || "Failed to update wallet"); return; }
    setSaveMsg("Wallet updated ✓");
    setRec(prev => prev ? { ...prev, wallet_address: j.claim.wallet_address } : prev);
  }

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/profile"; // back to "Sign in with Twitter"
  }

  return (
    <main>
      <div style={shell}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <h1 style={{ margin: 0 }}>Your Farmer profile</h1>
          <button onClick={signOut} style={button}>Sign out</button>
        </div>

        {msg && <p style={{ opacity: 0.9 }}>{msg}</p>}

        {rec && (
          <>
            <p><strong>Wallet:</strong> {rec.wallet_address}</p>
            <p><strong>Tier:</strong> {rec.tier}</p>

            {rec.x_username && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                {rec.x_avatar_url && (
                  <img src={rec.x_avatar_url} width={64} height={64} style={{ borderRadius: 12 }} alt="avatar" />
                )}
                <div>
                  <div><strong>{rec.x_name}</strong></div>
                  <div>@{rec.x_username}</div>
                </div>
              </div>
            )}

            <hr style={{ margin: "24px 0", borderColor: "rgba(255,255,255,0.12)" }} />

            <form onSubmit={saveWallet}>
              <label>Update wallet address</label>
              <input
                value={formWallet}
                onChange={(e) => setFormWallet(e.target.value)}
                style={inputStyle}
                placeholder="Enter your Solana wallet"
                required
              />
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <button type="submit" style={button} disabled={saving}>
                  {saving ? "Saving…" : "Save wallet"}
                </button>
                {saveMsg && <span style={{ opacity: 0.9 }}>{saveMsg}</span>}
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
