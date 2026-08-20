"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; 
import { 
  Building2, 
  KeyRound, 
  ShieldCheck, 
  UserPlus, 
  Users, 
  Edit, 
  X, 
  Loader2,
  Trash2,
  AlertTriangle,
  HardHat,
  Landmark,
  LogOut
} from "lucide-react";

type Worker = {
  id?: string;
  dept_id: string;
  name: string;
  department: string;
  password?: string;
  role?: string;
};

export default function AdminDashboard() {
  const router = useRouter();

  // Security & Auth State
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Registration State
  const [staffRole, setStaffRole] = useState<"worker" | "officer">("worker");
  const [staffName, setStaffName] = useState("");
  const [department, setDepartment] = useState("");
  const [generatedId, setGeneratedId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Worker List & Edit/Delete State
  const [workersList, setWorkersList] = useState<Worker[]>([]);
  const [fetchingWorkers, setFetchingWorkers] = useState(true);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Delete State
  const [workerToDelete, setWorkerToDelete] = useState<Worker | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // =========================================================
  // SECURITY: VERIFY ADMIN ON MOUNT
  // =========================================================
  useEffect(() => {
    setCheckingAuth(true);

    // Check if they have the admin wristband
    const isAdmin = window.localStorage.getItem("is_admin_logged_in");

    if (isAdmin === "true") {
      // Let them in!
      setIsAdminAuthorized(true);
      setCheckingAuth(false);
      fetchWorkers();
    } else {
      // Kick them out!
      setIsAdminAuthorized(false);
      setCheckingAuth(false);
      if (typeof window !== "undefined") {
        window.location.href = "/"; 
      }
    }
  }, []);

  const fetchWorkers = async () => {
    setFetchingWorkers(true);
    try {
      const { data, error } = await supabase
        .from("workers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setWorkersList(data);
    } catch (error) {
      console.error("Failed to fetch workers:", error);
    } finally {
      setFetchingWorkers(false);
    }
  };

  // =========================================================
  // LOGOUT HANDLER
  // =========================================================
  const handleAdminLogout = async () => {
    // 1. Explicitly wipe the admin wristband from local storage
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("is_admin_logged_in");
    }

    // 2. Terminate the Supabase auth session (just to be safe)
    await supabase.auth.signOut();

    // 3. Hard redirect back to login
    if (typeof window !== "undefined") {
      window.location.href = "/"; 
    }
  };

  // Switch roles and clear generated ID/department
  const handleRoleSwitch = (role: "worker" | "officer") => {
    setStaffRole(role);
    setGeneratedId("");
    setDepartment(""); 
  };

  // Generates a random 5-digit number appended to EMP- or BO-
  const handleGenerateId = () => {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    if (staffRole === "officer") {
      setGeneratedId(`BO-${randomNum}`);
    } else {
      setGeneratedId(`EMP-${randomNum}`);
    }
  };

  const handleRegisterStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (!generatedId || !staffName || !department || !password) {
      setMessage({ type: "error", text: "Please fill out all fields and generate an ID." });
      return;
    }

    setLoading(true);

    try {
      // Check if the generated ID somehow already exists
      const { data: existingWorker } = await supabase
        .from("workers")
        .select("dept_id")
        .eq("dept_id", generatedId);

      if (existingWorker && existingWorker.length > 0) {
        setMessage({ type: "error", text: "This ID already exists. Please generate a new one." });
        setLoading(false);
        return;
      }

      // Insert the new staff into Supabase
      const { error } = await supabase.from("workers").insert([
        {
          dept_id: generatedId,
          name: staffName,
          department: department,
          password: password,
          role: staffRole 
        },
      ]);

      if (error) throw error;

      setMessage({ type: "success", text: `${staffRole === 'officer' ? 'Officer' : 'Worker'} ${staffName} (${generatedId}) successfully registered!` });

      // Clear form for the next entry
      setStaffName("");
      setDepartment("");
      setGeneratedId("");
      setPassword("");

      // Refresh the worker list to show the new addition
      fetchWorkers();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Failed to register staff.";
      setMessage({ type: "error", text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorker) return;

    setEditLoading(true);
    try {
      const updatePayload: Partial<Worker> = {
        name: editingWorker.name,
        department: editingWorker.department,
      };

      if (editingWorker.password && editingWorker.password.trim() !== "") {
        updatePayload.password = editingWorker.password;
      }

      const { error } = await supabase
        .from("workers")
        .update(updatePayload)
        .eq("dept_id", editingWorker.dept_id);

      if (error) throw error;

      setEditingWorker(null);
      fetchWorkers();
    } catch (error) {
      console.error("Failed to update worker:", error);
      alert("Failed to update worker details.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteWorker = async () => {
    if (!workerToDelete) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from("workers")
        .delete()
        .eq("dept_id", workerToDelete.dept_id);

      if (error) throw error;

      setWorkerToDelete(null);
      fetchWorkers();
    } catch (error) {
      console.error("Failed to delete worker:", error);
      alert("Failed to delete worker.");
    } finally {
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    const triggerCleanup = async () => {
      try {
        await supabase.rpc("delete_old_resolved_issues");
      } catch (err) {
        console.error("Auto-cleanup background check failed:", err);
      }
    };

    if (isAdminAuthorized) {
      triggerCleanup();
    }
  }, [isAdminAuthorized]);

  // =========================================================
  // LOADING / DENIED SCREEN
  // =========================================================
  if (checkingAuth || !isAdminAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7f5]">
        <Loader2 className="animate-spin text-[#124b35]" size={36} />
      </div>
    );
  }

  // =========================================================
  // MAIN DASHBOARD
  // =========================================================
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#f4f7f5] p-4 sm:p-8">
      <div className="mx-auto w-full max-w-5xl">

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#124b35] text-white shadow-md">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#14251c]">Admin Control Panel</h1>
              <p className="text-[#718078]">Register and manage municipal staff and budget officers</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAdminLogout}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100"
          >
            <LogOut size={16} /> Log Out
          </button>
        </div>

        {/* Registration Form */}
        <div className="mb-8 w-full rounded-3xl border border-[#dce4de] bg-white p-6 sm:p-8 shadow-xl">
          <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-[#14251c]">
            <UserPlus size={20} className="text-[#124b35]" />
            Onboard New Staff
          </h2>

          <form onSubmit={handleRegisterStaff} className="space-y-5">

            {/* ROLE SELECTOR */}
            <div className="mb-2 flex rounded-2xl border border-[#dce4de] bg-[#fafcf9] p-1.5">
              <button
                type="button"
                onClick={() => handleRoleSwitch("worker")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${
                  staffRole === "worker"
                    ? "bg-[#124b35] text-white shadow-sm"
                    : "text-[#718078] hover:bg-[#f0f4f1]"
                }`}
              >
                <HardHat size={16} /> Field Worker
              </button>
              <button
                type="button"
                onClick={() => handleRoleSwitch("officer")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${
                  staffRole === "officer"
                    ? "bg-[#124b35] text-white shadow-sm"
                    : "text-[#718078] hover:bg-[#f0f4f1]"
                }`}
              >
                <Landmark size={16} /> Budget Officer
              </button>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#14251c]">Full Name</label>
                <input
                  type="text"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm focus:border-[#124b35] focus:outline-none focus:ring-2 focus:ring-[#124b35]/10"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#14251c]">Department</label>
                <div className="relative">
                  <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#718078]" />
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 pl-10 text-sm focus:border-[#124b35] focus:outline-none focus:ring-2 focus:ring-[#124b35]/10"
                  >
                    <option value="">Select Department...</option>
                    {staffRole === "worker" ? (
                      <>
                        <option value="Sanitation">Sanitation</option>
                        <option value="Roads">Roads & Transport</option>
                        <option value="Water">Water Supply</option>
                        <option value="Electricity">Electricity</option>
                        <option value="Drainage">Drainage</option>
                        <option value="Parks">Parks & Gardens</option>
                      </>
                    ) : (
                      <>
                        <option value="Finance">Finance & Budgeting</option>
                        <option value="Urban Planning">Urban Planning</option>
                        <option value="Administration">Administration</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#14251c]">
                  {staffRole === "officer" ? "Officer ID" : "Employee ID"}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={generatedId}
                    readOnly
                    placeholder="Click generate ->"
                    className="w-full rounded-xl border border-[#dce4de] bg-gray-100 p-3 text-sm font-mono font-bold text-[#14251c] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateId}
                    className="cursor-pointer whitespace-nowrap rounded-xl bg-[#eef5ef] px-4 text-sm font-bold text-[#124b35] transition hover:bg-[#dce4de]"
                  >
                    Generate
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#14251c]">Password</label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#718078]" />
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={`Set ${staffRole} password`}
                    className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 pl-10 text-sm focus:border-[#124b35] focus:outline-none focus:ring-2 focus:ring-[#124b35]/10"
                  />
                </div>
              </div>
            </div>

            {message.text && (
              <div className={`rounded-xl border p-4 text-sm font-semibold ${
                message.type === "success" 
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800" 
                  : "border-red-200 bg-red-50 text-red-700"
              }`}>
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full cursor-pointer rounded-xl bg-[#124b35] py-3.5 text-sm font-bold text-white transition hover:bg-[#0d3d2b] active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Registering..." : `Register ${staffRole === 'officer' ? 'Officer' : 'Worker'} Account`}
            </button>
          </form>
        </div>

        {/* Staff Directory List */}
        <div className="w-full rounded-3xl border border-[#dce4de] bg-white p-6 sm:p-8 shadow-xl">
          <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-[#14251c]">
            <Users size={20} className="text-[#124b35]" />
            Staff Directory
          </h2>

          {fetchingWorkers ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="animate-spin text-[#124b35]" size={32} />
            </div>
          ) : workersList.length === 0 ? (
            <div className="rounded-xl border border-[#dce4de] bg-[#fafcf9] py-8 text-center text-sm text-[#718078]">
              No staff members registered yet.
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#dce4de] text-[#718078]">
                    <th className="whitespace-nowrap pb-3 font-semibold uppercase tracking-wider text-[11px]">ID</th>
                    <th className="whitespace-nowrap pb-3 font-semibold uppercase tracking-wider text-[11px]">Role</th>
                    <th className="whitespace-nowrap pb-3 font-semibold uppercase tracking-wider text-[11px]">Name</th>
                    <th className="whitespace-nowrap pb-3 font-semibold uppercase tracking-wider text-[11px]">Department</th>
                    <th className="whitespace-nowrap pb-3 text-right font-semibold uppercase tracking-wider text-[11px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workersList.map((w) => (
                    <tr key={w.dept_id} className="border-b border-[#dce4de] transition hover:bg-[#fafcf9] last:border-0">
                      <td className="whitespace-nowrap py-4 font-mono font-bold text-[#124b35]">{w.dept_id}</td>
                      <td className="whitespace-nowrap py-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          w.role === "officer" 
                            ? "bg-amber-100 text-amber-800" 
                            : "bg-blue-100 text-blue-800"
                        }`}>
                          {w.role || "Worker"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-4 font-semibold text-[#14251c]">{w.name}</td>
                      <td className="whitespace-nowrap py-4 text-[#526158]">{w.department}</td>
                      <td className="whitespace-nowrap py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingWorker({ ...w, password: "" })}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#dce4de] bg-white px-3 py-1.5 text-xs font-bold text-[#124b35] transition hover:bg-[#eef5ef]"
                          >
                            <Edit size={14} /> Edit
                          </button>
                          <button
                            onClick={() => setWorkerToDelete(w)}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Edit Worker Modal */}
      {editingWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14251c]/40 p-4 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[#dce4de] bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">

            <div className="flex items-center justify-between border-b border-[#dce4de] bg-[#fafcf9] px-6 py-4">
              <h3 className="text-lg font-bold text-[#14251c]">Edit Staff Details</h3>
              <button
                onClick={() => setEditingWorker(null)}
                className="cursor-pointer rounded-full p-2 text-[#718078] transition hover:bg-[#eef5ef] hover:text-[#124b35]"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateWorker} className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#718078]">
                  Staff ID (Cannot be changed)
                </label>
                <input
                  type="text"
                  value={editingWorker.dept_id}
                  disabled
                  className="w-full rounded-xl border border-[#dce4de] bg-gray-100 p-3 text-sm font-mono font-bold text-[#718078] outline-none opacity-70"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#718078]">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editingWorker.name}
                  onChange={(e) => setEditingWorker({ ...editingWorker, name: e.target.value })}
                  className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm focus:border-[#124b35] focus:outline-none focus:ring-2 focus:ring-[#124b35]/10"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#718078]">
                  Department
                </label>
                <select
                  value={editingWorker.department}
                  onChange={(e) => setEditingWorker({ ...editingWorker, department: e.target.value })}
                  className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm focus:border-[#124b35] focus:outline-none focus:ring-2 focus:ring-[#124b35]/10"
                  required
                >
                  <option value="Sanitation">Sanitation</option>
                  <option value="Roads">Roads & Transport</option>
                  <option value="Water">Water Supply</option>
                  <option value="Electricity">Electricity</option>
                  <option value="Drainage">Drainage</option>
                  <option value="Parks">Parks & Gardens</option>
                  <option value="Finance">Finance & Budgeting</option>
                  <option value="Urban Planning">Urban Planning</option>
                  <option value="Administration">Administration</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#718078]">
                  Reset Password (Optional)
                </label>
                <input
                  type="text"
                  value={editingWorker.password || ""}
                  onChange={(e) => setEditingWorker({ ...editingWorker, password: e.target.value })}
                  placeholder="Leave blank to keep current password"
                  className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm focus:border-[#124b35] focus:outline-none focus:ring-2 focus:ring-[#124b35]/10"
                />
              </div>

              <div className="mt-6 flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingWorker(null)}
                  className="w-1/3 cursor-pointer rounded-xl border border-[#dce4de] py-3 text-xs font-bold text-[#526158] transition hover:bg-[#fafcf9]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex w-2/3 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#124b35] py-3 text-xs font-bold text-white transition hover:bg-[#0d3d2b] disabled:opacity-50"
                >
                  {editLoading ? <Loader2 size={16} className="animate-spin" /> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {workerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14251c]/40 p-4 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-[#dce4de] bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle size={28} />
              </div>
              <h3 className="mb-2 text-lg font-bold text-[#14251c]">Delete Staff Member?</h3>
              <p className="text-sm leading-relaxed text-[#718078]">
                Are you sure you want to remove <strong>{workerToDelete.name}</strong> ({workerToDelete.dept_id}) from the system? This action cannot be undone.
              </p>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setWorkerToDelete(null)}
                  className="w-1/2 cursor-pointer rounded-xl border border-[#dce4de] py-3 text-xs font-bold text-[#526158] transition hover:bg-[#fafcf9]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteWorker}
                  disabled={deleteLoading}
                  className="flex w-1/2 cursor-pointer items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteLoading ? <Loader2 size={16} className="animate-spin" /> : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}