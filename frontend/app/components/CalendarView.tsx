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
}

// --- Constants ---

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const DAY_NAMES_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const HOURS = Array.from({ length: 18 }, (_, i) => i + 7); // 7..24

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
  // Monday = 0 ... Sunday = 6
  let startDow = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startDow);

  const days: Date[] = [];
  const current = new Date(start);
  // Always render 6 rows (42 cells) so the grid doesn't jump
  for (let i = 0; i < 42; i++) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

/** Returns the 7 days of the week containing `refDate`, starting Monday. */
function getWeekDays(refDate: Date): Date[] {
  const dow = (refDate.getDay() + 6) % 7;
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() - dow);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatWeekRange(days: Date[]): string {
  const first = days[0];
  const last = days[6];
  const fd = first.getDate();
  const fm = MONTH_NAMES[first.getMonth()];
  const ld = last.getDate();
  const lm = MONTH_NAMES[last.getMonth()];
  if (first.getMonth() === last.getMonth()) {
    return `${fd} – ${ld} ${fm} ${first.getFullYear()}`;
  }
  return `${fd} ${fm} – ${ld} ${lm} ${last.getFullYear()}`;
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
}: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
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
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const nextMonth = () => {
    setDisplayedMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const prevWeek = () => {
    const d = parseDate(selectedDate);
    d.setDate(d.getDate() - 7);
    onSelectDate(formatDate(d));
  };

  const nextWeek = () => {
    const d = parseDate(selectedDate);
    d.setDate(d.getDate() + 7);
    onSelectDate(formatDate(d));
  };

  // --- Block helpers for a given date ---
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
  const renderMonthView = () => {
    const days = getMonthDays(displayedMonth.year, displayedMonth.month);

    return (
      <div>
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
        <div className="grid grid-cols-7 gap-px bg-zinc-800 border border-zinc-800 rounded-lg overflow-hidden">
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
                  relative min-h-[60px] p-1 cursor-pointer transition-colors
                  ${isCurrentMonth ? "bg-zinc-900" : "bg-zinc-900/50"}
                  ${isSelected ? "ring-1 ring-zinc-500 z-10" : ""}
                  ${fullyBlocked ? "bg-red-950/40" : "hover:bg-zinc-800"}
                `}
                onClick={() => onSelectDate(dateStr)}
              >
                {/* Day number */}
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

                  {/* Block button on hover */}
                  {isCurrentMonth && (
                    <button
                      className="opacity-0 group-hover:opacity-100 hover:!opacity-100 text-zinc-500 hover:text-red-400 transition-opacity"
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

                {/* Reservation summary */}
                {summary && summary.reservationCount > 0 && !fullyBlocked && (
                  <div className="mt-0.5 space-y-0">
                    {summary.services && summary.services.length > 0 ? (
                      summary.services.map((svc) => (
                        <div key={svc.name} className="text-[8px] text-zinc-400 leading-tight truncate">
                          <span className="text-zinc-500">{svc.name}</span>{" "}
                          {svc.reservationCount}r · {svc.coverCount}c
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

                {/* Delete block buttons */}
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
      </div>
    );
  };

  // =================== WEEK VIEW ===================
  const renderWeekView = () => {
    const refDate = parseDate(selectedDate);
    const weekDays = getWeekDays(refDate);

    return (
      <div>
        {/* Week header */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevWeek} className="p-1 text-zinc-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-white">{formatWeekRange(weekDays)}</span>
          <button onClick={nextWeek} className="p-1 text-zinc-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day columns header */}
        <div className="grid grid-cols-[48px_repeat(7,1fr)] border border-zinc-800 rounded-t-lg overflow-hidden">
          <div className="bg-zinc-800 p-1" />
          {weekDays.map((day, idx) => {
            const dateStr = formatDate(day);
            const isSelected = isSameDay(dateStr, selectedDate);
            const isToday = isSameDay(dateStr, todayStr);
            return (
              <div
                key={idx}
                className={`
                  bg-zinc-800 p-1 text-center cursor-pointer border-l border-zinc-700
                  ${isSelected ? "bg-zinc-700" : "hover:bg-zinc-700/50"}
                `}
                onClick={() => onSelectDate(dateStr)}
              >
                <div className="text-[10px] text-zinc-400">{DAY_NAMES_SHORT[idx]}</div>
                <div
                  className={`
                    text-xs font-medium
                    ${isToday ? "bg-white text-zinc-900 rounded-full w-5 h-5 flex items-center justify-center mx-auto" : "text-zinc-200"}
                  `}
                >
                  {day.getDate()}
                </div>
                {(() => {
                  const s = summaryMap.get(dateStr);
                  if (!s || s.reservationCount === 0) return null;
                  return (
                    <div className="mt-0.5 space-y-0">
                      {s.services && s.services.length > 0 ? (
                        s.services.map((svc) => (
                          <div key={svc.name} className="text-[7px] text-zinc-400 leading-tight truncate">
                            <span className="text-zinc-500">{svc.name[0]}</span> {svc.reservationCount}r·{svc.coverCount}c
                          </div>
                        ))
                      ) : (
                        <div className="text-[7px] text-zinc-400">{s.reservationCount}r·{s.coverCount}c</div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="border border-t-0 border-zinc-800 rounded-b-lg overflow-hidden max-h-[400px] overflow-y-auto">
          {HOURS.map((hour) => (
            <div key={hour} className="grid grid-cols-[48px_repeat(7,1fr)] border-t border-zinc-800">
              <div className="text-[10px] text-zinc-500 p-1 text-right pr-2 bg-zinc-900">
                {String(hour === 24 ? 0 : hour).padStart(2, "0")}:00
              </div>
              {weekDays.map((day, dayIdx) => {
                const dateStr = formatDate(day);
                const fullyBlocked = isDayFullyBlocked(dateStr);
                const serviceBlocks = getServiceBlocks(dateStr);
                const isMidiHour = hour >= 11 && hour < 15;
                const isSoirHour = hour >= 18 && hour <= 23;
                const midiBlocked = serviceBlocks.some((b) => b.service === "midi");
                const soirBlocked = serviceBlocks.some((b) => b.service === "soir");
                const isBlockedSlot =
                  fullyBlocked ||
                  (isMidiHour && midiBlocked) ||
                  (isSoirHour && soirBlocked);
                const isSelected = isSameDay(dateStr, selectedDate);

                return (
                  <div
                    key={dayIdx}
                    className={`
                      h-7 border-l border-zinc-800 transition-colors
                      ${isBlockedSlot ? "bg-red-950/40" : ""}
                      ${isSelected && !isBlockedSlot ? "bg-zinc-800/50" : ""}
                    `}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // =================== RENDER ===================
  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3">
      {/* View toggle */}
      <div className="flex gap-1 mb-3">
        <button
          className={`text-xs px-3 py-1 rounded ${
            viewMode === "month"
              ? "bg-zinc-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          }`}
          onClick={() => setViewMode("month")}
        >
          Mois
        </button>
        <button
          className={`text-xs px-3 py-1 rounded ${
            viewMode === "week"
              ? "bg-zinc-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          }`}
          onClick={() => setViewMode("week")}
        >
          Semaine
        </button>
      </div>

      {/* Calendar content */}
      {viewMode === "month" ? renderMonthView() : renderWeekView()}

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
