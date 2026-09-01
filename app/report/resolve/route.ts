import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { 
      reportId, 
      status, 
      resolutionProofUrl, 
      evidenceUrl, // Accepting both old and new payload keys
      resolutionNotes, 
      assignedWorkerId, 
      workerId 
    } = await req.json();

    if (!reportId) return NextResponse.json({ error: "Missing reportId" }, { status: 400 });

    // Normalize variables to bridge old frontend state and new DB schema
    const finalStatus = status === "Resolved" ? "Completed" : status;
    const finalEvidence = evidenceUrl || resolutionProofUrl;
    const finalWorker = workerId || assignedWorkerId;

    // Enforce rule: Evidence must be provided if the task is being marked as Completed
    if (finalStatus === "Completed" && !finalEvidence) {
      return NextResponse.json(
        { error: "Completion requires photographic evidence." },
        { status: 400 }
      );
    }

    // Build the payload targeting our new schema columns
    const updatePayload: any = {
      status: finalStatus, // Existing column
      task_status: finalStatus, // New tracking column
      resolution_notes: resolutionNotes,
    };

    if (finalEvidence) updatePayload.completion_evidence_url = finalEvidence;
    if (finalWorker) updatePayload.assigned_to = finalWorker;
    if (finalStatus === "Completed") updatePayload.completed_at = new Date().toISOString();

    // 1. Update the database securely from the backend
    const { data: updatedReport, error: updateError } = await supabase
      .from("reports")
      .update(updatePayload)
      .eq("id", reportId)
      .select()
      .single();

    if (updateError || !updatedReport) {
      throw new Error("Database update failed: " + updateError?.message);
    }

    // 2. Only send emails if the status is actually "Completed"
    if (finalStatus === "Completed") {
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

    return NextResponse.json({ success: true, report: updatedReport });
  } catch (error: any) {
    console.error("Resolve route error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}