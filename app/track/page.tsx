"use client";

import dynamic from "next/dynamic";
import { Loader2, MapPin } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

// Create a separate component for the loader so it can consume the context
function MapLoader() {
  const { t } = useLanguage();
  return (
    <div className="flex h-[600px] w-full items-center justify-center gap-2 rounded-3xl border border-[#dce4de] bg-white text-[#124b35]">
      <Loader2 className="animate-spin" size={24} />
      <span className="font-bold text-sm">{t("loadingMap")}</span>
    </div>
  );
}

// Dynamically import PublicTrackingMap with SSR disabled
const PublicTrackingMap = dynamic(
  () => import("../../components/PublicTrackingMap"),
  {
    ssr: false,
    loading: () => <MapLoader />,
  }
);

export default function TrackPage() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#dce4de] bg-white px-3.5 py-1 text-xs font-bold text-[#124b35]">
          <MapPin size={14} />
          {t("realtimeTracking")}
        </div>
        <h1 className="mt-2 text-3xl font-extrabold text-[#14251c] sm:text-4xl">
          {t("mapTitle")}
        </h1>
        <p className="mt-2 text-sm text-[#718078]">
          {t("mapSubtitle")}
        </p>
      </div>

      <PublicTrackingMap />
    </div>
  );
}