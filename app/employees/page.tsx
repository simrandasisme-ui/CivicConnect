"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useLanguage } from "../../context/LanguageContext";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Filter,
  Loader2,
  Upload,
  User,
  Wrench,
  X,
  Lock,
  Edit,
  MapPin,
  LogOut,
} from "lucide-react";

type Report = {
  id: string;
  category: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  task_status?: string;
  image_urls: string[];
  voice_url: string | null;
  duplicate_count: number;
  resolution_proof_url: string | null;
  resolution_notes: string | null;
  created_at: string;
  assigned_worker_id?: string | null;
  assigned_to?: string | null;
};

type WorkerProfile = {
  id: string;
  email: string;
  fullName: string;
  department: string;
  deptId: string;
  role: string;
};

/* =========================================================
   DEPARTMENT / CATEGORY MATCHING
   ========================================================= */

const DEPARTMENT_ALIASES: Record<string, string[]> = {
  sanitation: [
    "sanitation",
    "garbage",
    "waste",
    "waste management",
    "garbage collection",
    "cleanliness",
  ],

  roads: [
    "roads",
    "road",
    "public works",
    "pothole",
    "potholes",
    "street",
    "road maintenance",
  ],

  water: [
    "water",
    "water supply",
    "water leakage",
    "water leak",
    "pipeline",
    "pipelines",
  ],

  electricity: [
    "electricity",
    "electrical",
    "power",
    "street light",
    "streetlight",
    "lighting",
  ],

  drainage: [
    "drainage",
    "drain",
    "sewer",
    "sewage",
    "flooding",
    "stormwater",
  ],

  parks: [
    "parks",
    "park",
    "garden",
    "gardens",
    "public garden",
  ],
};

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .trim()
    // strip zero-width / non-breaking / other invisible whitespace-like chars
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converts a department/category into a canonical department.
 */
function getCanonicalDepartment(value: string | null | undefined) {
  const normalized = normalizeText(value);

  for (const [canonical, aliases] of Object.entries(DEPARTMENT_ALIASES)) {
    if (
      aliases.some(
        (alias) =>
          normalized === alias ||
          normalized.includes(alias) ||
          alias.includes(normalized)
      )
    ) {
      return canonical;
    }
  }

  return normalized;
}

/**
 * Determines whether a report belongs to a worker's department.
 */
function reportMatchesDepartment(
  reportCategory: string,
  workerDepartment: string
) {
  if (normalizeText(reportCategory) === "other") {
    return true;
  }

  const reportDepartment = getCanonicalDepartment(reportCategory);
  const workerDept = getCanonicalDepartment(workerDepartment);

  if (!reportDepartment || !workerDept) return false;

  return reportDepartment === workerDept;
}

