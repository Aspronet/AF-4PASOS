"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CheckCircle, ChevronRight, ChevronLeft, Volume2, VolumeX, Play as PlayIcon, Pause, Maximize, Calendar, Check, Lock } from "lucide-react";
import BookingCalendar from "./BookingCalendar";

/* ── Step config ── */
const BUNNY_STEP_1 = "https://vz-2228bbe6-62d.b-cdn.net/70598d3a-183b-4def-ac1b-ae3d57295f2b/playlist.m3u8";
const BUNNY_STEP_2 = "https://vz-2228bbe6-62d.b-cdn.net/85af4007-1910-48ea-a73a-6b873fbba9be/playlist.m3u8";

const STEPS = [
  { num: 1, title: "Intro al Nuevo Socio", video: BUNNY_STEP_1 },
  { num: 2, title: "Requisitos de la Academia", video: BUNNY_STEP_2 },
  { num: 3, title: "Aplicación a la Academia", video: null },
  { num: 4, title: "Confirma tu Cita", video: BUNNY_STEP_1 },
];

const STEP_DETAILS: Record<number, { duration: string; description: string; bullets: string[] }> = {
  1: {
    duration: "~3 min",
    description: "Conocé por dentro el sistema y lo que vas a lograr al formar parte.",
    bullets: ["Visión general del programa", "Qué vas a recibir", "Resultados reales de socios"],
  },
  2: {
    duration: "~4 min",
    description: "Revisá el perfil y compromiso que buscamos antes de avanzar.",
    bullets: ["Nivel de dedicación semanal", "Requisitos de inscripción", "Qué NO es este sistema"],
  },
  3: {
    duration: "~5 min",
    description: "Completá 14 preguntas cortas para que podamos conocerte.",
    bullets: ["Tus objetivos", "Tu situación actual", "Tu compromiso con el proceso"],
  },
};

interface StepCopy {
  progressLabel: string;
  headline: string;
  intro: string[];
  buttonLabel?: string;
  lockedText?: string;
  unlockedText?: string;
}

const STEP_COPY: Record<number, StepCopy> = {
  1: {
    progressLabel: "Paso 1 de 4 — Evaluación en curso",
    headline: "Antes de mostrarte la Certificación, necesitas entender qué hay detrás.",
    intro: [
      "Lo que vas a ver en los próximos minutos es lo que separa a esta certificación de todo lo que hay en el mercado.",
      "No es una presentación comercial. Es una mirada por dentro al sistema que Nexfy construye para sus clientes a más de 10.000 dólares por proyecto — y que tú vas a aprender a construir, operar y monetizar.",
      "Mira el video completo. El paso 2 se desbloquea solamente cuando lo termines.",
    ],
    buttonLabel: "Desbloquear paso 2",
    lockedText: "⏳ El botón se activa cuando completes el video. Este proceso está diseñado para que llegues a la decisión final con toda la información. No hay atajos.",
    unlockedText: "Bien. Ya entiendes la oportunidad y el sistema. En el paso 2 vas a ver exactamente qué incluye la Certificación, los tres caminos de monetización y toda la información que necesitas. Es el video más importante del portal.",
  },
  2: {
    progressLabel: "Paso 2 de 4 — Evaluación en curso",
    headline: "Esto es exactamente lo que recibes. Y cómo lo conviertes en ingresos.",
    intro: [
      "Este es el video más importante del portal. Vas a ver qué incluye la Certificación módulo por módulo, los tres caminos de monetización y los ingresos que puedes generar con cada uno.",
      "Míralo completo. Lo que viene en el paso 3 depende de lo que entiendas acá.",
    ],
    buttonLabel: "Avanzar a la calificación final",
    lockedText: "⏳ El botón se activa cuando completes el video. Estás a dos pasos de poder asegurar tu lugar.",
    unlockedText: "Perfecto. Ya tienes toda la información.\n\nEn el paso 3 vas a completar un formulario de calificación final. Son preguntas sobre tu situación actual, tu intención y tu compromiso. Tus respuestas determinan si avanzas a la etapa final o no.\n\nNo hay respuestas correctas o incorrectas. Hay respuestas honestas. Y eso es lo que necesitamos para decidir si esto es para ti.\n\n⚠️ Una vez que empieces el formulario, complétalo de una sola vez. No se guarda progreso parcial.",
  },
  3: {
    progressLabel: "Paso 3 de 4 — Calificación final",
    headline: "Tus respuestas determinan si avanzas a la etapa final.",
    intro: [
      "Son 14 preguntas cortas sobre tu situación actual, tu intención y tu compromiso.",
      "No hay respuestas correctas o incorrectas. Hay respuestas honestas. Respondé con calma — cada respuesta pesa en la decisión.",
    ],
  },
  4: {
    progressLabel: "Paso 4 de 4 — Confirma tu entrevista",
    headline: "Último paso: agendá tu entrevista de selección.",
    intro: [
      "Seleccioná día y hora. Tu lugar queda reservado automáticamente y vas a recibir un email de confirmación.",
      "La entrevista es la instancia donde definimos si avanzás a la inscripción.",
    ],
  },
};

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

