import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { reportId } = await req.json();

    if (!reportId) return NextResponse.json({ error: "Missing reportId" }, { status: 400 });

    // 1. Fetch the current flag count
    const { data: report, error: fetchError } = await supabase
      .from("reports")
      .select("flag_count, status")
      .eq("id", reportId)
      .single();

    if (fetchError || !report) throw new Error("Report not found");

    // 2. Increment the count
    const newCount = (report.flag_count || 0) + 1;
    
    // 3. Auto-moderate: If it hits 3 flags, change status to 'Flagged' to hide it
    const newStatus = newCount >= 3 ? "Flagged" : report.status;

    // 4. Update the database securely
    const { error: updateError } = await supabase
      .from("reports")
      .update({ flag_count: newCount, status: newStatus })
      .eq("id", reportId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, flag_count: newCount, isHidden: newCount >= 3 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}