export default function EmployeeDashboardPage() {
  const { t } = useLanguage();

  // =========================================================
  // WORKER PROFILE & WARNINGS
  // =========================================================

  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [authError, setAuthError] = useState(false);

  // =========================================================
  // REPORTS & FILTERS
  // =========================================================

  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("All");
  const [filterMode, setFilterMode] = useState<"assigned" | "department">("assigned");

  // =========================================================
  // MODAL
  // =========================================================

  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [newStatus, setNewStatus] = useState("In Progress");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [briefReportNote, setBriefReportNote] = useState("");
  const [updating, setUpdating] = useState(false);

  // =========================================================
  // LOAD WORKER & SECURITY
  // =========================================================

  useEffect(() => {
    const fetchWorkerProfile = async () => {
      setLoadingProfile(true);
      setAuthError(false);

      try {
        const storedWorker = window.localStorage.getItem(
          "civic_connect_worker"
        );

        if (storedWorker) {
          try {
            const parsedWorker = JSON.parse(storedWorker);

            if (parsedWorker?.deptId) {
              const { data: workerData, error: workerError } =
                await supabase
                  .from("workers")
                  .select("*")
                  .eq("dept_id", parsedWorker.deptId)
                  .maybeSingle();

              if (workerError) {
                console.error(
                  "Worker database lookup error:",
                  workerError
                );
              }

              if (workerData) {
                const profile: WorkerProfile = {
                  id: workerData.id,
                  email: workerData.email || "",
                  fullName:
                    workerData.name ||
                    workerData.full_name ||
                    parsedWorker.fullName ||
                    "Municipal Worker",
                  department:
                    workerData.department ||
                    parsedWorker.department ||
                    "",
                  deptId:
                    workerData.dept_id ||
                    parsedWorker.deptId,
                  role: workerData.role || "worker",
                };

                setWorker(profile);
                await fetchWarnings(profile.id);
                await fetchDepartmentReports(profile);
                return;
              }

              const fallbackProfile: WorkerProfile = {
                id: parsedWorker.id || "",
                email: parsedWorker.email || "",
                fullName:
                  parsedWorker.fullName || "Municipal Worker",
                department: parsedWorker.department || "",
                deptId: parsedWorker.deptId,
                role: parsedWorker.role || "worker",
              };

              setWorker(fallbackProfile);
              await fetchWarnings(fallbackProfile.id);
              await fetchDepartmentReports(fallbackProfile);
              return;
            }
          } catch (storageError) {
            console.error(
              "Invalid stored worker session:",
              storageError
            );
          }
        }

        /*
         * FALLBACK: Supabase Auth
         */
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setAuthError(true);
          return;
        }

        const { data: workerData, error: workerError } =
          await supabase
            .from("workers")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

        if (workerError || !workerData) {
          console.error(
            "Worker profile error:",
            workerError
          );

          setAuthError(true);
          return;
        }

        const profile: WorkerProfile = {
          id: workerData.id,
          email: workerData.email || "",
          fullName:
            workerData.name ||
            workerData.full_name ||
            "Municipal Worker",
          department: workerData.department || "",
          deptId: workerData.dept_id || "",
          role: workerData.role || "worker",
        };

        setWorker(profile);
        await fetchWarnings(profile.id);
        await fetchDepartmentReports(profile);
      } catch (error) {
        console.error("Profile fetch error:", error);
        setAuthError(true);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchWorkerProfile();
  }, []);

  const fetchWarnings = async (workerId: string) => {
    try {
      const { data } = await supabase
        .from("warnings_log")
        .select("*")
        .eq("worker_id", workerId)
        .order("created_at", { ascending: false });
        
      if (data) setWarnings(data);
    } catch (err) {
      console.error("Failed fetching warnings:", err);
    }
  };

  // =========================================================
  // LOGOUT HANDLER
  // =========================================================
  const handleWorkerLogout = async () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("civic_connect_worker");
    }
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  // =========================================================
  // FETCH REPORTS
  // =========================================================

  const fetchDepartmentReports = async (
    currentWorker: WorkerProfile
  ) => {
    setLoadingReports(true);

    try {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        console.error(
          "REPORT FETCH ERROR:",
          error
        );

        setReports([]);
        return;
      }

      const allReports = (data || []) as Report[];

      const departmentReports = allReports.filter((report) => {
        const explicitlyAssigned =
          (report.assigned_to && report.assigned_to === currentWorker.id) ||
          (report.assigned_worker_id && report.assigned_worker_id === currentWorker.id);

        const sameDepartment = reportMatchesDepartment(
          report.category,
          currentWorker.department
        );

        return explicitlyAssigned || sameDepartment;
      });

      setReports(departmentReports);
    } catch (error) {
      console.error(
        "Failed to fetch department reports:",
        error
      );

      setReports([]);
    } finally {
      setLoadingReports(false);
    }
  };

  // =========================================================
  // UPDATE REPORT
  // =========================================================

  const handleUpdateTicket = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!activeReport || !worker) return;

    if (
      newStatus === "Completed" &&
      !proofFile &&
      !activeReport.resolution_proof_url
    ) {
      alert(
        "An 'After Photo' proof is required to mark an issue as Completed."
      );
      return;
    }

    setUpdating(true);

    try {
      let resolutionProofUrl =
        activeReport.resolution_proof_url;

      if (proofFile) {
        const fileExt =
          proofFile.name.split(".").pop() || "jpg";

        const fileName = `resolution_${Date.now()}_${Math.random()
          .toString(36)
          .substring(7)}.${fileExt}`;

        const filePath =
          `resolution-proofs/${fileName}`;

        const { error: uploadError } =
          await supabase.storage
            .from("issue-media")
            .upload(
              filePath,
              proofFile,
              {
                contentType: proofFile.type,
              }
            );

        if (uploadError) {
          throw uploadError;
        }

        const { data: urlData } =
          supabase.storage
            .from("issue-media")
            .getPublicUrl(filePath);

        resolutionProofUrl =
          urlData.publicUrl;
      }

      const dbStatus =
        newStatus === "Not Started"
          ? "Open"
          : newStatus === "Completed"
          ? "Resolved"
          : "In Progress";

      // USING UPDATED BACKEND ROUTE PAYLOAD
      const response = await fetch("/report/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: activeReport.id,
          status: dbStatus,
          evidenceUrl: resolutionProofUrl, 
          resolutionNotes: briefReportNote.trim() || null,
          workerId: worker.id, 
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update ticket and send emails.");
      }

      await fetchDepartmentReports(worker);

      setActiveReport(null);
      setProofFile(null);
      setBriefReportNote("");
    } catch (err: unknown) {
      console.error(
        "Failed to update status:",
        err
      );

      const message =
        err instanceof Error
          ? err.message
          : "Failed to update ticket.";

      alert(message);
    } finally {
      setUpdating(false);
    }
  };

  // =========================================================
  // FILTER
  // =========================================================

  const statusFilteredReports =
    selectedStatusFilter === "All"
      ? reports
      : reports.filter((report) => {
          if (
            selectedStatusFilter ===
            "Not Started"
          ) {
            return report.status === "Open" || report.task_status === "Assigned";
          }

          if (
            selectedStatusFilter ===
            "In Progress"
          ) {
            return report.status === "In Progress" || report.task_status === "In Progress";
          }

          if (
            selectedStatusFilter ===
            "Completed"
          ) {
            return report.status === "Resolved" || report.task_status === "Completed";
          }

          return true;
        });

  const displayedReports = filterMode === "assigned"
    ? statusFilteredReports.filter(r => r.assigned_to === worker?.id || r.assigned_worker_id === worker?.id)
    : statusFilteredReports;


  // =========================================================
  // LOADING / HARD KICK REDIRECT
  // =========================================================

  if (loadingProfile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2
          className="animate-spin text-[#124b35]"
          size={32}
        />
      </div>
    );
  }

  if (authError || !worker) {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
    return null;
  }

  // =========================================================
  // DASHBOARD
  // =========================================================

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

      {/* SUPERVISOR WARNINGS BANNER */}
      {warnings.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
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

      {/* HEADER */}
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dce4de] bg-white px-3.5 py-1 text-xs font-bold text-[#124b35]">
            <Building2 size={14} />
            {t("opsDashboard") ||
              "Operations Dashboard"}
          </div>

          <h1 className="mt-2 text-3xl font-extrabold text-[#14251c]">
            {t("workerPortalTitle") ||
              "Operations Portal"}
          </h1>

          <p className="mt-2 text-sm text-[#718078]">
            Showing complaints for the{" "}
            <span className="font-bold text-[#124b35]">
              {worker.department}
            </span>{" "}
            department.
          </p>
        </div>

        {/* WORKER PROFILE */}
        <div className="flex w-full flex-col gap-3 rounded-2xl border border-[#dce4de] bg-white p-4 shadow-sm lg:w-96">

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#124b35] text-white">
              <User size={24} />
            </div>

            <div>
              <p className="text-base font-bold text-[#14251c]">
                {worker.fullName}
              </p>

              <p className="text-xs text-[#718078]">
                ID: {worker.deptId} •{" "}
                {worker.department} Dept
              </p>
            </div>
          </div>

          {worker.role === "admin" ? (
            <button
              type="button"
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#124b35] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0d3d2b]"
            >
              <Edit size={16} />
              Edit Profile settings
            </button>
          ) : (
            <div className="mt-2 rounded-xl border border-[#dce4de] bg-[#eef5ef] px-4 py-3">
              <p className="flex items-center gap-2 text-[11px] font-bold text-[#718078]">
                <Lock
                  size={14}
                  className="text-[#124b35]"
                />
                Profile locked & managed by
                Municipal Admin.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleWorkerLogout}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100"
          >
            <LogOut size={16} />
            Log Out
          </button>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="mb-6 flex gap-3 border-b border-[#dce4de] pb-4">
        <button
          onClick={() => setFilterMode("assigned")}
          className={`rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            filterMode === "assigned"
              ? "bg-[#124b35] text-white"
              : "border border-[#dce4de] bg-white text-[#526158] hover:bg-[#fafcf9]"
          }`}
        >
          Assigned to Me
        </button>
        <button
          onClick={() => setFilterMode("department")}
          className={`rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            filterMode === "department"
              ? "bg-[#124b35] text-white"
              : "border border-[#dce4de] bg-white text-[#526158] hover:bg-[#fafcf9]"
          }`}
        >
          All {worker.department} Tasks
        </button>
      </div>

      <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-4">
        <Filter
          size={16}
          className="shrink-0 text-[#718078]"
        />

        {[
          {
            key: "All",
            label: t("filterAll") || "All",
          },
          {
            key: "Not Started",
            label:
              t("filterNotStarted") ||
              "Not Started",
          },
          {
            key: "In Progress",
            label:
              t("filterInProgress") ||
              "In Progress",
          },
          {
            key: "Completed",
            label:
              t("filterCompleted") ||
              "Completed",
          },
        ].map((filterObj) => (
          <button
            key={filterObj.key}
            type="button"
            onClick={() =>
              setSelectedStatusFilter(
                filterObj.key
              )
            }
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition ${
              selectedStatusFilter ===
              filterObj.key
                ? "bg-[#124b35] text-white"
                : "border border-[#dce4de] bg-white text-[#526158] hover:bg-[#fafcf9]"
            }`}
          >
            {filterObj.label}
          </button>
        ))}
      </div>

      {/* REPORTS */}
      {loadingReports ? (
        <div className="flex h-64 w-full items-center justify-center gap-2 rounded-3xl border border-[#dce4de] bg-white">
          <Loader2
            className="animate-spin text-[#124b35]"
            size={24}
          />

          <span className="text-sm font-bold text-[#124b35]">
            Fetching department tickets...
          </span>
        </div>
      ) : displayedReports.length === 0 ? (
        <div className="rounded-3xl border border-[#dce4de] bg-white p-12 text-center shadow-sm">

          <CheckCircle2
            size={40}
            className="mx-auto text-[#124b35]"
          />

          <h3 className="mt-3 text-lg font-bold text-[#14251c]">
            No complaints found
          </h3>

          <p className="mt-1 text-xs text-[#718078]">
            {filterMode === "assigned"
              ? "You have no pending tasks explicitly assigned to you."
              : `No reports currently match the ${worker.department} department.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">

          {displayedReports.map((report) => (
            <div
              key={report.id}
              className="flex flex-col justify-between rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div>

                {/* CATEGORY + STATUS */}
                <div className="flex items-center justify-between gap-2">

                  <span className="rounded-lg bg-[#eef5ef] px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-[#124b35]">
                    {report.category}
                  </span>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                      report.task_status === "Completed" || report.status === "Resolved"
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

                {/* DUPLICATES */}
                {report.duplicate_count >
                  0 && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-800">
                    <AlertCircle size={13} />

                    Priority Boosted ({" "}
                    {report.duplicate_count +
                      1}{" "}
                    citizens)
                  </div>
                )}

                {/* DESCRIPTION */}
                <p className="mt-3 line-clamp-3 text-sm text-[#14251c]">
                  {report.description ||
                    "No written text provided."}
                </p>

                {/* IMAGE */}
                {report.image_urls &&
                  report.image_urls.length >
                    0 && (
                    <div className="mt-4">
                      <img
                        src={
                          report.image_urls[0]
                        }
                        alt="Complaint"
                        className="h-40 w-full rounded-2xl border border-[#dce4de] object-cover"
                      />
                    </div>
                  )}

                {/* VOICE - FIXED HEIGHT AND FALLBACK ADDED */}
                {report.voice_url && (
                  <div className="mt-3 rounded-2xl border border-[#dce4de] bg-[#f0f4f1] p-3">
                    <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#124b35]">
                      🎙️ Voice Recording
                    </p>

                    <audio
                      controls
                      src={report.voice_url}
                      className="mt-2 w-full"
                    >
                      <a href={report.voice_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#124b35] underline">
                        Download/Listen to Audio
                      </a>
                    </audio>
                  </div>
                )}

                {/* RESOLUTION PROOF */}
                {report.resolution_proof_url && (
                  <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-2.5">

                    <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                      <CheckCircle2
                        size={12}
                      />
                      Work Completed Proof
                    </p>

                    <img
                      src={
                        report.resolution_proof_url
                      }
                      alt="Proof"
                      className="h-28 w-full rounded-xl object-cover"
                    />

                    {report.resolution_notes && (
                      <p className="mt-1.5 text-xs italic text-emerald-900">
                        "{report.resolution_notes}"
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* MAP NAVIGATION (FAILSAFE) */}
                {report.latitude !== null && 
                report.longitude !== null && 
                report.latitude !== 0 && 
                report.longitude !== 0 && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${report.latitude},${report.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in Google Maps"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-[#124b35] bg-[#eef5ef] px-4 py-2 text-xs font-bold text-[#124b35] transition hover:bg-[#124b35] hover:text-white"
                >
                <MapPin size={14} /> 
                  Navigate to Location
                </a>
              )}

              {/* FOOTER */}
              <div className="mt-6 flex items-center justify-between border-t border-[#dce4de] pt-4">

                <span className="text-[11px] font-bold text-[#718078]">
                  Reported:{" "}
                  {new Date(
                    report.created_at
                  ).toLocaleDateString()}
                </span>

                {report.assigned_to === worker.id || report.assigned_worker_id === worker.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReport(
                        report
                      );

                      setNewStatus(
                        report.task_status ||
                        (report.status === "Open" ? "Not Started" : report.status === "Resolved" ? "Completed" : "In Progress")
                      );

                      setBriefReportNote(
                        report.resolution_notes ||
                          ""
                      );
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-[#124b35] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0d3d2b]"
                  >
                    <Wrench size={14} />
                    Update Task
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

      {/* =====================================================
         UPDATE MODAL
      ===================================================== */}

      {activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14251c]/40 p-4 backdrop-blur-sm">

          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-[#dce4de] bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-[#dce4de] bg-[#fafcf9] px-6 py-4">

              <h3 className="text-lg font-bold text-[#14251c]">
                Update Assigned Task
              </h3>

              <button
                type="button"
                onClick={() =>
                  setActiveReport(null)
                }
                className="rounded-full p-2 text-[#718078] transition hover:bg-[#eef5ef] hover:text-[#124b35]"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleUpdateTicket}
              className="space-y-5 p-6"
            >

              {/* REPORT SUMMARY */}
              <div className="rounded-2xl border border-[#dce4de] bg-[#fafcf9] p-4">

                <p className="text-[10px] font-bold uppercase tracking-wider text-[#718078]">
                  Report Category
                </p>

                <p className="mt-1 font-bold text-[#14251c]">
                  {activeReport.category}
                </p>

                <p className="mt-2 text-sm text-[#718078] line-clamp-2">
                  {activeReport.description ||
                    "No description provided."}
                </p>
              </div>

              {/* STATUS */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#526158]">
                  Task Progress
                </label>

                <select
                  value={newStatus}
                  onChange={(e) =>
                    setNewStatus(
                      e.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm font-semibold outline-none focus:border-[#124b35]"
                >
                  <option value="Assigned">
                    Assigned (Not Started)
                  </option>

                  <option value="In Progress">
                    In Progress (Working on it)
                  </option>

                  <option value="Completed">
                    Completed (Resolved)
                  </option>
                </select>
              </div>

              {/* NOTES */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#526158]">
                  Resolution Notes <span className="normal-case font-normal text-[#718078]">(Sent to citizen)</span>
                </label>

                <textarea
                  rows={3}
                  value={
                    briefReportNote
                  }
                  onChange={(e) =>
                    setBriefReportNote(
                      e.target.value
                    )
                  }
                  placeholder="e.g. Cleared the blockage and repaired the surrounding concrete."
                  className="mt-2 w-full resize-none rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm outline-none focus:border-[#124b35]"
                />
              </div>

              {/* PROOF */}
              <div className={`${newStatus === "Completed" ? "block" : "hidden"}`}>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#526158]">

                  Upload Completed Work Proof

                  {newStatus ===
                    "Completed" && (
                    <span className="ml-1 text-red-500">
                      * Required
                    </span>
                  )}
                </label>

                <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#dce4de] bg-[#fafcf9] p-6 text-center hover:border-[#124b35]">

                  <Upload
                    size={24}
                    className="text-[#124b35]"
                  />

                  <p className="mt-2 text-xs font-bold text-[#14251c]">
                    {proofFile
                      ? proofFile.name
                      : "Tap to upload completion photo"}
                  </p>

                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) =>
                      setProofFile(
                        e.target.files?.[0] ||
                          null
                      )
                    }
                    className="hidden"
                  />
                </label>
              </div>

              {/* BUTTONS */}
              <div className="flex gap-3 pt-4 border-t border-[#dce4de]">

                <button
                  type="button"
                  onClick={() =>
                    setActiveReport(null)
                  }
                  className="w-1/2 rounded-xl border border-[#dce4de] bg-[#fafcf9] py-3 text-xs font-bold text-[#526158] hover:bg-white"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={updating}
                  className="flex w-1/2 items-center justify-center gap-2 rounded-xl bg-[#124b35] py-3 text-xs font-bold text-white transition hover:bg-[#0d3d2b] disabled:opacity-50"
                >
                  {updating ? (
                    <>
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
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