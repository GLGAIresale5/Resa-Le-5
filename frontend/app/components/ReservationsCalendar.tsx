"use client";

import { useMemo, useState } from "react";
import { Reservation } from "../types";

interface Props {
  reservations: Reservation[];
  onEdit: (res: Reservation) => void;
  onAdd: (date: string) => void;
}

const WEEKDAY_HEADERS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const SOURCE_ICON: Record<string, string> = {
  phone: "📞",
  manual: "✏️",
  google: "🔍",
  instagram: "📸",
  facebook: "👥",
  web: "🌐",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function ReservationsCalendar({ reservations, onEdit, onAdd }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Résas actives groupées par jour, triées par heure
  const byDay = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of reservations) {
      if (r.status === "cancelled") continue;
      const arr = map.get(r.date) ?? [];
      arr.push(r);
      map.set(r.date, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.time.localeCompare(b.time));
    return map;
  }, [reservations]);

  // Grille du mois, lundi en premier
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // 0 = lundi
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${year}-${pad(month + 1)}-${pad(d)}`);

  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  function prevMonth() {
    if (month === 0) { setYear(year - 1); setMonth(11); } else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(year + 1); setMonth(0); } else setMonth(month + 1);
  }

  const dayRes = selectedDay ? (byDay.get(selectedDay) ?? []) : [];
  const dayCovers = dayRes.reduce((s, r) => s + r.guest_count, 0);

  return (
    <div className="mx-auto w-full max-w-md px-3 md:px-6 py-4 pb-10">
      {/* En-tête mois */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} aria-label="Mois précédent" className="h-9 w-9 flex items-center justify-center rounded bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500">‹</button>
        <div className="text-sm font-semibold capitalize">{MONTHS[month]} {year}</div>
        <button onClick={nextMonth} aria-label="Mois suivant" className="h-9 w-9 flex items-center justify-center rounded bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500">›</button>
      </div>

      {/* Jours de la semaine */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_HEADERS.map((w, i) => (
          <div key={i} className="text-center text-[11px] text-zinc-500 py-1">{w}</div>
        ))}
      </div>

      {/* Grille */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const n = byDay.get(date)?.length ?? 0;
          const dayNum = Number(date.slice(-2));
          const isToday = date === todayStr;
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(date)}
              aria-label={`${dayNum} ${MONTHS[month]}${n > 0 ? `, ${n} réservation${n > 1 ? "s" : ""}` : ""}`}
              className={`aspect-square rounded-md flex flex-col items-center justify-center gap-0.5 transition-colors border bg-zinc-800/60 border-zinc-700/60 hover:border-zinc-500 ${
                isToday ? "ring-1 ring-white/60" : ""
              }`}
            >
              <span className={`text-sm leading-none ${n > 0 ? "text-white font-medium" : "text-zinc-400"}`}>{dayNum}</span>
              {n > 0 ? (
                <span className="min-w-[18px] px-1 rounded-full bg-emerald-500/25 text-emerald-300 text-[10px] font-medium leading-4">{n}</span>
              ) : (
                <span className="h-4" />
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-zinc-500 mt-3">
        Le nombre de réservations s'affiche sous chaque jour. Touche un jour pour le détail ou pour ajouter.
      </p>

      {/* Panneau jour sélectionné */}
      {selectedDay && (
        <div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 px-4 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-4 pt-4"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="w-full max-w-sm max-h-[75vh] overflow-y-auto overscroll-contain bg-zinc-900 border border-zinc-700 rounded-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 p-4 pb-3 border-b border-zinc-800 sticky top-0 bg-zinc-900 rounded-t-2xl">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold capitalize truncate">
                  {new Date(selectedDay + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {dayRes.length === 0
                    ? "Aucune réservation"
                    : `${dayRes.length} résa${dayRes.length > 1 ? "s" : ""} · ${dayCovers} couvert${dayCovers > 1 ? "s" : ""}`}
                </p>
              </div>
              <button onClick={() => setSelectedDay(null)} aria-label="Fermer" className="shrink-0 h-8 w-8 flex items-center justify-center rounded text-zinc-500 hover:text-white text-sm">✕</button>
            </div>

            {dayRes.length > 0 && (
              <div className="divide-y divide-zinc-800">
                {dayRes.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => { setSelectedDay(null); onEdit(r); }}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-800/50 active:bg-zinc-800/70 transition-colors"
                  >
                    <div className="w-12 shrink-0 text-sm font-medium text-zinc-400">{r.time?.slice(0, 5)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">{r.guest_name}</span>
                        <span className="text-xs shrink-0">{SOURCE_ICON[r.source] ?? ""}</span>
                      </div>
                      <div className="text-xs text-zinc-400 truncate mt-0.5">
                        {r.guest_count} pers.
                        {r.table_label ? ` · ${r.table_label}` : ""}
                        {r.notes ? ` · ${r.notes}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 pt-3 border-t border-zinc-800 sticky bottom-0 bg-zinc-900 rounded-b-2xl">
              <button
                onClick={() => { const d = selectedDay; setSelectedDay(null); onAdd(d); }}
                className="w-full py-2.5 rounded-lg text-sm font-medium bg-white text-zinc-900 hover:bg-zinc-100 transition-colors"
              >
                + Ajouter une réservation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
