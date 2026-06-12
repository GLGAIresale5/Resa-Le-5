"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { fetchBlocks, createBlock, deleteBlock } from "../lib/api";
import {
  RecurringClosure,
  fetchRecurring,
  addRecurring,
  removeRecurring,
  materializeRules,
  unmaterializeRule,
  shouldMaterialize,
  markMaterialized,
} from "../lib/recurring";
import { ReservationBlock } from "../types";

interface Props {
  restaurantId: string;
  services: { name: string }[];
}

const WEEKDAY_HEADERS = ["L", "M", "M", "J", "V", "S", "D"];
// Ordre d'affichage lundi→dimanche, valeurs = JS getDay()
const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "lundi" },
  { value: 2, label: "mardi" },
  { value: 3, label: "mercredi" },
  { value: 4, label: "jeudi" },
  { value: 5, label: "vendredi" },
  { value: 6, label: "samedi" },
  { value: 0, label: "dimanche" },
];
const WEEKDAY_NAME: Record<number, string> = Object.fromEntries(
  WEEKDAY_OPTIONS.map((w) => [w.value, w.label]),
);

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

// Couleur de point par service (index dans service_hours)
const SERVICE_DOTS = ["bg-amber-400", "bg-sky-400", "bg-pink-400", "bg-purple-400"];
const SERVICE_DOT_FALLBACK = "bg-zinc-400";

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

  // Récurrences
  const [rules, setRules] = useState<RecurringClosure[]>([]);
  const [rulesAvailable, setRulesAvailable] = useState(true);
  const [recBusy, setRecBusy] = useState(false);
  const [recStatus, setRecStatus] = useState<string | null>(null);
  const [newWeekday, setNewWeekday] = useState(1);
  const [newScope, setNewScope] = useState(""); // "" = journée entière, sinon nom du service

  const monthStr = `${year}-${pad(month + 1)}`;

  const serviceDot = useCallback(
    (svcName: string | null): string => {
      if (svcName == null) return "";
      const idx = services.findIndex((s) => s.name.toLowerCase() === svcName.toLowerCase());
      return idx >= 0 ? (SERVICE_DOTS[idx] ?? SERVICE_DOT_FALLBACK) : SERVICE_DOT_FALLBACK;
    },
    [services],
  );

  // loadBlocks lit toujours le mois AFFICHÉ via une ref (pas de closure périmée
  // après une matérialisation lente ou une navigation rapide entre mois)
  const monthRef = useRef(monthStr);
  monthRef.current = monthStr;
  const loadBlocks = useCallback(async () => {
    if (!restaurantId) return;
    const m = monthRef.current;
    try {
      const data = await fetchBlocks(restaurantId, m);
      if (monthRef.current === m) setBlocks(data);
    } catch (e) {
      console.error(e);
    }
  }, [restaurantId]);

  useEffect(() => { loadBlocks(); }, [loadBlocks, monthStr]);

  // Chargement des règles + matérialisation de l'horizon (idempotente, throttlée 6 h)
  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchRecurring(restaurantId);
        if (cancelled) return;
        setRules(r);
        setRulesAvailable(true);
        if (r.length > 0 && shouldMaterialize(restaurantId)) {
          setRecBusy(true);
          setRecStatus("Synchronisation des fermetures récurrentes…");
          try {
            const created = await materializeRules(restaurantId, r);
            markMaterialized(restaurantId);
            if (!cancelled) {
              setRecStatus(null);
              if (created > 0) loadBlocks();
            }
          } finally {
            if (!cancelled) setRecBusy(false);
          }
        }
      } catch (e) {
        if (cancelled) return;
        const code = (e as { code?: string })?.code;
        if (code === "42P01" || code === "PGRST205") {
          // table absente (migration 016 non appliquée) — on masque la section
          setRulesAvailable(false);
        } else {
          setRecStatus("Erreur de synchronisation des récurrences — rouvre l'onglet pour réessayer.");
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  // Efface les messages de statut après quelques secondes (hors opération en cours)
  useEffect(() => {
    if (!recStatus || recBusy) return;
    const t = setTimeout(() => setRecStatus(null), 6000);
    return () => clearTimeout(t);
  }, [recStatus, recBusy]);

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

  // Un seul verrou pour toutes les mutations (ponctuelles ET récurrentes)
  const mutating = busy || recBusy;

  // ── Fermetures ponctuelles (jour sélectionné) ────────────────────────────────
  // Les toggles suppriment TOUS les blocks correspondants (résilient aux doublons)
  async function toggleWholeDay(date: string) {
    if (mutating) return;
    setBusy(true);
    const db = blocksByDay.get(date) ?? [];
    const wholes = db.filter((b) => b.service == null);
    try {
      if (wholes.length > 0) {
        for (const b of wholes) await deleteBlock(b.id);
      } else {
        for (const b of db.filter((b) => b.service != null)) await deleteBlock(b.id);
        await createBlock(restaurantId, date, null, null);
      }
      await loadBlocks();
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  }

  async function toggleService(date: string, svcName: string) {
    if (mutating) return;
    setBusy(true);
    const db = blocksByDay.get(date) ?? [];
    const matching = db.filter((b) => b.service != null && b.service.toLowerCase() === svcName.toLowerCase());
    try {
      if (matching.length > 0) {
        for (const b of matching) await deleteBlock(b.id);
      } else {
        for (const b of db.filter((b) => b.service == null)) await deleteBlock(b.id);
        await createBlock(restaurantId, date, svcName, null);
      }
      await loadBlocks();
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  }

  // ── Récurrences ──────────────────────────────────────────────────────────────
  const ruleExists = (weekday: number, service: string | null) =>
    rules.some(
      (r) =>
        r.weekday === weekday &&
        ((r.service == null && service == null) ||
          (r.service != null && service != null && r.service.toLowerCase() === service.toLowerCase())),
    );

  async function handleAddRule() {
    if (mutating) return;
    const service = newScope === "" ? null : newScope;
    if (ruleExists(newWeekday, service)) {
      setRecStatus("Cette règle existe déjà.");
      return;
    }
    setRecBusy(true);
    setRecStatus("Création de la règle…");
    try {
      const rule = await addRecurring(restaurantId, newWeekday, service);
      setRules((prev) => [...prev, rule]);
      setRecStatus("Fermeture des dates sur 6 mois…");
      const n = await materializeRules(restaurantId, [rule]);
      setRecStatus(`Règle ajoutée — ${n} date${n > 1 ? "s" : ""} fermée${n > 1 ? "s" : ""}.`);
      await loadBlocks();
    } catch (e) {
      console.error(e);
      setRecStatus("Erreur lors de la création de la règle.");
    } finally {
      setRecBusy(false);
    }
  }

  async function handleRemoveRule(rule: RecurringClosure) {
    if (mutating) return;
    const label = `${WEEKDAY_NAME[rule.weekday]} — ${rule.service ?? "journée entière"}`;
    if (!confirm(`Supprimer la récurrence « ${label} » ?\nLes fermetures à venir correspondantes seront rouvertes.`)) return;
    setRecBusy(true);
    setRecStatus("Réouverture des dates…");
    try {
      await removeRecurring(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      const n = await unmaterializeRule(restaurantId, rule);
      setRecStatus(`Règle supprimée — ${n} date${n > 1 ? "s" : ""} rouverte${n > 1 ? "s" : ""}.`);
      await loadBlocks();
    } catch (e) {
      console.error(e);
      setRecStatus("Erreur lors de la suppression.");
    } finally {
      setRecBusy(false);
    }
  }

  const selectedBlocks = selectedDay ? (blocksByDay.get(selectedDay) ?? []) : [];
  const selectedWhole = selectedBlocks.some((b) => b.service == null);
  const selectedWeekday = selectedDay ? new Date(selectedDay + "T12:00:00").getDay() : null;

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
          const db = blocksByDay.get(date) ?? [];
          const whole = db.some((b) => b.service == null);
          const svcBlocks = db.filter((b) => b.service != null);
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
              {!whole && svcBlocks.length > 0 && (
                <span className="absolute bottom-1 flex gap-0.5">
                  {svcBlocks.slice(0, 3).map((b) => (
                    <span key={b.id} className={`h-1.5 w-1.5 rounded-full ${serviceDot(b.service)}`} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Légende — une couleur par service */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-red-500/40 border border-red-500/50" /> Journée fermée</span>
        {services.map((s, i) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${SERVICE_DOTS[i] ?? SERVICE_DOT_FALLBACK}`} /> {s.name} fermé
          </span>
        ))}
      </div>

      <p className="text-xs text-zinc-500 mt-3">
        Touche un jour pour fermer la journée ou un service. Les fermetures bloquent les réservations en ligne.
      </p>

      {/* ── Fermetures récurrentes ── */}
      <div className="mt-6 border-t border-zinc-800 pt-4">
        <h3 className="text-sm font-semibold mb-2">Fermetures récurrentes</h3>
        {!rulesAvailable ? (
          <p className="text-xs text-zinc-500">Indisponible pour le moment (mise à jour de la base requise).</p>
        ) : (
          <>
            {rules.length === 0 && (
              <p className="text-xs text-zinc-500 mb-2">Aucune règle. Exemple : fermer tous les dimanches soir.</p>
            )}
            <div className="flex flex-col gap-1.5 mb-3">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between gap-2 bg-zinc-800/60 border border-zinc-700/60 rounded-lg px-3 py-2">
                  <span className="text-sm">
                    Tous les <span className="font-medium">{WEEKDAY_NAME[rule.weekday]}s</span>
                    {" · "}
                    {rule.service ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${serviceDot(rule.service)}`} />
                        {rule.service}
                      </span>
                    ) : (
                      <span className="text-red-300">journée entière</span>
                    )}
                  </span>
                  <button
                    onClick={() => handleRemoveRule(rule)}
                    disabled={mutating}
                    aria-label="Supprimer la règle"
                    className="shrink-0 h-8 w-8 flex items-center justify-center rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Ajout d'une règle */}
            <div className="flex items-center gap-2">
              <select
                value={newWeekday}
                onChange={(e) => setNewWeekday(Number(e.target.value))}
                className="flex-1 h-10 bg-zinc-800 border border-zinc-700 rounded px-2 text-sm text-white focus:outline-none focus:border-zinc-500"
              >
                {WEEKDAY_OPTIONS.map((w) => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>
              <select
                value={newScope}
                onChange={(e) => setNewScope(e.target.value)}
                className="flex-1 h-10 bg-zinc-800 border border-zinc-700 rounded px-2 text-sm text-white focus:outline-none focus:border-zinc-500"
              >
                <option value="">Journée entière</option>
                {services.map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
              <button
                onClick={handleAddRule}
                disabled={mutating}
                className="shrink-0 h-10 px-4 rounded text-sm bg-white text-zinc-900 font-medium hover:bg-zinc-100 transition-colors disabled:opacity-50"
              >
                Ajouter
              </button>
            </div>
            {recStatus && <p className="text-xs text-zinc-400 mt-2">{recStatus}</p>}
          </>
        )}
      </div>

      {/* Panneau jour sélectionné — au-dessus de la barre de menu */}
      {selectedDay && (
        <div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 px-4 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-4 pt-4"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="w-full max-w-sm max-h-[70vh] overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-2xl p-5 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold capitalize">
                {new Date(selectedDay + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              </h3>
              <button onClick={() => setSelectedDay(null)} aria-label="Fermer" className="h-8 w-8 flex items-center justify-center rounded text-zinc-500 hover:text-white text-sm">✕</button>
            </div>

            {/* Indication récurrence sur ce jour */}
            {selectedWeekday != null && rules.some((r) => r.weekday === selectedWeekday) && (
              <p className="text-[11px] text-zinc-500 -mt-1">
                Une fermeture récurrente s'applique le {WEEKDAY_NAME[selectedWeekday]} — rouvrir ici ne vaut que pour cette date.
              </p>
            )}

            <button
              onClick={() => toggleWholeDay(selectedDay)}
              disabled={mutating}
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
                {services.map((svc, i) => {
                  const closed = selectedBlocks.some((b) => b.service != null && b.service.toLowerCase() === svc.name.toLowerCase());
                  return (
                    <button
                      key={svc.name}
                      onClick={() => toggleService(selectedDay, svc.name)}
                      disabled={mutating}
                      className={`w-full py-2.5 rounded-lg text-sm border transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                        closed
                          ? "bg-zinc-800 border-zinc-500 text-white"
                          : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${SERVICE_DOTS[i] ?? SERVICE_DOT_FALLBACK}`} />
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
