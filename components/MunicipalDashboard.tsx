"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Filter,
  Loader2,
  Upload,
  X,
  FileText,
  LogOut,
  MapPin,
} from "lucide-react";

type Report = {
  id: string;
  category: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  task_status: string;
  assigned_to: string | null;
  image_urls: string[];
  voice_url: string | null;
  duplicate_count: number;
  resolution_proof_url: string | null;
  resolution_notes: string | null;
  created_at: string;
};

type WorkerSession = {
  id: string;
  fullName: string;
  deptId: string;
  department: string;
  role: string;
};

export default function MunicipalDashboard() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [workerInfo, setWorkerInfo] = useState<WorkerSession | null>(null);
  
  // Filter state
  const [filterMode, setFilterMode] = useState<"assigned" | "department">("assigned");

  // Modal State
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [newStatus, setNewStatus] = useState("In Progress");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const rawWorker = localStorage.getItem("civic_connect_worker");
    if (!rawWorker) {
      router.push("/");
      return;
    }
    const worker: WorkerSession = JSON.parse(rawWorker);
    setWorkerInfo(worker);
    
    fetchWarnings(worker.id);
    fetchReports(worker.department);
  }, []);

  const fetchWarnings = async (workerId: string) => {
    const { data } = await supabase
      .from("warnings_log")
      .select("*")
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false });
      
    if (data) setWarnings(data);
  };

  const fetchReports = async (department: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("category", department)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching reports:", error);
    } else if (data) {
      setReports(data);
    }
    setLoading(false);
  };

  // Filter tasks based on the active tab
  const displayedReports = filterMode === "assigned"
    ? reports.filter(r => r.assigned_to === workerInfo?.id)
    : reports;

  const handleLogout = () => {
    localStorage.removeItem("civic_connect_auth");
    localStorage.removeItem("civic_connect_worker");
    document.cookie = "civic_connect_auth=; path=/; max-age=0;";
    router.push("/");
  };

  /* ---------------- UPDATE TICKET STATUS VIA API ---------------- */
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReport || !workerInfo) return;

    if (newStatus === "Completed" && !proofFile) {
      alert("An 'After Photo' resolution proof is required to complete a task.");
      return;
    }

    setUploading(true);

    try {
      let uploadedProofUrl = activeReport.resolution_proof_url;

      // 1. Upload Resolution Proof if file attached
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

        uploadedProofUrl = urlData.publicUrl;
      }

      // 2. Send payload to our secure backend API route
      const payload = {
        reportId: activeReport.id,
        workerId: workerInfo.id,
        status: newStatus,
        evidenceUrl: uploadedProofUrl,
        resolutionNotes: resolutionNotes,
      };

      const res = await fetch("/report/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to resolve report.");
      }

      // 3. Refresh list & reset modal
      fetchReports(workerInfo.department);
      setActiveReport(null);
      setProofFile(null);
      setResolutionNotes("");
      alert("Task updated successfully!");
    } catch (err: unknown) {
      console.error("Failed to update status:", err);
      const msg = err instanceof Error ? err.message : "Failed to update issue status.";
      alert(msg);
    } finally {
      setUploading(false);
    }
  };

  if (!workerInfo) return null;

  return (
    <div className="space-y-8 bg-[#fafcf9] min-h-screen p-4 sm:p-8">
      
      {/* WARNINGS BANNER */}
      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <AlertTriangle size={18} /> Supervisor Reminders & Updates
          </div>
          <ul className="mt-2 space-y-2 text-xs text-amber-800">
            {warnings.map((w) => (
              <li key={w.id} className="flex gap-2">
                <span className="font-bold">•</span>
                <span>{w.message} <span className="opacity-75 block mt-0.5 text-[10px]">{new Date(w.created_at).toLocaleString()}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* HEADER & DEPARTMENT FILTER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dce4de] bg-white px-3.5 py-1 text-xs font-bold text-[#124b35]">
            <Building2 size={14} /> Ops: {workerInfo.department} Dept.
          </div>
          <h1 className="mt-2 text-2xl font-extrabold text-[#14251c] sm:text-3xl">
            Welcome, {workerInfo.fullName}
          </h1>
          <p className="mt-1 text-xs text-[#718078] font-mono">ID: {workerInfo.deptId}</p>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 self-start sm:self-center rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition"
        >
          <LogOut size={14} /> Log Out
        </button>
      </div>

      {/* TABS */}
      <div className="flex gap-3 border-b border-[#dce4de] pb-4">
        <button
          onClick={() => setFilterMode("assigned")}
          className={`rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            filterMode === "assigned"
              ? "bg-[#124b35] text-white"
              : "border border-[#dce4de] bg-white text-[#526158]"
          }`}
        >
          Assigned to Me
        </button>
        <button
          onClick={() => setFilterMode("department")}
          className={`rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            filterMode === "department"
              ? "bg-[#124b35] text-white"
              : "border border-[#dce4de] bg-white text-[#526158]"
          }`}
        >
          All {workerInfo.department} Tasks
        </button>
      </div>

      {/* TICKETS GRID */}
      {loading ? (
        <div className="flex h-64 w-full items-center justify-center gap-2 rounded-3xl border border-[#dce4de] bg-white">
          <Loader2 className="animate-spin text-[#124b35]" size={24} />
          <span className="text-sm font-bold text-[#124b35]">Loading tasks...</span>
        </div>
      ) : displayedReports.length === 0 ? (
        <div className="rounded-3xl border border-[#dce4de] bg-white p-12 text-center">
          <CheckCircle2 size={40} className="mx-auto text-[#124b35]" />
          <h3 className="mt-3 text-lg font-bold text-[#14251c]">No tasks found</h3>
          <p className="text-xs text-[#718078] mt-1">
            {filterMode === "assigned" 
              ? "You have no pending tasks assigned to you at the moment."
              : `There are no open issues in the ${workerInfo.department} department.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {displayedReports.map((report) => (
            <div
              key={report.id}
              className="flex flex-col justify-between rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div>
                {/* CARD TOP BAR */}
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-[#eef5ef] px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-[#124b35]">
                    {report.category}
                  </span>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                      report.task_status === "Completed" || report.status === "Completed"
                        ? "bg-emerald-100 text-emerald-800"
                        : report.task_status === "In Progress" || report.status === "In Progress"
                        ? "bg-blue-100 text-blue-800"
                        : report.task_status === "Assigned"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {report.task_status || report.status || "Pending"}
                  </span>
                </div>

                {/* DUPLICATE BADGE */}
                {report.duplicate_count > 0 && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-800 border border-orange-200">
                    <AlertCircle size={13} />
                    <span>Priority Boosted ({report.duplicate_count + 1} citizens)</span>
                  </div>
                )}

                {/* LOCATION & DESCRIPTION */}
                <div className="mt-4">
                  <p className="flex items-start gap-1.5 text-[11px] font-bold text-[#526158]">
                    <MapPin size={14} className="shrink-0 text-[#124b35]" />
                    {report.address || `${report.latitude?.toFixed(4)}, ${report.longitude?.toFixed(4)}`}
                  </p>
                  <p className="mt-2 text-sm text-[#14251c] line-clamp-3">
                    {report.description || "No written description provided."}
                  </p>
                </div>

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
                      🎙️ Citizen Voice Note
                    </p>
                    <audio controls src={report.voice_url} className="w-full h-8" />
                  </div>
                )}

                {/* RESOLUTION PROOF PHOTO */}
                {report.resolution_proof_url && (
                  <div className="mt-3 rounded-2xl bg-emerald-50 p-2.5 border border-emerald-200">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Work Completed
                    </p>
                    <img
                      src={report.resolution_proof_url}
                      alt="Resolution Proof"
                      className="h-28 w-full rounded-xl object-cover"
                    />
                    {report.resolution_notes && (
                      <p className="mt-2 text-[11px] text-emerald-900 border-t border-emerald-200 pt-2">
                        <span className="font-bold">Notes:</span> {report.resolution_notes}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ACTION FOOTER */}
              <div className="mt-6 pt-4 border-t border-[#dce4de] flex items-center justify-between">
                <span className="text-[10px] text-[#718078] font-bold">
                  Reported: {new Date(report.created_at).toLocaleDateString()}
                </span>

                {report.assigned_to === workerInfo.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReport(report);
                      setNewStatus(report.task_status || report.status || "In Progress");
                      setResolutionNotes(report.resolution_notes || "");
                    }}
                    className="rounded-xl bg-[#124b35] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0d3d2b]"
                  >
                    Manage Task
                  </button>
                ) : (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                    Not Assigned to You
                  </span>
                )}
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
                Update Task Status
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
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#526158]">
                  Task Progress
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm font-semibold outline-none focus:border-[#124b35]"
                >
                  <option value="Assigned">Assigned (Not Started)</option>
                  <option value="In Progress">In Progress (Working on it)</option>
                  <option value="Completed">Completed (Resolved)</option>
                </select>
              </div>

              {/* RESOLUTION NOTES */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#526158]">
                  Resolution Notes <span className="normal-case font-normal text-[#718078]">(Sent to citizen)</span>
                </label>
                <div className="relative mt-2">
                  <FileText size={16} className="absolute left-3 top-3 text-[#718078]" />
                  <textarea
                    rows={3}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="e.g. Cleared the blockage and repaired the surrounding concrete."
                    className="w-full resize-none rounded-xl border border-[#dce4de] bg-[#fafcf9] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#124b35]"
                  />
                </div>
              </div>

              {/* RESOLUTION PROOF PHOTO UPLOAD */}
              <div className={`${newStatus === "Completed" ? "block" : "hidden"}`}>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#526158]">
                  Completion Evidence (After Photo)
                  <span className="text-red-500 ml-1">* Required</span>
                </label>

                <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#dce4de] bg-[#fafcf9] p-6 text-center hover:border-[#124b35]">
                  <Upload size={24} className="text-[#124b35]" />
                  <p className="mt-2 text-xs font-bold text-[#14251c]">
                    {proofFile ? proofFile.name : "Tap to upload completion photo"}
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-[#dce4de]">
                <button
                  type="button"
                  onClick={() => setActiveReport(null)}
                  className="w-1/2 rounded-xl border border-[#dce4de] bg-[#fafcf9] py-3 text-xs font-bold text-[#526158] hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="w-1/2 flex items-center justify-center gap-2 rounded-xl bg-[#124b35] py-3 text-xs font-bold text-white transition hover:bg-[#0d3d2b] disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save & Notify"
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