/* ── Accent color (Nexfy green) ── */
const ACCENT = "#4ade80";
const ACCENT_LIGHT = "rgba(74, 222, 128, 0.14)";

/* ── Sealed email storage key ── */
const SEALED_EMAIL_KEY = "nexfy4p_sealed_email";

export default function FourStepsWizard() {
  const searchParams = useSearchParams();
  const refParam = searchParams.get("ref") || "";

  const [email, setEmail] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [lead, setLead] = useState<LeadInfo | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [autoLogging, setAutoLogging] = useState(false);

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
  const maxWatchedRef = useRef(0);

  // Quiz state
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number | string>>({});

  // Step 4 state
  const [citaConfirmed, setCitaConfirmed] = useState(false);
  const [bookedInfo, setBookedInfo] = useState<{ date: string; time: string; bookingId: string } | null>(null);

  // Track completed steps
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  /* ── Sealed email: ?ref= param seals email in localStorage, auto-login ── */
  const autoLoginAttempted = useRef(false);
  useEffect(() => {
    if (autoLoginAttempted.current || authenticated) return;

    // Priority 1: ?ref= param → seal it and auto-login
    if (refParam) {
      const sealed = refParam.trim().toLowerCase();
      localStorage.setItem(SEALED_EMAIL_KEY, sealed);
      setEmail(sealed);
      setAutoLogging(true);
      autoLoginAttempted.current = true;
      return;
    }

    // Priority 2: previously sealed email in cache → auto-login
    const cached = localStorage.getItem(SEALED_EMAIL_KEY);
    if (cached) {
      setEmail(cached);
      setAutoLogging(true);
      autoLoginAttempted.current = true;
    }
  }, [refParam, authenticated]);

  // Auto-login when autoLogging is triggered
  useEffect(() => {
    if (autoLogging && email && !authenticated) {
      handleLogin(email);
      setAutoLogging(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLogging, email, authenticated]);

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
  async function handleLogin(overrideEmail?: string) {
    const loginEmail = (overrideEmail || email).trim().toLowerCase();
    if (!loginEmail) { setError("Ingresá tu email"); return; }
    setLoading(true); setError("");

    // Seal email in localStorage (immutable for the user)
    localStorage.setItem(SEALED_EMAIL_KEY, loginEmail);

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail }),
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
    if (v.currentTime > maxWatchedRef.current) maxWatchedRef.current = v.currentTime;
    setCurrentTime(v.currentTime);
    setDuration(v.duration);
    setVideoProgress(Math.round((v.currentTime / v.duration) * 100));
  }

  function handleSeeking() {
    const v = videoRef.current;
    if (!v) return;
    const tolerance = 1.5;
    if (v.currentTime > maxWatchedRef.current + tolerance) {
      v.currentTime = maxWatchedRef.current;
    }
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
    maxWatchedRef.current = 0;
  }, [currentStep]);

  /* ── HLS loader: attach hls.js for .m3u8 sources (Safari plays natively) ── */
  useEffect(() => {
    const src = STEPS[currentStep - 1]?.video;
    const v = videoRef.current;
    if (!v || !src) return;

    const isHls = src.includes(".m3u8");
    if (!isHls) {
      v.src = src;
      return;
    }

    if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = src;
      return;
    }

    let hls: import("hls.js").default | null = null;
    let cancelled = false;
    import("hls.js").then(({ default: Hls }) => {
      if (cancelled || !videoRef.current) return;
      if (!Hls.isSupported()) { videoRef.current.src = src; return; }
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(videoRef.current);
    });

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [currentStep, authenticated]);

  /* ═══════ LOGIN SCREEN ═══════ */
  const isSealed = typeof window !== "undefined" && !!localStorage.getItem(SEALED_EMAIL_KEY);

  if (!authenticated) {
    // Auto-login in progress — show loading spinner
    if (loading && isSealed) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0d10] px-4 gap-4">
          <span className="text-2xl font-black tracking-tight text-[#f5f6f8]">NEXFUNNEL</span>
          <div className="w-6 h-6 border-2 border-[#242b35] border-t-[#4ade80] rounded-full animate-spin" />
          <p className="text-sm text-[#6a7180]">Ingresando...</p>
          {error && <p className="text-sm text-[#ff6568]">{error}</p>}
        </div>
      );
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0d10] px-4 py-12">
        <div className="mb-10 flex flex-col items-center gap-2">
          <span className="text-3xl font-black tracking-tight text-[#f5f6f8]">NEXFUNNEL</span>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#6a7180]">we build what AI makes possible</p>
        </div>

        <div
          className="w-full max-w-[520px] rounded-2xl border p-8 sm:p-10"
          style={{ backgroundColor: "#12161c", borderColor: "#242b35" }}
        >
          <h1 className="mb-4 text-2xl font-bold leading-tight text-[#f5f6f8] sm:text-[28px]">
            Acceso exclusivo — Portal de Certificación Nexfy
          </h1>

          <p className="mb-4 text-sm leading-relaxed text-[#a0a8b5]">
            Tu perfil fue evaluado y aprobado. Estás entre las personas seleccionadas para acceder a este portal.
          </p>
          <p className="mb-8 text-sm leading-relaxed text-[#a0a8b5]">
            Lo que vas a ver adentro no es información pública. Es el proceso de calificación final antes de que puedas asegurar tu lugar en la{" "}
            <span className="font-semibold text-[#f5f6f8]">Certificación Profesional en Sistemas de Ventas con IA</span>.
          </p>

          <div className="flex flex-col gap-4">
            <label className="text-xs font-medium uppercase tracking-wider text-[#6a7180]">
              Ingresa el email con el que te registraste
            </label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="tu@email.com"
              className="w-full rounded-xl border px-4 py-3.5 text-sm outline-none transition-colors focus:border-[#4ade80] focus:ring-1 focus:ring-[#4ade80]"
              style={{ backgroundColor: "#171c24", borderColor: "#242b35", color: "#f5f6f8" }}
            />
            {error && <p className="text-sm text-[#ff6568]">{error}</p>}
            <button onClick={() => handleLogin()} disabled={loading}
              className="w-full rounded-xl py-3.5 text-sm font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
              style={{ backgroundColor: ACCENT, color: "#0b0d10" }}
            >
              {loading ? "Verificando..." : "Acceder al portal"}
            </button>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-[#6a7180]">
            🔒 Acceso individual. Este portal es personal e intransferible. Si compartes el enlace, tu acceso se revoca automáticamente.
          </p>
        </div>

        <p className="mt-8 text-xs text-[#6a7180]">© 2026 Nexfy LLC</p>
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
    <div className="relative flex min-h-screen flex-col bg-[#0b0d10]">
      {/* Ambient green glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(74, 222, 128, 0.06), transparent 70%)",
        }}
      />
      {/* ── Header (sticky) ── */}
      <header
        className="relative sticky top-0 z-50 border-b backdrop-blur-md"
        style={{ backgroundColor: "rgba(11, 13, 16, 0.85)", borderColor: "#242b35" }}
      >
        {/* Top bar */}
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-3 sm:px-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-black tracking-tight text-[#f5f6f8]">NEXFUNNEL</span>
            <span className="hidden sm:inline text-[10px] font-medium uppercase tracking-[0.15em] text-[#6a7180]">/ 4 pasos</span>
          </div>

          {/* User */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-[13px] font-semibold text-[#f5f6f8]">{lead?.name}</span>
              <span className="text-[11px] text-[#6a7180]">{lead?.email}</span>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold" style={{ backgroundColor: ACCENT, color: "#0b0d10" }}>
              {lead?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Global progress bar */}
        <div className="h-[2px] w-full" style={{ backgroundColor: "#242b35" }}>
          <div
            className="h-full transition-all duration-700 ease-out"
            style={{
              width: `${globalProgress}%`,
              background: `linear-gradient(90deg, ${ACCENT}, #8fffad)`,
              boxShadow: `0 0 12px ${ACCENT}`,
            }}
          />
        </div>
      </header>

      {/* ── Hero title (dynamic per-step) ── */}
      <section className="relative z-10 px-4 pb-6 pt-8 sm:px-6 sm:pb-8 sm:pt-12">
        <div className="mx-auto max-w-[1200px]">
          {STEP_COPY[currentStep] && (
            <>
              {/* Progress chip with pulse dot */}
              <div className="flex justify-center">
                <div
                  className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5"
                  style={{ borderColor: `${ACCENT}40`, backgroundColor: `${ACCENT}10` }}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ backgroundColor: ACCENT }} />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }} />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
                    {STEP_COPY[currentStep].progressLabel}
                  </span>
                </div>
              </div>

              <h1
                className="mx-auto mt-5 max-w-[1100px] text-balance text-center text-2xl font-black tracking-tight text-[#f5f6f8] sm:text-[32px] sm:leading-[1.15] lg:text-[42px] lg:leading-[1.1]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {STEP_COPY[currentStep].headline}
              </h1>
              <div
                className="mx-auto mt-5 flex flex-col gap-1.5 text-center text-[15px] leading-[1.45] text-[#a0a8b5]"
                style={{ textWrap: "pretty" }}
              >
                {STEP_COPY[currentStep].intro.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </>
          )}

          {/* Step cards — premium stepper */}
          <div className="mt-8 grid grid-cols-2 gap-2.5 sm:mt-10 sm:grid-cols-4 sm:gap-3">
            {STEPS.map((step) => {
              const done = completedSteps.has(step.num);
              const active = currentStep === step.num;
              const locked = !done && !active;
              const stateLabel = done ? "Completado" : active ? "En curso" : "Bloqueado";
              return (
                <div
                  key={step.num}
                  className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border p-3 transition-all sm:p-4"
                  style={{
                    backgroundColor: active ? "#141922" : done ? "#12161c" : "#10141a",
                    borderColor: active ? ACCENT : done ? `${ACCENT}30` : "#242b35",
                    boxShadow: active
                      ? `0 0 0 1px ${ACCENT}, 0 16px 40px -12px ${ACCENT}50`
                      : done
                      ? `0 4px 16px -4px ${ACCENT}15`
                      : "none",
                    opacity: locked ? 0.7 : 1,
                  }}
                >
                  {/* Top accent strip for active */}
                  {active && (
                    <span
                      className="absolute inset-x-0 top-0 h-[2px]"
                      style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)` }}
                    />
                  )}

                  <div className="flex items-center justify-between">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-black transition-all sm:h-9 sm:w-9 sm:text-sm"
                      style={{
                        backgroundColor: done || active ? ACCENT : "transparent",
                        color: done || active ? "#0b0d10" : "#6a7180",
                        border: locked ? "1px solid #2a3240" : "none",
                      }}
                    >
                      {done ? <Check size={16} strokeWidth={3} /> : locked ? <Lock size={12} /> : step.num}
                    </div>

                    <span
                      className="text-[9px] font-bold uppercase tracking-[0.12em] sm:text-[10px]"
                      style={{
                        color: done ? ACCENT : active ? ACCENT : "#6a7180",
                      }}
                    >
                      {stateLabel}
                    </span>
                  </div>

                  <div
                    className="text-[12px] font-semibold leading-tight sm:text-[13px]"
                    style={{ color: active ? "#f5f6f8" : done ? "#cdd1da" : "#6a7180" }}
                  >
                    {step.title}
                  </div>
                </div>
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
              <div
                className="flex flex-col overflow-hidden rounded-2xl border bg-black"
                style={{ borderColor: "#242b35", boxShadow: "0 24px 48px rgba(0,0,0,0.4)" }}
              >
                <div
                  className="group relative aspect-video w-full cursor-pointer"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => { if (isPlaying) setShowControls(false); }}
                  onClick={togglePlay}
                >
                  {/* Video element */}
                  <video
                    ref={videoRef}
                    className="h-full w-full object-cover"
                    onTimeUpdate={handleTimeUpdate}
                    onSeeking={handleSeeking}
                    onEnded={handleVideoEnd}
                    onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration); }}
                    onContextMenu={(e) => e.preventDefault()}
                    controlsList="nodownload noplaybackrate noremoteplayback"
                    disablePictureInPicture
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

                  {/* Completed badge (top-right, unobtrusive — CTA lives below) */}
                  {videoCompleted && currentStep < 4 && (
                    <div className="pointer-events-none absolute right-3 top-3">
                      <div
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md"
                        style={{ backgroundColor: `${ACCENT}25`, border: `1px solid ${ACCENT}80` }}
                      >
                        <Check size={12} strokeWidth={3} style={{ color: ACCENT }} /> Video completado
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 1 & 2: CTA block below video (locked/unlocked) ── */}
            {(currentStep === 1 || currentStep === 2) && STEP_COPY[currentStep]?.buttonLabel && (
              <div
                className="mt-4 flex flex-col items-center gap-4 rounded-2xl border p-6 sm:p-7"
                style={{ backgroundColor: "#12161c", borderColor: "#242b35" }}
              >
                {!videoCompleted ? (
                  <>
                    <p className="text-center text-sm leading-relaxed text-[#a0a8b5]">
                      {STEP_COPY[currentStep].lockedText}
                    </p>
                    <button
                      disabled
                      className="flex cursor-not-allowed items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold uppercase tracking-wider opacity-50"
                      style={{ backgroundColor: "#1c222b", color: "#6a7180", border: `1px solid #242b35` }}
                    >
                      {STEP_COPY[currentStep].buttonLabel} <ChevronRight size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => advanceStep(currentStep)}
                      className="flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-[#0b0d10] shadow-lg transition-transform hover:scale-[1.02]"
                      style={{ backgroundColor: ACCENT, boxShadow: `0 12px 32px ${ACCENT}30` }}
                    >
                      {STEP_COPY[currentStep].buttonLabel} <ChevronRight size={18} />
                    </button>
                    <p className="whitespace-pre-line text-center text-sm leading-relaxed text-[#a0a8b5]">
                      {STEP_COPY[currentStep].unlockedText}
                    </p>
                  </>
                )}
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
                <div
                  className="flex flex-col rounded-2xl border p-6 sm:p-8"
                  style={{ backgroundColor: "#12161c", borderColor: "#242b35" }}
                >
                  <span className="mb-4 text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: ACCENT }}>
                    Pregunta {currentQuestion + 1} de {QUESTIONS.length}
                  </span>
                  <h3
                    className="mb-6 text-base font-bold text-[#f5f6f8] sm:text-lg"
                    style={{ whiteSpace: "pre-line", fontFamily: "var(--font-display)" }}
                  >
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
                      className="w-full rounded-xl border px-4 py-3.5 text-sm outline-none transition-colors focus:border-[#4ade80] focus:ring-1 focus:ring-[#4ade80] resize-none"
                      style={{ backgroundColor: "#171c24", borderColor: "#242b35", color: "#f5f6f8" }}
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
                              borderColor: selected ? ACCENT : "#242b35",
                              backgroundColor: selected ? ACCENT_LIGHT : "#171c24",
                              color: selected ? "#f5f6f8" : "#cdd1da",
                            }}
                          >
                            <span
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                              style={{
                                backgroundColor: selected ? ACCENT : "#1c222b",
                                color: selected ? "#0b0d10" : "#a0a8b5",
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
                        className="flex items-center gap-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:border-[#323a46]"
                        style={{ borderColor: "#242b35", color: "#cdd1da", backgroundColor: "#171c24" }}
                      >
                        <ChevronLeft size={14} /> ANTERIOR
                      </button>
                    )}
                    {currentQuestion < QUESTIONS.length - 1 ? (
                      <button
                        onClick={() => { if (hasAnswer) setCurrentQuestion((q) => q + 1); }}
                        disabled={!hasAnswer}
                        className="flex items-center gap-1 rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
                        style={{ backgroundColor: ACCENT, color: "#0b0d10" }}
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
                        className="flex items-center gap-1 rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
                        style={{ backgroundColor: ACCENT, color: "#0b0d10" }}
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
            <div
              className="mt-4 flex items-center gap-4 rounded-xl border p-4 lg:hidden"
              style={{ backgroundColor: "#12161c", borderColor: "#242b35" }}
            >
              <div className="relative flex shrink-0 items-center justify-center">
                <svg width="56" height="56" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="23" fill="none" stroke="#242b35" strokeWidth="4" />
                  <circle
                    cx="28" cy="28" r="23" fill="none"
                    stroke={ACCENT} strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 23}`}
                    strokeDashoffset={`${2 * Math.PI * 23 * (1 - progressForPanel / 100)}`}
                    transform="rotate(-90 28 28)"
                    style={{ transition: "stroke-dashoffset 0.3s ease" }}
                  />
                </svg>
                <span className="absolute text-sm font-black text-[#f5f6f8]">{progressForPanel}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[#f5f6f8]">Paso {currentStep}: {stepInfo.title}</span>
                <span className="text-xs text-[#a0a8b5]">
                  {isStepCompleted ? "¡Completado!" : "En Progreso"} — {globalProgress}% total
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: Progress panel (fills grid cell height to match video) */}
          <div className="hidden lg:flex h-full">
            <div
              className="flex h-full w-full flex-col rounded-2xl p-5"
              style={{
                background: `linear-gradient(135deg, #12161c, #171c24)`,
                border: `1px solid #242b35`,
                boxShadow: `0 0 0 1px ${ACCENT}20, 0 24px 48px rgba(0,0,0,0.3)`,
              }}
            >
              {/* ── HEADER ── */}
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: ACCENT, color: "#0b0d10" }}>
                  {currentStep}
                </div>

                <h3
                  className="text-center text-sm font-black uppercase tracking-wide text-[#f5f6f8]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {stepInfo.title}
                </h3>

                <span className="text-[11px] text-[#a0a8b5]">
                  {isStepCompleted ? "¡Completado!" : currentStep === 4 && !citaConfirmed ? "Pendiente de agendar" : "En progreso"}
                  {currentStep !== 4 && STEP_DETAILS[currentStep] && (
                    <> · <span className="text-[#6a7180]">{STEP_DETAILS[currentStep].duration}</span></>
                  )}
                </span>
              </div>

              {/* ── MIDDLE: progress circle / step 4 visual ── */}
              <div className="flex flex-1 items-center justify-center py-3">
                {currentStep === 4 ? (
                  <div className="flex flex-col items-center gap-3">
                    <h4
                      className="text-center text-sm font-black uppercase text-[#f5f6f8]"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {citaConfirmed ? "¡CITA AGENDADA!" : "AGENDA TU CITA"}
                    </h4>

                    {citaConfirmed && bookedInfo ? (
                      <>
                        <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: ACCENT_LIGHT }}>
                          <Check size={28} style={{ color: ACCENT }} />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-[#f5f6f8] capitalize">{bookedInfo.time}</p>
                          <p className="text-xs text-[#a0a8b5] capitalize">{bookedInfo.date}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: "#171c24", border: `1px solid #242b35` }}>
                          <Calendar size={24} className="text-[#6a7180]" />
                        </div>
                        <p className="text-center text-xs text-[#a0a8b5]">
                          {videoCompleted || !STEPS[3].video
                            ? "Seleccioná fecha y hora"
                            : "Mirá el video para desbloquear"}
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="relative flex w-full items-center justify-center">
                    <svg viewBox="0 0 200 200" className="w-[min(100%,220px)] h-auto">
                      <circle cx="100" cy="100" r="86" fill="none" stroke="#242b35" strokeWidth="10" />
                      <circle
                        cx="100" cy="100" r="86" fill="none"
                        stroke={ACCENT} strokeWidth="10" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 86}`}
                        strokeDashoffset={`${2 * Math.PI * 86 * (1 - progressForPanel / 100)}`}
                        transform="rotate(-90 100 100)"
                        style={{ transition: "stroke-dashoffset 0.3s ease", filter: `drop-shadow(0 0 10px ${ACCENT}70)` }}
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-4xl font-black text-[#f5f6f8]" style={{ fontFamily: "var(--font-display)" }}>{progressForPanel}%</span>
                      <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#6a7180]">
                        {progressForPanel >= 100 ? "¡COMPLETADO!" : "En progreso"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── FOOTER: step details / booking footer ── */}
              {currentStep === 4 ? (
                citaConfirmed && bookedInfo ? (
                  <div className="flex flex-col gap-1.5 border-t border-[#242b35] pt-3">
                    <button
                      className="flex w-full items-center justify-center gap-2 rounded-xl border py-2 text-xs font-medium transition-colors hover:bg-[#171c24]"
                      style={{ borderColor: ACCENT, color: ACCENT }}
                    >
                      <Calendar size={14} /> Agregar a tu calendario
                    </button>
                    <p className="text-center text-[10px] text-[#6a7180]">
                      Recibirás un email de confirmación
                    </p>
                  </div>
                ) : (
                  <div className="border-t border-[#242b35] pt-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-[#6a7180]">Último paso</p>
                    <p className="mt-1 text-[11px] text-[#a0a8b5]">
                      Tu entrevista queda confirmada al elegir horario
                    </p>
                  </div>
                )
              ) : (
                STEP_DETAILS[currentStep] && (
                  <div className="border-t border-[#242b35] pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6a7180]">
                      En este paso
                    </p>
                    <p className="mt-1.5 text-[11px] leading-snug text-[#a0a8b5]">
                      {STEP_DETAILS[currentStep].description}
                    </p>
                    <ul className="mt-2 flex flex-col gap-1">
                      {STEP_DETAILS[currentStep].bullets.map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] text-[#a0a8b5]">
                          <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: ACCENT }} />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              )}
            </div>
          </div>

        </div>
      </main>

      {/* ── Volume banner (only when muted) ── */}
      {(currentStep === 1 || currentStep === 2 || currentStep === 4) && isMuted && (
        <div
          onClick={toggleMute}
          className="mx-auto mb-6 flex max-w-[1200px] cursor-pointer items-center justify-center gap-3 rounded-2xl border px-6 py-4 transition-colors hover:bg-[#1c222b] sm:mx-6 lg:mx-auto"
          style={{ backgroundColor: "#171c24", borderColor: "#242b35", color: ACCENT }}
        >
          <VolumeX size={20} />
          <span className="text-xs font-bold tracking-wide sm:text-sm">HAZ CLIC AQUÍ PARA ACTIVAR EL SONIDO</span>
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="relative z-10 px-4 pb-0 sm:px-6">
        <div
          className="rounded-t-3xl border-t border-x px-6 py-10 sm:py-12"
          style={{ backgroundColor: "#12161c", borderColor: "#242b35" }}
        >
          <div className="mx-auto max-w-[800px]">
            <div className="mb-6 flex flex-col items-center gap-2">
              <span className="text-xl font-black tracking-tight text-[#f5f6f8]">NEXFUNNEL</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#6a7180]">we build what AI makes possible</span>
            </div>

            {/* Disclaimer */}
            <p className="text-center text-xs leading-relaxed text-[#a0a8b5] sm:text-sm">
              *Descargo de responsabilidad: Cualquier declaración de ingresos presentada no pretende ser una garantía de ingresos.
              En cambio, están diseñadas para darte una idea de lo que es posible. El éxito en este negocio requiere trabajo duro.
            </p>

            {/* Links */}
            <div className="mt-6 flex items-center justify-center gap-6 text-xs text-[#cdd1da] sm:text-sm">
              <a href="/privacy" className="font-medium transition-colors hover:text-[#4ade80]">Política de Privacidad</a>
              <a href="/terms" className="font-medium transition-colors hover:text-[#4ade80]">Términos de Uso</a>
              <a href="#" className="font-medium transition-colors hover:text-[#4ade80]">Descargo de Responsabilidad</a>
            </div>

            {/* Copyright */}
            <p className="mt-4 text-center text-[11px] text-[#6a7180]">© 2026 Nexfy LLC</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
