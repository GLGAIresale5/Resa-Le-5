"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import ReservationForm from "../../../components/ReservationForm";
import {
  fetchReservations,
  createReservation,
  updateReservation,
  confirmReservation,
  cancelReservation,
  noShowReservation,
  arrivedReservation,
} from "../../../lib/api";
import { Reservation, ReservationCreate } from "../../../types";
import { useAuth } from "../../../lib/auth-context";

// ── Helpers dates ──────────────────────────────────────────────────────────────

function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + deltaDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatLongDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatGroupDate(dateStr: string): string {
  const today = todayStr();
  if (dateStr === today) return `Aujourd'hui · ${formatLongDate(dateStr)}`;
  if (dateStr === shiftDate(today, 1)) return `Demain · ${formatLongDate(dateStr)}`;
  return formatLongDate(dateStr);
}

function isToday(dateStr: string): boolean {
  return dateStr === todayStr();
}

/** true si l'heure courante est >= heure de résa + 15 min, le jour même */
function isNoShowEligible(resDate: string, resTime: string, now: Date): boolean {
  const [h, m] = resTime.split(":").map(Number);
  const target = new Date(resDate + "T00:00:00");
  target.setHours(h, m + 15, 0, 0);
  return now >= target;
}

// ── Constantes d'affichage ──────────────────────────────────────────────────────

const SOURCE_ICON: Record<string, string> = {
  phone: "📞",
  manual: "✏️",
  google: "🔍",
  instagram: "📸",
  facebook: "👥",
  web: "🌐",
};

const STATUS_DOT: Record<string, string> = {
  confirmed: "bg-emerald-400",
  pending: "bg-amber-400",
  arrived: "bg-blue-400",
  no_show: "bg-red-400",
  cancelled: "bg-zinc-600",
};

type ViewMode = "jour" | "tout";

