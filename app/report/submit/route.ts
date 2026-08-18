import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { compareIssueTexts } from "@/lib/localEmbeddings";
import imghash from "imghash";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper to generate a perceptual hash from an image URL
// Helper to generate a perceptual hash from an image URL
async function getImageHash(imageUrl: string) {
  if (!imageUrl) return null;
  try {
    // 1. Fetch the image directly from the Supabase URL
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    
    // 2. Convert the ArrayBuffer to a Node.js Buffer
    const buffer = Buffer.from(arrayBuffer);
    
    // 3. Pass the raw Buffer directly to imghash
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

    console.log(`\n[DEBUG 1] Searching 100m radius for category: ${category} at ${lat}, ${lng}`);

    // 1. Spatial Search: Check for open reports within 100m in the same category
    const { data: nearbyReports, error: rpcError } = await supabase.rpc(
      "find_nearby_open_reports",
      {
        p_lat: lat,
        p_lng: lng,
        p_category: category,
        p_radius_meters: 100.0,
      }
    );

    if (rpcError) {
      console.error("[DEBUG] Spatial lookup error:", rpcError);
    }

    console.log(`[DEBUG 2] RPC returned ${nearbyReports?.length || 0} nearby matches.`);

    // 2. Check Candidate Matches using Text Embeddings & Visual Hashing
    if (nearbyReports && nearbyReports.length > 0) {
      const matchCandidate = nearbyReports[0];
      
      const combinedNew = `${category}: ${description || ""}`.trim();
      const combinedExisting = `${matchCandidate.category || category}: ${matchCandidate.description || ""}`.trim();

      // Compare semantic text vectors locally
      const similarityScore = await compareIssueTexts(combinedNew, combinedExisting);
      console.log(`[DEBUG 3] Text Similarity Score: ${similarityScore} (Needs >= 0.75)`);

      // Compare visual image hashes
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

      // Merge if semantic similarity is high OR if the photos are virtually identical
      if (similarityScore >= 0.75 || isVisualMatch) {
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
      } else {
        console.log("[DEBUG] Scores too low (Text and Visual distinct), bypassing merge.");
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