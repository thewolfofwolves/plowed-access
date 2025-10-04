"use client";
import { useState } from "react";

export default function Home(){
  const [step,setStep]=useState("code");
  const [code,setCode]=useState(""); const [tier,setTier]=useState();
  const [wallet,setWallet]=useState("");

  async function checkCode(e){
    e.preventDefault();
    const r=await fetch("/api/code/check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})});
    const j=await r.json(); if(!r.ok) return alert(j.error||"Invalid code");
    setTier(j.tier); setStep("wallet");
  }
  async function claim(e){
    e.preventDefault();
    const r=await fetch("/api/claim",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,wallet})});
    const j=await r.json(); if(!r.ok) return alert(j.error||"Claim failed");
    if(j.discord_url) window.location.href=j.discord_url; else setStep("done");
  }

  return (
    <main>
      <h1 style={{fontSize:32,marginBottom:8}}>Claim your access</h1>
      <p style={{opacity:.8,marginBottom:24}}>Enter your access code, then paste your Solana wallet. No transaction needed.</p>

      {step==="code"&&(<form onSubmit={checkCode}>
        <label>Access code</label>
        <input value={code} onChange={e=>setCode(e.target.value)} required
          style={{display:"block",width:"100%",padding:12,margin:"8px 0",borderRadius:8}}/>
        <button type="submit" style={{padding:"10px 16px",borderRadius:8}}>Continue</button>
      </form>)}

      {step==="wallet"&&(<form onSubmit={claim}>
        <p>Tier: <strong>{tier}</strong></p>
        <label>Solana wallet address</label>
        <input value={wallet} onChange={e=>setWallet(e.target.value)} required placeholder="e.g. 7p9...Xk"
          style={{display:"block",width:"100%",padding:12,margin:"8px 0",borderRadius:8}}/>
        <button type="submit" style={{padding:"10px 16px",borderRadius:8}}>Save wallet</button>
      </form>)}

      {step==="done"&&(<div><h2>All set</h2><p>Your wallet is saved.</p></div>)}
    </main>
  );
}
