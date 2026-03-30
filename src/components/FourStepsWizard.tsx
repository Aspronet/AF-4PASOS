"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CheckCircle, ChevronRight, ChevronLeft, Volume2, VolumeX, Play as PlayIcon, Pause, Maximize, Calendar, Check } from "lucide-react";
import BookingCalendar from "./BookingCalendar";

/* ── Step config ── */
const SUPABASE_STORAGE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/videos/funnel`;

const STEPS = [
  { num: 1, title: "Intro al Nuevo Socio", video: `${SUPABASE_STORAGE}/step1-intro.mp4` },
  { num: 2, title: "Requisitos de la Academia", video: `${SUPABASE_STORAGE}/step1-intro.mp4` },
  { num: 3, title: "Aplicación a la Academia", video: null },
  { num: 4, title: "Confirma tu Cita", video: `${SUPABASE_STORAGE}/step1-intro.mp4` },
];

/* ── Format seconds to mm:ss ── */
function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/* ── Qualification questions (14 questions) ── */
interface Question {
  q: string;
  options?: string[];  // if undefined → open text answer
}

const QUESTIONS: Question[] = [
  { q: "¿Cuál es tu principal motivación para ser parte de nuestro sistema de ventas digitales?", options: ["Viajar más y acceder a mejores experiencias", "Generar ingresos adicionales", "Construir un negocio online", "Todo lo anterior"] },
  { q: "¿Cuál de estas opciones describe mejor tu situación financiera actual?", options: ["Mis ingresos actuales no cubren mis gastos mensuales", "Mis ingresos actuales son apenas suficientes para cubrir mis gastos mensuales", "Mis ingresos actuales cubren mis gastos mensuales y tengo buena capacidad de ahorro e inversión"] },
  { q: "En los próximos 6 meses, ¿qué nivel de ingreso adicional te gustaría alcanzar?", options: ["$1.000 – $3.000 USD", "$3.000 – $5.000 USD", "$5.000 – $10.000 USD", "Más de $10.000 USD"] },
  { q: "Si logras esos ingresos, ¿cómo impactaría en tu estilo de vida?" },
  { q: "En base a lo que viste hasta ahora, ¿sientes que este sistema podría ayudarte a alcanzar tus objetivos?", options: ["Sí, totalmente", "Creo que sí", "Tengo dudas"] },
  { q: "¿Estás lo suficientemente comprometido con tus objetivos como para tomar una decisión hoy?" },
  { q: "¿A qué te dedicas actualmente y desde hace cuánto tiempo?" },
  { q: "Una vez que hayas alcanzado tus metas financieras, ¿cómo impactarías a otros?" },
  { q: "¿Podrías dedicar al menos 10 horas semanales para enfocarte en este negocio?", options: ["Sí", "Depende", "No"] },
  { q: "En nuestro sistema admitimos un número limitado de nuevos socios por mes y solo trabajamos con personas comprometidas y enfocadas.\n¿Por qué crees que deberías ser seleccionado para formar parte de este sistema?" },
  { q: "¿Te consideras una persona que puede avanzar y ejecutar sin necesidad de seguimiento constante?", options: ["Sí", "A veces", "No"] },
  { q: "¿Estás dispuesto a seguir un sistema probado y completar tareas simples que impactan directamente en tus resultados?", options: ["Sí", "Depende", "No"] },
  { q: "¿Podemos contar contigo para asistir en tiempo y forma a tus sesiones de entrenamiento?", options: ["Sí", "Depende", "No"] },
  { q: "En tu reunión programada, completaremos tu inscripción y se te dará acceso al portal de socios. La activación del sistema completo tiene un 50% de descuento por tiempo limitado a $895. Por favor, indica a continuación cómo financiarás tu inscripción:", options: ["Tarjeta de crédito", "Tarjeta de débito", "Cryptomonedas", "Necesito un plan de pagos", "Actualmente no puedo inscribirme, necesito una opción de menor inversión"] },
];

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

/* ── Types ── */
interface LeadInfo {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  stage: string;
  campaign_id: string;
  metadata: Record<string, unknown> | null;
}

/* ── Accent color (brand orange) ── */
const ACCENT = "#E8920D";
const ACCENT_LIGHT = "#FDF0DC";

export default function FourStepsWizard() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailParam);
  const [authenticated, setAuthenticated] = useState(false);
  const [lead, setLead] = useState<LeadInfo | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Video state
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Quiz state
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number | string>>({});

  // Step 4 state
  const [citaConfirmed, setCitaConfirmed] = useState(false);
  const [bookedInfo, setBookedInfo] = useState<{ date: string; time: string; bookingId: string } | null>(null);

  // Track completed steps
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  useEffect(() => { if (emailParam) setEmail(emailParam); }, [emailParam]);

  /* ── DEV: press "9" to skip video to 95% ── */
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    function handleDevKey(e: KeyboardEvent) {
      if (e.key === "9" && videoRef.current && videoRef.current.duration) {
        videoRef.current.currentTime = videoRef.current.duration * 0.99;
      }
    }
    window.addEventListener("keydown", handleDevKey);
    return () => window.removeEventListener("keydown", handleDevKey);
  }, []);

  /* ── Login: buscar lead por email ── */
  async function handleLogin() {
    if (!email.trim()) { setError("Ingresá tu email"); return; }
    setLoading(true); setError("");

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      console.error("Login error:", data.error);
      setError(data.error || "No encontramos una cuenta con ese email.");
      setLoading(false); return;
    }

    const leadData = data as LeadInfo;
    setLead(leadData);
    setAuthenticated(true);
    setLoading(false);

    // Restore progress from metadata.funnel_step
    console.log("Lead data on login:", JSON.stringify({ id: leadData.id, stage: leadData.stage, metadata: leadData.metadata }));
    const funnelStep = (leadData.metadata?.funnel_step as string) || "";
    console.log("Funnel step on login:", JSON.stringify(funnelStep));
    if (funnelStep === "funnel_complete") {
      setCompletedSteps(new Set([1, 2, 3, 4]));
      setCurrentStep(4);
      setCitaConfirmed(true);
    } else {
      const stepMatch = funnelStep.match(/^paso_(\d)$/);
      if (stepMatch) {
        const savedStep = parseInt(stepMatch[1], 10);
        const completed = new Set<number>();
        for (let i = 1; i < savedStep; i++) completed.add(i);
        setCompletedSteps(completed);
        setCurrentStep(savedStep);
      }
    }

    // Track login
    const resumedStep = funnelStep === "funnel_complete" ? 4 : parseInt(funnelStep.match(/^paso_(\d)$/)?.[1] || "1", 10);
    trackActivity(leadData, "funnel_login", null, null, { step: resumedStep, resumed_from: funnelStep || "new" });
  }

  /* ── Track activity to Supabase ── */
  async function trackActivity(
    leadData: LeadInfo,
    action: string,
    fromStage: string | null,
    toStage: string | null,
    metadata: Record<string, unknown> = {},
  ) {
    await supabase.from("lead_activity").insert({
      lead_id: leadData.id,
      user_id: leadData.user_id,
      action,
      from_stage: fromStage,
      to_stage: toStage,
      metadata,
    });
  }

  // Video timer ref (seconds watched)
  const videoStartTime = useRef<number>(0);
  const videoTrackedStart = useRef(false);

  /* ── Step labels for tracking ── */
  const STEP_LABELS = ["paso_1", "paso_2", "paso_3", "paso_4"];

  /* ── Advance step ── */
  const advanceStep = useCallback((from: number) => {
    setCompletedSteps((prev) => new Set(prev).add(from));
    setVideoProgress(0);
    setVideoCompleted(false);
    videoTrackedStart.current = false;

    const nextStep = from < 4 ? from + 1 : 4;

    // Track step completion
    if (lead) {
      const seconds = Math.round((Date.now() - videoStartTime.current) / 1000);
      trackActivity(lead, "funnel_step_complete", STEP_LABELS[from - 1], from < 4 ? STEP_LABELS[from] : null, {
        step: from,
        seconds_in_step: seconds,
      });

      // Persist progress to leads.metadata.funnel_step (via API route to bypass RLS)
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id, funnel_step: STEP_LABELS[nextStep - 1] }),
      }).then((r) => r.json()).then((res) => {
        if (res.error) console.error("Failed to save progress:", res.error);
        else console.log("Progress saved:", STEP_LABELS[nextStep - 1]);
      });
    }

    if (from < 4) setCurrentStep(nextStep);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead]);

  /* ── Video handlers ── */
  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
      if (!videoTrackedStart.current && lead) {
        videoTrackedStart.current = true;
        videoStartTime.current = Date.now();
        trackActivity(lead, "funnel_video_start", null, null, {
          step: currentStep, video: STEPS[currentStep - 1].title,
        });
      }
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }

  function handleTimeUpdate() {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setCurrentTime(v.currentTime);
    setDuration(v.duration);
    setVideoProgress(Math.round((v.currentTime / v.duration) * 100));
  }

  function handleVideoEnd() {
    setVideoCompleted(true);
    setIsPlaying(false);
    setVideoProgress(100);
    if (lead) {
      const seconds = Math.round((Date.now() - videoStartTime.current) / 1000);
      trackActivity(lead, "funnel_video_complete", null, null, {
        step: currentStep, video: STEPS[currentStep - 1].title, percent: 100, seconds_watched: seconds,
      });
    }
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * v.duration;
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  }

  function toggleFullscreen() {
    const v = videoRef.current;
    if (!v) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else v.parentElement?.requestFullscreen();
  }

  function handleMouseMove() {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => { if (isPlaying) setShowControls(false); }, 3000);
  }

  // Reset video state on step change
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setShowControls(true);
    videoTrackedStart.current = false;
  }, [currentStep]);

  /* ═══════ LOGIN SCREEN ═══════ */
  if (!authenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
        <div className="mb-10 flex flex-col items-center gap-2">
          <img src="/logo-asprofunnel.png" alt="AsproFunnel" className="h-10 w-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <h1 className="text-xl font-bold text-gray-900">AsproFunnel</h1>
        </div>

        <div className="w-full max-w-[420px] rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="mb-1 text-lg font-bold text-gray-900">Iniciá sesión</h2>
          <p className="mb-6 text-sm text-gray-500">Ingresá el email con el que te registraste</p>

          <div className="flex flex-col gap-4">
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="tu@email.com"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm text-gray-900 outline-none focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623]"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button onClick={handleLogin} disabled={loading}
              className="w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {loading ? "Verificando..." : "Iniciar sesión →"}
            </button>
          </div>
        </div>

        <p className="mt-8 text-xs text-gray-400">© 2026 AsproFunnel — A product of Nexfy LLC</p>
      </div>
    );
  }

  /* ═══════ MAIN PAGE ═══════ */
  const stepInfo = STEPS[currentStep - 1];
  const isStepCompleted = completedSteps.has(currentStep);
  const progressForPanel = currentStep === 3
    ? Math.round((Object.keys(answers).length / QUESTIONS.length) * 100)
    : videoProgress;
  const globalProgress = Math.round(((completedSteps.size * 100) + (completedSteps.has(currentStep) ? 0 : progressForPanel)) / STEPS.length);

  return (
    <div className="relative flex min-h-screen flex-col bg-gray-50">
      {/* Background crucero */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-[0.04]"
        style={{ backgroundImage: "url('/bg-cruise.jpg')" }}
      />
      {/* ── Header (sticky) ── */}
      <header className="relative sticky top-0 z-50 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        {/* Top bar */}
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-2.5 sm:px-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <img src="/logo-asprofunnel.png" alt="AsproFunnel" className="h-7 w-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span className="text-sm font-bold text-gray-900 tracking-tight">AsproFunnel</span>
          </div>

          {/* User */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-[13px] font-semibold text-gray-900">{lead?.name}</span>
              <span className="text-[11px] text-gray-400">{lead?.email}</span>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: ACCENT }}>
              {lead?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Global progress bar */}
        <div className="h-1 w-full bg-gray-200">
          <div
            className="h-full transition-all duration-700 ease-out"
            style={{
              width: `${globalProgress}%`,
              background: `linear-gradient(90deg, ${ACCENT}, #F5A623)`,
            }}
          />
        </div>
      </header>

      {/* ── Hero title ── */}
      <section className="bg-gradient-to-b from-gray-100 to-gray-50 px-4 pb-6 pt-8 sm:px-6 sm:pb-8 sm:pt-10">
        <div className="mx-auto max-w-[1200px]">
          <h1 className="text-center text-2xl font-black uppercase tracking-tight text-gray-900 sm:text-3xl lg:text-4xl">
            TU VIAJE CON INCRUISES COMIENZA AQUÍ
          </h1>
          <p className="mx-auto mt-3 max-w-[600px] text-center text-sm text-gray-500 sm:text-base">
            Completa los <strong className="text-gray-700">4 pasos</strong> antes de tu cita programada.
          </p>

          {/* Step cards */}
          <div className="mt-6 grid grid-cols-2 gap-2 sm:mt-8 sm:grid-cols-4 sm:gap-4">
            {STEPS.map((step) => {
              const done = completedSteps.has(step.num);
              const active = currentStep === step.num;
              return (
                <button
                  key={step.num}
                  onClick={() => { /* navigation blocked — steps are sequential */ }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-3 transition-all sm:gap-3 sm:px-4 sm:py-4"
                  style={{
                    backgroundColor: active ? ACCENT : done ? "#F9FAFB" : "#FFF",
                    color: active ? "#FFF" : "#374151",
                    cursor: "default",
                    boxShadow: active ? `0 4px 20px ${ACCENT}40` : "0 1px 3px rgba(0,0,0,0.06)",
                    border: active ? "none" : "1px solid #E5E7EB",
                  }}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-9 sm:w-9"
                    style={{
                      backgroundColor: done ? "#22C55E" : active ? "rgba(255,255,255,0.25)" : ACCENT,
                      color: "#FFF",
                    }}
                  >
                    {done ? <Check size={16} strokeWidth={3} /> : step.num}
                  </span>
                  <span className="text-[11px] font-semibold leading-tight sm:text-sm">{step.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Content ── */}
      <main className="flex flex-1 justify-center px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid w-full max-w-[1200px] grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-4">

          {/* LEFT: Main content */}
          <div className="col-span-1 flex flex-col lg:col-span-3">
            {/* ── STEP 1, 2, 4: Video Player ── */}
            {(currentStep === 1 || currentStep === 2 || currentStep === 4) && STEPS[currentStep - 1].video && (
              <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-black shadow-sm">
                <div
                  className="group relative aspect-video w-full cursor-pointer"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => { if (isPlaying) setShowControls(false); }}
                  onClick={togglePlay}
                >
                  {/* Video element */}
                  <video
                    ref={videoRef}
                    src={STEPS[currentStep - 1].video!}
                    className="h-full w-full object-cover"
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleVideoEnd}
                    onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration); }}
                    playsInline
                  />

                  {/* Play overlay (when paused) */}
                  {!isPlaying && !videoCompleted && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <button
                        className="flex items-center gap-3 rounded-full px-8 py-4 text-white backdrop-blur-sm transition-transform hover:scale-105"
                        style={{ backgroundColor: ACCENT }}
                      >
                        <PlayIcon size={22} fill="white" color="white" />
                        <span className="text-sm font-bold tracking-wide sm:text-base">
                          {currentTime > 0 ? "CONTINUAR VIDEO" : "REPRODUCIR VIDEO"}
                        </span>
                        <Volume2 size={18} className="ml-1 opacity-70" />
                      </button>
                    </div>
                  )}

                  {/* Bottom controls */}
                  <div
                    className="absolute bottom-0 left-0 right-0 transition-opacity duration-300"
                    style={{ opacity: showControls || !isPlaying ? 1 : 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Progress bar (no seek, no duration visible) */}
                    <div className="px-4">
                      <div className="h-1 w-full rounded-full bg-white/30">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${videoProgress}%`, backgroundColor: ACCENT }}
                        />
                      </div>
                    </div>

                    {/* Controls row */}
                    <div className="flex items-center bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-2">
                      <div className="flex-1" />

                      <button onClick={toggleMute} className="text-white/80 transition-colors hover:text-white">
                        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Advance button (shows when video completes) */}
                  {videoCompleted && currentStep < 4 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => advanceStep(currentStep)}
                        className="flex items-center gap-2 rounded-xl px-8 py-4 text-base font-bold uppercase text-white shadow-lg transition-transform hover:scale-105"
                        style={{ backgroundColor: ACCENT }}
                      >
                        AVANZA AL PASO {currentStep + 1} <ChevronRight size={20} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 4: Booking Calendar (always visible) ── */}
            {currentStep === 4 && lead && (
              <div className="mt-4">
                <BookingCalendar
                  hostUserId={lead.user_id}
                  leadId={lead.id}
                  leadName={lead.name}
                  leadEmail={lead.email}
                  leadPhone={lead.phone}
                  onBooked={(info) => {
                    setBookedInfo(info);
                    setCitaConfirmed(true);
                    setCompletedSteps((prev) => new Set(prev).add(4));
                    if (lead) {
                      trackActivity(lead, "funnel_cita_confirmed", "paso_4", null, {
                        step: 4, date: info.date, time: info.time, booking_id: info.bookingId,
                      });
                      // Mark funnel as complete (via API route to bypass RLS)
                      fetch("/api/progress", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ lead_id: lead.id, funnel_step: "funnel_complete" }),
                      }).then((r) => r.json()).then((res) => {
                        if (res.error) console.error("Failed to save funnel_complete:", res.error);
                        else console.log("Funnel complete saved");
                      });
                    }
                  }}
                />
              </div>
            )}

            {/* ── STEP 3: Questionnaire ── */}
            {currentStep === 3 && (() => {
              const currentQ = QUESTIONS[currentQuestion];
              const isOpen = !currentQ.options;
              const hasAnswer = isOpen
                ? typeof answers[currentQuestion] === "string" && (answers[currentQuestion] as string).trim().length > 0
                : answers[currentQuestion] !== undefined;

              return (
                <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
                  <span className="mb-4 text-sm font-semibold" style={{ color: ACCENT }}>
                    Pregunta {currentQuestion + 1} de {QUESTIONS.length}
                  </span>
                  <h3 className="mb-6 text-base font-bold text-gray-900 sm:text-lg" style={{ whiteSpace: "pre-line" }}>
                    {currentQ.q}
                  </h3>

                  {isOpen ? (
                    /* Open text answer */
                    <textarea
                      value={(answers[currentQuestion] as string) || ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [currentQuestion]: e.target.value }))}
                      onBlur={() => {
                        const val = (answers[currentQuestion] as string) || "";
                        if (val.trim() && lead) {
                          trackActivity(lead, "funnel_quiz_answer", null, null, {
                            step: 3, question: currentQuestion + 1, answer_text: val.trim(),
                          });
                        }
                      }}
                      placeholder="Escribe tu respuesta aquí..."
                      rows={3}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm text-gray-900 outline-none focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] resize-none"
                    />
                  ) : (
                    /* Multiple choice */
                    <div className="flex flex-col gap-3">
                      {currentQ.options!.map((opt, i) => {
                        const selected = answers[currentQuestion] === i;
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              setAnswers((prev) => ({ ...prev, [currentQuestion]: i }));
                              if (lead) trackActivity(lead, "funnel_quiz_answer", null, null, {
                                step: 3, question: currentQuestion + 1, answer: OPTION_LETTERS[i], answer_text: opt,
                              });
                            }}
                            className="flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition-all"
                            style={{
                              borderColor: selected ? ACCENT : "#E5E7EB",
                              backgroundColor: selected ? ACCENT_LIGHT : "#FFF",
                              color: "#111827",
                            }}
                          >
                            <span
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                              style={{
                                backgroundColor: selected ? ACCENT : "#F3F4F6",
                                color: selected ? "#FFF" : "#6B7280",
                              }}
                            >
                              {OPTION_LETTERS[i]}
                            </span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Nav buttons */}
                  <div className="mt-8 flex items-center justify-end gap-3">
                    {currentQuestion > 0 && (
                      <button onClick={() => setCurrentQuestion((q) => q - 1)}
                        className="flex items-center gap-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600"
                      >
                        <ChevronLeft size={14} /> ANTERIOR
                      </button>
                    )}
                    {currentQuestion < QUESTIONS.length - 1 ? (
                      <button
                        onClick={() => { if (hasAnswer) setCurrentQuestion((q) => q + 1); }}
                        disabled={!hasAnswer}
                        className="flex items-center gap-1 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                        style={{ backgroundColor: ACCENT }}
                      >
                        SIGUIENTE <ChevronRight size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (!hasAnswer) return;
                          // Save all quiz answers to metadata
                          if (lead) {
                            const quizAnswers: Record<string, string> = {};
                            for (let i = 0; i < QUESTIONS.length; i++) {
                              const a = answers[i];
                              if (a === undefined) continue;
                              const q = QUESTIONS[i];
                              quizAnswers[`p${i + 1}`] = typeof a === "string" ? a : q.options![a as number];
                            }
                            fetch("/api/progress", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ lead_id: lead.id, funnel_step: "paso_4", quiz_answers: quizAnswers }),
                            });
                          }
                          advanceStep(3);
                        }}
                        disabled={!hasAnswer}
                        className="flex items-center gap-1 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                        style={{ backgroundColor: ACCENT }}
                      >
                        AVANZA AL PASO 4 <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Step 4 video is handled by the unified player above */}

            {/* Mobile progress bar */}
            <div className="mt-4 flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 lg:hidden">
              <div className="relative flex shrink-0 items-center justify-center">
                <svg width="56" height="56" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="23" fill="none" stroke="#D4D4D8" strokeWidth="4" />
                  <circle
                    cx="28" cy="28" r="23" fill="none"
                    stroke={ACCENT} strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 23}`}
                    strokeDashoffset={`${2 * Math.PI * 23 * (1 - progressForPanel / 100)}`}
                    transform="rotate(-90 28 28)"
                    style={{ transition: "stroke-dashoffset 0.3s ease" }}
                  />
                </svg>
                <span className="absolute text-sm font-black text-gray-900">{progressForPanel}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-900">Paso {currentStep}: {stepInfo.title}</span>
                <span className="text-xs text-gray-500">
                  {isStepCompleted ? "¡Completado!" : "En Progreso"} — {globalProgress}% total
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: Progress panel (1 col, aligned with 4th step card) */}
          <div className="hidden lg:block">
            <div
              className="sticky top-24 flex flex-col items-center justify-center gap-5 rounded-2xl p-6"
              style={{
                background: `linear-gradient(135deg, ${ACCENT_LIGHT}, #FFF5F6)`,
                border: `1px solid ${ACCENT}20`,
              }}
            >
              {/* Step number badge */}
              <div className="flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white" style={{ backgroundColor: ACCENT }}>
                {currentStep}
              </div>

              {/* Step title */}
              <h3 className="text-center text-base font-black uppercase tracking-wide text-gray-900">
                {stepInfo.title}
              </h3>

              {/* Status */}
              <span className="text-sm text-gray-500">
                {isStepCompleted ? "¡Completado!" : currentStep === 4 && !citaConfirmed ? "" : "En Progreso"}
              </span>

              {/* Step 4: Appointment info */}
              {currentStep === 4 ? (
                <div className="flex flex-col items-center gap-3 w-full">
                  <h4 className="text-center text-lg font-black uppercase text-gray-900">
                    {citaConfirmed ? "¡CITA AGENDADA!" : "AGENDA TU CITA"}
                  </h4>

                  {citaConfirmed && bookedInfo ? (
                    <>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                        <Check size={24} className="text-green-600" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-gray-900 capitalize">{bookedInfo.time}</p>
                        <p className="text-xs text-gray-500 capitalize">{bookedInfo.date}</p>
                      </div>

                      <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#F5A623] py-2.5 text-xs font-medium" style={{ color: ACCENT }}>
                        <Calendar size={14} /> Agregar a tu calendario
                      </button>

                      <p className="text-center text-[11px] text-gray-400">
                        Recibirás un email de confirmación.
                      </p>
                    </>
                  ) : (
                    <>
                      <Calendar size={32} className="text-gray-300" />
                      <p className="text-center text-xs text-gray-400">
                        {videoCompleted || !STEPS[3].video
                          ? "Seleccioná fecha y hora en el calendario"
                          : "Mirá el video para desbloquear el calendario"}
                      </p>
                    </>
                  )}
                </div>
              ) : (
                /* Progress circle */
                <div className="relative mt-2 flex items-center justify-center">
                  <svg width="150" height="150" viewBox="0 0 150 150">
                    <circle cx="75" cy="75" r="62" fill="none" stroke="#D4D4D8" strokeWidth="8" />
                    <circle
                      cx="75" cy="75" r="62" fill="none"
                      stroke={ACCENT} strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 62}`}
                      strokeDashoffset={`${2 * Math.PI * 62 * (1 - progressForPanel / 100)}`}
                      transform="rotate(-90 75 75)"
                      style={{ transition: "stroke-dashoffset 0.3s ease" }}
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-3xl font-black text-gray-900">{progressForPanel}%</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      {progressForPanel >= 100 ? "¡COMPLETADO!" : "EN PROGRESO"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* ── Volume banner (only when muted) ── */}
      {(currentStep === 1 || currentStep === 2 || currentStep === 4) && isMuted && (
        <div
          onClick={toggleMute}
          className="mx-auto mb-6 flex max-w-[1200px] cursor-pointer items-center justify-center gap-3 rounded-2xl px-6 py-4 text-white transition-opacity sm:mx-6 lg:mx-auto"
          style={{ backgroundColor: "#1E293B" }}
        >
          <VolumeX size={20} />
          <span className="text-xs font-bold tracking-wide sm:text-sm">HAZ CLIC AQUÍ PARA ACTIVAR EL SONIDO</span>
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="px-4 pb-0 sm:px-6">
        {/* Coral section */}
        <div className="rounded-t-3xl px-6 py-10 sm:py-12" style={{ backgroundColor: ACCENT }}>
          <div className="mx-auto max-w-[800px]">
            {/* Disclaimer */}
            <p className="text-center text-xs leading-relaxed text-white/80 sm:text-sm">
              *Descargo de responsabilidad: Cualquier declaración de ingresos presentada no pretende ser una garantía de ingresos.
              En cambio, están diseñadas para darte una idea de lo que es posible. El éxito en este negocio requiere trabajo duro.
            </p>

            {/* Links */}
            <div className="mt-6 flex items-center justify-center gap-6 text-xs text-white/70 sm:text-sm">
              <a href="/privacy" className="font-medium underline underline-offset-2 transition-colors hover:text-white">Política de Privacidad</a>
              <a href="/terms" className="font-medium underline underline-offset-2 transition-colors hover:text-white">Términos de Uso</a>
              <a href="#" className="font-medium underline underline-offset-2 transition-colors hover:text-white">Descargo de Responsabilidad</a>
            </div>

            {/* Copyright */}
            <p className="mt-4 text-center text-[11px] text-white/50">© 2026 AsproFunnel — A product of Nexfy LLC</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
