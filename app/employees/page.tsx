"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useLanguage } from "../../context/LanguageContext";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Filter,
  Loader2,
  ShieldCheck,
  Upload,
  User,
  Wrench,
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
  resolution_notes: string | null;
  created_at: string;
};

type WorkerProfile = {
  fullName: string;
  department: string;
  deptId: string;
  phone: string;
};

export default function EmployeeDashboardPage() {
  const { t } = useLanguage();

  // Verification & Profile State
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDept, setFormDept] = useState("Garbage");
  const [formDeptId, setFormDeptId] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Tickets & Radius State
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("All");

  // Action Modal State
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [newStatus, setNewStatus] = useState("In Progress");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [briefReportNote, setBriefReportNote] = useState("");
  const [updating, setUpdating] = useState(false);

  const departments = [
    "Garbage",
    "Pothole",
    "Water Leakage",
    "Electricity",
    "Streetlight",
    "Drainage",
    "Other",
  ];

  useEffect(() => {
    const savedWorker = localStorage.getItem("civic_connect_worker");
    if (savedWorker) {
      try {
        const parsed = JSON.parse(savedWorker);
        setWorker(parsed);
        fetchDepartmentReports(parsed.department);
      } catch {
        setShowVerificationModal(true);
      }
    } else {
      setShowVerificationModal(true);
    }
  }, []);

  const fetchDepartmentReports = async (department: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("category", department)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setReports(data);
    }
    setLoading(false);
  };

  /* ---------------- PHONE OTP VERIFICATION ---------------- */
  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formDeptId.trim() || !formPhone.trim()) {
      alert("Please fill in all verification fields.");
      return;
    }
    setOtpSent(true);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpInput !== "1234" && otpInput !== "9999") {
      alert("Invalid OTP code. For demo testing, enter '1234'.");
      return;
    }

    setVerifying(true);

    try {
      const profile: WorkerProfile = {
        fullName: formName.trim(),
        department: formDept,
        deptId: formDeptId.trim(),
        phone: formPhone.trim(),
      };

      await supabase.from("workers").upsert([
        {
          dept_id: profile.deptId,
          full_name: profile.fullName,
          department: profile.department,
          phone_number: profile.phone,
          is_verified: true,
        },
      ]);

      localStorage.setItem("civic_connect_worker", JSON.stringify(profile));
      setWorker(profile);
      setShowVerificationModal(false);
      fetchDepartmentReports(profile.department);
    } catch (err: unknown) {
      console.error("Worker registration error:", err);
    } finally {
      setVerifying(false);
    }
  };

  /* ---------------- UPDATE WORKER TICKET ---------------- */
  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReport) return;

    if (newStatus === "Completed" && !proofFile) {
      alert("An 'After Photo' proof is required to mark an issue as Completed.");
      return;
    }

    setUpdating(true);

    try {
      let resolutionProofUrl = activeReport.resolution_proof_url;

      if (proofFile) {
        const fileExt = proofFile.name.split(".").pop() || "jpg";
        const fileName = `resolution_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
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

      const dbStatus =
        newStatus === "Not Started"
          ? "Open"
          : newStatus === "Completed"
          ? "Resolved"
          : "In Progress";

      const { error: updateError } = await supabase
        .from("reports")
        .update({
          status: dbStatus,
          resolution_proof_url: resolutionProofUrl,
          resolution_notes: briefReportNote.trim() || null,
          assigned_worker_id: worker?.deptId,
        })
        .eq("id", activeReport.id);

      if (updateError) throw updateError;

      if (worker) {
        fetchDepartmentReports(worker.department);
      }
      setActiveReport(null);
      setProofFile(null);
      setBriefReportNote("");
    } catch (err: unknown) {
      console.error("Failed to update status:", err);
      const msg = err instanceof Error ? err.message : "Failed to update ticket.";
      alert(msg);
    } finally {
      setUpdating(false);
    }
  };

  const filteredReports =
    selectedStatusFilter === "All"
      ? reports
      : reports.filter((r) => {
          if (selectedStatusFilter === "Not Started") return r.status === "Open";
          if (selectedStatusFilter === "In Progress") return r.status === "In Progress";
          if (selectedStatusFilter === "Completed") return r.status === "Resolved";
          return true;
        });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* HEADER BAR */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dce4de] bg-white px-3.5 py-1 text-xs font-bold text-[#124b35]">
            <Building2 size={14} /> {t("opsDashboard")}
          </div>
          <h1 className="mt-2 text-3xl font-extrabold text-[#14251c]">
            {t("workerPortalTitle")}
          </h1>
        </div>

        {/* WORKER IDENTITY CARD */}
        {worker && (
          <div className="flex items-center gap-3 rounded-2xl border border-[#dce4de] bg-white p-3.5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#124b35] text-white">
              <User size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#14251c]">{worker.fullName}</p>
              <p className="text-[11px] text-[#718078]">
                ID: {worker.deptId} • {worker.department} Dept
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowVerificationModal(true)}
              className="ml-2 rounded-lg border border-[#dce4de] p-1.5 text-xs font-bold text-[#718078] hover:bg-[#fafcf9]"
            >
              {t("switchUser")}
            </button>
          </div>
        )}
      </div>

      {/* TICKET STATUS FILTERS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6">
        <Filter size={16} className="text-[#718078] shrink-0" />
        {[
          { key: "All", label: t("filterAll") },
          { key: "Not Started", label: t("filterNotStarted") },
          { key: "In Progress", label: t("filterInProgress") },
          { key: "Completed", label: t("filterCompleted") },
        ].map((filterObj) => (
          <button
            key={filterObj.key}
            type="button"
            onClick={() => setSelectedStatusFilter(filterObj.key)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              selectedStatusFilter === filterObj.key
                ? "bg-[#124b35] text-white"
                : "border border-[#dce4de] bg-white text-[#526158] hover:bg-[#fafcf9]"
            }`}
          >
            {filterObj.label}
          </button>
        ))}
      </div>

      {/* ASSIGNED TICKETS LIST */}
      {loading ? (
        <div className="flex h-64 w-full items-center justify-center gap-2 rounded-3xl border border-[#dce4de] bg-white">
          <Loader2 className="animate-spin text-[#124b35]" size={24} />
          <span className="text-sm font-bold text-[#124b35]">
            Fetching assigned ward tickets...
          </span>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="rounded-3xl border border-[#dce4de] bg-white p-12 text-center">
          <CheckCircle2 size={40} className="mx-auto text-[#124b35]" />
          <h3 className="mt-3 text-lg font-bold text-[#14251c]">
            No assigned complaints
          </h3>
          <p className="text-xs text-[#718078] mt-1">
            There are currently no tickets matching this filter in your department.
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
                {/* TOP STATUS BAR */}
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
                    {report.status === "Open"
                      ? t("filterNotStarted")
                      : report.status === "Resolved"
                      ? t("filterCompleted")
                      : t("filterInProgress")}
                  </span>
                </div>

                {/* DUPLICATE REPORT BADGE */}
                {report.duplicate_count > 0 && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-800 border border-orange-200">
                    <AlertCircle size={13} />
                    <span>Reported by {report.duplicate_count + 1} citizens</span>
                  </div>
                )}

                {/* DESCRIPTION */}
                <p className="mt-3 text-sm text-[#14251c] line-clamp-3">
                  {report.description || "No written text provided."}
                </p>

                {/* CITIZEN COMPLAINT IMAGE */}
                {report.image_urls && report.image_urls.length > 0 && (
                  <div className="mt-4">
                    <img
                      src={report.image_urls[0]}
                      alt="Complaint"
                      className="h-40 w-full rounded-2xl object-cover border border-[#dce4de]"
                    />
                  </div>
                )}

                {/* CITIZEN VOICE RECORDING */}
                {report.voice_url && (
                  <div className="mt-3 rounded-2xl bg-[#f0f4f1] p-3 border border-[#dce4de]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#124b35] mb-1 flex items-center gap-1">
                      🎙️ {t("citizenVoiceRecording")}
                    </p>
                    <audio controls src={report.voice_url} className="w-full h-8" />
                  </div>
                )}

                {/* RESOLUTION PROOF DISPLAY */}
                {report.resolution_proof_url && (
                  <div className="mt-3 rounded-2xl bg-emerald-50 p-2.5 border border-emerald-200">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1 flex items-center gap-1">
                      <CheckCircle2 size={12} /> {t("workCompletedProof")}
                    </p>
                    <img
                      src={report.resolution_proof_url}
                      alt="Proof"
                      className="h-28 w-full rounded-xl object-cover"
                    />
                    {report.resolution_notes && (
                      <p className="mt-1.5 text-xs text-emerald-900 italic">
                        "{report.resolution_notes}"
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ACTION FOOTER */}
              <div className="mt-6 pt-4 border-t border-[#dce4de] flex items-center justify-between">
                <span className="text-[11px] text-[#718078]">
                  Logged: {new Date(report.created_at).toLocaleDateString()}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setActiveReport(report);
                    setNewStatus(
                      report.status === "Open"
                        ? "Not Started"
                        : report.status === "Resolved"
                        ? "Completed"
                        : "In Progress"
                    );
                  }}
                  className="rounded-xl bg-[#124b35] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0d3d2b] flex items-center gap-1.5"
                >
                  <Wrench size={14} /> {t("updateTask")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* WORKER OTP VERIFICATION MODAL */}
      {showVerificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[#dce4de] bg-white p-6 shadow-2xl sm:p-8">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#124b35] text-white">
                <ShieldCheck size={24} />
              </div>
              <h3 className="mt-3 text-xl font-bold text-[#14251c]">
                Municipal Worker Verification
              </h3>
              <p className="mt-1 text-xs text-[#718078]">
                Enter your department details and verify via phone OTP
              </p>
            </div>

            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#718078]">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Rajesh Kumar Swain"
                    className="mt-1 w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm outline-none focus:border-[#124b35]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#718078]">
                    Assigned Department
                  </label>
                  <select
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm outline-none focus:border-[#124b35]"
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#718078]">
                    Department ID
                  </label>
                  <input
                    type="text"
                    required
                    value={formDeptId}
                    onChange={(e) => setFormDeptId(e.target.value)}
                    placeholder="e.g. EMP-4092"
                    className="mt-1 w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm outline-none focus:border-[#124b35]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#718078]">
                    Private Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="mt-1 w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm outline-none focus:border-[#124b35]"
                  />
                </div>

                <button
                  type="submit"
                  className="mt-2 w-full rounded-xl bg-[#124b35] py-3 text-xs font-bold text-white transition hover:bg-[#0d3d2b]"
                >
                  Send Verification OTP
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
                <div className="rounded-2xl bg-[#eef5ef] p-3 text-center border border-[#dce4de]">
                  <p className="text-xs text-[#124b35] font-semibold">
                    OTP sent to {formPhone}
                  </p>
                  <p className="text-[10px] text-[#718078] mt-0.5">
                    (Use demo code: <strong className="font-mono">1234</strong>)
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#718078]">
                    Enter 4-Digit OTP
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    required
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    placeholder="1234"
                    className="mt-1 w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-center font-mono text-lg font-bold outline-none focus:border-[#124b35]"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="w-1/3 rounded-xl border border-[#dce4de] py-3 text-xs font-bold text-[#526158]"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={verifying}
                    className="w-2/3 rounded-xl bg-[#124b35] py-3 text-xs font-bold text-white"
                  >
                    {verifying ? "Verifying..." : "Verify & Sign In"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* UPDATE TASK MODAL WITH PROOF & BRIEF REPORT */}
      {activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-[#dce4de] bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#14251c]">
                Update Assigned Duty
              </h3>
              <button
                type="button"
                onClick={() => setActiveReport(null)}
                className="rounded-lg p-1 text-[#718078] hover:bg-[#fafcf9]"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateTicket} className="mt-6 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#718078]">
                  Select Work Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm font-semibold outline-none focus:border-[#124b35]"
                >
                  <option value="Not Started">Not Started Yet</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#718078]">
                  Brief Report Message to Citizen
                </label>
                <textarea
                  rows={3}
                  value={briefReportNote}
                  onChange={(e) => setBriefReportNote(e.target.value)}
                  placeholder="e.g. Waste cleared completely and disinfectant sprayed in area..."
                  className="mt-2 w-full resize-none rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm outline-none focus:border-[#124b35]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#718078]">
                  Upload Completed Work Proof (After Photo)
                  {newStatus === "Completed" && (
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
                  disabled={updating}
                  className="w-1/2 flex items-center justify-center gap-2 rounded-xl bg-[#124b35] py-3 text-xs font-bold text-white disabled:opacity-50"
                >
                  {updating ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Save & Notify Citizen"
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