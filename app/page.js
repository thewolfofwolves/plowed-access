"use client";
import { useState } from "react";

export default function Home() {
  const [code, setCode] = useState("");
  const [wallet, setWallet] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      const r = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, wallet }),
      });
      const j = await r.json();
      if (!r.ok) {
        setMsg(j.error || "Failed to claim");
        return;
      }
      // success -> go link X
      window.location.href = "/api/x/start?mode=link";
    } catch (err) {
      setMsg("Network error");
    } finally {
      setLoading(false);
    }
  }

  const shell = {
    maxWidth: 760,
    margin: "48px auto",
    padding: 28,
    background: "rgba(6,10,7,0.72)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 16,
    boxSizing: "border-box",
  };

  const input = {
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

  return (
    <main>
      <div style={shell}>
        <h1 style={{ marginTop: 0 }}>Claim your Early Access</h1>
        <p>
          Enter your access code, then paste your Solana wallet to register. After we accept your
          code, connect Twitter to finish.
        </p>

        <form onSubmit={onSubmit}>
          <label>Access code</label>
          <input
            style={input}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter your code"
            required
          />

          <label>Solana wallet</label>
          <input
            style={input}
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="Enter your Solana address"
            required
          />

          <button type="submit" style={button} disabled={loading}>
            {loading ? "Checking..." : "Continue"}
          </button>
        </form>

        {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
      </div>
    </main>
  );
}
