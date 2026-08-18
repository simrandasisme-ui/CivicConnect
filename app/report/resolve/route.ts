import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { reportId, status, resolutionProofUrl, resolutionNotes, assignedWorkerId } = await req.json();

    if (!reportId) return NextResponse.json({ error: "Missing reportId" }, { status: 400 });

    // 1. Update the database securely from the backend
    const { data: updatedReport, error: updateError } = await supabase
      .from("reports")
      .update({ 
        status: status,
        resolution_proof_url: resolutionProofUrl,
        resolution_notes: resolutionNotes,
        assigned_worker_id: assignedWorkerId
      })
      .eq("id", reportId)
      .select()
      .single();

    if (updateError || !updatedReport) throw new Error("Database update failed");

    // 2. Only send emails if the status is actually "Resolved"
    if (status === "Resolved") {
      const allEmailsToNotify = new Set([
        updatedReport.user_id,
        ...(updatedReport.secondary_emails || [])
      ]);

      const subject = `Resolved: The ${updatedReport.category} issue you reported has been fixed!`;
      const textContent = `Hello,\n\nGreat news! The municipal team has successfully resolved the "${updatedReport.category}" issue you reported (Ticket: ${reportId}).\n\nWorker Notes: ${resolutionNotes || 'No notes provided.'}\n\nThank you for using CivicConnect to improve your community!`;

      for (const email of Array.from(allEmailsToNotify)) {
        if (!email || email === "Anonymous Citizen") continue;

        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "accept": "application/json",
            "api-key": (process.env.BREVO_API_KEY || "").replace(/['"]/g, '').trim(),
            "content-type": "application/json"
          },
          body: JSON.stringify({
            sender: { name: "CivicConnect", email: "civicconnect482@gmail.com" },
            to: [{ email: email }],
            subject: subject,
            textContent: textContent
          })
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}