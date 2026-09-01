"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { CheckCircle2, Clock, AlertTriangle, Flag } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

type Report = {
  id: string;
  category: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  image_urls: string[];
  resolution_proof_url: string | null;
  created_at: string;
  flag_count?: number;
};

// Component to handle proper map resizing after mount
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [map]);
  return null;
}

// Custom SVG map marker icons color-coded by status
const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: "custom-leaflet-marker",
    html: `<div style="
      background-color: ${color};
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
};

const redIcon = createCustomIcon("#ef4444"); // Open
const yellowIcon = createCustomIcon("#f59e0b"); // In Progress
const greenIcon = createCustomIcon("#10b981"); // Resolved

export default function PublicTrackingMap() {
  const { t } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [flaggingId, setFlaggingId] = useState<string | null>(null);

  // Default center coordinates
  const defaultCenter: [number, number] = [20.2961, 85.8245];

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .neq("status", "Flagged") // Ensure flagged posts never load on the map
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching reports for map:", error);
    } else if (data) {
      setReports(data);
    }
  };

  const handleFlagReport = async (reportId: string) => {
    setFlaggingId(reportId);
    
    try {
      const response = await fetch("/report/flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId }),
      });
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to flag report.");
      }

      if (data.isHidden) {
        // Auto-hide threshold reached: immediately remove it from the map view
        setReports((prev) => prev.filter((r) => r.id !== reportId));
        alert("This issue has received multiple community flags and has been hidden pending review.");
      } else {
        alert("Report successfully flagged for review.");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Something went wrong while flagging.");
    } finally {
      setFlaggingId(null);
    }
  };

  const getMarkerIcon = (status: string) => {
    if (status === "Resolved") return greenIcon;
    if (status === "In Progress") return yellowIcon;
    return redIcon;
  };

  const getStatusBadge = (status: string) => {
    if (status === "Resolved") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
          <CheckCircle2 size={12} /> {t("resolved")}
        </span>
      );
    }
    if (status === "In Progress") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
          <Clock size={12} /> {t("inProgress")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">
        <AlertTriangle size={12} /> {t("openIssue")}
      </span>
    );
  };

  return (
    <div className="relative h-[600px] w-full overflow-hidden rounded-3xl border border-[#dce4de] bg-[#e5e9e6] shadow-xl">
      {/* Import Leaflet CSS explicitly inside client component */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />

      {/* MAP LEGEND OVERLAY */}
      <div className="absolute right-4 top-4 z-[1000] rounded-2xl border border-[#dce4de] bg-white/95 p-4 shadow-lg backdrop-blur text-xs font-semibold space-y-2">
        <p className="font-bold text-[#14251c] mb-1.5">{t("issueStatus")}</p>
        <div className="flex items-center gap-2 text-[#14251c]">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          <span>{t("openIssue")}</span>
        </div>
        <div className="flex items-center gap-2 text-[#14251c]">
          <span className="h-3 w-3 rounded-full bg-amber-500" />
          <span>{t("inProgress")}</span>
        </div>
        <div className="flex items-center gap-2 text-[#14251c]">
          <span className="h-3 w-3 rounded-full bg-emerald-500" />
          <span>{t("resolved")}</span>
        </div>
      </div>

      {/* LEAFLET MAP CONTAINER */}
      <MapContainer
        center={defaultCenter}
        zoom={12}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <MapResizer />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {reports.map((report) => {
          if (!report.latitude || !report.longitude) return null;

          return (
            <Marker
              key={report.id}
              position={[report.latitude, report.longitude]}
              icon={getMarkerIcon(report.status)}
            >
              <Popup>
                <div className="max-w-xs space-y-3 p-1 text-[#14251c]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#14251c] text-sm">
                      {report.category}
                    </span>
                    {getStatusBadge(report.status)}
                  </div>

                  {report.description && (
                    <p className="text-xs text-[#526158] leading-relaxed">
                      {report.description}
                    </p>
                  )}

                  {/* REPORTED PHOTO */}
                  {report.image_urls && report.image_urls.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#718078] mb-1">
                        {t("reportedPhoto")}
                      </p>
                      <img
                        src={report.image_urls[0]}
                        alt="Reported Issue"
                        className="h-32 w-full rounded-xl object-cover border border-[#dce4de]"
                      />
                    </div>
                  )}

                  {/* RESOLUTION PROOF PHOTO (IF RESOLVED) */}
                  {report.status === "Resolved" && report.resolution_proof_url && (
                    <div className="rounded-xl bg-emerald-50 p-2 border border-emerald-200">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1 flex items-center gap-1">
                        <CheckCircle2 size={12} /> {t("resolutionProof")}
                      </p>
                      <img
                        src={report.resolution_proof_url}
                        alt="Resolution Proof"
                        className="h-32 w-full rounded-lg object-cover"
                      />
                    </div>
                  )}
                  
                  {/* FOOTER & FLAGGING ACTION */}
                  <div className="flex items-center justify-between border-t border-[#dce4de] pt-2 mt-2">
                    <p className="text-[10px] text-[#718078]">
                      {t("loggedOn")} {new Date(report.created_at).toLocaleDateString()}
                    </p>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFlagReport(report.id);
                      }}
                      disabled={flaggingId === report.id}
                      title="Flag as inappropriate or fake"
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 hover:text-red-700 transition disabled:opacity-50"
                    >
                      <Flag size={12} />
                      {flaggingId === report.id ? "Flagging..." : "Flag"}
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}