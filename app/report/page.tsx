"use client";

import { ChangeEvent, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/context/LanguageContext";
import {
  Camera,
  CheckCircle2,
  FileText,
  ImageIcon,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  Send,
  Trash2,
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

  // Photo State
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoName, setPhotoName] = useState("");

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

  const categories = [
    "Garbage",
    "Pothole",
    "Water Leakage",
    "Electricity",
    "Streetlight",
    "Drainage",
    "Other",
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
        alert("Unable to detect location. Please grant permission.");
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

  /* ---------------- 4. FORM SUBMISSION ---------------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!photo) {
      alert("Please upload or take a photo of the issue.");
      return;
    }

    setIsSubmitting(true);

    try {
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

      // Get Public URL for Photo
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

      // Step C: Insert Record in Supabase Table
      const { data: insertedData, error: dbError } = await supabase
        .from("reports")
        .insert([
          {
            category,
            description: description.trim() || null,
            anonymous,
            latitude: location?.latitude ?? null,
            longitude: location?.longitude ?? null,
            status: "Open",
            image_urls: [uploadedPhotoUrl],
            voice_url: uploadedAudioUrl || null,
            duplicate_count: 0,
          },
        ])
        .select();

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      // Step D: Generate Tracking Reference ID
      let assignedId = "";
      if (anonymous) {
        assignedId = `CIT-ANON-${Math.floor(10000 + Math.random() * 90000)}`;
      } else if (insertedData && insertedData.length > 0) {
        assignedId = insertedData[0].id.slice(0, 8).toUpperCase();
      } else {
        assignedId = `CC-${Date.now().toString().slice(-6)}`;
      }

      setReportId(assignedId);
      setSubmitted(true);
    } catch (err: unknown) {
      console.error("Submission failed:", err);
      const msg = err instanceof Error ? err.message : "Failed to submit report. Please try again.";
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
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#eef5ef] text-[#124b35]">
            <CheckCircle2 size={42} />
          </div>

          <h2 className="mt-6 text-2xl font-bold text-[#14251c] sm:text-3xl">
            Report Submitted Successfully!
          </h2>

          <p className="mt-2 text-sm text-[#718078]">
            Thank you for helping improve your community. Your issue has been logged and assigned for municipal action.
          </p>

          <div className="mt-6 rounded-2xl bg-[#fafcf9] p-4 text-center border border-[#dce4de]">
            <p className="text-xs font-bold uppercase tracking-wider text-[#718078]">
              Tracking Reference ID
            </p>
            <p className="mt-1 font-mono text-xl font-extrabold text-[#124b35]">
              #{reportId}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setPhoto(null);
              setPhotoName("");
              setDescription("");
              setLocation(null);
              deleteRecording();
            }}
            className="mt-8 w-full rounded-xl bg-[#124b35] py-3.5 text-sm font-bold text-white transition hover:bg-[#0d3d2b]"
          >
            Submit Another Report
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
          Citizen Intake
        </span>
        <h1 className="mt-1 text-3xl font-extrabold text-[#14251c] sm:text-4xl">
          {t("reportIssue")}
        </h1>
        <p className="mt-2 text-sm text-[#718078]">
          Upload photos, describe the problem, provide voice notes, or share your GPS location to help municipal teams fix it fast.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. CATEGORY SELECTOR */}
        <div className="rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm sm:p-8">
          <label className="text-base font-bold text-[#14251c]">
            {t("selectCategory")} <span className="text-red-500">*</span>
          </label>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {categories.map((cat) => {
              const selected = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-xl border px-3 py-3 text-xs font-bold transition ${
                    selected
                      ? "border-[#124b35] bg-[#eef5ef] text-[#124b35] ring-2 ring-[#124b35]/20"
                      : "border-[#dce4de] bg-white text-[#526158] hover:bg-[#fafcf9]"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. PHOTO UPLOAD (COMPULSORY) */}
        <div className="rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between">
            <label className="text-base font-bold text-[#14251c]">
              {t("uploadPhoto")} <span className="text-red-500">*</span>
            </label>
            <span className="text-xs font-bold text-red-500">Required</span>
          </div>

          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#dce4de] bg-[#fafcf9] p-8 text-center transition hover:border-[#124b35] hover:bg-[#eef5ef]/40">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef5ef] text-[#124b35]">
              <Camera size={24} />
            </div>
            <p className="mt-3 text-sm font-bold text-[#14251c]">
              Click to capture or upload photo
            </p>
            <p className="mt-1 text-xs text-[#718078]">
              PNG, JPG, or WEBP (Max 10MB)
            </p>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </label>

          {photoName && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#eef5ef] p-3 text-xs font-bold text-[#124b35]">
              <ImageIcon size={16} />
              <span className="truncate">{photoName}</span>
            </div>
          )}
        </div>

        {/* 3. DESCRIPTION */}
        <div className="rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm sm:p-8">
          <label className="text-base font-bold text-[#14251c]">
            {t("describeProblem")}{" "}
            <span className="text-xs text-[#718078] font-normal">
              (Optional)
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
              placeholder="Provide context (e.g. Overflowing bin near main road entrance)..."
              className="w-full resize-none rounded-xl border border-[#dce4de] bg-[#fafcf9] py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-[#124b35] focus:ring-2 focus:ring-[#124b35]/10"
            />
          </div>
        </div>

        {/* 4. VOICE NOTE RECORDING */}
        <div className="rounded-3xl border border-[#dce4de] bg-white p-6 shadow-sm sm:p-8">
          <label className="text-base font-bold text-[#14251c]">
            {t("recordVoice")}{" "}
            <span className="text-xs text-[#718078] font-normal">
              (Optional)
            </span>
          </label>
          <p className="mt-1 text-xs text-[#718078]">
            Speak in Odia, Hindi, or English to explain the issue directly.
          </p>

          <div className="mt-4">
            {!isRecording && !audioUrl && (
              <button
                type="button"
                onClick={startRecording}
                className="flex items-center gap-2 rounded-xl border border-[#124b35] bg-[#eef5ef] px-4 py-2.5 text-xs font-bold text-[#124b35] hover:bg-[#124b35] hover:text-white transition"
              >
                <Mic size={16} />
                Start Voice Recording
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
                  className="ml-auto flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white"
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
                  className="self-end flex items-center gap-1 text-xs font-bold text-red-500 hover:underline mt-1"
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
            {t("attachGps")}
          </label>
          <p className="mt-1 text-xs text-[#718078]">
            Helps municipal workers route the issue to the right ward.
          </p>

          <div className="mt-4">
            {!location ? (
              <button
                type="button"
                onClick={getLocation}
                disabled={locationLoading}
                className="flex items-center gap-2 rounded-xl border border-[#dce4de] bg-[#fafcf9] px-4 py-3 text-xs font-bold text-[#14251c] hover:border-[#124b35]"
              >
                {locationLoading ? (
                  <Loader2 size={16} className="animate-spin text-[#124b35]" />
                ) : (
                  <MapPin size={16} className="text-[#124b35]" />
                )}
                {locationLoading
                  ? "Detecting Coordinates..."
                  : "Detect Current Location"}
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
                Submit Anonymously
              </p>
              <p className="text-xs text-[#718078]">
                Your identity won't be visible on public tracking maps.
              </p>
            </div>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#124b35] py-4 text-base font-bold text-white shadow-lg transition hover:bg-[#0d3d2b] disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Submitting Report...</span>
              </>
            ) : (
              <>
                <Send size={18} />
                <span>{t("submitReport")}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}