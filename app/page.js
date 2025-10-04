"use client";
import { useState } from "react";

export default function Home() {
  const [step, setStep] = useState("code");       // "code" | "wallet" | "done"
  const [code, setCode] = useState("");
  const [tier, setTier] = useState();
  const [wallet, setWallet] = useState("");
  const [receipt, setReceipt] = useState({ wallet: "", tier: "" });

  const short = (a = "") => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : "");

  async function checkCode(e) {
    e.preventDefault();
    const r = await fetch("/api/code/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
    const j = await r.json();
    if (!r.ok) return alert(j.error || "Invalid code");
    setTier(j.tier);
    setStep("wallet");
  }

  async function claim(e) {
    e.preventDefault();
    const r = await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, wallet })
    });
    const j = await r.json();
    if (!r.ok) return alert(j.error || "Claim failed");
    setReceipt({ wallet: j.wallet, tier: j.tier });
    setStep("done");
  }

  const Card = ({ children }) => (
    <div
      style={{
        background: "rgba(6, 10, 7, 0.68)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 22,
        boxShadow: "0 20px 50px rgba(0,0,0,0.35)"
      }}
    >
      {children}
    </div>
  );

  const inputStyle = {
    display: "block",
    width: "100%",
    padding: "12px 14px",
    margin: "8px 0 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    outline: "none",
    background: "rgba(255,255,255,0.06)",
    color: "#eaf8eb"
  };

  const buttonStyle = {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(87, 214, 127, 0.2)",
    color: "#eaf8eb",
    cursor: "pointer"
  };

  return (
    <main>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 36, margin: "0 0 8px" }}>Claim your Early Access</h1>
        <p style={{ opacity: 0.9, margin: 0 }}>
          Enter your access code, then paste your Solana wallet to register for Early Access.
        </p>
      </div>

      <Card>
        {step === "code" && (
          <form onSubmit={checkCode}>
            <label>Access code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              style={inputStyle}
              placeholder="Enter your code"
            />
            <button type="submit" style={buttonStyle}>Continue</button>
          </form>
        )}

        {step === "wallet" && (
          <form onSubmit={claim}>
            <p style={{ marginTop: 0 }}>
              Tier detected: <strong>{tier}</strong>
            </p>
            <label>Solana wallet address</label>
            <input
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              required
              placeholder="e.g. 7p9…Xk"
              style={inputStyle}
            />
            <button type="submit" style={buttonStyle}>Save wallet</button>
          </form>
        )}

        {step === "done" && (
          <div>
            <h2 style={{ marginTop: 0 }}>All set</h2>
            <p>
              Wallet <code>{short(receipt.wallet)}</code> successfully submitted
              {receipt.tier ? <> for <strong>{receipt.tier}</strong></> : null}.
            </p>
            <p style={{ opacity: 0.8, marginBottom: 0 }}>
              Keep this page as your receipt.
            </p>
          </div>
        )}
      </Card>
    </main>
  );
}
