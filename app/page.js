"use client";
import { useState } from "react";

/**
 * Home page
 * - User pastes Early Access code
 * - We POST /api/claim (your server will also set the short-lived x_claim cookie)
 * - On success we store claimId and render a "Sign in with Twitter" button:
 *     /api/x/start?mode=link&claim=<claimId>
 * - If the user somehow loses the claimId, /api/x/start still has the cookie fallback
 */
export default function Page() {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [claimId, setClaimId] = useState(null);

  async function submitCode(e) {
    e.preventDefault();
    setMsg("");
    setSubmitting(true);
    try {
      // You already have /api/claim that:
      //  - verifies the code + wallet (if you require wallet here, add a field and include it)
      //  - calls your claim_code RPC
      //  - returns { ok:true, id, tier } and sets a short-lived x_claim cookie
      const r = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), wallet: "" /* add if you collect wallet here */ }),
      });
      const j = await r.json();
      if (!r.ok) {
        setMsg(j.error || "Could not claim that code.");
        setSubmitting(false);
        return;
      }
      setClaimId(j.id); // <-- we’ll use this to build the Twitter link
      setMsg("Code accepted. Connect Twitter to finish.");
    } catch (e) {
      setMsg("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const shell = {
    maxWidth: 760,
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

  const linkBtn = {
    ...button,
    display: "inline-block",
    textDecoration: "none",
  };

  return (
    <main style={{
      minHeight: "100vh",
      backgroundImage: "url(/bg.jpg)", // your background
      backgroundSize: "cover",
      backgroundPosition: "center",
      padding: "24px 12px"
    }}>
      <div style={shell}>
        <h1 style={{ marginTop: 0 }}>Claim your Early Access</h1>
        <p style={{ opacity: 0.9 }}>
          Enter your access code to register. After we accept your code,
          connect Twitter to finish.
        </p>

        {!claimId ? (
          <form onSubmit={submitCode}>
            <label htmlFor="code">Access code</label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={inputStyle}
              placeholder="Enter your code"
              required
            />
            <button type="submit" style={button} disabled={submitting}>
              {submitting ? "Checking…" : "Continue"}
            </button>
            {msg && <div style={{ marginTop: 12, opacity: 0.9 }}>{msg}</div>}
          </form>
        ) : (
          <>
            <p style={{ marginTop: 0 }}>
              ✅ Code accepted. Click below to connect your Twitter and complete registration.
            </p>
            <a
              style={linkBtn}
              href={`/api/x/start?mode=link&claim=${encodeURIComponent(claimId)}`}
            >
              Sign in with Twitter
            </a>

            <p style={{ marginTop: 12, opacity: 0.8 }}>
              Tip: If you switch browsers or lose this page, the link may still work
              because we set a short-lived claim cookie. If not, just re-enter your code.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
