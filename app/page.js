"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [step, setStep] = useState("code"); // "code" -> "wallet" -> "link-x"
  const [code, setCode] = useState("");
  const [tier, setTier] = useState("");
  const [wallet, setWallet] = useState("");
  const [claimId, setClaimId] = useState("");
  const [xStatus, setXStatus] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const x = p.get("x");
    const id = p.get("id");
    if (x) {
      setXStatus(x === "ok" ? "connected" : "error");
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (id) setClaimId(id);
  }, []);

  async function checkCode(e) {
    e.preventDefault();
    const r = await fetch("/api/code/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
    const j = await r.json();
    if (!r.ok) return alert(j.error || "Invalid code");
    setTier(j.tier); setStep("wallet");
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
    setClaimId(j.id);
    setStep("link-x");
  }

  const Card = ({ children }) => (
    <div style={{
      maxWidth: 880, margin: "48px auto", padding: 28,
      background: "rgba(6,10,7,0.72)", backdropFilter: "blur(8px)",
      border: "1px solid rgba(255,255,255,0.10)", borderRadius: 16,
      boxShadow: "0 24px 60px rgba(0,0,0,0.45)"
    }}>{children}</div>
  );
  const inputStyle = {
    display:"block", width:"100%", padding:"14px 16px", margin:"10px 0 16px",
    borderRadius:12, border:"1px solid rgba(255,255,255,0.18)",
    background:"rgba(255,255,255,0.06)", color:"#eaf8eb"
  };
  const buttonStyle = {
    padding:"12px 18px", borderRadius:12, border:"1px solid rgba(255,255,255,0.18)",
    background:"rgba(87,214,127,0.22)", color:"#eaf8eb", cursor:"pointer", textDecoration:"none"
  };

  return (
    <main>
      <Card>
        <h1 style={{ fontSize: 40, margin: "0 0 6px" }}>Claim your Early Access</h1>
        <p style={{ opacity: 0.9, margin: "0 0 20px" }}>
          Enter your access code, then paste your Solana wallet to register for Early Access.
        </p>

        {step === "code" && (
          <form onSubmit={checkCode}>
            <label>Access code</label>
            <input value={code} onChange={e=>setCode(e.target.value)} required style={inputStyle} placeholder="Enter your code"/>
            <button type="submit" style={buttonStyle}>Continue</button>
          </form>
        )}

        {step === "wallet" && (
          <form onSubmit={claim}>
            <p style={{ marginTop: 0 }}>Tier detected: <strong>{tier}</strong></p>
            <label>Solana wallet address</label>
            <input value={wallet} onChange={e=>setWallet(e.target.value)} required placeholder="e.g. 7p9…Xk" style={inputStyle}/>
            <button type="submit" style={buttonStyle}>Save wallet</button>
          </form>
        )}

        {step === "link-x" && (
          <div>
            <h2 style={{ marginTop: 0 }}>Verify your X (Twitter)</h2>
            <p>To finish registration, link your Twitter account.</p>
            <div style={{ display:"flex", gap:12, alignItems:"center" }}>
              <a href={`/api/x/start?mode=link&claim=${encodeURIComponent(claimId)}`} style={buttonStyle}>
                Connect Twitter
              </a>
              {xStatus === "connected" && <span>Twitter linked ✓</span>}
              {xStatus === "error" && <span style={{ color:"#f5a3a3" }}>Linking failed — try again</span>}
            </div>
          </div>
        )}

        <p style={{ marginTop: 12 }}>
          Already signed up?{" "}
          <a href="/profile" style={{ color: "#b9f6c5" }}>
            Sign in with Twitter to see your profile
          </a>
        </p>
      </Card>
    </main>
  );
}
