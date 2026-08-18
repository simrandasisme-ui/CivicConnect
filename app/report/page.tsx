"use client";

import { ChangeEvent, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/context/LanguageContext";
import {
  Camera,
  CheckCircle2,
  FileText,
  Flame,
  ImageIcon,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  Send,
  Trash2,
  X,
} from "lucide-react";

export default function CitizenReportPage() {
  const { t } = useLanguage();

  const [category, setCategory] = useState("Garbage");
  const [description, setDescription] = useState("");
  const [anonymous, setAnonymous] = useState(false);

  // GPS State
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Photo & Preview State
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Hidden input refs for triggering camera vs gallery
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reportId, setReportId] = useState("");
  const [isMerged, setIsMerged] = useState(false);
  const [mergeMessage, setMergeMessage] = useState("");

  const categories = [
    { key: "cat_garbage", value: "Garbage" },
    { key: "cat_pothole", value: "Pothole" },
    { key: "cat_water", value: "Water Leakage" },
    { key: "cat_electricity", value: "Electricity" },
    { key: "cat_streetlight", value: "Streetlight" },
    { key: "cat_drainage", value: "Drainage" },
    { key: "cat_other", value: "Other" },
  ];

  /* ---------------- 1. GPS LOCATION ---------------- */
  const getLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationLoading(false);
      },
      (error) => {
        setLocationLoading(false);
        alert("Unable to detect location. Please grant location permissions.");
        console.error("GPS Error:", error);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  /* ---------------- 2. PHOTO HANDLING ---------------- */
  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be under 10 MB.");
      return;
    }

    setPhoto(file);
    setPhotoName(file.name);
    setImagePreview(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoName("");
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  };

  /* ---------------- 3. VOICE RECORDING ---------------- */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      alert("Microphone access failed. Please allow microphone permissions.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const deleteRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
    setAudioBlob(null);
  };

  /* ---------------- 4. FORM SUBMISSION VIA /reports/submit ---------------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!photo) {
      alert("Please upload or take a photo of the issue.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Get current logged in user (or fallback to Anonymous)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const currentUserEmail = user?.email || (anonymous ? "Anonymous Citizen" : "Registered Citizen");

      let uploadedPhotoUrl = "";
      let uploadedAudioUrl = "";

      // Step A: Upload Photo to Supabase Storage
      const fileExt = photo.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `issue-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("issue-media")
        .upload(filePath, photo, { contentType: photo.type });

      if (uploadError) {
        throw new Error(`Photo upload failed: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from("issue-media")
        .getPublicUrl(filePath);

      uploadedPhotoUrl = urlData.publicUrl;

      // Step B: Upload Voice Recording (If Recorded)
      if (audioBlob) {
        const audioName = `voice_${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;
        const audioPath = `issue-voices/${audioName}`;

        const { error: audioUploadError } = await supabase.storage
          .from("issue-media")
          .upload(audioPath, audioBlob, { contentType: "audio/webm" });

        if (!audioUploadError) {
          const { data: audioUrlData } = supabase.storage
            .from("issue-media")
            .getPublicUrl(audioPath);
          uploadedAudioUrl = audioUrlData.publicUrl;
        }
      }

      // Step C: Send report to the Local Deduplication API Endpoint
      const payload = {
        title: `${category} Issue`,
        description: description.trim() || `${category} reported at current location.`,
        category,
        imageUrl: uploadedPhotoUrl,
        voiceUrl: uploadedAudioUrl || null,
        latitude: location?.latitude ?? 0,
        longitude: location?.longitude ?? 0,
        address: location
          ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
          : "Location Captured via GPS",
        reporterId: currentUserEmail,
        reporterEmail: user?.email || null,
        anonymous,
      };

      const res = await fetch("/report/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to submit report.");
      }

      // Step D: Handle Response (Merged vs New)
      if (result.merged) {
        setIsMerged(true);
        setMergeMessage(result.message);
        setReportId(
          result.parentReportId
            ? result.parentReportId.slice(0, 8).toUpperCase()
            : `BOOST-${Math.floor(1000 + Math.random() * 9000)}`
        );
      } else {
        setIsMerged(false);
        setMergeMessage("");
        const newId = result.report?.id
          ? result.report.id.slice(0, 8).toUpperCase()
          : `CC-${Date.now().toString().slice(-6)}`;
        setReportId(newId);
      }

      setSubmitted(true);
    } catch (err: unknown) {
      console.error("Submission failed:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to submit report. Please try again.";
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------------- SUCCESS SCREEN ---------------- */
  if (submitted) {
    return (
      <div className="mx-auto flex min-h-[75vh] max-w-xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-3xl border border-[#dce4de] bg-white p-8 text-center shadow-xl sm:p-10">
          <div
            className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${
              isMerged ? "bg-amber-100 text-amber-700" : "bg-[#eef5ef] text-[#124b35]"
            }`}
          >
            {isMerged ? <Flame size={42} className="animate-pulse" /> : <CheckCircle2 size={42} />}
          </div>

          <h2 className="mt-6 text-2xl font-bold text-[#14251c] sm:text-3xl">
            {isMerged 
              ? (t("successMergedTitle") || "Report Merged & Priority Boosted!") 
              : (t("successNewTitle") || "Report Submitted Successfully!")}
          </h2>

          <p className="mt-2 text-sm text-[#718078]">
            {isMerged
              ? mergeMessage || (t("successMergedDesc") || "A matching report was already open within 25 meters. Your evidence has been attached to raise municipal priority.")
              : (t("successNewDesc") || "Thank you for helping improve your community. Your issue has been logged and assigned for municipal action.")}
          </p>

          <div className="mt-6 rounded-2xl bg-[#fafcf9] p-4 text-center border border-[#dce4de]">
            <p className="text-xs font-bold uppercase tracking-wider text-[#718078]">
              {isMerged 
                ? (t("mergedTicketLabel") || "Linked Master Ticket ID") 
                : (t("newTicketLabel") || "Tracking Reference ID")}
            </p>
            <p className="mt-1 font-mono text-xl font-extrabold text-[#124b35]">
              #{reportId}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setIsMerged(false);
              setMergeMessage("");
              setPhoto(null);
              setPhotoName("");
              setImagePreview(null);
              setDescription("");
              setLocation(null);
              deleteRecording();
            }}
            className="mt-8 w-full rounded-xl bg-[#124b35] py-3.5 text-sm font-bold text-white transition hover:bg-[#0d3d2b] cursor-pointer"
          >
            {t("submitAnotherBtn") || "Submit Another Report"}
          </button>
        </div>
      </div>
    );
  }

  /* ---------------- REPORT FORM ---------------- */
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-[#124b35]">
          {t("citizenIntake")}
        </span>
        <h1 className="mt-1 text-3xl font-extrabold text-[#14251c] sm:text-4xl">
          {t("reportIssue") || "Report an Issue"}
        </h1>
        <p className="mt-2 text-sm text-[#718078]">{t("reportSubtext")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. CATEGORY SELECTOR */}
        <div className="rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm sm:p-8">
          <label className="text-base font-bold text-[#14251c]">
            {t("selectCategory") || "Select Category"}{" "}
            <span className="text-red-500">*</span>
          </label>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {categories.map((cat) => {
              const selected = category === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`cursor-pointer rounded-xl border px-3 py-3 text-xs font-bold transition ${
                    selected
                      ? "border-[#124b35] bg-[#eef5ef] text-[#124b35] ring-2 ring-[#124b35]/20"
                      : "border-[#dce4de] bg-white text-[#526158] hover:bg-[#fafcf9]"
                  }`}
                >
                  {t(cat.key as keyof typeof import("@/context/LanguageContext").TranslationsMap)}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. PHOTO UPLOAD / CAMERA (COMPULSORY) */}
        <div className="rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex items-center justify-between">
            <label className="text-base font-bold text-[#14251c]">
              {t("uploadPhoto") || "Attach Evidence"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <span className="text-xs font-bold text-red-500">
              {t("requiredText")}
            </span>
          </div>

          {/* IMAGE PREVIEW OR BUTTONS */}
          {imagePreview ? (
            <div className="relative overflow-hidden rounded-2xl border border-[#dce4de]">
              <img
                src={imagePreview}
                alt="Issue preview"
                className="h-48 w-full object-cover"
              />
              <button
                type="button"
                onClick={removePhoto}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-red-600 shadow-sm backdrop-blur-sm transition hover:bg-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {/* CAMERA BUTTON */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#124b35]/40 bg-[#eef5ef] py-6 text-[#124b35] transition hover:bg-[#dce4de] cursor-pointer"
              >
                <Camera size={28} />
                <span className="text-xs font-bold">{t("takePhotoBtn")}</span>
              </button>

              {/* GALLERY BUTTON */}
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#dce4de] bg-[#fafcf9] py-6 text-[#718078] transition hover:bg-white hover:text-[#14251c] cursor-pointer"
              >
                <ImageIcon size={28} />
                <span className="text-xs font-bold">{t("uploadFileBtn")}</span>
              </button>
            </div>
          )}

          {/* HIDDEN INPUTS TO TRIGGER ACTIONS */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraInputRef}
            onChange={handlePhotoChange}
            className="hidden"
          />
          <input
            type="file"
            accept="image/*"
            ref={galleryInputRef}
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>

        {/* 3. DESCRIPTION */}
        <div className="rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm sm:p-8">
          <label className="text-base font-bold text-[#14251c]">
            {t("describeProblem") || "Describe Issue"}{" "}
            <span className="text-xs text-[#718078] font-normal">
              {t("optionalText")}
            </span>
          </label>
          <div className="relative mt-3">
            <FileText
              size={18}
              className="absolute left-4 top-4 text-[#718078]"
            />
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("describePlaceholder")}
              className="w-full resize-none rounded-xl border border-[#dce4de] bg-[#fafcf9] py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-[#124b35] focus:ring-2 focus:ring-[#124b35]/10"
            />
          </div>
        </div>

        {/* 4. VOICE NOTE RECORDING */}
        <div className="rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm sm:p-8">
          <label className="text-base font-bold text-[#14251c]">
            {t("recordVoice") || "Record Voice Note"}{" "}
            <span className="text-xs text-[#718078] font-normal">
              {t("optionalText")}
            </span>
          </label>
          <p className="mt-1 text-xs text-[#718078]">{t("voiceHint")}</p>

          <div className="mt-4">
            {!isRecording && !audioUrl && (
              <button
                type="button"
                onClick={startRecording}
                className="flex items-center gap-2 rounded-xl border border-[#124b35] bg-[#eef5ef] px-4 py-2.5 text-xs font-bold text-[#124b35] hover:bg-[#124b35] hover:text-white transition cursor-pointer"
              >
                <Mic size={16} />
                {t("startVoiceBtn")}
              </button>
            )}

            {isRecording && (
              <div className="flex items-center gap-4 rounded-xl bg-red-50 p-4 border border-red-200">
                <span className="h-3 w-3 animate-ping rounded-full bg-red-500" />
                <span className="text-xs font-bold text-red-600">
                  Recording audio...
                </span>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="ml-auto flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                >
                  <MicOff size={14} /> Stop
                </button>
              </div>
            )}

            {audioUrl && !isRecording && (
              <div className="flex flex-col gap-2 rounded-2xl bg-[#fafcf9] p-4 border border-[#dce4de]">
                <audio controls src={audioUrl} className="w-full h-10" />
                <button
                  type="button"
                  onClick={deleteRecording}
                  className="self-end flex items-center gap-1 text-xs font-bold text-red-500 hover:underline mt-1 cursor-pointer"
                >
                  <Trash2 size={14} /> Remove recording
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 5. GPS LOCATION CAPTURE */}
        <div className="rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm sm:p-8">
          <label className="text-base font-bold text-[#14251c]">
            {t("attachGps") || "Attach GPS Location"}
          </label>
          <p className="mt-1 text-xs text-[#718078]">{t("gpsHint")}</p>

          <div className="mt-4">
            {!location ? (
              <button
                type="button"
                onClick={getLocation}
                disabled={locationLoading}
                className="flex items-center gap-2 rounded-xl border border-[#dce4de] bg-[#fafcf9] px-4 py-3 text-xs font-bold text-[#14251c] hover:border-[#124b35] cursor-pointer"
              >
                {locationLoading ? (
                  <Loader2 size={16} className="animate-spin text-[#124b35]" />
                ) : (
                  <MapPin size={16} className="text-[#124b35]" />
                )}
                {locationLoading
                  ? "Detecting Coordinates..."
                  : t("detectLocBtn")}
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-[#eef5ef] p-3 text-xs font-bold text-[#124b35]">
                <CheckCircle2 size={16} />
                <span>
                  Captured: {location.latitude.toFixed(5)},{" "}
                  {location.longitude.toFixed(5)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 6. ANONYMOUS TOGGLE & SUBMIT */}
        <div className="rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm sm:p-8">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[#124b35]"
            />
            <div>
              <p className="text-sm font-bold text-[#14251c]">
                {t("submitAnonLabel")}
              </p>
              <p className="text-xs text-[#718078]">{t("anonHint")}</p>
            </div>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#124b35] py-4 text-base font-bold text-white shadow-lg transition hover:bg-[#0d3d2b] disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Processing & Checking Duplicates...</span>
              </>
            ) : (
              <>
                <Send size={18} />
                <span>{t("submitReport") || "Submit Report"}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}