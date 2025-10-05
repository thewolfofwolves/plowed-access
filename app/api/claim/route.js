import { NextResponse } from "next/server";
import { supaAdmin } from "@/lib/supa";
import bs58 from "bs58";
import crypto from "crypto";

function isSol(addr){ try{return bs58.decode(addr.trim()).length===32;}catch{return false;} }

export async function POST(req){
  try{
    const { code, wallet } = await req.json();
    if(!code||!wallet) return NextResponse.json({error:"Missing inputs"},{status:400});
    if(!isSol(wallet)) return NextResponse.json({error:"Invalid Solana address"},{status:400});

    const ip=req.headers.get("x-forwarded-for")||""; 
    const ua=req.headers.get("user-agent")||"";
    const ipHash=crypto.createHash("sha256").update(ip).digest("hex").slice(0,32);

    const supa=supaAdmin();
    const { data, error } = await supa.rpc("claim_code",{
      p_code:code.trim(), p_wallet_address:wallet.trim(), p_tier:"Early Access", p_ip_hash:ipHash, p_user_agent:ua
    });
    if(error) return NextResponse.json({error:error.message},{status:400});

    // data should have id (claim id) + tier
    const res = NextResponse.json({ ok:true, id:data?.id, tier:data?.tier||"Early Access" });
    if (data?.id) {
      // short-lived cookie so we can fall back if user clicks generic link
      res.cookies.set("x_claim", data.id, {
        httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 15 * 60,
      });
    }
    return res;
  }catch(e){ 
    return NextResponse.json({error:e.message||"Server error"},{status:500}); 
  }
}
