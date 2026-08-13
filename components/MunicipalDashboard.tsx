"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Filter,
  Loader2,
  Upload,
  X,
} from "lucide-react";

type Report = {
  id: string;
  category: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  image_urls: string[];
  voice_url: string | null;
  duplicate_count: number;
  resolution_proof_url: string | null;
  created_at: string;
};

export default function MunicipalDashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState("All");

  // Modal State
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [newStatus, setNewStatus] = useState("In Progress");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const departments = [
    "All",
    "Garbage",
    "Pothole",
    "Water Leakage",
    "Electricity",
    "Streetlight",
    "Drainage",
  ];

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching reports:", error);
    } else if (data) {
      setReports(data);
    }
    setLoading(false);
  };

  const filteredReports =
    selectedDepartment === "All"
      ? reports
      : reports.filter((r) => r.category === selectedDepartment);

  /* ---------------- UPDATE TICKET STATUS ---------------- */
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReport) return;

    if (newStatus === "Resolved" && !proofFile) {
      alert("An 'After Photo' resolution proof is required to resolve a ticket.");
      return;
    }

    setUploading(true);

    try {
      let resolutionProofUrl = activeReport.resolution_proof_url;

      // Upload Resolution Proof if file attached
      if (proofFile) {
        const fileExt = proofFile.name.split(".").pop() || "jpg";
        const fileName = `proof_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `resolution-proofs/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("issue-media")
          .upload(filePath, proofFile, { contentType: proofFile.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("issue-media")
          .getPublicUrl(filePath);

        resolutionProofUrl = urlData.publicUrl;
      }

      // Update report status in DB
      const { error: updateError } = await supabase
        .from("reports")
        .update({
          status: newStatus,
          resolution_proof_url: resolutionProofUrl,
        })
        .eq("id", activeReport.id);

      if (updateError) throw updateError;

      // Refresh list & reset modal
      fetchReports();
      setActiveReport(null);
      setProofFile(null);
    } catch (err: unknown) {
      console.error("Failed to update status:", err);
      const msg = err instanceof Error ? err.message : "Failed to update issue status.";
      alert(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* HEADER & DEPARTMENT FILTER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dce4de] bg-white px-3.5 py-1 text-xs font-bold text-[#124b35]">
            <Building2 size={14} /> Internal Ops
          </div>
          <h1 className="mt-2 text-3xl font-extrabold text-[#14251c]">
            Municipal Action Dashboard
          </h1>
        </div>

        {/* Department Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          <Filter size={16} className="text-[#718078] shrink-0" />
          {departments.map((dept) => (
            <button
              key={dept}
              type="button"
              onClick={() => setSelectedDepartment(dept)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap transition ${
                selectedDepartment === dept
                  ? "bg-[#124b35] text-white"
                  : "border border-[#dce4de] bg-white text-[#526158] hover:bg-[#fafcf9]"
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* TICKETS GRID */}
      {loading ? (
        <div className="flex h-64 w-full items-center justify-center gap-2 rounded-3xl border border-[#dce4de] bg-white">
          <Loader2 className="animate-spin text-[#124b35]" size={24} />
          <span className="text-sm font-bold text-[#124b35]">Loading issues...</span>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="rounded-3xl border border-[#dce4de] bg-white p-12 text-center">
          <CheckCircle2 size={40} className="mx-auto text-[#124b35]" />
          <h3 className="mt-3 text-lg font-bold text-[#14251c]">No issues found</h3>
          <p className="text-xs text-[#718078] mt-1">
            There are no reported issues under the "{selectedDepartment}" department.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="flex flex-col justify-between rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div>
                {/* CARD TOP BAR */}
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-[#eef5ef] px-2.5 py-1 text-xs font-bold text-[#124b35]">
                    {report.category}
                  </span>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      report.status === "Resolved"
                        ? "bg-emerald-100 text-emerald-800"
                        : report.status === "In Progress"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {report.status}
                  </span>
                </div>

                {/* DUPLICATE BADGE */}
                {report.duplicate_count > 0 && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-800 border border-orange-200">
                    <AlertCircle size={13} />
                    <span>Reported by {report.duplicate_count + 1} citizens</span>
                  </div>
                )}

                {/* DESCRIPTION */}
                <p className="mt-3 text-sm text-[#14251c] line-clamp-3">
                  {report.description || "No written description provided."}
                </p>

                {/* COMPLAINT PHOTO */}
                {report.image_urls && report.image_urls.length > 0 && (
                  <div className="mt-4">
                    <img
                      src={report.image_urls[0]}
                      alt="Complaint"
                      className="h-40 w-full rounded-2xl object-cover border border-[#dce4de]"
                    />
                  </div>
                )}

                {/* VOICE NOTE AUDIO PLAYER */}
                {report.voice_url && (
                  <div className="mt-3 rounded-2xl bg-[#f0f4f1] p-3 border border-[#dce4de]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#124b35] mb-1 flex items-center gap-1">
                      🎙️ Citizen Voice Recording
                    </p>
                    <audio controls src={report.voice_url} className="w-full h-8" />
                  </div>
                )}

                {/* RESOLUTION PROOF PHOTO */}
                {report.resolution_proof_url && (
                  <div className="mt-3 rounded-2xl bg-emerald-50 p-2.5 border border-emerald-200">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Resolution Evidence
                    </p>
                    <img
                      src={report.resolution_proof_url}
                      alt="Resolution Proof"
                      className="h-28 w-full rounded-xl object-cover"
                    />
                  </div>
                )}
              </div>

              {/* ACTION FOOTER */}
              <div className="mt-6 pt-4 border-t border-[#dce4de] flex items-center justify-between">
                <span className="text-[11px] text-[#718078]">
                  {new Date(report.created_at).toLocaleDateString()}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setActiveReport(report);
                    setNewStatus(report.status);
                  }}
                  className="rounded-xl bg-[#124b35] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0d3d2b]"
                >
                  Manage Ticket
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* UPDATE STATUS MODAL */}
      {activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-[#dce4de] bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#14251c]">
                Update Ticket Status
              </h3>
              <button
                type="button"
                onClick={() => setActiveReport(null)}
                className="rounded-lg p-1 text-[#718078] hover:bg-[#fafcf9]"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="mt-6 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#718078]">
                  Select New Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm font-semibold outline-none focus:border-[#124b35]"
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>

              {/* RESOLUTION PROOF PHOTO UPLOAD */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#718078]">
                  Upload Resolution Evidence (After Photo)
                  {newStatus === "Resolved" && (
                    <span className="text-red-500 ml-1">* Required</span>
                  )}
                </label>

                <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#dce4de] bg-[#fafcf9] p-6 text-center hover:border-[#124b35]">
                  <Upload size={24} className="text-[#124b35]" />
                  <p className="mt-2 text-xs font-bold text-[#14251c]">
                    {proofFile ? proofFile.name : "Attach 'After Photo' proof"}
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveReport(null)}
                  className="w-1/2 rounded-xl border border-[#dce4de] py-3 text-xs font-bold text-[#526158]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="w-1/2 flex items-center justify-center gap-2 rounded-xl bg-[#124b35] py-3 text-xs font-bold text-white disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}