import { NextResponse } from "next/server";
import { supaAdmin } from "@/lib/supa";

export async function GET(req){
  try{
    const xuid = req.cookies.get("x_uid")?.value;
    if(!xuid) return NextResponse.json({error:"Not signed in"}, { status: 401 });

    const supa = supaAdmin();
    const { data, error } = await supa
      .from("claims")
      .select("id, wallet_address, tier, claimed_at, referral_code, x_user_id, x_username, x_name, x_avatar_url")
      .eq("x_user_id", xuid)
      .order("claimed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if(error) return NextResponse.json({error:error.message},{status:400});
    if(!data) return NextResponse.json({error:"No profile found"}, { status: 404 });

    return NextResponse.json(data);
  }catch(e){
    return NextResponse.json({error:e.message || "Server error"}, { status: 500 });
  }
}