export default function ReservationsPage() {
  const { restaurant } = useAuth();
  const RESTAURANT_ID = restaurant?.id ?? "";

  const [view, setView] = useState<ViewMode>("jour");
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const [dayReservations, setDayReservations] = useState<Reservation[]>([]);
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [pendingAll, setPendingAll] = useState<Reservation[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showPanel, setShowPanel] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [pendingCollapsed, setPendingCollapsed] = useState(false);

  // Horloge — rafraîchit la logique "no-show éligible" chaque minute
  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // ── Chargements ────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!RESTAURANT_ID) return;
    try {
      const [all, pending] = await Promise.all([
        fetchReservations(RESTAURANT_ID),
        fetchReservations(RESTAURANT_ID, undefined, "pending"),
      ]);
      setAllReservations(all);
      setPendingAll(pending);
    } catch (e) {
      console.error(e);
    }
  }, [RESTAURANT_ID]);

  // Chargement de la journée — à chaque changement de restaurant ou de date
  useEffect(() => {
    if (!RESTAURANT_ID) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchReservations(RESTAURANT_ID, selectedDate)
      .then((r) => { if (!cancelled) setDayReservations(r); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Erreur de chargement"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [RESTAURANT_ID, selectedDate]);

  // Chargement "toutes les résas" + "à valider" — une fois par restaurant
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Mise à jour locale des 3 listes ──────────────────────────────────────────
  const applyRes = useCallback((updated: Reservation) => {
    const upd = (arr: Reservation[]) => arr.map((r) => (r.id === updated.id ? updated : r));
    setDayReservations(upd);
    setAllReservations(upd);
    setPendingAll((prev) =>
      updated.status === "pending" ? upd(prev) : prev.filter((r) => r.id !== updated.id),
    );
  }, []);

  const addRes = useCallback((r: Reservation) => {
    setAllReservations((prev) => [...prev, r]);
    setDayReservations((prev) => (r.date === selectedDate ? [...prev, r] : prev));
    if (r.status === "pending") setPendingAll((prev) => [...prev, r]);
  }, [selectedDate]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const openCreate = () => { setEditingReservation(null); setShowPanel(true); };
  const openEdit = (res: Reservation) => { setEditingReservation(res); setShowPanel(true); };
  const closePanel = () => { setShowPanel(false); setEditingReservation(null); };

  const handleCreate = async (data: ReservationCreate) => {
    const res = await createReservation(data);
    addRes(res);
    closePanel();
    // Feedback : afficher la résa créée là où elle est visible
    setSelectedDate(res.date);
    if (res.date < todayStr()) setView("jour");
  };

  const handleUpdate = async (data: ReservationCreate) => {
    if (!editingReservation) return;
    const res = await updateReservation(editingReservation.id, data);
    applyRes(res);
    closePanel();
  };

  const handleConfirm = async (id: string) => {
    const res = await confirmReservation(id);
    applyRes(res);
  };
  const handleArrived = async (id: string) => {
    const res = await arrivedReservation(id);
    applyRes(res);
  };
  const handleNoShow = async (id: string) => {
    const res = await noShowReservation(id);
    applyRes(res);
  };
  const handleCancelFromForm = async (id: string) => {
    const res = await cancelReservation(id);
    applyRes(res);
    closePanel();
  };

  // ── Données dérivées ──────────────────────────────────────────────────────────
  const dayActive = useMemo(
    () =>
      dayReservations
        .filter((r) => r.status !== "cancelled")
        .sort((a, b) => a.time.localeCompare(b.time)),
    [dayReservations],
  );
  const dayCovers = dayActive.reduce((sum, r) => sum + r.guest_count, 0);

  // Vue "Tout" : à venir (date >= aujourd'hui), groupé par jour, trié chronologiquement
  const toutGroups = useMemo(() => {
    const today = todayStr();
    const upcoming = allReservations
      .filter((r) => r.status !== "cancelled" && r.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    const map = new Map<string, Reservation[]>();
    for (const r of upcoming) {
      const arr = map.get(r.date) ?? [];
      arr.push(r);
      map.set(r.date, arr);
    }
    return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
  }, [allReservations]);

  // "À valider" : seulement les demandes à venir (aligné sur la vue Tout)
  const sortedPending = useMemo(() => {
    const today = todayStr();
    return pendingAll
      .filter((r) => r.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }, [pendingAll]);

  // ── Rendu d'une ligne de réservation (partagé Jour / Tout) ────────────────────
  const renderRow = (res: Reservation) => {
    const today = isToday(res.date);
    return (
      <div
        key={res.id}
        onClick={() => openEdit(res)}
        className="flex items-center gap-3 px-4 md:px-5 py-3.5 cursor-pointer hover:bg-zinc-800/50 active:bg-zinc-800/70 transition-colors"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[res.status] ?? "bg-zinc-600"}`} aria-hidden />
        <div className="w-12 shrink-0 text-sm font-medium text-zinc-400">{res.time?.slice(0, 5)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate">{res.guest_name}</span>
            <span className="text-xs shrink-0">{SOURCE_ICON[res.source] ?? ""}</span>
          </div>
          <div className="text-xs text-zinc-400 truncate mt-0.5">
            {res.guest_count} pers.
            {res.table_label ? ` · ${res.table_label}` : ""}
            {res.notes ? ` · ${res.notes}` : ""}
          </div>
        </div>

        {/* Actions selon statut */}
        <div className="shrink-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {res.status === "pending" && (
            <button
              onClick={() => handleConfirm(res.id)}
              className="px-3 py-2 rounded-full text-[11px] font-medium bg-amber-500 text-black hover:bg-amber-400 transition-colors"
            >
              Valider
            </button>
          )}
          {res.status === "confirmed" && today && (
            <>
              <button
                onClick={() => { if (confirm("Marquer comme arrivé ?")) handleArrived(res.id); }}
                className="px-3 py-2 rounded-full text-[11px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500/30 transition-colors"
              >
                Arrivé
              </button>
              {isNoShowEligible(res.date, res.time, currentTime) && (
                <button
                  onClick={() => { if (confirm("Marquer comme no-show ?")) handleNoShow(res.id); }}
                  className="px-3 py-2 rounded-full text-[11px] font-medium bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 transition-colors"
                >
                  No-show
                </button>
              )}
            </>
          )}
          {res.status === "confirmed" && !today && (
            <span className="px-3 py-2 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-300">Confirmé</span>
          )}
          {res.status === "arrived" && (
            <span className="px-3 py-2 rounded-full text-[11px] font-medium bg-blue-500/20 text-blue-300">Arrivé</span>
          )}
          {res.status === "no_show" && (
            <span className="px-3 py-2 rounded-full text-[11px] font-medium text-zinc-500">No-show</span>
          )}
        </div>
      </div>
    );
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-zinc-900 text-white overflow-hidden">
      {/* Colonne principale */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0">
        {/* Header */}
        <div className="flex flex-col gap-3 px-3 md:px-6 py-3 md:py-4 border-b border-zinc-800">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-semibold">Réservations</h1>
              {view === "jour" ? (
                <p className="text-xs text-zinc-400 mt-0.5 capitalize">{formatLongDate(selectedDate)}</p>
              ) : (
                <p className="text-xs text-zinc-400 mt-0.5">À venir · ordre chronologique</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {view === "jour" && (
                <>
                  <div className="hidden sm:flex gap-3 text-sm text-zinc-400 mr-1">
                    <span><span className="text-white font-medium">{dayActive.length}</span> résa</span>
                    <span><span className="text-white font-medium">{dayCovers}</span> couv.</span>
                  </div>
                  <button
                    onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
                    aria-label="Jour précédent"
                    className="h-9 w-9 hidden sm:flex items-center justify-center rounded bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500 transition-colors"
                  >
                    ‹
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-9 bg-zinc-800 border border-zinc-700 rounded px-2 md:px-3 text-sm text-white focus:outline-none focus:border-zinc-500"
                  />
                  <button
                    onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
                    aria-label="Jour suivant"
                    className="h-9 w-9 hidden sm:flex items-center justify-center rounded bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500 transition-colors"
                  >
                    ›
                  </button>
                </>
              )}
              <button
                onClick={openCreate}
                className="h-9 px-3 rounded text-sm bg-white text-zinc-900 font-medium hover:bg-zinc-100 transition-colors whitespace-nowrap"
              >
                +<span className="hidden md:inline"> Réservation</span>
              </button>
            </div>
          </div>

          {/* Toggle Jour / Tout */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 bg-zinc-800 border border-zinc-700 rounded p-0.5">
              <button
                onClick={() => setView("jour")}
                className={`px-4 py-1.5 rounded text-xs font-medium transition-colors ${
                  view === "jour" ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                Jour
              </button>
              <button
                onClick={() => setView("tout")}
                className={`px-4 py-1.5 rounded text-xs font-medium transition-colors ${
                  view === "tout" ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                Tout
              </button>
            </div>
            {view === "jour" && (
              <button
                onClick={() => setSelectedDate(todayStr())}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1"
              >
                Aujourd'hui
              </button>
            )}
          </div>
        </div>

        {/* Zone scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Bandeau "À valider" — visible dans les deux vues */}
          {sortedPending.length > 0 && (
            <div className="border-b border-amber-500/30 bg-amber-950/20">
              <button
                onClick={() => setPendingCollapsed((v) => !v)}
                className="w-full flex items-center justify-between px-4 md:px-5 py-2.5 text-xs font-medium text-amber-400 hover:bg-amber-950/30 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-black">
                    {sortedPending.length}
                  </span>
                  À valider
                </span>
                <span className={`transition-transform ${pendingCollapsed ? "" : "rotate-180"}`}>⌄</span>
              </button>
              {!pendingCollapsed && (
                <div className="divide-y divide-amber-500/10">
                  {sortedPending.map((res) => (
                    <div key={res.id} className="flex items-center justify-between gap-2 px-4 md:px-5 py-2.5 hover:bg-amber-950/30 transition-colors">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(res)}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white truncate">{res.guest_name}</span>
                          <span className="text-[10px] shrink-0">{SOURCE_ICON[res.source] ?? ""}</span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          <span className="text-amber-400/80">
                            {new Date(res.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </span>
                          {" · "}{res.time?.slice(0, 5)}{" · "}{res.guest_count} pers.
                        </div>
                      </div>
                      <button
                        onClick={() => handleConfirm(res.id)}
                        className="shrink-0 px-3 py-2 rounded-full text-[11px] font-medium bg-amber-500 text-black hover:bg-amber-400 transition-colors"
                      >
                        Valider
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-24 text-zinc-500 text-sm">Chargement…</div>
          ) : error ? (
            <div className="flex items-center justify-center py-24 text-red-400 text-sm">{error}</div>
          ) : view === "jour" ? (
            // ── Vue JOUR ──
            <div className="mx-auto w-full max-w-3xl">
              {dayActive.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-zinc-500 text-sm gap-2">
                  <span className="text-2xl">📋</span>
                  <p>Aucune réservation ce jour</p>
                  <button onClick={openCreate} className="mt-1 text-xs text-zinc-400 underline hover:text-white">
                    Ajouter une réservation
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">{dayActive.map(renderRow)}</div>
              )}
            </div>
          ) : (
            // ── Vue TOUT (chronologique) ──
            <div className="mx-auto w-full max-w-3xl pb-6">
              {toutGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-zinc-500 text-sm gap-2">
                  <span className="text-2xl">📅</span>
                  <p>Aucune réservation à venir</p>
                </div>
              ) : (
                toutGroups.map((g) => (
                  <div key={g.date}>
                    <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur px-4 md:px-5 py-2 text-xs font-medium text-zinc-400 border-b border-zinc-800 capitalize">
                      {formatGroupDate(g.date)}
                    </div>
                    <div className="divide-y divide-zinc-800">{g.items.map(renderRow)}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Backdrop drawer (toutes tailles) */}
      {showPanel && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={closePanel} />
      )}

      {/* Panneau formulaire — drawer à droite (téléphone, iPad, desktop) */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-96 max-w-[90vw] transform transition-transform duration-200 ease-out border-l border-zinc-800 bg-zinc-900 flex flex-col overflow-y-auto ${
          showPanel ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {showPanel && (
          <div className="p-4 pb-[calc(3.5rem+env(safe-area-inset-bottom)+1.5rem)] md:pb-4">
            <ReservationForm
              key={editingReservation?.id ?? "new"}
              restaurantId={RESTAURANT_ID}
              initialDate={selectedDate}
              reservation={editingReservation ?? undefined}
              onSubmit={editingReservation ? handleUpdate : handleCreate}
              onCancel={closePanel}
              onCancelReservation={handleCancelFromForm}
            />
          </div>
        )}
      </div>
    </div>
  );
}
