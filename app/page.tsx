"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import UnifiedLogin from "../components/UnifiedLogin";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../context/LanguageContext";
import {
  ArrowRight,
  FileText,
  MapPin,
  PlusCircle,
  Sparkles,
  User,
  Vote,
} from "lucide-react";

type AuthUser = {
  role: string;
  identifier: string;
  anonymous: boolean;
  token: string;
};

type UserReport = {
  id: string;
  category: string;
  description: string | null;
  status: string;
  created_at: string;
  image_urls: string[];
};

export default function HomePage() {
  const { t } = useLanguage();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [myReports, setMyReports] = useState<UserReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  useEffect(() => {
    // Read session from LocalStorage or Cookies (Mobile fallback)
    let savedSession = localStorage.getItem("civic_connect_auth");

    if (!savedSession) {
      const match = document.cookie.match(
        new RegExp("(^| )civic_connect_auth=([^;]+)")
      );
      if (match) {
        savedSession = decodeURIComponent(match[2]);
      }
    }

    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        setUser(parsed);
        if (parsed.role === "citizen") {
          fetchUserReports();
        }
      } catch {
        setUser(null);
      }
    }
  }, []);

  const fetchUserReports = async () => {
    setLoadingReports(true);
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setMyReports(data);
    }
    setLoadingReports(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("civic_connect_auth");
    document.cookie =
      "civic_connect_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    setUser(null);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* HERO BANNER */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#dce4de] bg-white px-4 py-1.5 text-xs font-bold text-[#124b35]">
          <Sparkles size={14} />
          {t("subTitle")}
        </div>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#14251c] sm:text-5xl">
          {t("heroTitle1")} <br />
          <span className="text-[#124b35]">{t("heroTitle2")}</span>
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-base text-[#718078] sm:text-lg">
          {t("heroDesc")}
        </p>
      </div>

      {/* LOGGED IN USER DASHBOARD */}
      {user ? (
        <div className="mx-auto max-w-4xl space-y-8">
          {/* USER WELCOME CARD */}
          <div className="flex items-center justify-between rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#124b35] text-white">
                <User size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-[#14251c]">
                    {t("welcome")}, {user.identifier}
                  </h2>
                  <span className="rounded-full bg-[#eef5ef] px-2.5 py-0.5 text-xs font-bold capitalize text-[#124b35]">
                    {user.role}
                  </span>
                </div>
                <p className="text-xs text-[#718078]">
                  Logged in with User ID: {user.identifier}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-[#dce4de] px-4 py-2 text-xs font-bold text-[#718078] hover:bg-[#fafcf9]"
            >
              {t("signOut")}
            </button>
          </div>

          {/* MAIN ACTION CARD */}
          <Link
            href="/report"
            className="group relative flex flex-col items-center justify-between overflow-hidden rounded-3xl border-2 border-[#124b35] bg-gradient-to-r from-[#124b35] to-[#1c6448] p-8 text-white shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl sm:flex-row sm:p-10"
          >
            <div className="z-10 text-center sm:text-left">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-emerald-200 backdrop-blur">
                <PlusCircle size={14} /> {t("quickAction")}
              </span>
              <h3 className="mt-3 text-2xl font-extrabold sm:text-3xl">
                {t("reportNewIssue")}
              </h3>
              <p className="mt-2 max-w-md text-xs text-emerald-100 sm:text-sm">
                {t("reportCardDesc")}
              </p>
            </div>

            <div className="z-10 mt-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#124b35] shadow-lg transition-transform duration-300 group-hover:scale-125 group-hover:rotate-6 sm:mt-0">
              <ArrowRight size={32} />
            </div>
          </Link>

          {/* MY SUBMITTED REPORTS CORNER */}
          <div className="rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-[#14251c]">
                  {t("myReportsTitle")}
                </h3>
              </div>
              <span className="rounded-xl bg-[#eef5ef] px-3 py-1 text-xs font-bold text-[#124b35]">
                {myReports.length} Total Saved
              </span>
            </div>

            {loadingReports ? (
              <p className="text-xs text-[#718078]">Loading saved reports...</p>
            ) : myReports.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#dce4de] bg-[#fafcf9] p-8 text-center">
                <FileText size={32} className="mx-auto text-[#718078]" />
                <p className="mt-2 text-sm font-bold text-[#14251c]">
                  No reports filed yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myReports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between rounded-2xl border border-[#dce4de] bg-[#fafcf9] p-4 transition hover:bg-white"
                  >
                    <div className="flex items-center gap-3">
                      {report.image_urls && report.image_urls.length > 0 ? (
                        <img
                          src={report.image_urls[0]}
                          alt="Report"
                          className="h-12 w-12 rounded-xl object-cover border border-[#dce4de]"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef5ef] text-[#124b35]">
                          <FileText size={20} />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-[#14251c]">
                          {report.category}
                        </p>
                        <p className="text-xs text-[#718078] line-clamp-1">
                          {report.description || "No description written"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          report.status === "Resolved"
                            ? "bg-emerald-100 text-emerald-800"
                            : report.status === "In Progress"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {report.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECONDARY NAVIGATION */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/track"
              className="flex items-center gap-4 rounded-3xl border border-[#dce4de] bg-white p-6 transition hover:border-[#124b35] hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef5ef] text-[#124b35]">
                <MapPin size={24} />
              </div>
              <div>
                <h4 className="font-bold text-[#14251c]">
                  {t("exploreMapTitle")}
                </h4>
              </div>
            </Link>

            <Link
              href="/budgeting"
              className="flex items-center gap-4 rounded-3xl border border-[#dce4de] bg-white p-6 transition hover:border-[#124b35] hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef5ef] text-[#124b35]">
                <Vote size={24} />
              </div>
              <div>
                <h4 className="font-bold text-[#14251c]">
                  {t("publicBudgetingTitle")}
                </h4>
              </div>
            </Link>
          </div>
        </div>
      ) : (
        /* LOGIN FORM */
        <UnifiedLogin
          onLoginSuccess={(data) => {
            setUser(data);
            if (data.role === "worker") {
              window.location.href = "/employees";
            } else if (data.role === "citizen") {
              fetchUserReports();
            }
          }}
        />
      )}
    </div>
  );
}