import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { lead_id, funnel_step, quiz_answers } = body;

  console.log("[API progress] Received:", { lead_id, funnel_step, quiz_answers: quiz_answers ? "yes" : "no" });

  if (!lead_id || !funnel_step) {
    return NextResponse.json({ error: "Missing lead_id or funnel_step" }, { status: 400 });
  }

  // Read current metadata, then merge funnel_step into it
  const { data: lead, error: readErr } = await supabaseAdmin
    .from("leads")
    .select("metadata")
    .eq("id", lead_id)
    .single();

  if (readErr) {
    console.error("Progress read error:", readErr);
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  const metadata = { ...(lead?.metadata || {}), funnel_step, ...(quiz_answers ? { quiz_answers } : {}) };

  // Also update stage to confirmar_cita when funnel is complete
  const updateFields: Record<string, unknown> = { metadata };
  if (funnel_step === "funnel_complete") {
    updateFields.stage = "confirmar_cita";
  }

  const { error } = await supabaseAdmin
    .from("leads")
    .update(updateFields)
    .eq("id", lead_id);

  if (error) {
    console.error("Progress update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log("[API progress] Saved successfully:", { lead_id, funnel_step, metadata });
  return NextResponse.json({ ok: true });
}
