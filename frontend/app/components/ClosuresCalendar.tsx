"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchBlocks, createBlock, deleteBlock } from "../lib/api";
import { ReservationBlock } from "../types";

interface Props {
  restaurantId: string;
  services: { name: string }[];
}

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function ClosuresCalendar({ restaurantId, services }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11
  const [blocks, setBlocks] = useState<ReservationBlock[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const monthStr = `${year}-${pad(month + 1)}`;

  const load = useCallback(async () => {
    if (!restaurantId) return;
    try {
      setBlocks(await fetchBlocks(restaurantId, monthStr));
    } catch (e) {
      console.error(e);
    }
  }, [restaurantId, monthStr]);

  useEffect(() => { load(); }, [load]);

  const blocksByDay = useMemo(() => {
    const map = new Map<string, ReservationBlock[]>();
    for (const b of blocks) {
      const arr = map.get(b.date) ?? [];
      arr.push(b);
      map.set(b.date, arr);
    }
    return map;
  }, [blocks]);

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

  async function toggleWholeDay(date: string) {
    if (busy) return;
    setBusy(true);
    const db = blocksByDay.get(date) ?? [];
    const whole = db.find((b) => b.service == null);
    try {
      if (whole) {
        await deleteBlock(whole.id);
      } else {
        // Fermer toute la journée : on retire d'abord les fermetures de service
        for (const b of db.filter((b) => b.service != null)) await deleteBlock(b.id);
        await createBlock(restaurantId, date, null, null);
      }
      await load();
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  }

  async function toggleService(date: string, svcName: string) {
    if (busy) return;
    setBusy(true);
    const db = blocksByDay.get(date) ?? [];
    const existing = db.find((b) => b.service != null && b.service.toLowerCase() === svcName.toLowerCase());
    const whole = db.find((b) => b.service == null);
    try {
      if (existing) {
        await deleteBlock(existing.id);
      } else {
        if (whole) await deleteBlock(whole.id); // si jour entier fermé, on repasse en fermeture par service
        await createBlock(restaurantId, date, svcName, null);
      }
      await load();
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  }

  const selectedBlocks = selectedDay ? (blocksByDay.get(selectedDay) ?? []) : [];
  const selectedWhole = selectedBlocks.some((b) => b.service == null);

  return (
    <div className="mx-auto w-full max-w-md px-3 md:px-6 py-4">
      {/* En-tête mois */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} aria-label="Mois précédent" className="h-9 w-9 flex items-center justify-center rounded bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500">‹</button>
        <div className="text-sm font-semibold capitalize">{MONTHS[month]} {year}</div>
        <button onClick={nextMonth} aria-label="Mois suivant" className="h-9 w-9 flex items-center justify-center rounded bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500">›</button>
      </div>

      {/* Jours de la semaine */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-center text-[11px] text-zinc-500 py-1">{w}</div>
        ))}
      </div>

      {/* Grille */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const db = blocksByDay.get(date) ?? [];
          const whole = db.some((b) => b.service == null);
          const partial = db.some((b) => b.service != null);
          const dayNum = Number(date.slice(-2));
          const isToday = date === todayStr;
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(date)}
              className={`aspect-square rounded-md text-sm flex items-center justify-center relative transition-colors border ${
                whole
                  ? "bg-red-500/25 border-red-500/50 text-red-200"
                  : "bg-zinc-800/60 border-zinc-700/60 text-zinc-200 hover:border-zinc-500"
              } ${isToday ? "ring-1 ring-white/60" : ""}`}
            >
              {dayNum}
              {partial && !whole && (
                <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Légende */}
      <div className="flex items-center gap-4 mt-3 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-red-500/40 border border-red-500/50" /> Journée fermée</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> Service fermé</span>
      </div>

      <p className="text-xs text-zinc-500 mt-4">
        Touche un jour pour fermer la journée entière ou un service. Les fermetures empêchent les réservations en ligne.
      </p>

      {/* Panneau jour sélectionné */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4" onClick={() => setSelectedDay(null)}>
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-3 mb-0 sm:mb-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold capitalize">
                {new Date(selectedDay + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              </h3>
              <button onClick={() => setSelectedDay(null)} className="text-zinc-500 hover:text-white text-sm">✕</button>
            </div>

            <button
              onClick={() => toggleWholeDay(selectedDay)}
              disabled={busy}
              className={`w-full py-2.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${
                selectedWhole
                  ? "bg-red-500/25 border-red-500/50 text-red-200"
                  : "bg-zinc-800 border-zinc-700 text-zinc-200 hover:border-zinc-500"
              }`}
            >
              {selectedWhole ? "✓ Journée fermée — rouvrir" : "Fermer toute la journée"}
            </button>

            {!selectedWhole && services.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-xs text-zinc-500">Ou fermer un service :</span>
                {services.map((svc) => {
                  const closed = selectedBlocks.some((b) => b.service != null && b.service.toLowerCase() === svc.name.toLowerCase());
                  return (
                    <button
                      key={svc.name}
                      onClick={() => toggleService(selectedDay, svc.name)}
                      disabled={busy}
                      className={`w-full py-2 rounded-lg text-sm border transition-colors disabled:opacity-50 ${
                        closed
                          ? "bg-amber-500/20 border-amber-500/50 text-amber-200"
                          : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500"
                      }`}
                    >
                      {closed ? `✓ ${svc.name} fermé — rouvrir` : `Fermer le ${svc.name}`}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
