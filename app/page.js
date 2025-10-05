"use client";
import { useEffect, useMemo, useRef, useState } from "react";

/* --- tiny spinner + global busy flag (does not change UI) --- */
function Spinner({ size = 14, stroke = 2 }) {
  const s = `${size}px`; const r = (size - stroke) / 2;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${size} ${size}`} aria-label="Loading">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={`${Math.PI*r*1.2} ${Math.PI*r*2}`}
              style={{transformOrigin:"50% 50%", animation:"spin .8s linear infinite"}}/>
      <style jsx>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </svg>
  );
}
function useGlobalBusy() {
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(0);
  const restore = useRef(null);
  useEffect(() => {
    if (restore.current) return;
    const orig = window.fetch.bind(window);
    restore.current = () => (window.fetch = orig);
    window.fetch = async (...args) => {
      inFlight.current += 1; setBusy(true);
      try { return await orig(...args); }
      finally { inFlight.current -= 1; if (inFlight.current <= 0) setBusy(false); }
    };
    return () => restore.current && restore.current();
  }, []);
  return busy;
}
function BusyPill({ show }) {
  if (!show) return null;
  return (
    <div aria-hidden="true" style={{ position:"fixed", top:12, right:12, zIndex:9999 }}>
      <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"#000",
                    color:"#fff", borderRadius:9999, padding:"6px 10px",
                    boxShadow:"0 8px 20px rgba(0,0,0,.25)" }}>
        <Spinner />
        <span style={{ fontSize:12 }}>Loading…</span>
      </div>
    </div>
  );
}

export default function Home() {
  // steps: "code" -> "wallet" -> "link-x"
  const [step, setStep] = useState("code");

  const [code, setCode] = useState("");
  const [tier, setTier] = useState("");
  const [wallet, setWallet] = useState("");

  const [claimId, setClaimId] = useState("");
  const [xStatus, setXStatus] = useState(""); // "", "connected", "error"

  const busy = useGlobalBusy();

  // If we come back from Twitter with ?x=ok|error and maybe ?id=<claim_id>
  useEffect(() => {
    const u = new URL(window.location.href);
    const x = u.searchParams.get("x");
    const id = u.searchParams.get("id");
    if (x === "ok") {
      setXStatus("connected");
      if (id) setClaimId(id);
      setStep("link-x");
      window.history.replaceState({}, "", u.pathname);
    } else if (x === "error") {
      setXStatus("error");
      if (id) setClaimId(id);
      setStep("link-x");
      window.history.replaceState({}, "", u.pathname);
    }
  }, []);

  async function checkCode(e) {
    e.preventDefault();
    setTier("");
    const res = await fetch("/api/code/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code })
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || "Invalid or used code");
      return;
    }
    setTier(json.tier || "Early Access");
    setStep("wallet");
  }

  async function submitWallet(e) {
    e.preventDefault();
    const res = await fetch("/api/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, wallet })
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      alert(json.error || "Could not create claim");
      return;
    }
    setClaimId(json.id);
    setStep("link-x");
  }

  const startXLinkUrl = useMemo(
    () => (claimId ? `/api/x/start?mode=link&claim=${encodeURIComponent(claimId)}` : "#"),
    [claimId]
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        backgroundImage: "url(/bg.jpg), url(/bg.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center"
      }}
    >
      <BusyPill show={busy} />

      <div style={{
        background: "rgba(0,0,0,0.7)",
        color: "#fff",
        borderRadius: 14,
        padding: 20,
        width: "100%",
        maxWidth: 520,
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)"
      }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
          PLOWED Access
        </h1>
        <p style={{ opacity: 0.8, marginBottom: 20 }}>
          Claim access with your code, add your Solana wallet, then link your Twitter.
        </p>

        {step === "code" && (
          <form onSubmit={checkCode}>
            <label style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Access code</label>
            <input
              placeholder="Enter your code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              autoComplete="one-time-code"
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                border: "1px solid #2f2f2f", background: "#111", color: "#fff"
              }}
            />
            <div style={{ height: 10 }} />
            <button
              type="submit"
              disabled={!code.trim()}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10,
                background: "#00c26e", color: "#0a0a0a", border: "none",
                fontWeight: 600, cursor: !code.trim() ? "not-allowed" : "pointer",
                opacity: !code.trim() ? 0.6 : 1
              }}
            >
              Continue
            </button>
            <p style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Your code will be verified against our list. Expired or already used codes will be rejected.
            </p>
          </form>
        )}

        {step === "wallet" && (
          <form onSubmit={submitWallet}>
            <div style={{ marginBottom: 8, fontSize: 14, opacity: 0.9 }}>
              Code verified{tier ? ` — Tier: ${tier}` : ""}.
            </div>
            <label style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Solana wallet address</label>
            <input
              placeholder="Your SOL wallet"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              autoFocus
              autoComplete="off"
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                border: "1px solid #2f2f2f", background: "#111", color: "#fff",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
              }}
            />
            <div style={{ height: 10 }} />
            <button
              type="submit"
              disabled={!wallet.trim()}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10,
                background: "#00c26e", color: "#0a0a0a", border: "none",
                fontWeight: 600, cursor: !wallet.trim() ? "not-allowed" : "pointer",
                opacity: !wallet.trim() ? 0.6 : 1
              }}
            >
              Save wallet
            </button>
            <p style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              This wallet will be used for your access claim. Make sure it’s correct.
            </p>
          </form>
        )}

        {step === "link-x" && (
          <div>
            {claimId ? (
              <>
                <div style={{ marginBottom: 12, fontSize: 14 }}>
                  Claim created: <span style={{ fontFamily: "monospace" }}>{claimId}</span>
                </div>
                {xStatus === "connected" && (
                  <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: "#0a311f", color: "#b9f6c5" }}>
                    Twitter linked successfully.
                  </div>
                )}
                {xStatus === "error" && (
                  <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: "#31110a", color: "#f6b9b9" }}>
                    Twitter linking failed. Try again below.
                  </div>
                )}
                <a
                  href={startXLinkUrl}
                  style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", width: "100%" }}
                >
                  <button
                    disabled={!claimId}
                    style={{
                      width: "100%", padding: "12px 14px", borderRadius: 10,
                      background: "#00c26e", color: "#0a0a0a", border: "none",
                      fontWeight: 600, cursor: !claimId ? "not-allowed" : "pointer",
                      opacity: !claimId ? 0.6 : 1
                    }}
                  >
                    Link Twitter now
                  </button>
                </a>
                <p style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                  If you close the window, you can come back later and link from your profile or the resume page.
                </p>
              </>
            ) : (
              <div style={{ padding: 10, borderRadius: 10, background: "#31110a", color: "#f6b9b9" }}>
                Missing claim id. Please go back and re-enter your code and wallet.
              </div>
            )}
          </div>
        )}

        <p style={{ marginTop: 16 }}>
          Already signed up?{" "}
          <a href="/profile" style={{ color: "#b9f6c5", textDecoration: "underline" }}>
            Sign in with Twitter to see your profile
          </a>
        </p>
      </div>
    </main>
  );
}
