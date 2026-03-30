import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { booking_link_id, user_id, lead_name, lead_email, lead_phone, scheduled_at, duration_minutes, timezone, lead_id } = body;

  if (!booking_link_id || !user_id || !lead_name || !lead_email || !scheduled_at || !duration_minutes || !timezone) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .insert({
      booking_link_id,
      user_id,
      lead_name,
      lead_email,
      lead_phone: lead_phone || null,
      scheduled_at,
      duration_minutes,
      timezone,
      status: "confirmed",
      lead_id: lead_id || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Booking insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
