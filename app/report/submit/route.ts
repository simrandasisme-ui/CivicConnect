import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { compareIssueTexts } from "@/lib/localEmbeddings";
import imghash from "imghash";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper to send email notifications via Native Fetch
async function sendNotificationEmail(email: string, category: string, isMerged: boolean, ticketId: string) {
  if (!email) return;

  console.log("[DEBUG] Checking API Key:", process.env.BREVO_API_KEY ? "Key exists" : "KEY IS MISSING!");
  
  const subject = isMerged
    ? `Update: Your ${category} report has been linked to an active ticket`
    : `CivicConnect: Your report for ${category} has been received`;
    
  const textContent = isMerged
    ? `Hello,\n\nWe noticed a similar issue was already reported nearby. To help municipal teams resolve it faster, your report has been merged with the existing active tracking ticket (${ticketId}). You will be notified when it is resolved.`
    : `Hello,\n\nThank you for helping improve your community. Your new report regarding "${category}" has been successfully logged (Ticket: ${ticketId}).`;

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": process.env.BREVO_API_KEY || "",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: { name: "CivicConnect", email: "civicconnect482@gmail.com" },
        to: [{ email: email }],
        subject: subject,
        textContent: textContent
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[DEBUG] Brevo Native Fetch failed:", errorData);
    } else {
      console.log(`[DEBUG] Brevo Email successfully sent to ${email}`);
    }
  } catch (error) {
    console.error("[DEBUG] Email send crashed:", error);
  }
}

// Helper to generate a perceptual hash from an image URL
async function getImageHash(imageUrl: string) {
  if (!imageUrl) return null;
  try {
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const hash = await imghash.hash(buffer);
    return hash;
  } catch (error) {
    console.error("[DEBUG] Error hashing image:", error);
    return null;
  }
}

// Helper to calculate Hamming distance between two hex hashes (0 = exact match)
function hammingDistance(hash1: string, hash2: string) {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  return distance;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      description,
      category,
      imageUrl,
      voiceUrl,
      latitude,
      longitude,
      reporterId,
      reporterEmail,
      address,
      anonymous, // <-- FIXED: We now explicitly extract the anonymous flag from the frontend
    } = body;

    // =====================================================================
    // SECURITY FIREWALL: STRICT ANONYMITY ENFORCEMENT
    // If the anonymous toggle is true, we immediately destroy the email
    // and force the ID to "Anonymous Citizen" so it CANNOT leak.
    // =====================================================================
    const isAnon = anonymous === true;
    const safeReporterId = isAnon ? "Anonymous Citizen" : (reporterId || "Registered Citizen");
    const safeReporterEmail = isAnon ? null : reporterEmail;

    if (!category || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: "Missing required fields (category, latitude, longitude)." },
        { status: 400 }
      );
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    console.log(`\n[DEBUG 1] Searching 100m radius for category: ${category} at ${lat}, ${lng}`);

    // 1. Spatial Search (Radius set to 100m for GPS drift)
    const { data: nearbyReports, error: rpcError } = await supabase.rpc(
      "find_nearby_open_reports",
      {
        p_lat: lat,
        p_lng: lng,
        p_category: category,
        p_radius_meters: 100.0, 
      }
    );

    if (rpcError) console.error("[DEBUG] Spatial lookup error:", rpcError);

    console.log(`[DEBUG 2] RPC returned ${nearbyReports?.length || 0} nearby matches.`);

    // 2. Check Candidate Matches using Text Embeddings & Visual Hashing
    if (nearbyReports && nearbyReports.length > 0) {
      const matchCandidate = nearbyReports[0];
      
      const combinedNew = `${category}: ${description || ""}`.trim();
      const combinedExisting = `${matchCandidate.category || category}: ${matchCandidate.description || ""}`.trim();

      const similarityScore = await compareIssueTexts(combinedNew, combinedExisting);
      console.log(`[DEBUG 3] Text Similarity Score: ${similarityScore} (Needs >= 0.75)`);

      let isVisualMatch = false;
      if (imageUrl && matchCandidate.image_urls && matchCandidate.image_urls.length > 0) {
        const incomingHash = await getImageHash(imageUrl);
        const existingHash = await getImageHash(matchCandidate.image_urls[0]);
        
        if (incomingHash && existingHash) {
          const distance = hammingDistance(incomingHash, existingHash);
          console.log(`[DEBUG 4] Image Hamming Distance: ${distance} (Needs < 10 for visual match)`);
          if (distance < 10) isVisualMatch = true;
        }
      }

      // Merge Logic
      if (similarityScore >= 0.75 || isVisualMatch) {
        const { error: updateError } = await supabase.rpc("increment_duplicate_count", {
          target_report_id: matchCandidate.id
        });

        if (updateError) console.error("[DEBUG] Failed to update DB:", updateError);

        // Store secondary email and dispatch the "Merged" notification email
        // We use safeReporterEmail which is strictly NULL if anonymous
        if (safeReporterEmail) {
          const { data: currentReport } = await supabase
            .from("reports")
            .select("secondary_emails")
            .eq("id", matchCandidate.id)
            .single();

          const emailsList = currentReport?.secondary_emails || [];
          if (!emailsList.includes(safeReporterEmail)) {
            emailsList.push(safeReporterEmail);
            await supabase
              .from("reports")
              .update({ secondary_emails: emailsList })
              .eq("id", matchCandidate.id);
          }
          
          await sendNotificationEmail(safeReporterEmail, category, true, matchCandidate.id);
        }

        const newTotalCitizens = (matchCandidate.duplicate_count || 0) + 2; 

        return NextResponse.json({
          merged: true,
          parentReportId: matchCandidate.id,
          reportCount: newTotalCitizens,
          distanceMeters: Math.round(matchCandidate.distance_meters),
          message: `Issue merged with existing report (${Math.round(
            matchCandidate.distance_meters
          )}m away). Priority upgraded to ${newTotalCitizens} citizen reports!`,
        });
      }
    }

    // 3. No duplicate found: Insert fresh ticket
    const { data: newReport, error: insertError } = await supabase
      .from("reports")
      .insert([
        {
          description,
          category,
          image_urls: imageUrl ? [imageUrl] : [],
          voice_url: voiceUrl || null, 
          latitude: lat,
          longitude: lng,
          // user_id now perfectly maps to safeReporterId which handles anonymity
          user_id: safeReporterId, 
          address: address || null,
          status: "Open", 
          duplicate_count: 0, 
          secondary_emails: [],
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    // Dispatch the "Created" notification email ONLY if not anonymous
    if (safeReporterEmail) {
      await sendNotificationEmail(safeReporterEmail, category, false, newReport.id);
    }

    return NextResponse.json({
      merged: false,
      report: newReport,
      message: "New issue ticket logged successfully.",
    });
  } catch (error: any) {
    console.error("Submission error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}