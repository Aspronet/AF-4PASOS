import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("id, user_id, name, email, phone, stage, campaign_id, metadata")
    .eq("email", email.trim().toLowerCase())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "No encontramos una cuenta con ese email." },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
