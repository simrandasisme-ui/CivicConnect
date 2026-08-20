"use client";

import { useLanguage } from "@/context/LanguageContext";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import {
  Building2,
  Check,
  KeyRound,
  Lock,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserRound,
  Landmark,
} from "lucide-react";

type Role = "citizen" | "worker" | "officer" | "admin";

type AuthMode = "login" | "register" | "forgot";

type UnifiedLoginProps = {
  onLoginSuccess?: (data: {
    role: Role;
    identifier: string;
    name?: string;
    email?: string;
    anonymous: boolean;
    token: string;
  }) => void;
};

export default function UnifiedLogin({ onLoginSuccess }: UnifiedLoginProps) {
  const { t } = useLanguage();

  const [selectedRole, setSelectedRole] = useState<Role>("citizen");
  const [mode, setMode] = useState<AuthMode>("login");
  const [identifier, setIdentifier] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const roles = [
    {
      id: "citizen" as Role,
      title: t("login_roleCitizen") || "Citizen",
      subtitle: t("login_roleCitizenDesc") || "Report issues & track progress",
      icon: UserRound,
    },
    {
      id: "worker" as Role,
      title: t("login_roleEmployee") || "Municipal Worker",
      subtitle: t("login_roleEmployeeDesc") || "Manage tickets & post evidence",
      icon: Building2,
    },
    {
      id: "officer" as Role,
      title: t("login_roleOfficer") || "Budget Officer",
      subtitle: t("login_roleOfficerDesc") || "Publish & manage civic projects",
      icon: Landmark,
    },
    {
      id: "admin" as Role,
      title: t("login_roleAdmin") || "Administrator",
      subtitle: t("login_roleAdminDesc") || "Manage workers & system",
      icon: ShieldCheck,
    },
  ];

  const handleRoleChange = (role: Role) => {
    setSelectedRole(role);
    setMode("login");
    setIdentifier("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setSuccessMessage("");
  };

  const handleModeChange = (newMode: AuthMode) => {
    setMode(newMode);
    setError("");
    setSuccessMessage("");
    setPassword("");
    setConfirmPassword("");
  };

  const handleAuthAction = async () => {
    setError("");
    setSuccessMessage("");

    const trimmedId = identifier.trim();

    const isAnonymousCitizen =
      selectedRole === "citizen" && mode === "login" && anonymous;

    if (!isAnonymousCitizen) {
      if (!trimmedId) {
        setError(
          selectedRole === "worker"
            ? "Please enter your Employee ID."
            : selectedRole === "officer"
            ? "Please enter your Officer ID."
            : selectedRole === "citizen"
            ? "Please enter your Email Address."
            : "Please enter your Admin ID."
        );
        return;
      }

      if (!password) {
        setError("Please enter your password.");
        return;
      }
    }

    setLoading(true);

    try {
      let finalToken = `jwt_session_${selectedRole}_${Date.now()}`;
      let finalDisplayName = trimmedId;
      let finalEmail = trimmedId;

      if (isAnonymousCitizen) {
        const anonAlias = `anon_${Math.random().toString(36).slice(2, 10)}`;
        finalToken = `anon_session_${Date.now()}`;
        finalDisplayName = anonAlias;
        finalEmail = "";

        const sessionData = {
          role: "citizen" as Role,
          identifier: finalDisplayName,
          email: finalEmail,
          anonymous: true,
          token: finalToken,
        };

        window.localStorage.setItem(
          "civic_connect_auth",
          JSON.stringify(sessionData)
        );
        document.cookie = `civic_connect_auth=${encodeURIComponent(
          JSON.stringify(sessionData)
        )}; path=/; max-age=86400; SameSite=Lax`;

        window.location.href = "/report"; // update to your actual report route
        return;
      }

      /*
       * ========================================================
       * CITIZEN REGISTRATION
       * ========================================================
       */
      if (mode === "register" && selectedRole === "citizen") {
        if (!fullName.trim()) {
          throw new Error("Please enter your full name.");
        }

        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: trimmedId,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              role: "citizen",
            },
          },
        });

        if (signUpError) throw signUpError;

        if (signUpData.user && !signUpData.session) {
          setSuccessMessage(
            "Registration successful! Please check your email to verify your account."
          );
          setLoading(false);
          return;
        }

        if (signUpData.session) {
          finalToken = signUpData.session.access_token;
          finalDisplayName = fullName.trim();
          finalEmail = trimmedId;
        }
      }

      /*
       * ========================================================
       * LOGIN
       * ========================================================
       */
      else if (mode === "login") {
        /*
         * ADMIN
         */
        if (selectedRole === "admin") {
          if (trimmedId !== "admin" || password !== "admin123") {
            throw new Error("Incorrect admin credentials.");
          }

          finalDisplayName = "System Admin";
          finalEmail = "admin@civicconnect.com";
          
          
          window.localStorage.setItem("is_admin_logged_in", "true");
        }

        /*
         * ====================================================
         * WORKER & OFFICER AUTHENTICATION
         * ====================================================
         */
        else if (selectedRole === "worker" || selectedRole === "officer") {
          const { data: workerRecord, error: workerError } = await supabase
            .from("workers")
            .select("*")
            .eq("dept_id", trimmedId)
            .maybeSingle();

          if (workerError) {
            console.error("Staff lookup error:", workerError);
            throw new Error(
              `Unable to verify ${
                selectedRole === "officer" ? "Officer ID" : "Employee ID"
              }. Please try again.`
            );
          }

          if (!workerRecord) {
            throw new Error(
              `${
                selectedRole === "officer" ? "Officer" : "Worker"
              } record not found. Check your ID.`
            );
          }

          if (workerRecord.password !== password) {
            throw new Error("Incorrect password.");
          }

          finalDisplayName =
            workerRecord.name || workerRecord.full_name || trimmedId;

          finalEmail = workerRecord.dept_id;

          const staffSession = {
            id: workerRecord.id,
            fullName: finalDisplayName,
            deptId: workerRecord.dept_id,
            department: workerRecord.department || "Municipal Administration",
            role: selectedRole,
          };

          if (selectedRole === "officer") {
            window.localStorage.setItem(
              "civic_connect_officer",
              JSON.stringify(staffSession)
            );
          } else {
            window.localStorage.setItem(
              "civic_connect_worker",
              JSON.stringify(staffSession)
            );
          }
        }

        /*
         * CITIZEN LOGIN
         */
        else if (selectedRole === "citizen") {
          const { data: authData, error: authError } =
            await supabase.auth.signInWithPassword({
              email: trimmedId,
              password,
            });

          if (authError) {
            if (authError.message.includes("Email not confirmed")) {
              throw new Error(
                "Please verify your email address before logging in. Check your inbox."
              );
            }
            throw new Error("Incorrect credentials. Please try again.");
          }

          if (authData.session && authData.user) {
            finalToken = authData.session.access_token;
            finalDisplayName =
              authData.user.user_metadata?.full_name || trimmedId;
            finalEmail = authData.user.email || trimmedId;
          }
        }
      }

      /*
       * ========================================================
       * CUSTOM GLOBAL SESSION
       * ========================================================
       */
      const sessionData = {
        role: selectedRole,
        identifier: finalDisplayName,
        email: finalEmail,
        anonymous: selectedRole === "citizen" ? anonymous : false,
        token: finalToken,
      };

      const sessionString = JSON.stringify(sessionData);

      window.localStorage.setItem("civic_connect_auth", sessionString);
      document.cookie = `civic_connect_auth=${encodeURIComponent(
        sessionString
      )}; path=/; max-age=86400; SameSite=Lax`;

      /*
       * ========================================================
       * ROUTING
       * ========================================================
       */
      if (selectedRole === "worker") {
        window.location.href = "/employees";
        return;
      }

      if (selectedRole === "officer") {
        window.location.href = "/officer";
        return;
      }

      if (selectedRole === "admin") {
        window.location.href = "/admin";
        return;
      }

      if (selectedRole === "citizen" && anonymous) {
        window.location.href = "/report"; // update to your actual report route
        return;
      }

      if (onLoginSuccess) {
        onLoginSuccess(sessionData);
      }
    } catch (err: unknown) {
      console.error("Auth error:", err);
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-[#dce4de] bg-white p-6 shadow-xl sm:p-10">
      {/* HEADER */}
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#124b35] text-white shadow-md">
          {mode === "register" ? (
            <UserPlus size={28} />
          ) : mode === "forgot" ? (
            <KeyRound size={28} />
          ) : (
            <UserCheck size={28} />
          )}
        </div>

        <h2 className="mt-4 text-2xl font-bold text-[#14251c] sm:text-3xl">
          {mode === "forgot"
            ? t("login_title_reset")
            : selectedRole === "citizen"
            ? mode === "register"
              ? t("login_title_create")
              : t("login_title")
            : selectedRole === "worker"
            ? t("login_title_worker")
            : selectedRole === "admin"
            ? t("login_roleAdmin")
            : t("login_roleOfficer")}
        </h2>

        <p className="mt-2 text-sm text-[#718078]">{t("login_subtitle")}</p>
      </div>

      {/* ROLES */}
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {roles.map((role) => {
          const Icon = role.icon;
          const isSelected = selectedRole === role.id;

          return (
            <button
              key={role.id}
              type="button"
              onClick={() => handleRoleChange(role.id)}
              className={`relative flex flex-col items-start rounded-2xl border p-4 text-left transition ${
                isSelected
                  ? "border-[#124b35] bg-[#eef5ef] ring-2 ring-[#124b35]/20"
                  : "border-[#dce4de] bg-white hover:border-[#124b35]/40 hover:bg-[#fafcf9]"
              }`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  isSelected
                    ? "bg-[#124b35] text-white"
                    : "bg-[#f0f4f1] text-[#526158]"
                }`}
              >
                <Icon size={20} />
              </div>

              <p className="mt-3 text-sm font-bold text-[#14251c]">
                {role.title}
              </p>

              <p className="mt-1 text-[11px] leading-4 text-[#718078]">
                {role.subtitle}
              </p>

              {isSelected && (
                <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#124b35] text-white">
                  <Check size={12} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* MODE */}
      <div className="mt-6 flex rounded-2xl border border-[#dce4de] bg-[#fafcf9] p-1.5">
        <button
          type="button"
          onClick={() => handleModeChange("login")}
          className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
            mode === "login"
              ? "bg-[#124b35] text-white shadow-sm"
              : "text-[#718078]"
          }`}
        >
          {t("login_modeLogin")}
        </button>

        {selectedRole === "citizen" && (
          <button
            type="button"
            onClick={() => handleModeChange("register")}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
              mode === "register"
                ? "bg-[#124b35] text-white shadow-sm"
                : "text-[#718078]"
            }`}
          >
            {t("login_modeRegister")}
          </button>
        )}

        <button
          type="button"
          onClick={() => handleModeChange("forgot")}
          className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
            mode === "forgot"
              ? "bg-[#124b35] text-white shadow-sm"
              : "text-[#718078]"
          }`}
        >
          {t("login_modeForgot")}
        </button>
      </div>

      {/* FORM */}
      <div className="mt-6 space-y-4">
        {/* FULL NAME */}
        {mode === "register" && selectedRole === "citizen" && (
          <div>
            <label className="block text-sm font-semibold text-[#14251c]">
              {t("login_nameLabel")}
            </label>

            <div className="relative mt-1.5">
              <UserRound
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#718078]"
              />

              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t("login_namePlaceholder")}
                className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] py-3.5 pl-11 pr-4 text-sm outline-none focus:border-[#124b35]"
              />
            </div>
          </div>
        )}

        {/* IDENTIFIER */}
        <div>
          <label className="block text-sm font-semibold text-[#14251c]">
            {selectedRole === "citizen"
              ? t("login_emailLabel")
              : selectedRole === "worker"
              ? t("login_employeeLabel")
              : selectedRole === "officer"
              ? "Officer ID"
              : "Admin ID"}
          </label>

          <div className="relative mt-1.5">
            <UserRound
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#718078]"
            />

            <input
              type={selectedRole === "citizen" ? "email" : "text"}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={
                selectedRole === "citizen"
                  ? t("login_emailPlaceholder")
                  : selectedRole === "worker"
                  ? "e.g. EMP-12345"
                  : selectedRole === "officer"
                  ? "e.g. OFF-9901"
                  : "e.g. admin"
              }
              className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] py-3.5 pl-11 pr-4 text-sm outline-none focus:border-[#124b35]"
            />
          </div>
        </div>

        {/* PASSWORD */}
        <div>
          <label className="block text-sm font-semibold text-[#14251c]">
            {t("login_passwordLabel")}
          </label>

          <div className="relative mt-1.5">
            <Lock
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#718078]"
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("login_passwordLabel")}
              className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] py-3.5 pl-11 pr-4 text-sm outline-none focus:border-[#124b35]"
            />
          </div>
        </div>

        {/* CONFIRM PASSWORD */}
        {(mode === "register" || mode === "forgot") && (
          <div>
            <label className="block text-sm font-semibold text-[#14251c]">
              {t("login_confirmPasswordLabel")}
            </label>

            <div className="relative mt-1.5">
              <Lock
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#718078]"
              />

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("login_confirmPasswordLabel")}
                className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] py-3.5 pl-11 pr-4 text-sm outline-none focus:border-[#124b35]"
              />
            </div>
          </div>
        )}

        {/* ANONYMOUS */}
        {selectedRole === "citizen" && mode === "login" && (
          <div className="rounded-2xl border border-[#dce4de] bg-[#fafcf9] p-3.5">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#124b35]"
              />

              <div>
                <p className="text-xs font-bold text-[#14251c]">
                  {t("login_anonymousLabel")}
                </p>

                <p className="text-[11px] text-[#718078]">
                  {t("login_anonymousDesc")}
                </p>
              </div>
            </label>
          </div>
        )}

        {/* SUCCESS */}
        {successMessage && (
          <p className="rounded-xl border border-[#dce4de] bg-[#eef5ef] px-4 py-3 text-xs font-semibold text-[#124b35]">
            {successMessage}
          </p>
        )}

        {/* ERROR */}
        {error && (
          <p className="rounded-xl bg-[#fff0ee] px-4 py-3 text-xs font-semibold text-[#a33d36]">
            {error}
          </p>
        )}

        {/* SUBMIT */}
        <button
          type="button"
          onClick={handleAuthAction}
          disabled={loading}
          className="w-full rounded-xl bg-[#124b35] py-3.5 text-sm font-bold text-white transition hover:bg-[#0d3d2b] disabled:opacity-50"
        >
          {loading
            ? t("login_authenticating")
            : mode === "forgot"
            ? t("login_submitReset")
            : selectedRole === "citizen"
            ? mode === "register"
              ? t("login_submitRegister")
              : t("login_submitButton")
            : selectedRole === "worker"
            ? t("login_submitWorker")
            : selectedRole === "admin"
            ? "Login to Admin Panel"
            : "Login to Officer Dashboard"}
        </button>

        {/* SECURITY */}
        <div className="flex items-center justify-center gap-2 pt-2 text-xs text-[#718078]">
          <ShieldCheck size={15} className="text-[#124b35]" />
          <span>
            {selectedRole === "citizen"
              ? "Secured by Supabase Auth"
              : "Official Staff ID Authentication"}
          </span>
        </div>
      </div>
    </div>
  );
}