"use client";

import { useState } from "react";
import {
  AlertCircle,
  Coins,
  CheckCircle2,
  TrendingUp,
  Vote,
  Users,
} from "lucide-react";

type Proposal = {
  id: string;
  title: string;
  description: string;
  category: string;
  ward: string;
  targetBudget: number;
  votes: number;
  hotspotCount: number;
};

export default function ParticipatoryBudgeting() {
  const [tokensLeft, setTokensLeft] = useState(10);
  const [votedProjects, setVotedProjects] = useState<Record<string, number>>({});

  const initialProposals: Proposal[] = [
    {
      id: "prop-1",
      title: "Install Stormwater Drainage System in Ward 3",
      description:
        "Hotspot analysis flagged 42 recurring waterlogging reports during monsoon months along the Ward 3 main corridor.",
      category: "Drainage",
      ward: "Ward 3",
      targetBudget: 450000,
      votes: 184,
      hotspotCount: 42,
    },
    {
      id: "prop-[#2]",
      title: "Solar Streetlight Installation & Repair Hotspot",
      description:
        "Aggregated dark spot complaints across residential alleys in Ward 7. Proposed installation of 35 smart solar poles.",
      category: "Electricity",
      ward: "Ward 7",
      targetBudget: 280000,
      votes: 210,
      hotspotCount: 31,
    },
    {
      id: "prop-3",
      title: "Community Automated Waste Segregation Hub",
      description:
        "Frequent overflowing garbage dump reports in Ward 12. Establishing an automated eco-hub with daily clearance.",
      category: "Sanitation",
      ward: "Ward 12",
      targetBudget: 600000,
      votes: 125,
      hotspotCount: 58,
    },
  ];

  const [proposals, setProposals] = useState<Proposal[]>(initialProposals);

  const handleVote = (proposalId: string) => {
    if (tokensLeft <= 0) {
      alert("You have used all 10 of your allocated annual civic tokens.");
      return;
    }

    setTokensLeft((prev) => prev - 1);
    setVotedProjects((prev) => ({
      ...prev,
      [proposalId]: (prev[proposalId] || 0) + 1,
    }));

    setProposals((prev) =>
      prev.map((p) =>
        p.id === proposalId ? { ...p, votes: p.votes + 1 } : p
      )
    );
  };

  return (
    <div className="space-y-8">
      {/* HEADER BAR & TOKEN BALANCE */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm sm:p-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dce4de] bg-[#eef5ef] px-3.5 py-1 text-xs font-bold text-[#124b35]">
            <Vote size={14} /> Participatory Budgeting
          </div>
          <h1 className="mt-2 text-3xl font-extrabold text-[#14251c]">
            Vote on Community Proposals
          </h1>
          <p className="mt-1 text-xs text-[#718078]">
            Proposals automatically synthesized from aggregated citizen issue hotspots.
          </p>
        </div>

        {/* TOKEN BADGE */}
        <div className="flex items-center gap-3 rounded-2xl bg-[#124b35] p-4 text-white shadow-md">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
            <Coins size={24} className="text-amber-300" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-200">
              Remaining Civic Tokens
            </p>
            <p className="text-2xl font-extrabold">{tokensLeft} / 10 Tokens</p>
          </div>
        </div>
      </div>

      {/* PROPOSALS LIST */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {proposals.map((proposal) => {
          const userVoteCount = votedProjects[proposal.id] || 0;
          // Calculate arbitrary target progress based on 300 target votes
          const progressPercentage = Math.min(
            100,
            Math.round((proposal.votes / 300) * 100)
          );

          return (
            <div
              key={proposal.id}
              className="flex flex-col justify-between rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div>
                {/* CATEGORY & WARD */}
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-[#eef5ef] px-2.5 py-1 text-xs font-bold text-[#124b35]">
                    {proposal.category}
                  </span>
                  <span className="text-xs font-bold text-[#718078]">
                    {proposal.ward}
                  </span>
                </div>

                {/* TITLE */}
                <h3 className="mt-4 text-lg font-bold text-[#14251c] leading-snug">
                  {proposal.title}
                </h3>

                {/* HOTSPOT SUMMARY */}
                <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  <TrendingUp size={14} />
                  <span>Synthesized from {proposal.hotspotCount} reports</span>
                </div>

                {/* DESCRIPTION */}
                <p className="mt-3 text-xs text-[#526158] leading-relaxed">
                  {proposal.description}
                </p>

                {/* BUDGET & VOTE PROGRESS BAR */}
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#718078]">Community Support</span>
                    <span className="text-[#124b35]">{proposal.votes} Votes ({progressPercentage}%)</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-[#f0f4f1] overflow-hidden">
                    <div
                      className="h-full bg-[#124b35] transition-all duration-500"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#718078] pt-1">
                    Target Budget: ₹{proposal.targetBudget.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              {/* ACTION BUTTON */}
              <div className="mt-6 pt-4 border-t border-[#dce4de]">
                <button
                  type="button"
                  onClick={() => handleVote(proposal.id)}
                  disabled={tokensLeft <= 0}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition ${
                    userVoteCount > 0
                      ? "bg-[#eef5ef] text-[#124b35] border border-[#124b35]"
                      : "bg-[#124b35] text-white hover:bg-[#0d3d2b]"
                  } disabled:opacity-50`}
                >
                  <Coins size={15} />
                  {userVoteCount > 0
                    ? `Allocated ${userVoteCount} Token(s) (+1)`
                    : "Allocate 1 Civic Token"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}