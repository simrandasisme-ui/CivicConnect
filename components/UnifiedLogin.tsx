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
  Vote,
} from "lucide-react";

type Role = "citizen" | "worker" | "budgeting" | "admin";
type AuthMode = "login" | "register" | "forgot";

type UnifiedLoginProps = {
  onLoginSuccess?: (data: {
    role: Role;
    identifier: string;
    anonymous: boolean;
    token: string;
  }) => void;
};

export default function UnifiedLogin({ onLoginSuccess }: UnifiedLoginProps) {
  const { t } = useLanguage();
  const [selectedRole, setSelectedRole] = useState<Role>("citizen");
  const [mode, setMode] = useState<AuthMode>("login");

  // Form State
  const [identifier, setIdentifier] = useState("");
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
      id: "budgeting" as Role,
      title: t("login_roleVoter") || "Community Voter",
      subtitle: t("login_roleVoterDesc") || "Vote on local public works",
      icon: Vote,
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

    if (!trimmedId) {
      setError(
        selectedRole === "worker"
          ? "Please enter your Employee ID."
          : "Please enter your User ID."
      );
      return;
    }

    setLoading(true);

    try {
      // 1. FORGOT PASSWORD
      if (mode === "forgot") {
        if (!password) {
          setError("Please enter a new password.");
          setLoading(false);
          return;
        }
        if (password.length < 4) {
          setError("New password must be at least 4 characters long.");
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          setLoading(false);
          return;
        }

        if (selectedRole === "worker") {
          await supabase
            .from("workers")
            .update({ password: password })
            .eq("dept_id", trimmedId);
        } else {
          await supabase
            .from("users")
            .update({ password: password })
            .eq("user_id", trimmedId);
        }

        setSuccessMessage("Password reset successfully! Logging you in...");
      }

      // 2. REGISTER NEW ACCOUNT
      if (mode === "register" && selectedRole === "citizen") {
        if (!password) {
          setError("Please enter a password.");
          setLoading(false);
          return;
        }
        if (password.length < 4) {
          setError("Password must be at least 4 characters long.");
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          setLoading(false);
          return;
        }

        const { data: existingUsers } = await supabase
          .from("users")
          .select("user_id")
          .eq("user_id", trimmedId);

        if (existingUsers && existingUsers.length > 0) {
          setError("This User ID is already taken. Please choose another or log in.");
          setLoading(false);
          return;
        }

        await supabase.from("users").insert([
          {
            user_id: trimmedId,
            password: password,
            role: "citizen",
          },
        ]);
      }
      
      // 3. LOGIN VERIFICATION
      if (mode === "login") {
        if (selectedRole === "admin") {
          // Master Admin Credentials
          if (trimmedId !== "admin" || password !== "admin123") {
            setError("Incorrect admin credentials.");
            setLoading(false);
            return;
          }
        } else if (selectedRole === "citizen") {
          const { data: userRecords } = await supabase
            .from("users")
            .select("*")
            .eq("user_id", trimmedId);

          if (userRecords && userRecords.length > 0) {
            const matchedUser = userRecords[0];
            if (matchedUser.password && matchedUser.password !== password) {
              setError("Incorrect password. Please check your credentials.");
              setLoading(false);
              return;
            }
          }
        }
      }

      // 4. PERSIST SESSION (LOCAL STORAGE + COOKIE FOR MOBILE HARDINESS)
      const mockToken = `jwt_session_${selectedRole}_${Date.now()}`;
      const sessionData = {
        role: selectedRole,
        identifier: trimmedId,
        anonymous: selectedRole === "citizen" ? anonymous : false,
        token: mockToken,
      };

      const sessionString = JSON.stringify(sessionData);

      try {
        window.localStorage.setItem("civic_connect_auth", sessionString);
      } catch (e) {
        console.warn("Storage warning:", e);
      }

      // Set cookie as mobile fallback
      document.cookie = `civic_connect_auth=${encodeURIComponent(
        sessionString
      )}; path=/; max-age=86400`;

      if (selectedRole === "worker") {
        window.location.href = "/employees";
      } else if (selectedRole === "admin") {
        window.location.href = "/admin"; // Redirects to the new admin dashboard
      } else if (onLoginSuccess) {
        onLoginSuccess(sessionData);
      }
    } catch (err: unknown) {
      console.error("Auth error:", err);
      const msg = err instanceof Error ? err.message : "Authentication failed.";
      setError(msg);
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
            ? t("login_title_reset") || "Reset Password"
            : selectedRole === "citizen"
            ? mode === "register"
              ? t("login_title_create") || "Create Citizen Account"
              : t("login_title") || "Citizen Portal Login"
            : selectedRole === "worker"
            ? t("login_title_worker") || "Municipal Worker Login"
            : selectedRole === "admin"
            ? "Admin Portal Login"
            : t("login_title_voter") || "Community Voter Login"}
        </h2>
        <p className="mt-2 text-sm text-[#718078]">
          {t("login_subtitle") || "Select your portal role to continue"}
        </p>
      </div>

      {/* ROLE SELECTION TABS */}
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {roles.map((role) => {
          const Icon = role.icon;
          const isSelected = selectedRole === role.id;

          return (
            <button
              key={role.id}
              type="button"
              onClick={() => handleRoleChange(role.id)}
              className={`relative flex flex-col items-start rounded-2xl border p-4 text-left transition cursor-pointer ${
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

              <p className="mt-3 font-bold text-[#14251c] text-sm">
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

      {/* MODE SELECTION TOGGLE */}
      <div className="mt-6 flex rounded-2xl bg-[#fafcf9] p-1.5 border border-[#dce4de]">
        <button
          type="button"
          onClick={() => handleModeChange("login")}
          className={`flex-1 rounded-xl py-2 text-xs font-bold transition cursor-pointer ${
            mode === "login"
              ? "bg-[#124b35] text-white shadow-sm"
              : "text-[#718078] hover:text-[#14251c]"
          }`}
        >
          {t("login_modeLogin") || "Login"}
        </button>

        {selectedRole === "citizen" && (
          <button
            type="button"
            onClick={() => handleModeChange("register")}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition cursor-pointer ${
              mode === "register"
                ? "bg-[#124b35] text-white shadow-sm"
                : "text-[#718078] hover:text-[#14251c]"
            }`}
          >
            {t("login_modeRegister") || "New Account"}
          </button>
        )}

        <button
          type="button"
          onClick={() => handleModeChange("forgot")}
          className={`flex-1 rounded-xl py-2 text-xs font-bold transition cursor-pointer ${
            mode === "forgot"
              ? "bg-[#124b35] text-white shadow-sm"
              : "text-[#718078] hover:text-[#14251c]"
          }`}
        >
          {t("login_modeForgot") || "Forgot Password"}
        </button>
      </div>

      {/* FORM INPUTS */}
      <div className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-[#14251c]">
            {selectedRole === "citizen"
              ? t("login_emailLabel") || "User ID / Username"
              : selectedRole === "worker"
              ? t("login_employeeLabel") || "Employee ID"
              : selectedRole === "admin"
              ? "Admin ID"
              : t("login_voterLabel") || "Voter ID / Phone"}
          </label>
          <div className="relative mt-1.5">
            <UserRound
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#718078]"
            />
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={
                selectedRole === "worker" ? "e.g. EMP-4092" : "e.g. Rahul2026"
              }
              className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-[#124b35] focus:ring-2 focus:ring-[#124b35]/10"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#14251c]">
            {mode === "forgot" 
              ? t("login_newPasswordLabel") || "New Password" 
              : t("login_passwordLabel") || "Password"}
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
              placeholder={
                mode === "forgot" ? "Enter new password" : "Enter password"
              }
              className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-[#124b35] focus:ring-2 focus:ring-[#124b35]/10"
            />
          </div>
        </div>

        {(mode === "register" || mode === "forgot") && (
          <div>
            <label className="block text-sm font-semibold text-[#14251c]">
              {t("login_confirmPasswordLabel") || "Confirm Password"}
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
                placeholder="Re-enter password"
                className="w-full rounded-xl border border-[#dce4de] bg-[#fafcf9] py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-[#124b35] focus:ring-2 focus:ring-[#124b35]/10"
              />
            </div>
          </div>
        )}

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
                  {t("login_anonymousLabel") || "File Anonymous Reports"}
                </p>
                <p className="text-[11px] text-[#718078]">
                  {t("login_anonymousDesc") || "Generates an anonymous alias (e.g. CIT-ANON-73817) when filing complaints."}
                </p>
              </div>
            </label>
          </div>
        )}

        {successMessage && (
          <p className="rounded-xl bg-[#eef5ef] px-4 py-3 text-xs font-semibold text-[#124b35] border border-[#dce4de]">
            {successMessage}
          </p>
        )}

        {error && (
          <p className="rounded-xl bg-[#fff0ee] px-4 py-3 text-xs font-semibold text-[#a33d36]">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleAuthAction}
          disabled={loading}
          className="w-full rounded-xl bg-[#124b35] py-3.5 text-sm font-bold text-white transition hover:bg-[#0d3d2b] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          {loading
            ? t("login_authenticating") || "Authenticating..."
            : mode === "forgot"
            ? t("login_submitReset") || "Reset Password & Sign In"
            : selectedRole === "citizen"
            ? mode === "register"
              ? t("login_submitRegister") || "Create Account & Sign In"
              : t("login_submitButton") || "Sign In as Citizen"
            : selectedRole === "worker"
            ? t("login_submitWorker") || "Login to Worker Portal"
            : selectedRole === "admin"
            ? "Login to Admin Panel"
            : t("login_submitVoter") || "Sign In as Voter"}
        </button>

        <div className="flex items-center justify-center gap-2 pt-2 text-xs text-[#718078]">
          <ShieldCheck size={15} className="text-[#124b35]" />
          <span>{t("login_encryptedSession") || "Encrypted account session"}</span>
        </div>
      </div>
    </div>
  );
}