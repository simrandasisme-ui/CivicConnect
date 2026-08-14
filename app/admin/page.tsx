"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase"; // Adjust import path if needed
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
  AlertTriangle
} from "lucide-react";

type Worker = {
  id?: string;
  dept_id: string;
  name: string;
  department: string;
  password?: string;
};

export default function AdminDashboard() {
  // Registration State
  const [workerName, setWorkerName] = useState("");
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

  // Fetch workers on mount
  useEffect(() => {
    fetchWorkers();
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

  // Generates a random 5-digit number appended to EMP-
  const handleGenerateId = () => {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    setGeneratedId(`EMP-${randomNum}`);
  };

  const handleRegisterWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (!generatedId || !workerName || !department || !password) {
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

      // Insert the new worker into Supabase
      const { error } = await supabase.from("workers").insert([
        {
          dept_id: generatedId,
          name: workerName,
          department: department,
          password: password,
          role: 'worker' // Automatically set role to worker
        },
      ]);

      if (error) throw error;

      setMessage({ type: "success", text: `Worker ${workerName} (${generatedId}) successfully registered!` });
      
      // Clear form for the next entry
      setWorkerName("");
      setDepartment("");
      setGeneratedId("");
      setPassword("");
      
      // Refresh the worker list to show the new addition
      fetchWorkers();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Failed to register worker.";
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

      // Only update password if a new one was typed
      if (editingWorker.password && editingWorker.password.trim() !== "") {
        updatePayload.password = editingWorker.password;
      }

      const { error } = await supabase
        .from("workers")
        .update(updatePayload)
        .eq("dept_id", editingWorker.dept_id);

      if (error) throw error;

      setEditingWorker(null);
      fetchWorkers(); // Refresh the list
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
      fetchWorkers(); // Refresh the list
    } catch (error) {
      console.error("Failed to delete worker:", error);
      alert("Failed to delete worker.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7f5] p-8">
      <div className="mx-auto max-w-4xl">
        
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#124b35] text-white shadow-md">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[#14251c]">Admin Control Panel</h1>
            <p className="text-[#718078]">Register and manage municipal workers</p>
          </div>
        </div>

        {/* Registration Form */}
        <div className="mb-8 rounded-3xl border border-[#dce4de] bg-white p-8 shadow-xl">
          <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-[#14251c]">
            <UserPlus size={20} className="text-[#124b35]" />
            Onboard New Worker
          </h2>

          <form onSubmit={handleRegisterWorker} className="space-y-5">
            
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#14251c]">Full Name</label>
                <input
                  type="text"
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
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
                    <option value="Sanitation">Sanitation</option>
                    <option value="Roads">Roads & Transport</option>
                    <option value="Water">Water Supply</option>
                    <option value="Electricity">Electricity</option>
                    <option value="Drainage">Drainage</option>
                    <option value="Parks">Parks & Gardens</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#14251c]">Employee ID</label>
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
                    className="rounded-xl bg-[#eef5ef] px-4 text-sm font-bold text-[#124b35] hover:bg-[#dce4de] transition cursor-pointer"
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
                    placeholder="Set worker password"
                    className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 pl-10 text-sm focus:border-[#124b35] focus:outline-none focus:ring-2 focus:ring-[#124b35]/10"
                  />
                </div>
              </div>
            </div>

            {message.text && (
              <div className={`rounded-xl border p-4 text-sm font-semibold ${
                message.type === "success" 
                  ? "border-[#dce4de] bg-[#eef5ef] text-[#124b35]" 
                  : "border-red-200 bg-red-50 text-red-700"
              }`}>
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full rounded-xl bg-[#124b35] py-3.5 text-sm font-bold text-white transition hover:bg-[#0d3d2b] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Registering Worker..." : "Register Worker Account"}
            </button>
          </form>
        </div>

        {/* Worker Directory List */}
        <div className="rounded-3xl border border-[#dce4de] bg-white p-8 shadow-xl">
          <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-[#14251c]">
            <Users size={20} className="text-[#124b35]" />
            Worker Directory
          </h2>

          {fetchingWorkers ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="animate-spin text-[#124b35]" size={32} />
            </div>
          ) : workersList.length === 0 ? (
            <div className="rounded-xl border border-[#dce4de] bg-[#fafcf9] py-8 text-center text-sm text-[#718078]">
              No workers registered yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#dce4de] text-[#718078]">
                    <th className="pb-3 font-semibold uppercase tracking-wider text-[11px]">Emp ID</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider text-[11px]">Name</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider text-[11px]">Department</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider text-[11px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workersList.map((w) => (
                    <tr key={w.dept_id} className="border-b border-[#dce4de] last:border-0 hover:bg-[#fafcf9]">
                      <td className="py-4 font-mono font-bold text-[#124b35]">{w.dept_id}</td>
                      <td className="py-4 font-semibold text-[#14251c]">{w.name}</td>
                      <td className="py-4 text-[#526158]">{w.department}</td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingWorker({ ...w, password: "" })}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#dce4de] bg-white px-3 py-1.5 text-xs font-bold text-[#124b35] transition hover:bg-[#eef5ef] cursor-pointer"
                          >
                            <Edit size={14} /> Edit
                          </button>
                          <button
                            onClick={() => setWorkerToDelete(w)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100 cursor-pointer"
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
              <h3 className="text-lg font-bold text-[#14251c]">Edit Worker Details</h3>
              <button
                onClick={() => setEditingWorker(null)}
                className="rounded-full p-2 text-[#718078] hover:bg-[#eef5ef] hover:text-[#124b35] transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateWorker} className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#718078]">
                  Employee ID (Cannot be changed)
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
                  className="w-1/3 rounded-xl border border-[#dce4de] py-3 text-xs font-bold text-[#526158] hover:bg-[#fafcf9] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex w-2/3 items-center justify-center gap-2 rounded-xl bg-[#124b35] py-3 text-xs font-bold text-white transition hover:bg-[#0d3d2b] disabled:opacity-50 cursor-pointer"
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
              <h3 className="mb-2 text-lg font-bold text-[#14251c]">Delete Worker?</h3>
              <p className="text-sm text-[#718078] leading-relaxed">
                Are you sure you want to remove <strong>{workerToDelete.name}</strong> ({workerToDelete.dept_id}) from the system? This action cannot be undone.
              </p>
              
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setWorkerToDelete(null)}
                  className="w-1/2 rounded-xl border border-[#dce4de] py-3 text-xs font-bold text-[#526158] hover:bg-[#fafcf9] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteWorker}
                  disabled={deleteLoading}
                  className="flex w-1/2 items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50 cursor-pointer"
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