import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supaAdmin } from "../../../../lib/supa";

export async function POST(req){
  try{
    const { code, secret } = await req.json();
    if(!code||!secret) return NextResponse.json({error:"Missing inputs"},{status:400});

    const supa=supaAdmin();
    const { data, error } = await supa
      .from("codes")
      .select("id,secret_hash,used_at")
      .eq("code",code)
      .maybeSingle();

    if(error) return NextResponse.json({error:error.message},{status:400});
    if(!data) return NextResponse.json({error:"Invalid code"},{status:404});
    if(data.used_at) return NextResponse.json({error:"Code already used"},{status:400});

    const ok = await bcrypt.compare(secret, data.secret_hash);
    if(!ok) return NextResponse.json({error:"Invalid secret"},{status:401});

    return NextResponse.json({ok:true});
  }catch(e){
    return NextResponse.json({error:e.message || "Server error"},{status:500});
  }
}
