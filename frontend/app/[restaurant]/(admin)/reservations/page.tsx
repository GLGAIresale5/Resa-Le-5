"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import ReservationForm from "../../../components/ReservationForm";
import ClosuresCalendar from "../../../components/ClosuresCalendar";
import ReservationsCalendar from "../../../components/ReservationsCalendar";
import {
  fetchReservations,
  createReservation,
  updateReservation,
  cancelReservation,
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

// ── Constantes d'affichage ──────────────────────────────────────────────────────

const SOURCE_ICON: Record<string, string> = {
  phone: "📞",
  manual: "✏️",
  google: "🔍",
  instagram: "📸",
  facebook: "👥",
  web: "🌐",
};

type ViewMode = "jour" | "tout" | "calendrier" | "fermetures";

export default function ReservationsPage() {
  const { restaurant } = useAuth();
  const RESTAURANT_ID = restaurant?.id ?? "";
  const services = restaurant?.service_hours?.services ?? [];

  const [view, setView] = useState<ViewMode>("jour");
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const [dayReservations, setDayReservations] = useState<Reservation[]>([]);
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showPanel, setShowPanel] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);

  // ── Chargements ────────────────────────────────────────────────────────────
  const [allError, setAllError] = useState<string | null>(null);
  const loadAll = useCallback(async () => {
    if (!RESTAURANT_ID) return;
    try {
      setAllReservations(await fetchReservations(RESTAURANT_ID));
      setAllError(null);
    } catch (e) {
      console.error(e);
      setAllError("Impossible de charger les réservations — vérifie ta connexion et rouvre l'onglet.");
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

  // Chargement "toutes les résas" — une fois par restaurant
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Mise à jour locale des listes ────────────────────────────────────────────
  // Date-aware : une résa déplacée vers une autre date sort de la vue Jour
  // (ou y entre) immédiatement, sans attendre un refetch.
  const applyRes = useCallback((updated: Reservation) => {
    setDayReservations((arr) => {
      const without = arr.filter((r) => r.id !== updated.id);
      return updated.date === selectedDate ? [...without, updated] : without;
    });
    setAllReservations((arr) => arr.map((r) => (r.id === updated.id ? updated : r)));
  }, [selectedDate]);

  const addRes = useCallback((r: Reservation) => {
    setAllReservations((prev) => [...prev, r]);
    setDayReservations((prev) => (r.date === selectedDate ? [...prev, r] : prev));
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
    if (res.date < todayStr() && view === "tout") setView("jour");
  };

  const handleUpdate = async (data: ReservationCreate) => {
    if (!editingReservation) return;
    const res = await updateReservation(editingReservation.id, data);
    applyRes(res);
    closePanel();
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

  // ── Rendu d'une ligne de réservation (partagé Jour / Tout) ────────────────────
  const renderRow = (res: Reservation) => (
    <div
      key={res.id}
      onClick={() => openEdit(res)}
      className="flex items-center gap-3 px-4 md:px-5 py-3.5 cursor-pointer hover:bg-neutral-900/70 active:bg-neutral-900 transition-colors"
    >
      <div className="w-12 shrink-0 text-sm font-medium text-neutral-400">{res.time?.slice(0, 5)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white truncate">{res.guest_name}</span>
          <span className="text-xs shrink-0">{SOURCE_ICON[res.source] ?? ""}</span>
        </div>
        <div className="text-xs text-neutral-400 truncate mt-0.5">
          {res.guest_count} pers.
          {res.table_label ? ` · ${res.table_label}` : ""}
          {res.notes ? ` · ${res.notes}` : ""}
        </div>
      </div>
    </div>
  );

  // ── Rendu ──────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-neutral-950 text-white overflow-hidden">
      {/* Colonne principale */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0">
        {/* Header */}
        <div className="flex flex-col gap-3 px-3 md:px-6 py-3 md:py-4 border-b border-neutral-800">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-semibold tracking-tight">Réservations</h1>
              {view === "jour" && <p className="text-xs text-neutral-400 mt-0.5 capitalize">{formatLongDate(selectedDate)}</p>}
              {view === "tout" && <p className="text-xs text-neutral-400 mt-0.5">À venir · ordre chronologique</p>}
              {view === "calendrier" && <p className="text-xs text-neutral-400 mt-0.5">Vue mensuelle</p>}
              {view === "fermetures" && <p className="text-xs text-neutral-400 mt-0.5">Fermer un jour ou un service</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {view === "jour" && (
                <>
                  <div className="hidden sm:flex gap-3 text-sm text-neutral-400 mr-1">
                    <span><span className="text-white font-medium">{dayActive.length}</span> résa</span>
                    <span><span className="text-white font-medium">{dayCovers}</span> couv.</span>
                  </div>
                  <button
                    onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
                    aria-label="Jour précédent"
                    className="h-9 w-9 hidden sm:flex items-center justify-center rounded-lg border border-neutral-800 text-neutral-300 hover:border-neutral-600 hover:text-white transition-colors"
                  >
                    ‹
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-9 bg-neutral-900 border border-neutral-800 rounded-lg px-2 md:px-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
                  />
                  <button
                    onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
                    aria-label="Jour suivant"
                    className="h-9 w-9 hidden sm:flex items-center justify-center rounded-lg border border-neutral-800 text-neutral-300 hover:border-neutral-600 hover:text-white transition-colors"
                  >
                    ›
                  </button>
                </>
              )}
              {view !== "fermetures" && (
                <button
                  onClick={openCreate}
                  className="h-9 px-3 rounded-lg text-sm bg-white text-neutral-950 font-medium hover:bg-neutral-200 transition-colors whitespace-nowrap"
                >
                  +<span className="hidden md:inline"> Réservation</span>
                </button>
              )}
            </div>
          </div>

          {/* Toggle Jour / Tout / Calendrier — Fermetures déporté à droite */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-0.5 border border-neutral-800 rounded-full p-0.5 shrink-0">
              {([["jour", "Jour"], ["tout", "Tout"], ["calendrier", "Calendrier"]] as const).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    view === v ? "bg-white text-neutral-950" : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {view === "jour" && (
              <button
                onClick={() => setSelectedDate(todayStr())}
                className="text-xs text-neutral-500 hover:text-white transition-colors px-2 py-1 shrink-0"
              >
                Aujourd'hui
              </button>
            )}
            <button
              onClick={() => setView("fermetures")}
              className={`ml-auto shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                view === "fermetures"
                  ? "bg-red-500/15 border-red-500/40 text-red-300"
                  : "border-neutral-800 text-neutral-300 hover:border-neutral-600 hover:text-white"
              }`}
            >
              Fermetures
            </button>
          </div>
        </div>

        {/* Zone scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {view === "fermetures" ? (
            <ClosuresCalendar restaurantId={RESTAURANT_ID} services={services} />
          ) : view === "calendrier" ? (
            allError ? (
              <div className="flex items-center justify-center py-24 text-red-300 text-sm px-6 text-center">{allError}</div>
            ) : (
              <ReservationsCalendar
                reservations={allReservations}
                onEdit={openEdit}
                onAdd={(d) => { setSelectedDate(d); openCreate(); }}
              />
            )
          ) : loading ? (
            <div className="flex items-center justify-center py-24 text-neutral-500 text-sm">Chargement…</div>
          ) : error ? (
            <div className="flex items-center justify-center py-24 text-red-300 text-sm">{error}</div>
          ) : view === "jour" ? (
            // ── Vue JOUR ──
            <div className="mx-auto w-full max-w-3xl">
              {dayActive.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-neutral-500 text-sm gap-2">
                  <span className="text-2xl">📋</span>
                  <p>Aucune réservation ce jour</p>
                  <button onClick={openCreate} className="mt-1 text-xs text-neutral-400 underline hover:text-white">
                    Ajouter une réservation
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-neutral-800/60">{dayActive.map(renderRow)}</div>
              )}
            </div>
          ) : (
            // ── Vue TOUT (chronologique) ──
            <div className="mx-auto w-full max-w-3xl pb-6">
              {allError ? (
                <div className="flex items-center justify-center py-24 text-red-300 text-sm px-6 text-center">{allError}</div>
              ) : toutGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-neutral-500 text-sm gap-2">
                  <span className="text-2xl">📅</span>
                  <p>Aucune réservation à venir</p>
                </div>
              ) : (
                toutGroups.map((g) => (
                  <div key={g.date}>
                    <div className="sticky top-0 z-10 bg-neutral-950/95 backdrop-blur px-4 md:px-5 py-2 text-xs font-medium text-neutral-400 border-b border-neutral-800 capitalize">
                      {formatGroupDate(g.date)}
                    </div>
                    <div className="divide-y divide-neutral-800/60">{g.items.map(renderRow)}</div>
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
        className={`fixed top-0 right-0 bottom-0 z-50 w-96 max-w-[90vw] transform transition-transform duration-200 ease-out border-l border-neutral-800 bg-neutral-900 flex flex-col overflow-y-auto ${
          showPanel ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {showPanel && (
          <div className="p-4 pb-[calc(3.5rem+env(safe-area-inset-bottom)+1.5rem)] md:pb-4">
            <ReservationForm
              key={editingReservation?.id ?? `new-${selectedDate}`}
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
