"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/context/LanguageContext";
import { 
  Coins, 
  ThumbsUp, 
  CheckCircle2, 
  Loader2, 
  Building2,
  AlertCircle
} from "lucide-react";

type Proposal = {
  id: string;
  title: string;
  description: string;
  category: string;
  estimated_cost: number;
  votes_count: number;
  status: string;
  created_at: string;
};

export default function ParticipatoryBudgeting() {
  const { t } = useLanguage();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("budget_proposals")
        .select("*")
        .order("votes_count", { ascending: false });

      if (error) throw error;
      if (data) setProposals(data);
    } catch (err) {
      console.error("Error fetching proposals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleVote = async (proposalId: string) => {
    // Get the logged-in citizen's identifier (email or name from auth session)
    const authSession = JSON.parse(localStorage.getItem("civic_connect_auth") || "{}");
    const voterId = authSession.email || authSession.identifier || "anonymous_voter";

    setVotingId(proposalId);
    try {
      // 1. Try to record this user's vote in the tracking table
      const { error: voteInsertError } = await supabase
        .from("proposal_votes")
        .insert([{ proposal_id: proposalId, voter_identifier: voterId }]);

      if (voteInsertError) {
        // If the unique constraint fails, they already voted!
        if (voteInsertError.code === "23505") {
          alert(t("alreadyVotedAlert"));
          return;
        }
        throw voteInsertError;
      }

      // 2. If successful, increment the proposal's vote count
      const proposalToUpdate = proposals.find(p => p.id === proposalId);
      const newCount = (proposalToUpdate?.votes_count || 0) + 1;
      
      const { error: updateError } = await supabase
        .from("budget_proposals")
        .update({ votes_count: newCount })
        .eq("id", proposalId);

      if (updateError) throw updateError;

      // 3. Update local state
      setProposals((prev) =>
        prev.map((p) =>
          p.id === proposalId ? { ...p, votes_count: newCount } : p
        )
      );
    } catch (err) {
      console.error("Error voting:", err);
      alert(t("voteErrorAlert"));
    } finally {
      setVotingId(null);
    }
  };

  const totalAllocated = proposals.reduce((acc, curr) => acc + Number(curr.estimated_cost || 0), 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* HEADER */}
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dce4de] bg-white px-3.5 py-1 text-xs font-bold text-[#124b35]">
            <Coins size={14} /> {t("communityEmpowerment")}
          </div>
          <h1 className="mt-2 text-3xl font-extrabold text-[#14251c]">
            {t("participatoryBudgeting")}
          </h1>
          <p className="mt-1 text-sm text-[#718078]">
            {t("budgetingSubtitle")}
          </p>
        </div>

        {/* SUMMARY STATS CARD */}
        <div className="flex items-center gap-4 rounded-2xl border border-[#dce4de] bg-white p-4 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef5ef] text-[#124b35]">
            <Building2 size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#718078]">{t("totalProposedPool")}</p>
            <p className="text-lg font-extrabold text-[#14251c]">₹{totalAllocated.toLocaleString("en-IN")}</p>
          </div>
        </div>
      </div>

      {/* PROPOSALS GRID */}
      {loading ? (
        <div className="flex h-64 w-full items-center justify-center rounded-3xl border border-[#dce4de] bg-white">
          <Loader2 className="animate-spin text-[#124b35]" size={32} />
        </div>
      ) : proposals.length === 0 ? (
        <div className="rounded-3xl border border-[#dce4de] bg-white p-12 text-center shadow-sm">
          <AlertCircle size={40} className="mx-auto text-[#124b35]" />
          <h3 className="mt-3 text-lg font-bold text-[#14251c]">{t("noBudgetProposals")}</h3>
          <p className="mt-1 text-xs text-[#718078]">
            {t("noBudgetSubtitle")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {proposals.map((proposal) => (
            <div
              key={proposal.id}
              className="flex flex-col justify-between rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-[#eef5ef] px-2.5 py-1 text-xs font-bold text-[#124b35]">
                    {proposal.category}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    proposal.status === "Approved" ? "bg-emerald-100 text-emerald-800" :
                    proposal.status === "Rejected" ? "bg-red-100 text-red-800" :
                    "bg-amber-100 text-amber-800"
                  }`}>
                    {proposal.status}
                  </span>
                </div>

                <h3 className="mt-4 text-lg font-bold text-[#14251c]">{proposal.title}</h3>
                <p className="mt-2 text-sm text-[#718078] line-clamp-3">
                  {proposal.description}
                </p>

                <div className="mt-4 rounded-2xl border border-[#dce4de] bg-[#fafcf9] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#718078]">{t("estimatedCost")}</p>
                  <p className="text-base font-extrabold text-[#124b35]">₹{Number(proposal.estimated_cost || 0).toLocaleString("en-IN")}</p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-[#dce4de] pt-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#14251c]">
                  <ThumbsUp size={14} className="text-[#124b35]" />
                  <span>{proposal.votes_count} {t("votes")}</span>
                </div>

                <button
                  type="button"
                  disabled={votingId === proposal.id || Boolean(proposal.status && proposal.status !== "Voting" && proposal.status !== "Proposed")}
                  onClick={() => handleVote(proposal.id)}
                  className="flex items-center gap-1.5 rounded-xl bg-[#124b35] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0d3d2b] disabled:opacity-50 cursor-pointer"
                >
                  {votingId === proposal.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <>
                      <ThumbsUp size={14} /> {t("supportProject")}
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}