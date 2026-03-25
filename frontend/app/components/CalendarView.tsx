"use client";

import { useState, useMemo } from "react";

// --- Types ---

interface ServiceSummary {
  name: string;
  reservationCount: number;
  coverCount: number;
}

interface DaySummary {
  date: string;
  reservationCount: number;
  coverCount: number;
  services?: ServiceSummary[];
}

interface ReservationBlock {
  id: string;
  restaurant_id: string;
  date: string;
  service: string | null;
  reason: string | null;
  created_at?: string;
}

interface CalendarViewProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  daySummaries: DaySummary[];
  blocks: ReservationBlock[];
  onCreateBlock: (date: string, service: string | null, reason: string | null) => void;
  onDeleteBlock: (blockId: string) => void;
  onMonthChange?: (month: string) => void; // "YYYY-MM"
}

// --- Constants ---

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const DAY_NAMES_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// --- Helpers ---

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isSameDay(a: string, b: string): boolean {
  return a === b;
}

function formatMonthYear(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

/** Returns all day-dates to display in a month grid (includes padding from prev/next months). */
function getMonthDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  let startDow = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startDow);

  const days: Date[] = [];
  const current = new Date(start);
  for (let i = 0; i < 42; i++) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

// --- Sub-components ---

function BlockModal({
  date,
  onClose,
  onCreateBlock,
}: {
  date: string;
  onClose: () => void;
  onCreateBlock: (date: string, service: string | null, reason: string | null) => void;
}) {
  const [service, setService] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    onCreateBlock(date, service, reason.trim() || null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 w-80 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-white">Bloquer le {parseDate(date).getDate()}/{parseDate(date).getMonth() + 1}</h3>

        <div className="flex gap-2">
          <button
            className={`flex-1 text-xs py-1.5 rounded border ${
              service === null
                ? "bg-red-600 border-red-500 text-white"
                : "border-zinc-600 text-zinc-300 hover:bg-zinc-700"
            }`}
            onClick={() => setService(null)}
          >
            Jour entier
          </button>
          <button
            className={`flex-1 text-xs py-1.5 rounded border ${
              service === "midi"
                ? "bg-red-600 border-red-500 text-white"
                : "border-zinc-600 text-zinc-300 hover:bg-zinc-700"
            }`}
            onClick={() => setService("midi")}
          >
            Midi
          </button>
          <button
            className={`flex-1 text-xs py-1.5 rounded border ${
              service === "soir"
                ? "bg-red-600 border-red-500 text-white"
                : "border-zinc-600 text-zinc-300 hover:bg-zinc-700"
            }`}
            onClick={() => setService("soir")}
          >
            Soir
          </button>
        </div>

        <input
          type="text"
          placeholder="Raison (optionnel)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-600 rounded px-2 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400"
        />

        <div className="flex gap-2 justify-end">
          <button
            className="text-xs px-3 py-1.5 rounded border border-zinc-600 text-zinc-300 hover:bg-zinc-700"
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700"
            onClick={handleSubmit}
          >
            Bloquer
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function CalendarView({
  selectedDate,
  onSelectDate,
  daySummaries,
  blocks,
  onCreateBlock,
  onDeleteBlock,
  onMonthChange,
}: CalendarViewProps) {
  const [displayedMonth, setDisplayedMonth] = useState(() => {
    const d = parseDate(selectedDate);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [blockModalDate, setBlockModalDate] = useState<string | null>(null);

  const todayStr = formatDate(new Date());

  // Index summaries & blocks by date for O(1) lookup
  const summaryMap = useMemo(() => {
    const map: Record<string, DaySummary> = {};
    for (const s of daySummaries) map[s.date] = s;
    return map;
  }, [daySummaries]);

  const blocksByDate = useMemo(() => {
    const map: Record<string, ReservationBlock[]> = {};
    for (const b of blocks) {
      if (!map[b.date]) map[b.date] = [];
      map[b.date].push(b);
    }
    return map;
  }, [blocks]);

  // Navigation
  const prevMonth = () => {
    setDisplayedMonth((prev) => {
      const next = prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 };
      onMonthChange?.(`${next.year}-${String(next.month + 1).padStart(2, "0")}`);
      return next;
    });
  };

  const nextMonth = () => {
    setDisplayedMonth((prev) => {
      const next = prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 };
      onMonthChange?.(`${next.year}-${String(next.month + 1).padStart(2, "0")}`);
      return next;
    });
  };

  // --- Block helpers ---
  const isDayFullyBlocked = (dateStr: string) => {
    const dayBlocks = blocksByDate[dateStr];
    if (!dayBlocks) return false;
    return dayBlocks.some((b) => b.service === null);
  };

  const getServiceBlocks = (dateStr: string) => {
    return (blocksByDate[dateStr] || []).filter((b) => b.service !== null);
  };

  const getAllBlocks = (dateStr: string) => {
    return blocksByDate[dateStr] || [];
  };

  // =================== MONTH VIEW ===================
  const days = getMonthDays(displayedMonth.year, displayedMonth.month);

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 flex flex-col flex-1">
      {/* Month header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1 text-zinc-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-white">
          {formatMonthYear(displayedMonth.year, displayedMonth.month)}
        </span>
        <button onClick={nextMonth} className="p-1 text-zinc-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES_SHORT.map((name) => (
          <div key={name} className="text-center text-[10px] font-medium text-zinc-500 py-1">
            {name}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px bg-zinc-800 border border-zinc-800 rounded-lg overflow-hidden flex-1">
        {days.map((day, idx) => {
          const dateStr = formatDate(day);
          const isCurrentMonth = day.getMonth() === displayedMonth.month;
          const isSelected = isSameDay(dateStr, selectedDate);
          const isToday = isSameDay(dateStr, todayStr);
          const summary = summaryMap[dateStr];
          const fullyBlocked = isDayFullyBlocked(dateStr);
          const serviceBlocks = getServiceBlocks(dateStr);
          const dayAllBlocks = getAllBlocks(dateStr);

          return (
            <div
              key={idx}
              className={`
                relative min-h-[70px] p-1.5 cursor-pointer transition-colors group
                ${isCurrentMonth ? "bg-zinc-900" : "bg-zinc-900/50"}
                ${isSelected ? "ring-1 ring-zinc-500 z-10" : ""}
                ${fullyBlocked ? "bg-red-950/40" : "hover:bg-zinc-800"}
              `}
              onClick={() => onSelectDate(dateStr)}
            >
              {/* Day number + block button */}
              <div className="flex items-center justify-between">
                <span
                  className={`
                    text-xs font-medium leading-none
                    ${!isCurrentMonth ? "text-zinc-600" : fullyBlocked ? "text-red-400 line-through" : "text-zinc-300"}
                    ${isToday ? "bg-white text-zinc-900 rounded-full w-5 h-5 flex items-center justify-center text-[10px]" : ""}
                  `}
                >
                  {day.getDate()}
                </span>

                {isCurrentMonth && (
                  <button
                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-opacity"
                    style={{ opacity: isSelected ? 1 : undefined }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setBlockModalDate(dateStr);
                    }}
                    title="Bloquer"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Reservation summary per service */}
              {summary && summary.reservationCount > 0 && !fullyBlocked && (
                <div className="mt-1 space-y-0.5">
                  {summary.services && summary.services.length > 0 ? (
                    summary.services.map((svc) => (
                      <div key={svc.name} className="text-[9px] leading-tight truncate">
                        <span className="text-zinc-500 font-medium">{svc.name}</span>{" "}
                        <span className="text-zinc-400">{svc.reservationCount} résa · {svc.coverCount} couv.</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-[9px] text-zinc-400 leading-tight truncate">
                      {summary.reservationCount} résa · {summary.coverCount} couv.
                    </div>
                  )}
                </div>
              )}

              {/* Service block indicators */}
              {serviceBlocks.length > 0 && !fullyBlocked && (
                <div className="mt-0.5 flex gap-0.5">
                  {serviceBlocks.map((b) => (
                    <span
                      key={b.id}
                      className="text-[8px] bg-red-900/60 text-red-300 rounded px-0.5"
                      title={`${b.service}${b.reason ? ` — ${b.reason}` : ""}`}
                    >
                      {b.service === "midi" ? "M" : "S"}
                    </span>
                  ))}
                </div>
              )}

              {/* Delete block buttons (visible when day is selected) */}
              {isSelected && dayAllBlocks.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {dayAllBlocks.map((b) => (
                    <div key={b.id} className="flex items-center gap-0.5">
                      <span className="text-[8px] text-red-400 truncate flex-1">
                        {b.service === null ? "Bloqué" : b.service}
                      </span>
                      <button
                        className="text-red-400 hover:text-red-300 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteBlock(b.id);
                        }}
                        title="Supprimer le blocage"
                      >
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Block creation modal */}
      {blockModalDate && (
        <BlockModal
          date={blockModalDate}
          onClose={() => setBlockModalDate(null)}
          onCreateBlock={onCreateBlock}
        />
      )}
    </div>
  );
}
