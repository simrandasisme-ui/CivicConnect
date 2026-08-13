"use client";

import dynamic from "next/dynamic";
import { Loader2, MapPin } from "lucide-react";

// Dynamically import PublicTrackingMap with SSR disabled
const PublicTrackingMap = dynamic(
  () => import("../../components/PublicTrackingMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[600px] w-full items-center justify-center gap-2 rounded-3xl border border-[#dce4de] bg-white text-[#124b35]">
        <Loader2 className="animate-spin" size={24} />
        <span className="font-bold text-sm">Loading Interactive Map...</span>
      </div>
    ),
  }
);

export default function TrackPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#dce4de] bg-white px-3.5 py-1 text-xs font-bold text-[#124b35]">
          <MapPin size={14} />
          Real-time Public Tracking
        </div>
        <h1 className="mt-2 text-3xl font-extrabold text-[#14251c] sm:text-4xl">
          Community Issue Map
        </h1>
        <p className="mt-2 text-sm text-[#718078]">
          Explore open, in-progress, and resolved civic issues across your city. Click any pin to view complaint details and worker resolution proof.
        </p>
      </div>

      <PublicTrackingMap />
    </div>
  );
}