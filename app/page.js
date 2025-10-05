"use client";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  // steps: "code" -> "wallet" -> "link-x"
  const [step, setStep] = useState("code");

  const [code, setCode] = useState("");
  const [tier, setTier] = useState("");
  const [wallet, setWallet] = useState("");

  const [claimId, setClaimId] = useState("");
  const [xStatus, setXStatus] = useState(""); // "", "connected", "error"

  // local loading flags (only change button content/state)
  const [checkingCode, setCheckingCode] = useState(false);
  const [savingWallet, setSavingWallet] = useState(false);
  const [resuming, setResuming] = useState(false);

  // track and restore focus to the field the user was in
  const codeRef = useRef(null);
  const walletRef = useRef(null);
  const lastFocusedRef = useRef(null); // "code" | "wallet" | null

  // If focus drops to <body> after a render, put it back to the last focused field
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) {
      const targetKey = lastFocusedRef.current;
      if (targetKey === "code" && codeRef.current) codeRef.current.focus();
      if (targetKey === "wallet" && walletRef.current) walletRef.current.focus();
    }
  });

  // tiny inline spinner (no layout changes)
  const Spinner = ({ size = 14, stroke = 2 }) => {
    const s = `${size}px`;
    const r = (size - stroke) / 2;
    return (
      <svg width={s} height={s} viewBox={`0 0 ${size} ${size}`} aria-label="Loading" style={{ marginRight: 8 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={`${Math.PI*r*1.2} ${Math.PI*r*2}`}
                style={{ transformOrigin:"50% 50%", animation:"spin .8s linear infinite" }}/>
        <style jsx>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </svg>
    );
  };

  // Handle return from Twitter (?x=ok|error & ?id=<claim_id>)
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
    if (checkingCode) return;
    setCheckingCode(true);
    try {
      const r = await fetch("/api/code/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert(j.error || "Invalid code");
        return;
      }
      setTier(j.tier || "Early Access");
      setStep("wallet");
      // when we switch to wallet step, move focus into wallet field
      lastFocusedRef.current = "wallet";
      // delay to next frame to ensure DOM exists
      requestAnimationFrame(() => walletRef.current && walletRef.current.focus());
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setCheckingCode(false);
    }
  }

  async function claim(e) {
    e.preventDefault();
    if (savingWallet) return;
    setSavingWallet(true);
    try {
      const r = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, wallet }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert(j.error || "Claim failed");
        return;
      }
      setClaimId(j.id);
      setStep("link-x"); // force Twitter link to complete registration
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setSavingWallet(false);
    }
  }

  // resume flow (code + wallet must match the original claim)
  async function resumeLinking(e) {
    e.preventDefault();
    if (resuming) return;
    setResuming(true);
    try {
      const r = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, wallet }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert(j.error || "Could not resume. Check code and wallet are the same as your original claim.");
        return;
      }
      window.location.href = j.url; // /api/x/start?mode=link&claim=...
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setResuming(false);
    }
  }

  // --- styles ---
  const Card = ({ children }) => (
    <div
      style={{
        maxWidth: 760,               // consistent content width
        margin: "48px auto",
        padding: 28,
        background: "rgba(6,10,7,0.72)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 16,
        boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );

  const inputStyle = {
    display: "block",
    width: "100%",
    padding: "14px 16px",
    margin: "10px 0 16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "#eaf8eb",
    boxSizing: "border-box",
  };

  const buttonStyle = {
    padding: "12px 18px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(87,214,127,0.22)",
    color: "#eaf8eb",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center"
  };

  const buttonDisabledStyle = {
    ...buttonStyle,
    cursor: "not-allowed",
    opacity: 0.6
  };

  return (
    <main>
      <Card>
        <h1 style={{ fontSize: 40, margin: "0 0 6px" }}>Claim your Early Access</h1>
        <p style={{ opacity: 0.9, margin: "0 0 20px" }}>
          Enter your access code, then paste your Solana wallet to register for Early Access.
        </p>

        {step === "code" && (
          <>
            <form onSubmit={checkCode}>
              <label>Access code</label>
              <input
                ref={codeRef}
                onFocus={() => (lastFocusedRef.current = "code")}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                style={inputStyle}
                placeholder="Enter your code"
                autoComplete="one-time-code"
                inputMode="text"
              />
              <button type="submit" style={checkingCode ? buttonDisabledStyle : buttonStyle} disabled={checkingCode}>
                {checkingCode && <Spinner />}
                {checkingCode ? "Checking…" : "Continue"}
              </button>
            </form>

            {/* Resume block for people with used codes */}
            <div style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <p style={{ margin: "0 0 8px", opacity: 0.9 }}>
                Already claimed but didn’t link Twitter?
              </p>
              <form onSubmit={resumeLinking} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
                <input
                  ref={walletRef}
                  onFocus={() => (lastFocusedRef.current = "wallet")}
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value)}
                  required
                  style={inputStyle}
                  placeholder="Enter the same wallet you used"
                  autoComplete="off"
                />
                <button type="submit" style={resuming ? buttonDisabledStyle : buttonStyle} disabled={resuming}>
                  {resuming && <Spinner />}
                  {resuming ? "Resuming…" : "Resume linking"}
                </button>
              </form>
              <p style={{ marginTop: 8, opacity: 0.8, fontSize: 14 }}>
                We’ll verify your code and wallet, then send you to Twitter to finish linking.
              </p>
            </div>
          </>
        )}

        {step === "wallet" && (
          <form onSubmit={claim}>
            <p style={{ marginTop: 0 }}>
              Tier detected: <strong>{tier}</strong>
            </p>
            <label>Solana wallet address</label>
            <input
              ref={walletRef}
              onFocus={() => (lastFocusedRef.current = "wallet")}
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              required
              style={inputStyle}
              placeholder="e.g. 7p9…Xk"
              autoComplete="off"
            />
            <button type="submit" style={savingWallet ? buttonDisabledStyle : buttonStyle} disabled={savingWallet}>
              {savingWallet && <Spinner />}
              {savingWallet ? "Saving…" : "Save wallet"}
            </button>
          </form>
        )}

        {step === "link-x" && (
          <div>
            <h2 style={{ marginTop: 0 }}>Verify your X (Twitter)</h2>
            <p>To finish registration, link your Twitter account.</p>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <a
                href={`/api/x/start?mode=link&claim=${encodeURIComponent(claimId)}`}
                style={buttonStyle}
              >
                Connect Twitter
              </a>
              {xStatus === "connected" && <span>Twitter linked ✓</span>}
              {xStatus === "error" && (
                <span style={{ color: "#f5a3a3" }}>
                  Linking failed — try again
                </span>
              )}
            </div>
            {xStatus === "connected" && (
              <p style={{ marginTop: 14 }}>
                You’re done. View your profile at{" "}
                <a href="/profile" style={{ color: "#b9f6c5" }}>
                  Profile
                </a>.
              </p>
            )}
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
