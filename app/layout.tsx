"use client";

import "./globals.css";
import { LanguageProvider, useLanguage, Language } from "../context/LanguageContext";
import Link from "next/link";
import { Globe, Shield } from "lucide-react";

function Navbar() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="sticky top-0 z-40 border-b border-[#dce4de] bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#124b35] text-white shadow-sm">
            <Shield size={20} />
          </div>
          <div>
            <span className="text-lg font-black tracking-tight text-[#14251c]">
              {t("appName")}
            </span>
            <span className="hidden text-[10px] font-bold text-[#124b35] sm:inline-block sm:ml-2">
              • Odisha Civic Network
            </span>
          </div>
        </Link>

        {/* 7-LANGUAGE SELECTOR */}
        <div className="flex items-center gap-2 rounded-xl border border-[#dce4de] bg-[#fafcf9] px-3 py-1.5 text-xs font-bold text-[#14251c]">
          <Globe size={15} className="text-[#124b35]" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="bg-transparent font-bold outline-none cursor-pointer"
          >
            <option value="en">English</option>
            <option value="or">ଓଡ଼ିଆ (Odia)</option>
            <option value="hi">हिंदी (Hindi)</option>
            <option value="mr">मराठी (Marathi)</option>
            <option value="te">తెలుగు (Telugu)</option>
            <option value="ta">தமிழ் (Tamil)</option>
            <option value="bn">বাংলা (Bengali)</option>
          </select>
        </div>
      </div>
    </header>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f7faf8] text-[#14251c] antialiased">
        <LanguageProvider>
          <Navbar />
          <main>{children}</main>
        </LanguageProvider>
      </body>
    </html>
  );
}