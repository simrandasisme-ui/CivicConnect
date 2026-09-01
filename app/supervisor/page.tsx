"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Users,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  Send,
  Sliders,
  LogOut,
  MapPin,
} from "lucide-react";

interface WorkerStats {
  worker_id: string;
  employee_id: string;
  tasks_assigned: number;
  tasks_completed: number;
  tasks_pending: number;
  tasks_overdue: number;
  weekly_quota: number;
  status: string;
}

interface Issue {
  id: string;
  category: string;
  description: string;
  address: string;
  image_urls: string[];
  task_status: string;
  assigned_to: string | null;
  created_at: string;
}

export default function SupervisorDashboard() {
  const router = useRouter();
  const [department, setDepartment] = useState("");
  const [workers, setWorkers] = useState<WorkerStats[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<string>("");
  const [warningMessage, setWarningMessage] = useState("");
  const [newQuota, setNewQuota] = useState<number>(10);
  const [activeTab, setActiveTab] = useState<"tasks" | "workers">("tasks");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check generic auth
    const rawAuth = localStorage.getItem("civic_connect_auth");
    if (!rawAuth) {
      router.push("/");
      return;
    }
    const authSession = JSON.parse(rawAuth);
    if (authSession.role !== "supervisor") {
      router.push("/");
      return;
    }

    // 2. Fetch specific worker data containing the database department
    const rawWorker = localStorage.getItem("civic_connect_worker");
    if (!rawWorker) {
      router.push("/");
      return;
    }
    
    const workerSession = JSON.parse(rawWorker);
    const activeDept = workerSession.department || "Garbage"; // Fallback only if db is empty
    
    setDepartment(activeDept);
    loadDashboardData(activeDept);
  }, []);

  const loadDashboardData = async (dept: string) => {
    setLoading(true);
    try {
      // Fetch live department issues
      const { data: deptIssues } = await supabase
        .from("reports")
        .select("*")
        .eq("category", dept)
        .order("created_at", { ascending: false });

      if (deptIssues) setIssues(deptIssues);

      // Fetch weekly worker performance stats via Supabase RPC
      const { data: workerData, error: rpcErr } = await supabase.rpc(
        "get_weekly_worker_stats",
        { supervisor_dept: dept }
      );

      if (!rpcErr && workerData) {
        setWorkers(workerData);
      }
    } catch (err) {
      console.error("Failed loading supervisor metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTask = async (reportId: string, workerId: string) => {
    if (!workerId) return;
    const { error } = await supabase
      .from("reports")
      .update({
        assigned_to: workerId,
        task_status: "Assigned",
      })
      .eq("id", reportId);

    if (!error) {
      alert("Task successfully assigned.");
      loadDashboardData(department);
    }
  };

  const handleSetQuota = async (workerId: string) => {
    const { error } = await supabase.from("worker_quotas").upsert({
      worker_id: workerId,
      weekly_quota: newQuota,
      updated_at: new Date().toISOString(),
    });

    if (!error) {
      alert("Weekly quota updated.");
      loadDashboardData(department);
    }
  };

  const handleSendWarning = async (workerId: string) => {
    if (!warningMessage.trim()) return;
    const { error } = await supabase.from("warnings_log").insert({
      worker_id: workerId,
      message: warningMessage.trim(),
    });

    if (!error) {
      alert("Reminder sent to worker dashboard.");
      setWarningMessage("");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("civic_connect_auth");
    localStorage.removeItem("civic_connect_worker");
    document.cookie = "civic_connect_auth=; path=/; max-age=0;";
    router.push("/");
  };

  if (!department) return null; // Prevents UI flicker while loading

  return (
    <div className="min-h-screen bg-[#fafcf9] px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 border-b border-[#dce4de] pb-6 sm:flex-row sm:items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#124b35]">
              Supervisor Management Portal
            </span>
            <h1 className="mt-1 text-2xl font-black text-[#14251c] sm:text-3xl">
              {department} Department Overview
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 self-start sm:self-center rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition"
          >
            <LogOut size={14} /> Log Out
          </button>
        </div>

        {/* View Switcher Tabs */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setActiveTab("tasks")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              activeTab === "tasks"
                ? "bg-[#124b35] text-white"
                : "border border-[#dce4de] bg-white text-[#526158] hover:bg-[#fafcf9]"
            }`}
          >
            <ClipboardList size={16} /> Department Tickets ({issues.length})
          </button>
          <button
            onClick={() => setActiveTab("workers")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              activeTab === "workers"
                ? "bg-[#124b35] text-white"
                : "border border-[#dce4de] bg-white text-[#526158] hover:bg-[#fafcf9]"
            }`}
          >
            <Users size={16} /> Field Staff Performance ({workers.length})
          </button>
        </div>

        {/* TAB 1: Department Task List & Assignment */}
        {activeTab === "tasks" && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="flex flex-col justify-between rounded-2xl border border-[#dce4de] bg-white p-5 shadow-sm hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                        issue.task_status === "Completed"
                          ? "bg-emerald-100 text-emerald-800"
                          : issue.task_status === "In Progress"
                          ? "bg-blue-100 text-blue-800"
                          : issue.task_status === "Assigned"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {issue.task_status || "Pending"}
                    </span>
                    <span className="text-[11px] font-bold text-[#718078]">
                      {new Date(issue.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="mt-3 text-sm font-bold text-[#14251c] line-clamp-2">
                    {issue.description || "No specific description provided."}
                  </p>
                  <p className="mt-2 flex items-start gap-1 text-xs font-semibold text-[#526158]">
                    <MapPin size={14} className="shrink-0 text-[#124b35]" /> 
                    {issue.address || "GPS Coordinates Logged"}
                  </p>
                </div>

                <div className="mt-4 border-t border-[#dce4de] pt-4">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#718078]">
                    Assign / Reassign Worker:
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <select
                      defaultValue={issue.assigned_to || ""}
                      onChange={(e) => handleAssignTask(issue.id, e.target.value)}
                      className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] px-3 py-2 text-xs font-semibold outline-none focus:border-[#124b35]"
                    >
                      <option value="" disabled>
                        Select Field Worker
                      </option>
                      {workers.map((w) => (
                        <option key={w.worker_id} value={w.worker_id}>
                          {w.employee_id} ({w.tasks_pending} active)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
            
            {issues.length === 0 && !loading && (
              <div className="col-span-full rounded-2xl border border-dashed border-[#dce4de] p-8 text-center text-sm text-[#718078]">
                No issues currently reported in the {department} department.
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Worker Performance, Quotas & Manual Reminders */}
        {activeTab === "workers" && (
          <div className="mt-6 space-y-6">
            <div className="overflow-x-auto rounded-2xl border border-[#dce4de] bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#dce4de] bg-[#fafcf9] font-bold text-[#526158]">
                  <tr>
                    <th className="p-4 uppercase tracking-wider text-[11px]">Employee ID</th>
                    <th className="p-4 uppercase tracking-wider text-[11px]">Completed</th>
                    <th className="p-4 uppercase tracking-wider text-[11px]">Pending</th>
                    <th className="p-4 uppercase tracking-wider text-[11px]">Overdue (&gt;7d)</th>
                    <th className="p-4 uppercase tracking-wider text-[11px]">Weekly Quota</th>
                    <th className="p-4 uppercase tracking-wider text-[11px]">Performance Status</th>
                    <th className="p-4 text-right uppercase tracking-wider text-[11px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dce4de]">
                  {workers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[#718078]">
                        No workers registered for the {department} department.
                      </td>
                    </tr>
                  ) : (
                    workers
                      .sort((a, b) => b.tasks_completed - a.tasks_completed)
                      .map((w) => (
                        <tr key={w.worker_id} className="transition hover:bg-[#fafcf9]">
                          <td className="p-4 font-mono font-bold text-[#14251c]">
                            {w.employee_id}
                          </td>
                          <td className="p-4 text-emerald-700 font-bold text-sm">
                            {w.tasks_completed}
                          </td>
                          <td className="p-4 text-amber-700 font-bold text-sm">
                            {w.tasks_pending}
                          </td>
                          <td className="p-4 text-red-700 font-bold text-sm">
                            {w.tasks_overdue}
                          </td>
                          <td className="p-4 font-semibold text-[#526158]">{w.weekly_quota}</td>
                          <td className="p-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                                w.status === "Above target"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : w.status === "On target"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {w.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => setSelectedWorker(w.worker_id)}
                              className="rounded-lg bg-[#eef5ef] px-3 py-1.5 font-bold text-[#124b35] transition hover:bg-[#124b35] hover:text-white"
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Selected Worker Management Modal/Section */}
            {selectedWorker && (
              <div className="rounded-2xl border border-[#dce4de] bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-[#14251c]">
                  Manage Worker Quota & Reminders
                </h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-[#fafcf9] p-4 border border-[#dce4de]">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-[#718078]">
                      Set Weekly Target Quota
                    </label>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="number"
                        min="1"
                        value={newQuota}
                        onChange={(e) => setNewQuota(parseInt(e.target.value) || 1)}
                        className="w-24 rounded-xl border border-[#dce4de] px-3 py-2 text-xs font-bold outline-none focus:border-[#124b35]"
                      />
                      <button
                        onClick={() => handleSetQuota(selectedWorker)}
                        className="rounded-xl bg-[#124b35] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0d3d2b]"
                      >
                        Save Quota
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#fafcf9] p-4 border border-[#dce4de]">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-[#718078]">
                      Send Manual Warning / Reminder
                    </label>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Please review pending road repairs"
                        value={warningMessage}
                        onChange={(e) => setWarningMessage(e.target.value)}
                        className="w-full rounded-xl border border-[#dce4de] px-3 py-2 text-xs outline-none focus:border-[#124b35]"
                      />
                      <button
                        onClick={() => handleSendWarning(selectedWorker)}
                        className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-700"
                      >
                        <Send size={14} /> Send
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}