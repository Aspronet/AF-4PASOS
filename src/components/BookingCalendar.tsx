"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { ChevronLeft, ChevronRight, Clock, Check, CalendarDays, Loader2 } from "lucide-react";

/* ── Types ── */
interface AvailabilitySchedule {
  id: string;
  user_id: string;
  day_of_week: number; // 0=Monday … 6=Sunday (DB convention)
  start_time: string;  // "HH:MM:SS"
  end_time: string;
  is_active: boolean;
}

interface BookingLink {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  buffer_minutes: number;
  timezone: string;
  is_active: boolean;
  accent_color: string;
  welcome_message: string | null;
}

interface ExistingBooking {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
}

interface TimeSlot {
  time: string;   // "HH:MM"
  label: string;  // "10:30 AM"
  available: boolean;
}

interface BookingCalendarProps {
  hostUserId: string;
  leadId: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  accentColor?: string;
  onBooked: (booking: { date: string; time: string; bookingId: string }) => void;
}

/* ── Constants ── */
const DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/* ── Helpers ── */
function formatTimeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function jsDayToDbDay(jsDay: number): number {
  // JS: 0=Sun,1=Mon…6=Sat → DB: 0=Mon…6=Sun
  return jsDay === 0 ? 6 : jsDay - 1;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function formatDateES(date: Date): string {
  const day = date.getDate();
  const month = MONTHS_ES[date.getMonth()].toLowerCase();
  const year = date.getFullYear();
  const weekday = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][date.getDay()];
  return `${weekday} ${day} de ${month}, ${year}`;
}

