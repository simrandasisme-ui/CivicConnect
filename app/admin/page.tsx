"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase"; // Adjust import path if needed
import { Building2, KeyRound, ShieldCheck, UserPlus } from "lucide-react";

export default function AdminDashboard() {
  const [workerName, setWorkerName] = useState("");
  const [department, setDepartment] = useState("");
  const [generatedId, setGeneratedId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

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
        },
      ]);

      if (error) throw error;

      setMessage({ type: "success", text: `Worker ${workerName} (${generatedId}) successfully registered!` });
      
      // Clear form for the next entry
      setWorkerName("");
      setDepartment("");
      setGeneratedId("");
      setPassword("");
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Failed to register worker.";
      setMessage({ type: "error", text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7f5] p-8">
      <div className="mx-auto max-w-3xl">
        
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
        <div className="rounded-3xl border border-[#dce4de] bg-white p-8 shadow-xl">
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
                    className="rounded-xl bg-[#eef5ef] px-4 text-sm font-bold text-[#124b35] hover:bg-[#dce4de] transition"
                  >
                    Generate
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#14251c]">Temporary Password</label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#718078]" />
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Set initial password"
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
              className="mt-4 w-full rounded-xl bg-[#124b35] py-3.5 text-sm font-bold text-white transition hover:bg-[#0d3d2b] active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Registering Worker..." : "Register Worker Account"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}