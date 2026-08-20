"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Landmark,
  LogOut,
  Plus,
  BarChart3,
  Users,
  Loader2,
  X,
  FileText,
  IndianRupee,
  Edit,
  Trash2,
} from "lucide-react";

type Officer = {
  id: string;
  fullName: string;
  deptId: string;
  department: string;
  role: string;
};

type Proposal = {
  id: string;
  title: string;
  description: string;
  estimated_cost: number;
  department: string;
  votes_count: number;
  status: string;
};

export default function OfficerDashboard() {
  const router = useRouter();
  const [officer, setOfficer] = useState<Officer | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  
  // Security State
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState(false);
  
  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCost, setNewCost] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  // Edit Modal State
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // =========================================================
  // SECURITY: VERIFY OFFICER ON MOUNT
  // =========================================================
  useEffect(() => {
    const verifyOfficer = async () => {
      setCheckingAuth(true);
      setAuthError(false);

      try {
        const session = window.localStorage.getItem("civic_connect_officer");
        
        if (session) {
          const parsedSession = JSON.parse(session);
          
          if (parsedSession?.deptId) {
            // Verify with the database to ensure the worker hasn't been deleted
            const { data: workerData, error: workerError } = await supabase
              .from("workers")
              .select("*")
              .eq("dept_id", parsedSession.deptId)
              .maybeSingle();

            if (!workerError && workerData && (workerData.role === "officer" || workerData.role === "admin")) {
              setOfficer(parsedSession);
              fetchProposals();
              
              // Trigger Auto Cleanup
              try {
                await supabase.rpc("delete_old_resolved_issues");
              } catch (err) {
                console.error("Auto-cleanup background check failed:", err);
              }
              
              setCheckingAuth(false);
              return;
            }
          }
        }

        // Fallback: Check Supabase session
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: workerData } = await supabase
            .from("workers")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

          if (workerData && (workerData.role === "officer" || workerData.role === "admin")) {
            const profile: Officer = {
              id: workerData.id,
              fullName: workerData.name || workerData.full_name || "Budget Officer",
              deptId: workerData.dept_id,
              department: workerData.department || "",
              role: workerData.role,
            };
            
            setOfficer(profile);
            fetchProposals();
            setCheckingAuth(false);
            return;
          }
        }

        // If we reach here, the user is unauthorized
        setAuthError(true);
      } catch (error) {
        console.error("Auth verification error:", error);
        setAuthError(true);
      }
    };

    verifyOfficer();
  }, []);

  const fetchProposals = async () => {
    setProposalsLoading(true);
    try {
      const { data, error } = await supabase
        .from("budget_proposals")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setProposals(data);
    } catch (error) {
      console.error("Error fetching proposals:", error);
    } finally {
      setProposalsLoading(false);
    }
  };

  // =========================================================
  // LOGOUT HANDLER
  // =========================================================
  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("civic_connect_officer");
      window.localStorage.removeItem("civic_connect_auth");
    }
    
    await supabase.auth.signOut();
    
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officer) return;

    setSubmitLoading(true);
    try {
      const { error } = await supabase.from("budget_proposals").insert([
        {
          title: newTitle,
          description: newDescription,
          estimated_cost: Number(newCost),
          department: officer.department,
          status: "Voting",
          votes_count: 0
        },
      ]);

      if (error) throw error;

      setIsCreateModalOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewCost("");
      fetchProposals();
    } catch (error: any) {
      console.error("Error creating proposal:", error);
      alert(error.message || "Failed to create proposal");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleUpdateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProposal) return;

    setEditLoading(true);
    try {
      const { error } = await supabase
        .from("budget_proposals")
        .update({
          title: editingProposal.title,
          description: editingProposal.description,
          estimated_cost: Number(editingProposal.estimated_cost),
          status: editingProposal.status,
        })
        .eq("id", editingProposal.id);

      if (error) throw error;

      setEditingProposal(null);
      fetchProposals();
    } catch (error: any) {
      console.error("Error updating proposal:", error);
      alert(error.message || "Failed to update proposal");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteProposal = async (id: string) => {
    if (!confirm("Are you sure you want to delete this proposal?")) return;

    try {
      const { error } = await supabase
        .from("budget_proposals")
        .delete()
        .eq("id", id);

      if (error) throw error;
      fetchProposals();
    } catch (error: any) {
      console.error("Error deleting proposal:", error);
      alert(error.message || "Failed to delete proposal");
    }
  };

  // =========================================================
  // HARD REDIRECT / LOADING SCREEN
  // =========================================================
  if (authError) {
    if (typeof window !== "undefined") {
      // Clear ghost local storage data if they bypassed auth
      window.localStorage.removeItem("civic_connect_officer");
      window.localStorage.removeItem("civic_connect_auth");
      window.location.href = "/";
    }
    return null;
  }

  if (checkingAuth || !officer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7f5]">
        <Loader2 className="animate-spin text-[#124b35]" size={40} />
      </div>
    );
  }

  // =========================================================
  // MAIN DASHBOARD
  // =========================================================
  const totalVotes = proposals.reduce((acc, curr) => acc + (curr.votes_count || 0), 0);

  return (
    <div className="min-h-screen bg-[#f4f7f5]">
      {/* Navbar */}
      <nav className="bg-white border-b border-[#dce4de] px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#124b35] text-white">
              <Landmark size={20} />
            </div>
            <div>
              <h1 className="font-bold text-[#14251c]">Budget Officer Portal</h1>
              <p className="text-xs text-[#718078]">{officer.department} Dept.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold text-[#14251c]">{officer.fullName}</p>
              <p className="text-xs font-mono text-[#718078]">{officer.deptId}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl border border-[#dce4de] bg-[#fafcf9] px-4 py-2 text-sm font-bold text-[#526158] transition hover:bg-red-50 hover:text-red-700 hover:border-red-200 cursor-pointer"
            >
              <LogOut size={16} /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl p-6 sm:p-8">
        
        {/* Stats Row */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef5ef] text-[#124b35]">
              <FileText size={24} />
            </div>
            <h3 className="text-3xl font-extrabold text-[#14251c]">{proposals.length}</h3>
            <p className="text-sm font-semibold text-[#718078]">Active Proposals</p>
          </div>
          
          <div className="rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Users size={24} />
            </div>
            <h3 className="text-3xl font-extrabold text-[#14251c]">{totalVotes}</h3>
            <p className="text-sm font-semibold text-[#718078]">Total Citizen Votes</p>
          </div>

          <div className="flex flex-col justify-center rounded-3xl border-2 border-dashed border-[#124b35]/30 bg-[#eef5ef]/50 p-6 transition hover:bg-[#eef5ef] sm:col-span-2 lg:col-span-1">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex flex-col items-center justify-center gap-3 text-center cursor-pointer"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#124b35] text-white shadow-lg">
                <Plus size={28} />
              </div>
              <div>
                <p className="font-bold text-[#124b35]">Publish New Project</p>
                <p className="text-xs text-[#526158]">Draft a new municipal budget proposal</p>
              </div>
            </button>
          </div>
        </div>

        {/* Proposals List */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#14251c]">Your Department's Proposals</h2>
        </div>

        {proposalsLoading ? (
          <div className="flex py-20 justify-center">
            <Loader2 className="animate-spin text-[#124b35]" size={32} />
          </div>
        ) : proposals.length === 0 ? (
          <div className="rounded-3xl border border-[#dce4de] bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f0f4f1] text-[#718078]">
              <BarChart3 size={32} />
            </div>
            <h3 className="text-lg font-bold text-[#14251c]">No Proposals Published</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[#718078]">
              You haven't published any budget proposals yet. Click the button above to draft your first project for citizen voting.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {proposals.map((proposal) => (
              <div key={proposal.id} className="flex flex-col justify-between rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm transition hover:shadow-md">
                <div>
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <h3 className="font-bold text-[#14251c] line-clamp-2">{proposal.title}</h3>
                    <span className="shrink-0 rounded-full bg-[#eef5ef] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#124b35]">
                      {proposal.status || "Voting"}
                    </span>
                  </div>
                  <p className="mb-4 text-sm text-[#718078] line-clamp-3">{proposal.description}</p>
                </div>
                
                <div>
                  <div className="mb-4 border-t border-[#dce4de] pt-4">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1.5 font-bold text-[#14251c]">
                        <IndianRupee size={16} className="text-[#718078]" />
                        {Number(proposal.estimated_cost || 0).toLocaleString("en-IN")}
                      </div>
                      <div className="flex items-center gap-1.5 font-bold text-blue-600">
                        <Users size={16} />
                        {proposal.votes_count || 0} Votes
                      </div>
                    </div>
                  </div>

                  {/* Edit / Delete Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingProposal(proposal)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#dce4de] bg-[#fafcf9] py-2 text-xs font-bold text-[#124b35] transition hover:bg-[#eef5ef] cursor-pointer"
                    >
                      <Edit size={14} /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteProposal(proposal.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 cursor-pointer"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Proposal Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14251c]/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-[#dce4de] bg-white shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#dce4de] bg-[#fafcf9] px-6 py-4">
              <h3 className="text-lg font-bold text-[#14251c]">Draft Budget Proposal</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-full p-2 text-[#718078] hover:bg-[#eef5ef] hover:text-[#124b35] transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateProposal} className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#14251c]">Project Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Renovation of Central Park"
                  className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm focus:border-[#124b35] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#14251c]">Description & Impact</label>
                <textarea
                  required
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Explain why this project matters..."
                  rows={4}
                  className="w-full resize-none rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm focus:border-[#124b35] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#14251c]">Estimated Cost (₹)</label>
                <div className="relative">
                  <IndianRupee size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#718078]" />
                  <input
                    type="number"
                    required
                    min="0"
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value)}
                    placeholder="e.g. 500000"
                    className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 pl-10 text-sm focus:border-[#124b35] focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-8 flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="w-1/3 rounded-xl border border-[#dce4de] py-3.5 text-sm font-bold text-[#526158] transition hover:bg-[#fafcf9] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex w-2/3 items-center justify-center gap-2 rounded-xl bg-[#124b35] py-3.5 text-sm font-bold text-white transition hover:bg-[#0d3d2b] disabled:opacity-50 cursor-pointer"
                >
                  {submitLoading ? <Loader2 size={16} className="animate-spin" /> : "Publish Proposal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Proposal Modal */}
      {editingProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14251c]/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-[#dce4de] bg-white shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#dce4de] bg-[#fafcf9] px-6 py-4">
              <h3 className="text-lg font-bold text-[#14251c]">Edit Budget Proposal</h3>
              <button
                onClick={() => setEditingProposal(null)}
                className="rounded-full p-2 text-[#718078] hover:bg-[#eef5ef] hover:text-[#124b35] transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateProposal} className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#14251c]">Project Title</label>
                <input
                  type="text"
                  required
                  value={editingProposal.title}
                  onChange={(e) => setEditingProposal({ ...editingProposal, title: e.target.value })}
                  className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm focus:border-[#124b35] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#14251c]">Description & Impact</label>
                <textarea
                  required
                  value={editingProposal.description}
                  onChange={(e) => setEditingProposal({ ...editingProposal, description: e.target.value })}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm focus:border-[#124b35] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#14251c]">Estimated Cost (₹)</label>
                <div className="relative">
                  <IndianRupee size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#718078]" />
                  <input
                    type="number"
                    required
                    min="0"
                    value={editingProposal.estimated_cost}
                    onChange={(e) => setEditingProposal({ ...editingProposal, estimated_cost: Number(e.target.value) })}
                    className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 pl-10 text-sm focus:border-[#124b35] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#14251c]">Status</label>
                <select
                  value={editingProposal.status}
                  onChange={(e) => setEditingProposal({ ...editingProposal, status: e.target.value })}
                  className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] p-3 text-sm focus:border-[#124b35] focus:outline-none"
                >
                  <option value="Voting">Voting</option>
                  <option value="Proposed">Proposed</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              <div className="mt-8 flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingProposal(null)}
                  className="w-1/3 rounded-xl border border-[#dce4de] py-3.5 text-sm font-bold text-[#526158] transition hover:bg-[#fafcf9] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex w-2/3 items-center justify-center gap-2 rounded-xl bg-[#124b35] py-3.5 text-sm font-bold text-white transition hover:bg-[#0d3d2b] disabled:opacity-50 cursor-pointer"
                >
                  {editLoading ? <Loader2 size={16} className="animate-spin" /> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}