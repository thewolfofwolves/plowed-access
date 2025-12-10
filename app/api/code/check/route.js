import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supaAdmin } from "../../../../lib/supa";   // <-- change this line


export async function POST(req){
  try{
    const { code } = await req.json();
    if(!code) return NextResponse.json({error:"Missing code"},{status:400});
    const supa=supaAdmin();
    const { data, error } = await supa.from("codes")
      .select("id,code_hash,tier,expires_at,used_at").is("used_at",null);
    if(error) throw error;
    const now=new Date();
    const hit=data?.find(r=>(!r.expires_at||new Date(r.expires_at)>now)&&bcrypt.compareSync(code.trim(),r.code_hash));
    if(!hit) return NextResponse.json({error:"Invalid or used code"},{status:400});
    return NextResponse.json({tier:hit.tier});
  }catch(e){ return NextResponse.json({error:e.message||"Server error"},{status:500}); }
}
