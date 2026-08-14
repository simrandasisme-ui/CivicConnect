"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { UserPlus, Loader2, ShieldCheck, HardHat, Landmark } from "lucide-react";

// The { onCreated } prop is added here so TypeScript knows it's allowed!
export default function AdminStaffManager({ onCreated }: { onCreated?: () => void }) {
  const [name, setName] = useState("");
  const [staffRole, setStaffRole] = useState<"worker" | "officer">("officer");
  const [deptId, setDeptId] = useState("");
  const [department, setDepartment] = useState("Finance & Budgeting");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Auto-generate a smart default ID when the role changes
  useEffect(() => {
    if (staffRole === "officer") {
      setDeptId(`BO-${Math.floor(10000 + Math.random() * 90000)}`);
      setDepartment("Finance & Budgeting");
    } else {
      setDeptId(`EMP-${Math.floor(10000 + Math.random() * 90000)}`);
      setDepartment("Sanitation");
    }
  }, [staffRole]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const { error } = await supabase.from("workers").insert([
        {
          name,
          dept_id: deptId,
          password,
          department,
          role: staffRole,
        },
      ]);

      if (error) throw error;

      setMessage({ 
        type: "success", 
        text: `Successfully created ${staffRole === "officer" ? "Officer" : "Worker"}: ${deptId}` 
      });
      
      // Reset form but generate a new ID for the next entry
      setName("");
      setPassword("");
      setDeptId(
        staffRole === "officer" 
          ? `BO-${Math.floor(10000 + Math.random() * 90000)}` 
          : `EMP-${Math.floor(10000 + Math.random() * 90000)}`
      );

      // Trigger the table refresh on the parent page!
      if (onCreated) {
        onCreated();
      }
      
    } catch (err: any) {
      console.error(err);
      setMessage({ type: "error", text: err.message || "Failed to create staff account." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-[#dce4de] bg-white p-6 sm:p-8 shadow-sm mt-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef5ef] text-[#124b35]">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#14251c]">Register Municipal Staff</h2>
          <p className="text-xs text-[#718078]">Create login credentials for workers and budget officers</p>
        </div>
      </div>

      <form onSubmit={handleCreateStaff} className="space-y-5">
        
        {/* ROLE SELECTOR */}
        <div className="flex rounded-2xl border border-[#dce4de] bg-[#fafcf9] p-1.5">
          <button
            type="button"
            onClick={() => setStaffRole("worker")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
              staffRole === "worker"
                ? "bg-[#124b35] text-white shadow-sm"
                : "text-[#718078] hover:bg-[#f0f4f1]"
            }`}
          >
            <HardHat size={16} /> Field Worker
          </button>
          <button
            type="button"
            onClick={() => setStaffRole("officer")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
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
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#14251c]">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm focus:border-[#124b35] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#14251c]">
              Department
            </label>
            <input
              type="text"
              required
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm focus:border-[#124b35] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#14251c]">
              Login ID
            </label>
            <input
              type="text"
              required
              value={deptId}
              onChange={(e) => setDeptId(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm font-mono focus:border-[#124b35] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#14251c]">
              Initial Password
            </label>
            <input
              type="text"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Set a secure password"
              className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm focus:border-[#124b35] focus:outline-none"
            />
          </div>
        </div>

        {message.text && (
          <div
            className={`rounded-xl border p-4 text-sm font-semibold ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#124b35] py-3.5 text-sm font-bold text-white transition hover:bg-[#0d3d2b] disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <UserPlus size={16} /> Create {staffRole === "officer" ? "Officer" : "Worker"} Account
            </>
          )}
        </button>
      </form>
    </div>
  );
}