export default function BookingCalendar({
  hostUserId,
  leadId,
  leadName,
  leadEmail,
  leadPhone,
  accentColor = "#E8920D",
  onBooked,
}: BookingCalendarProps) {
  const [loading, setLoading] = useState(true);
  const [bookingLink, setBookingLink] = useState<BookingLink | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySchedule[]>([]);
  const [existingBookings, setExistingBookings] = useState<ExistingBooking[]>([]);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  /* ── Fetch data on mount ── */
  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // Fetch booking link for this host
      const { data: links } = await supabase
        .from("booking_links")
        .select("*")
        .eq("user_id", hostUserId)
        .eq("is_active", true)
        .limit(1);

      const link = links?.[0] || null;
      setBookingLink(link);

      // Fetch availability schedules
      const { data: avail } = await supabase
        .from("availability_schedules")
        .select("*")
        .eq("user_id", hostUserId)
        .eq("is_active", true);

      setAvailability(avail || []);

      // Fetch ALL existing bookings for this host (across all booking links)
      // so that a booking on any link blocks the same time on all other links
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, scheduled_at, duration_minutes, status")
        .eq("user_id", hostUserId)
        .neq("status", "cancelled")
        .gte("scheduled_at", new Date().toISOString());

      setExistingBookings(bookings || []);

      setLoading(false);
    }

    fetchData();
  }, [hostUserId]);

  /* ── Get available days for a given month ── */
  const getAvailableDays = useCallback((): Set<number> => {
    const days = new Set<number>();
    if (!availability.length) return days;

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      if (date < today) continue; // Skip past dates

      const dbDay = jsDayToDbDay(date.getDay());
      const hasAvail = availability.some((a) => a.day_of_week === dbDay);
      if (hasAvail) days.add(d);
    }

    return days;
  }, [availability, currentMonth]);

  /* ── Generate time slots for selected date ── */
  const getTimeSlots = useCallback((): TimeSlot[] => {
    if (!selectedDate || !bookingLink) return [];

    const dbDay = jsDayToDbDay(selectedDate.getDay());
    const dayAvail = availability.filter((a) => a.day_of_week === dbDay);

    if (!dayAvail.length) return [];

    const slots: TimeSlot[] = [];
    const duration = bookingLink.duration_minutes;
    const buffer = bookingLink.buffer_minutes;
    const now = new Date();
    const isToday = isSameDay(selectedDate, now);

    for (const sched of dayAvail) {
      const [startH, startM] = sched.start_time.split(":").map(Number);
      const [endH, endM] = sched.end_time.split(":").map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      for (let m = startMinutes; m + duration <= endMinutes; m += duration + buffer) {
        const slotH = Math.floor(m / 60);
        const slotM = m % 60;
        const timeStr = `${slotH.toString().padStart(2, "0")}:${slotM.toString().padStart(2, "0")}`;

        // Skip past slots if today
        if (isToday) {
          const slotDate = new Date(selectedDate);
          slotDate.setHours(slotH, slotM, 0, 0);
          if (slotDate <= now) continue;
        }

        // Check if slot is already booked
        const slotStart = new Date(selectedDate);
        slotStart.setHours(slotH, slotM, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + duration * 60000);

        const isBooked = existingBookings.some((b) => {
          const bStart = new Date(b.scheduled_at);
          const bEnd = new Date(bStart.getTime() + b.duration_minutes * 60000);
          return slotStart < bEnd && slotEnd > bStart;
        });

        slots.push({
          time: timeStr,
          label: formatTimeLabel(timeStr),
          available: !isBooked,
        });
      }
    }

    return slots;
  }, [selectedDate, bookingLink, availability, existingBookings]);

  /* ── Confirm booking ── */
  async function handleConfirm() {
    if (!selectedDate || !selectedSlot || !bookingLink) return;

    setConfirming(true);
    setError("");

    const [h, m] = selectedSlot.split(":").map(Number);
    const scheduledAt = new Date(selectedDate);
    scheduledAt.setHours(h, m, 0, 0);

    const res = await fetch("/api/booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        booking_link_id: bookingLink.id,
        user_id: hostUserId,
        lead_name: leadName,
        lead_email: leadEmail,
        lead_phone: leadPhone,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: bookingLink.duration_minutes,
        timezone: bookingLink.timezone,
        lead_id: leadId,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Booking error:", data.error);
      setError("Error al agendar. Intentá de nuevo.");
      setConfirming(false);
      return;
    }

    setConfirmed(true);
    setConfirming(false);

    onBooked({
      date: formatDateES(selectedDate),
      time: formatTimeLabel(selectedSlot),
      bookingId: data.id,
    });
  }

  /* ── Calendar grid ── */
  const availableDays = getAvailableDays();
  const timeSlots = getTimeSlots();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  // Adjust to Monday start: Mon=0, Tue=1, …, Sun=6
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isCurrentMonth = currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear();

  function prevMonth() {
    const prev = new Date(year, month - 1, 1);
    if (prev >= new Date(today.getFullYear(), today.getMonth(), 1)) {
      setCurrentMonth(prev);
      setSelectedDate(null);
      setSelectedSlot(null);
    }
  }

  function nextMonth() {
    setCurrentMonth(new Date(year, month + 1, 1));
    setSelectedDate(null);
    setSelectedSlot(null);
  }

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white p-12">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  /* ── No availability configured ── */
  if (!bookingLink || !availability.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white p-8 text-center">
        <CalendarDays size={40} className="text-gray-300" />
        <p className="text-sm text-gray-500">No hay horarios disponibles por el momento.</p>
      </div>
    );
  }

  /* ── Confirmed state ── */
  if (confirmed && selectedDate && selectedSlot) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-gray-200 bg-white p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: `${accentColor}20` }}>
          <Check size={32} style={{ color: accentColor }} />
        </div>
        <h3 className="text-lg font-bold text-gray-900">¡Cita Confirmada!</h3>
        <div className="text-sm text-gray-600">
          <p className="font-semibold capitalize">{formatDateES(selectedDate)}</p>
          <p>{formatTimeLabel(selectedSlot)} — {bookingLink.duration_minutes} min</p>
        </div>
        <p className="text-xs text-gray-400">Recibirás un email de confirmación a {leadEmail}</p>
      </div>
    );
  }

  /* ── Calendar + Slots ── */
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      {/* Title */}
      <div className="flex items-center gap-2">
        <CalendarDays size={20} style={{ color: accentColor }} />
        <h3 className="text-base font-bold text-gray-900">Seleccioná fecha y hora</h3>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        {/* ── Calendar Grid ── */}
        <div className="flex-1">
          {/* Month nav */}
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={prevMonth}
              disabled={isCurrentMonth}
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-bold text-gray-900 capitalize">
              {MONTHS_ES[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day headers */}
          <div className="mb-1 grid grid-cols-7 gap-1">
            {DAYS_ES.map((d) => (
              <div key={d} className="py-1 text-center text-[11px] font-semibold uppercase text-gray-400">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for offset */}
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const date = new Date(year, month, day);
              const isPast = date < today;
              const hasAvail = availableDays.has(day);
              const isSelected = selectedDate && isSameDay(selectedDate, date);
              const isToday2 = isSameDay(date, today);

              return (
                <button
                  key={day}
                  onClick={() => {
                    if (hasAvail && !isPast) {
                      setSelectedDate(date);
                      setSelectedSlot(null);
                    }
                  }}
                  disabled={!hasAvail || isPast}
                  className="flex aspect-square items-center justify-center rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: isSelected ? accentColor : undefined,
                    color: isSelected ? "#FFF" : isPast || !hasAvail ? "#D1D5DB" : "#111827",
                    border: isToday2 && !isSelected ? `2px solid ${accentColor}` : "2px solid transparent",
                    cursor: hasAvail && !isPast ? "pointer" : "default",
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Time Slots ── */}
        <div className="flex-1 lg:max-w-[240px]">
          {selectedDate ? (
            <div className="flex flex-col gap-2">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 capitalize">
                {formatDateES(selectedDate)}
              </p>

              {timeSlots.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No hay horarios disponibles</p>
              ) : (
                <div className="flex max-h-[280px] flex-col gap-1.5 overflow-y-auto pr-1">
                  {timeSlots.filter((s) => s.available).map((slot) => {
                    const isActive = selectedSlot === slot.time;
                    return (
                      <button
                        key={slot.time}
                        onClick={() => setSelectedSlot(slot.time)}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all"
                        style={{
                          borderColor: isActive ? accentColor : "#E5E7EB",
                          backgroundColor: isActive ? `${accentColor}15` : "#FFF",
                          color: isActive ? accentColor : "#374151",
                        }}
                      >
                        <Clock size={14} className="shrink-0 opacity-60" />
                        {slot.label}
                        {isActive && <Check size={14} className="ml-auto" style={{ color: accentColor }} />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Confirm button */}
              {selectedSlot && (
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all disabled:opacity-60"
                  style={{ backgroundColor: accentColor }}
                >
                  {confirming ? (
                    <><Loader2 size={16} className="animate-spin" /> Agendando...</>
                  ) : (
                    <>Confirmar — {formatTimeLabel(selectedSlot)}</>
                  )}
                </button>
              )}

              {error && <p className="text-center text-xs text-red-500">{error}</p>}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <Clock size={28} className="text-gray-300" />
              <p className="text-sm text-gray-400">Seleccioná un día para ver los horarios disponibles</p>
            </div>
          )}
        </div>
      </div>

      {/* Duration info */}
      <div className="flex items-center gap-2 border-t border-gray-100 pt-3 text-xs text-gray-400">
        <Clock size={12} />
        <span>Duración: {bookingLink.duration_minutes} min</span>
        <span className="mx-1">•</span>
        <span>{bookingLink.timezone}</span>
      </div>
    </div>
  );
}
