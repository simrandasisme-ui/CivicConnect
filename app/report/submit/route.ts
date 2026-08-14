import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { compareIssueTexts } from "@/lib/localEmbeddings";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      description,
      category,
      imageUrl,
      latitude,
      longitude,
      reporterId,
      address,
    } = body;

    if (!category || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: "Missing required fields (category, latitude, longitude)." },
        { status: 400 }
      );
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    console.log(`\n[DEBUG 1] Searching 25m radius for category: ${category} at ${lat}, ${lng}`);

    // 1. Spatial Search: Check for open reports within 25m in the same category
    const { data: nearbyReports, error: rpcError } = await supabase.rpc(
      "find_nearby_open_reports",
      {
        p_lat: lat,
        p_lng: lng,
        p_category: category,
        p_radius_meters: 25.0,
      }
    );

    if (rpcError) {
      console.error("[DEBUG] Spatial lookup error:", rpcError);
    }

    console.log(`[DEBUG 2] RPC returned ${nearbyReports?.length || 0} nearby matches.`);

    // 2. Check Candidate Matches using Open-Source Embeddings
    if (nearbyReports && nearbyReports.length > 0) {
      const matchCandidate = nearbyReports[0];
      
      // FIX: Removed 'title' dependency to prevent "undefined" text comparisons
      const combinedNew = `${category}: ${description || ""}`.trim();
      const combinedExisting = `${matchCandidate.category || category}: ${matchCandidate.description || ""}`.trim();

      // Compare semantic text vectors locally
      const similarityScore = await compareIssueTexts(combinedNew, combinedExisting);
      
      console.log(`[DEBUG 3] Similarity Score: ${similarityScore} (Needs >= 0.65)`);
      console.log(`[DEBUG] Comparing: "${combinedNew}" WITH "${combinedExisting}"`);

      // Merge if semantic similarity is high (>= 0.65)
      if (similarityScore >= 0.65) {
        // Use the secure RPC to increment atomically, bypassing RLS and race conditions
        const { error: updateError } = await supabase.rpc("increment_duplicate_count", {
          target_report_id: matchCandidate.id
        });

        if (updateError) {
           console.error("[DEBUG] Failed to update DB:", updateError);
        }

        // We estimate the new count for the immediate frontend response
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
      } else {
        console.log("[DEBUG] Score too low, bypassing merge.");
      }
    

    // 3. No duplicate found: Insert fresh ticket
    const { data: newReport, error: insertError } = await supabase
      .from("reports")
      .insert([
        {
          description,
          category,
          image_urls: imageUrl ? [imageUrl] : [],
          latitude: lat,
          longitude: lng,
          user_id: reporterId || "Anonymous Citizen",
          address: address || null,
          status: "Open", 
          duplicate_count: 0, 
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

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