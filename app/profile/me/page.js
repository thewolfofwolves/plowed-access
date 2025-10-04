"use client";
import { useEffect, useState } from "react";

export default function Me(){
  const [rec,setRec]=useState(null);
  const [msg,setMsg]=useState("Loading…");

  useEffect(()=>{
    (async ()=>{
      const r=await fetch("/api/profile/me");
      const j=await r.json();
      if(!r.ok){ setMsg(j.error||"Not signed in"); return; }
      setRec(j); setMsg("");
    })();
  },[]);

  const Card = ({children}) => (
    <div style={{
      maxWidth:880, margin:"48px auto", padding:28,
      background:"rgba(6,10,7,0.72)", backdropFilter:"blur(8px)",
      border:"1px solid rgba(255,255,255,0.10)", borderRadius:16
    }}>{children}</div>
  );

  return (
    <main>
      <Card>
        <h1 style={{marginTop:0}}>Your profile</h1>
        {msg && <p style={{opacity:.9}}>{msg}</p>}
        {rec && (
          <>
            <p><strong>Wallet:</strong> {rec.wallet_address}</p>
            <p><strong>Tier:</strong> {rec.tier}</p>
            {rec.x_username && (
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                {rec.x_avatar_url && <img src={rec.x_avatar_url} width={64} height={64} style={{borderRadius:12}} alt="avatar" />}
                <div>
                  <div><strong>{rec.x_name}</strong></div>
                  <div>@{rec.x_username}</div>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </main>
  );
}
