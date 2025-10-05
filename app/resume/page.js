// app/resume/page.js
"use client";
import { useState } from "react";

export default function Resume() {
  const [code, setCode] = useState("");
  const [wallet, setWallet] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, wallet })
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error || "Something went wrong");
        return;
      }
      window.location.href = j.url; // /api/x/start?mode=link&claim=...
    } catch (_) {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>
        Resume Twitter Linking
      </h1>
      <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 16 }}>
        Enter the same access code and the same wallet you used when you claimed. If your claim has no Twitter yet, you can link it now.
      </p>

      <form onSubmit={submit}>
        <label style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Access code</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Your code"
          style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8, marginBottom: 12 }}
        />

        <label style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Wallet address</label>
        <input
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          placeholder="Your Solana wallet address"
          style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8, marginBottom: 12, fontFamily: "monospace" }}
        />

        {err && <div style={{ color: "#b00020", fontSize: 14, marginBottom: 12 }}>{err}</div>}

        <button
          type="submit"
          disabled={loading || !code || !wallet}
          style={{
            width: "100%", padding: 12, borderRadius: 8,
            background: "#000", color: "#fff", border: "none", opacity: loading || !code || !wallet ? 0.6 : 1
          }}
        >
          {loading ? "Checking…" : "Link Twitter"}
        </button>
      </form>

      <p style={{ fontSize: 12, opacity: 0.6, marginTop: 16 }}>
        If your claim already has Twitter linked, this page will tell you and stop.
      </p>
    </main>
  );
}
