"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import FloorPlan from "../../components/FloorPlan";
import ReservationForm from "../../components/ReservationForm";
import {
  fetchFloorPlans,
  createFloorPlan,
  updateFloorPlan,
  deleteFloorPlan,
  fetchTables,
  fetchReservations,
  createReservation,
  updateReservation,
  deleteReservation,
  confirmReservation,
  cancelReservation,
  updateTable,
  createTable,
  deleteTable,
} from "../../lib/api";
import { FloorPlan as FloorPlanType, RestaurantTable, Reservation, ReservationCreate } from "../../types";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || "60945098-cb17-4b47-8771-4b0110ec6d9d";

const MERGE_THRESHOLD = 9; // % distance center-to-center to consider tables adjacent

// ── Groupement automatique ────────────────────────────────────────────────────

/**
 * Trouve le meilleur groupement de tables déplaçables pour accueillir guestCount personnes.
 * Part de la table primaire (si fournie) et ajoute les tables voisines déplaçables les plus proches.
 * Retourne null si une seule table suffit déjà.
 */
function suggestGrouping(
  tables: RestaurantTable[],
  guestCount: number,
  occupiedIds: Set<string>,
  primaryTableId?: string | null,
): { tableIds: string[]; totalCapacity: number } | null {
  const freeMovable = tables.filter((t) => t.movable !== false && !occupiedIds.has(t.id));

  let start = primaryTableId ? freeMovable.find((t) => t.id === primaryTableId) : null;
  if (!start) {
    start = [...freeMovable].sort((a, b) => b.capacity - a.capacity)[0] ?? null;
  }
  if (!start) return null;

  // If start alone is enough, no grouping needed
  if (start.capacity >= guestCount) return null;

  const others = freeMovable
    .filter((t) => t.id !== start!.id)
    .sort((a, b) => {
      const dA = Math.hypot(a.x - start!.x, a.y - start!.y);
      const dB = Math.hypot(b.x - start!.x, b.y - start!.y);
      return dA - dB;
    });

  const group: RestaurantTable[] = [start];
  let total = start.capacity;
  for (const t of others) {
    if (total >= guestCount) break;
    group.push(t);
    total += t.capacity;
  }
  if (total < guestCount) return null; // not enough tables

  return { tableIds: group.map((t) => t.id), totalCapacity: total };
}

function findAdjacentGroups(tables: RestaurantTable[]): RestaurantTable[][] {
  const groups: RestaurantTable[][] = [];
  const visited = new Set<string>();
  for (const t of tables) {
    if (visited.has(t.id)) continue;
    const group: RestaurantTable[] = [t];
    visited.add(t.id);
    const queue = [t];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const other of tables) {
        if (visited.has(other.id)) continue;
        const dx = current.x - other.x;
        const dy = current.y - other.y;
        if (Math.sqrt(dx * dx + dy * dy) < MERGE_THRESHOLD) {
          group.push(other);
          visited.add(other.id);
          queue.push(other);
        }
      }
    }
    if (group.length > 1) groups.push(group);
  }
  return groups;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmée",
  pending: "En attente",
  cancelled: "Annulée",
  no_show: "No show",
};

const STATUS_COLOR: Record<string, string> = {
  confirmed: "text-emerald-400",
  pending: "text-amber-400",
  cancelled: "text-red-400",
  no_show: "text-zinc-500",
};

const SOURCE_ICON: Record<string, string> = {
  phone: "📞",
  manual: "✏️",
  google: "🔍",
  instagram: "📸",
  facebook: "👥",
  web: "🌐",
};

// ── Services ──────────────────────────────────────────────────────────────────

interface ServiceConfig {
  id: string;
  name: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
}

const DEFAULT_SERVICES: ServiceConfig[] = [
  { id: "midi", name: "Midi", startTime: "12:00", endTime: "15:30" },
  { id: "soir", name: "Soir", startTime: "19:00", endTime: "23:30" },
];

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function loadServices(): ServiceConfig[] {
  try {
    const stored = localStorage.getItem("glg_services");
    return stored ? JSON.parse(stored) : DEFAULT_SERVICES;
  } catch { return DEFAULT_SERVICES; }
}

function saveServicesToStorage(services: ServiceConfig[]) {
  try { localStorage.setItem("glg_services", JSON.stringify(services)); } catch {}
}

export default function ReservationsPage() {
  const [floorPlans, setFloorPlans] = useState<FloorPlanType[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [planVisible, setPlanVisible] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [editMode, setEditMode] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Services
  const [services, setServices] = useState<ServiceConfig[]>(DEFAULT_SERVICES);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [editingServices, setEditingServices] = useState<ServiceConfig[]>([]);
  // Live clock — refreshes every minute to update active-reservation logic
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Drag-and-drop réservations
  const [draggingReservationId, setDraggingReservationId] = useState<string | null>(null);

  // Groupement de tables
  const [groupingProposal, setGroupingProposal] = useState<{
    reservationId: string;
    tableIds: string[];
    totalCapacity: number;
  } | null>(null);

  // Floor plan management
  const [renamingPlanId, setRenamingPlanId] = useState<string | null>(null);
  const [renamingPlanName, setRenamingPlanName] = useState("");
  const [addPlanModal, setAddPlanModal] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");

  // Add table modal
  const [addTableModal, setAddTableModal] = useState<{ x: number; y: number } | null>(null);
  const [newTableName, setNewTableName] = useState("");
  const [newTableCapacity, setNewTableCapacity] = useState(2);
  const [newTableShape, setNewTableShape] = useState<"square" | "round" | "rectangle">("square");
  const [newTableRotation, setNewTableRotation] = useState(0);
  const [newTableMovable, setNewTableMovable] = useState(true);

  // Edit table modal
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);

  // Load services from localStorage
  useEffect(() => {
    setServices(loadServices());
  }, []);

  // Refresh current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const loadReservations = useCallback(async (date: string) => {
    try {
      const res = await fetchReservations(RESTAURANT_ID, date);
      setReservations(res);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadTables = useCallback(async (planId: string) => {
    if (!planId) return;
    try {
      const t = await fetchTables(RESTAURANT_ID, planId);
      setTables(t);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        const [plans, res] = await Promise.all([
          fetchFloorPlans(RESTAURANT_ID),
          fetchReservations(RESTAURANT_ID, selectedDate),
        ]);
        setFloorPlans(plans);
        setReservations(res);
        if (plans.length > 0) {
          setSelectedPlanId(plans[0].id);
          const t = await fetchTables(RESTAURANT_ID, plans[0].id);
          setTables(t);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Reload reservations on date change
  useEffect(() => {
    loadReservations(selectedDate);
  }, [selectedDate]);

  // Reload tables on plan change
  useEffect(() => {
    if (selectedPlanId) loadTables(selectedPlanId);
  }, [selectedPlanId]);

  const switchPlan = useCallback((planId: string) => {
    if (planId === selectedPlanId) return;
    setPlanVisible(false);
    setTimeout(() => {
      setSelectedPlanId(planId);
      setPlanVisible(true);
    }, 180);
  }, [selectedPlanId]);

  const handleTableMove = async (tableId: string, x: number, y: number) => {
    try {
      await updateTable(tableId, { x, y });
    } catch (e) {
      console.error(e);
    }
  };

  const handleTableClick = (table: RestaurantTable) => {
    if (editMode) {
      setEditingTable(table);
      return;
    }
    setSelectedTableId(table.id === selectedTableId ? null : table.id);
    setShowForm(true);
    setEditingReservation(null);
    setShowPanel(true);
  };

  const handleAddPlan = async () => {
    if (!newPlanName.trim()) return;
    try {
      const plan = await createFloorPlan({
        restaurant_id: RESTAURANT_ID,
        name: newPlanName.trim(),
        sort_order: floorPlans.length,
      });
      setFloorPlans((prev) => [...prev, plan]);
      setAddPlanModal(false);
      setNewPlanName("");
      switchPlan(plan.id);
    } catch (e) { console.error(e); }
  };

  const handleRenamePlan = async (planId: string) => {
    if (!renamingPlanName.trim()) { setRenamingPlanId(null); return; }
    try {
      const updated = await updateFloorPlan(planId, { name: renamingPlanName.trim() });
      setFloorPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (e) { console.error(e); }
    setRenamingPlanId(null);
  };

  const handleToggleReservable = async (planId: string) => {
    const plan = floorPlans.find((p) => p.id === planId);
    if (!plan) return;
    const newVal = plan.reservable === false ? true : false;
    try {
      const updated = await updateFloorPlan(planId, { reservable: newVal });
      setFloorPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (e) { console.error(e); }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm("Supprimer cette salle et toutes ses tables ?")) return;
    try {
      await deleteFloorPlan(planId);
      const remaining = floorPlans.filter((p) => p.id !== planId);
      setFloorPlans(remaining);
      setTables((prev) => prev.filter((t) => t.floor_plan_id !== planId));
      if (selectedPlanId === planId && remaining.length > 0) switchPlan(remaining[0].id);
    } catch (e) { console.error(e); }
  };

  const handleAddTable = (x: number, y: number) => {
    setAddTableModal({ x, y });
    setNewTableName(`T${tables.length + 1}`);
    setNewTableCapacity(2);
    setNewTableShape("square");
    setNewTableRotation(0);
    setNewTableMovable(true);
  };

  const confirmAddTable = async () => {
    if (!newTableName.trim() || !selectedPlanId) return;
    try {
      const t = await createTable({
        floor_plan_id: selectedPlanId,
        restaurant_id: RESTAURANT_ID,
        name: newTableName.trim(),
        capacity: newTableCapacity,
        x: addTableModal!.x,
        y: addTableModal!.y,
        shape: newTableShape,
        rotation: newTableRotation,
        movable: newTableMovable,
      });
      setTables((prev) => [...prev, t]);
      setAddTableModal(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!confirm("Supprimer cette table ?")) return;
    try {
      await deleteTable(tableId);
      setTables((prev) => prev.filter((t) => t.id !== tableId));
      setEditingTable(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateTable = async () => {
    if (!editingTable) return;
    try {
      const updated = await updateTable(editingTable.id, {
        name: editingTable.name,
        capacity: editingTable.capacity,
        shape: editingTable.shape,
        rotation: editingTable.rotation ?? 0,
        snap: editingTable.snap ?? true,
        movable: editingTable.movable ?? true,
        premium: editingTable.premium ?? false,
      });
      setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditingTable(null);
    } catch (e) {
      console.error(e);
    }
  };

  function checkAndProposeGrouping(res: Reservation) {
    const table = tables.find((t) => t.id === res.table_id);
    if (!table) return;
    if (table.capacity >= res.guest_count) return; // single table is enough
    if (res.grouped_table_ids?.length) return; // already grouped

    const occupied = new Set(occupiedTableIds);
    // Remove the reservation's own table from occupied so it's available for grouping
    if (res.table_id) occupied.delete(res.table_id);
    const proposal = suggestGrouping(currentPlanTables, res.guest_count, occupied, res.table_id);
    if (proposal) {
      setGroupingProposal({ reservationId: res.id, ...proposal });
    }
  }

  const handleCreateReservation = async (data: ReservationCreate) => {
    const res = await createReservation({
      ...data,
      table_id: selectedTableId || data.table_id || null,
    });
    setReservations((prev) => [...prev, res]);
    setShowForm(false);
    setSelectedTableId(null);
    setEditingReservation(null);
    checkAndProposeGrouping(res);
  };

  const handleUpdateReservation = async (data: ReservationCreate) => {
    if (!editingReservation) return;
    const res = await updateReservation(editingReservation.id, data);
    setReservations((prev) => prev.map((r) => (r.id === res.id ? res : r)));
    setShowForm(false);
    setEditingReservation(null);
  };

  const handleValidateGrouping = async () => {
    if (!groupingProposal) return;
    const { reservationId, tableIds } = groupingProposal;
    const res = await updateReservation(reservationId, {
      status: "confirmed",
      grouped_table_ids: tableIds,
    });
    setReservations((prev) => prev.map((r) => (r.id === res.id ? res : r)));
    setGroupingProposal(null);
  };

  const handleDropReservationOnTable = async (tableId: string, reservationId: string) => {
    setDraggingReservationId(null);
    // Avoid no-op if dropped on the same table
    const existing = reservations.find((r) => r.id === reservationId);
    if (existing?.table_id === tableId) return;
    try {
      const res = await updateReservation(reservationId, { table_id: tableId });
      setReservations((prev) => prev.map((r) => (r.id === res.id ? res : r)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirmReservation = async (resId: string) => {
    const res = await confirmReservation(resId);
    setReservations((prev) => prev.map((r) => (r.id === res.id ? res : r)));
  };

  const handleCancelReservation = async (resId: string) => {
    const res = await updateReservation(resId, { status: "cancelled" });
    setReservations((prev) => prev.map((r) => (r.id === res.id ? res : r)));
  };

  const handleDeleteReservation = async (resId: string) => {
    if (!confirm("Supprimer définitivement cette réservation ?")) return;
    await deleteReservation(resId);
    setReservations((prev) => prev.filter((r) => r.id !== resId));
  };

  const currentPlanTables = tables.filter((t) => t.floor_plan_id === selectedPlanId);

  // ── Service filtering ──────────────────────────────────────────────────────
  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null;

  // Reservations filtered to the selected service window (or all if none selected)
  const serviceReservations = useMemo(() => {
    if (!selectedService) return reservations;
    const start = timeToMinutes(selectedService.startTime);
    const end = timeToMinutes(selectedService.endTime);
    return reservations.filter((r) => {
      const t = timeToMinutes(r.time);
      return t >= start && t < end;
    });
  }, [reservations, selectedService]);

  // For the floor plan: keep at most one reservation per table (the currently active one).
  // On today's date, "active" = the first reservation that hasn't ended yet.
  // On other dates, "active" = the first upcoming reservation.
  const floorPlanReservations = useMemo(() => {
    const isToday = selectedDate === todayStr();
    const nowMin = currentTime.getHours() * 60 + currentTime.getMinutes();

    const byTable = new Map<string, Reservation>();
    serviceReservations
      .filter((r) => r.status === "confirmed" || r.status === "pending")
      .sort((a, b) => a.time.localeCompare(b.time))
      .forEach((r) => {
        if (!r.table_id) return;
        const existing = byTable.get(r.table_id);
        if (!existing) { byTable.set(r.table_id, r); return; }
        if (isToday) {
          // Replace existing only if it has already ended
          const endMin = timeToMinutes(existing.time) + (existing.duration ?? 120);
          if (endMin <= nowMin) byTable.set(r.table_id, r);
        }
        // On future dates: keep the first (already set)
      });

    const nonTableRes = serviceReservations.filter((r) => !r.table_id);
    return [...nonTableRes, ...byTable.values()];
  }, [serviceReservations, selectedDate, currentTime]);

  // IDs de tables déjà occupées (réservations confirmées/en attente du jour)
  const occupiedTableIds = useMemo(() => {
    const ids = new Set<string>();
    reservations.forEach((r) => {
      if (r.status === "confirmed" || r.status === "pending") {
        if (r.table_id) ids.add(r.table_id);
        r.grouped_table_ids?.forEach((id) => ids.add(id));
      }
    });
    return ids;
  }, [reservations]);

  // IDs des tables dans des groupements confirmés actifs (pour coloration plan de salle)
  const confirmedGroupedIds = useMemo(() => {
    const ids = new Set<string>();
    reservations.forEach((r) => {
      if (r.status === "confirmed" && r.grouped_table_ids?.length) {
        r.grouped_table_ids.forEach((id) => ids.add(id));
      }
    });
    return ids;
  }, [reservations]);

  const mergeGroups = useMemo(() => {
    if (editMode) {
      // In edit mode: show all adjacent groups (to visualise layout proximity)
      return findAdjacentGroups(currentPlanTables);
    }
    // In view mode: show groups of FREE movable adjacent tables (available combinations)
    const freeMov = currentPlanTables.filter(
      (t) => t.movable !== false && !occupiedTableIds.has(t.id)
    );
    return findAdjacentGroups(freeMov);
  }, [currentPlanTables, editMode, occupiedTableIds]);

  const activeReservations = serviceReservations.filter((r) => r.status !== "cancelled");
  const totalCovers = activeReservations.reduce((sum, r) => sum + r.guest_count, 0);

  return (
    <div className="flex flex-col h-full bg-zinc-900 text-white overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-2 px-3 md:px-6 py-3 md:py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base md:text-lg font-semibold">Réservations</h1>
            <p className="text-xs text-zinc-400 mt-0.5 capitalize">{formatDate(selectedDate)}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex gap-4 text-sm text-zinc-400 mr-2">
              <span><span className="text-white font-medium">{activeReservations.length}</span> réservations</span>
              <span><span className="text-white font-medium">{totalCovers}</span> couverts</span>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 md:px-3 py-1.5 text-sm text-white focus:outline-none focus:border-zinc-500"
            />
            {!editMode && (
              <button
                onClick={() => { setShowForm(true); setEditingReservation(null); setSelectedTableId(null); setShowPanel(true); }}
                className="px-3 py-1.5 rounded text-sm bg-white text-zinc-900 font-medium hover:bg-zinc-100 transition-colors"
              >
                +<span className="hidden md:inline"> Réservation</span>
              </button>
            )}
          </div>
        </div>
        {/* Second row: service selector + edit button */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="flex items-center gap-0.5 bg-zinc-800 border border-zinc-700 rounded p-0.5 shrink-0">
            <button
              onClick={() => setSelectedServiceId(null)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                !selectedServiceId ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              Tous
            </button>
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedServiceId(s.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedServiceId === s.id ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                {s.name}
              </button>
            ))}
            <button
              onClick={() => { setEditingServices(services.map((s) => ({ ...s }))); setShowServicesModal(true); }}
              className="px-2 py-1 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
              title="Gérer les services"
            >
              ⚙
            </button>
          </div>
          {/* Mobile stats */}
          <div className="flex md:hidden gap-3 text-xs text-zinc-400 shrink-0">
            <span><span className="text-white font-medium">{activeReservations.length}</span> résa</span>
            <span><span className="text-white font-medium">{totalCovers}</span> couv.</span>
          </div>
          <div className="ml-auto shrink-0">
            <button
              onClick={() => setEditMode((prev) => !prev)}
              className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                editMode
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {editMode ? "Quitter" : "Éditer"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* LEFT: Floor plan */}
        <div className="flex flex-col flex-1 min-w-0 p-2 md:p-4 gap-3">
          {/* Plan selector tabs */}
          <div className="flex items-end gap-0 border-b border-zinc-800 pb-0">
            {floorPlans.map((plan) => {
              const isActive = selectedPlanId === plan.id;
              const isRenaming = renamingPlanId === plan.id;
              const planReservations = reservations.filter((r) =>
                tables.filter((t) => t.floor_plan_id === plan.id).some((t) => t.id === r.table_id)
              );
              return (
                <div key={plan.id} className="relative flex items-center">
                  {isRenaming ? (
                    <input
                      autoFocus
                      className="px-3 py-1.5 text-sm font-medium bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:border-zinc-400 w-32 mb-0.5"
                      value={renamingPlanName}
                      onChange={(e) => setRenamingPlanName(e.target.value)}
                      onBlur={() => handleRenamePlan(plan.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenamePlan(plan.id);
                        if (e.key === "Escape") setRenamingPlanId(null);
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => switchPlan(plan.id)}
                      onDoubleClick={() => {
                        if (editMode) { setRenamingPlanId(plan.id); setRenamingPlanName(plan.name); }
                      }}
                      className={`relative px-5 py-2 text-sm font-medium transition-colors ${
                        isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {plan.name}
                      {plan.reservable === false && (
                        <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-700 text-zinc-400 font-normal">
                          non réservable
                        </span>
                      )}
                      {planReservations.length > 0 && (
                        <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${
                          isActive ? "bg-zinc-600 text-zinc-200" : "bg-zinc-800 text-zinc-500"
                        }`}>
                          {planReservations.length}
                        </span>
                      )}
                      {isActive && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
                      )}
                    </button>
                  )}
                  {/* Reservable toggle + Delete plan button — edit mode only, active plan only */}
                  {editMode && isActive && (
                    <button
                      onClick={() => handleToggleReservable(plan.id)}
                      className={`ml-2 mb-1 px-2 py-0.5 rounded text-[10px] border transition-colors ${
                        plan.reservable !== false
                          ? "border-emerald-700/60 text-emerald-400 hover:border-emerald-600"
                          : "border-zinc-600 text-zinc-500 hover:border-zinc-500"
                      }`}
                      title={plan.reservable !== false ? "Désactiver les réservations pour cette salle" : "Activer les réservations pour cette salle"}
                    >
                      {plan.reservable !== false ? "✓ Réservable" : "✗ Non réservable"}
                    </button>
                  )}
                  {editMode && isActive && floorPlans.length > 1 && (
                    <button
                      onClick={() => handleDeletePlan(plan.id)}
                      className="ml-1 mb-1 text-zinc-600 hover:text-red-400 text-xs transition-colors"
                      title="Supprimer cette salle"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
            {/* Add plan button — edit mode only */}
            {editMode && (
              <button
                onClick={() => { setAddPlanModal(true); setNewPlanName(""); }}
                className="px-3 py-2 text-sm text-zinc-500 hover:text-white transition-colors mb-0.5"
                title="Ajouter une salle"
              >
                + Salle
              </button>
            )}
          </div>

          {/* Bannière groupement proposé */}
          {groupingProposal && (
            <div className="mx-0 mb-2 flex items-center justify-between gap-3 rounded-lg border border-orange-700/50 bg-orange-950/60 px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-orange-400">⬡</span>
                <span className="text-orange-200 font-medium">Groupement suggéré</span>
                <span className="text-orange-400/80 text-xs">
                  {groupingProposal.tableIds.map((id) => currentPlanTables.find((t) => t.id === id)?.name ?? id).join(" + ")}
                  {" "}· {groupingProposal.totalCapacity} couverts disponibles
                </span>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setGroupingProposal(null)}
                  className="px-3 py-1 rounded text-xs border border-orange-800 text-orange-400 hover:border-orange-600 transition-colors"
                >
                  Ignorer
                </button>
                <button
                  onClick={handleValidateGrouping}
                  className="px-3 py-1 rounded text-xs bg-orange-500 text-white font-medium hover:bg-orange-400 transition-colors"
                >
                  Valider le placement
                </button>
              </div>
            </div>
          )}

          {/* Canvas */}
          <div
            className="flex-1 min-h-0 transition-opacity duration-150"
            style={{ opacity: planVisible ? 1 : 0 }}
          >
            {loading ? (
              <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                Chargement...
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full text-red-400 text-sm">
                {error}
              </div>
            ) : (
              <FloorPlan
                tables={currentPlanTables}
                reservations={floorPlanReservations}
                editMode={editMode}
                selectedTableId={selectedTableId}
                mergeGroups={mergeGroups}
                proposedGroupIds={groupingProposal?.tableIds ?? []}
                draggingReservationId={draggingReservationId}
                onTableMove={handleTableMove}
                onTableClick={handleTableClick}
                onAddTable={handleAddTable}
                onDropReservation={handleDropReservationOnTable}
              />
            )}
          </div>
        </div>

        {/* Floating button to toggle panel on tablet/mobile */}
        <button
          onClick={() => setShowPanel((v) => !v)}
          className="lg:hidden absolute bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 shadow-lg transition hover:bg-zinc-100"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          {activeReservations.length} résa
        </button>

        {/* Backdrop for mobile panel */}
        {showPanel && (
          <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setShowPanel(false)} />
        )}

        {/* RIGHT: List + form — always visible on desktop, drawer on tablet/mobile */}
        <div className={`
          lg:relative lg:translate-x-0 lg:w-80
          fixed top-0 right-0 bottom-0 z-50 w-80 max-w-[85vw]
          transform transition-transform duration-200 ease-out
          ${showPanel ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
          border-l border-zinc-800 bg-zinc-900 flex flex-col overflow-hidden
        `}>
          {showForm || editingReservation ? (
            <div className="flex-1 overflow-y-auto p-4">
              <ReservationForm
                restaurantId={RESTAURANT_ID}
                tables={tables}
                initialDate={selectedDate}
                reservation={editingReservation ?? undefined}
                onSubmit={editingReservation ? handleUpdateReservation : handleCreateReservation}
                onCancel={() => { setShowForm(false); setEditingReservation(null); setSelectedTableId(null); }}
                onCancelReservation={async (resId) => {
                  const res = await cancelReservation(resId);
                  setReservations((prev) => prev.map((r) => (r.id === res.id ? res : r)));
                  setEditingReservation(null);
                  setShowForm(false);
                }}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {serviceReservations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-sm gap-2 p-6">
                  <span className="text-2xl">📋</span>
                  <p>Aucune réservation ce jour</p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-2 text-xs text-zinc-400 underline hover:text-white"
                  >
                    Ajouter une réservation
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {serviceReservations
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .map((res) => (
                      <div
                        key={res.id}
                        draggable={res.status !== "cancelled"}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("reservationId", res.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggingReservationId(res.id);
                        }}
                        onDragEnd={() => setDraggingReservationId(null)}
                        className={`p-4 hover:bg-zinc-800/40 transition-colors ${
                          res.status === "cancelled" ? "opacity-40" : "cursor-grab active:cursor-grabbing"
                        } ${draggingReservationId === res.id ? "opacity-50" : ""}`}
                      >
                        <div
                          className="flex items-start justify-between gap-2 cursor-pointer"
                          onClick={() => { setEditingReservation(res); setShowForm(false); setShowPanel(true); }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white truncate">
                                {res.guest_name}
                              </span>
                              <span className="text-xs">{SOURCE_ICON[res.source] ?? ""}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs text-zinc-300">{res.time?.slice(0, 5)}</span>
                              <span className="text-xs text-zinc-500">·</span>
                              <span className="text-xs text-zinc-300">{res.guest_count} pers.</span>
                              {res.table_id && (
                                <>
                                  <span className="text-xs text-zinc-500">·</span>
                                  <span className="text-xs text-zinc-300 font-medium">
                                    {tables.find((t) => t.id === res.table_id)?.name ?? ""}
                                  </span>
                                </>
                              )}
                            </div>
                            {res.notes && (
                              <p className="text-xs text-zinc-400 mt-1 truncate">{res.notes}</p>
                            )}
                          </div>
                          {res.status === "pending" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmReservation(res.id);
                              }}
                              className="shrink-0 px-3 py-1 rounded-full text-[10px] font-medium bg-zinc-700 text-zinc-300 border border-zinc-600 hover:bg-emerald-600 hover:text-white hover:border-emerald-500 transition-colors"
                            >
                              Valider
                            </button>
                          )}
                          {res.status === "confirmed" && (
                            <span className="shrink-0 px-3 py-1 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                              Validé
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Ajouter une salle */}
      {addPlanModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-72 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-white">Nouvelle salle</h3>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Nom</label>
              <input
                autoFocus
                className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
                placeholder="Ex : Bar, Terrasse couverte..."
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddPlan(); }}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setAddPlanModal(false)}
                className="flex-1 py-2 rounded text-sm border border-zinc-700 text-zinc-400 hover:border-zinc-600"
              >
                Annuler
              </button>
              <button
                onClick={handleAddPlan}
                className="flex-1 py-2 rounded text-sm bg-white text-zinc-900 font-medium hover:bg-zinc-100"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ajouter une table */}
      {addTableModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-80 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-white">Nouvelle table</h3>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Nom</label>
              <input
                className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Capacité</label>
              <input
                type="number"
                min={1}
                max={20}
                className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
                value={newTableCapacity}
                onChange={(e) => setNewTableCapacity(parseInt(e.target.value) || 2)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Forme</label>
              <div className="flex gap-2">
                {(["square", "round", "rectangle"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNewTableShape(s)}
                    className={`flex-1 py-1.5 rounded text-xs border transition-colors ${
                      newTableShape === s
                        ? "bg-zinc-600 border-zinc-500 text-white"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400"
                    }`}
                  >
                    {s === "square" ? "Carré" : s === "round" ? "Rond" : "Rect."}
                  </button>
                ))}
              </div>
            </div>

            {newTableShape === "rectangle" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">Orientation</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTableRotation(0)}
                    className={`flex-1 py-1.5 rounded text-xs border transition-colors ${
                      newTableRotation === 0
                        ? "bg-zinc-600 border-zinc-500 text-white"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400"
                    }`}
                  >
                    ↔ Horizontal
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTableRotation(90)}
                    className={`flex-1 py-1.5 rounded text-xs border transition-colors ${
                      newTableRotation === 90
                        ? "bg-zinc-600 border-zinc-500 text-white"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400"
                    }`}
                  >
                    ↕ Vertical
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Options</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewTableMovable(!newTableMovable)}
                  className={`flex-1 py-1.5 rounded text-xs border transition-colors ${
                    newTableMovable
                      ? "bg-zinc-600 border-zinc-500 text-white"
                      : "bg-zinc-800 border-zinc-700 text-zinc-400"
                  }`}
                >
                  Déplaçable
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setAddTableModal(null)}
                className="flex-1 py-2 rounded text-sm border border-zinc-700 text-zinc-400 hover:border-zinc-600"
              >
                Annuler
              </button>
              <button
                onClick={confirmAddTable}
                className="flex-1 py-2 rounded text-sm bg-white text-zinc-900 font-medium hover:bg-zinc-100"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Éditer une table */}
      {editingTable && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-80 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-white">Modifier la table</h3>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Nom</label>
              <input
                className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
                value={editingTable.name}
                onChange={(e) => setEditingTable({ ...editingTable, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Capacité</label>
              <input
                type="number"
                min={1}
                max={20}
                className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
                value={editingTable.capacity}
                onChange={(e) => setEditingTable({ ...editingTable, capacity: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Forme</label>
              <div className="flex gap-2">
                {(["square", "round", "rectangle"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEditingTable({ ...editingTable, shape: s })}
                    className={`flex-1 py-1.5 rounded text-xs border transition-colors ${
                      editingTable.shape === s
                        ? "bg-zinc-600 border-zinc-500 text-white"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400"
                    }`}
                  >
                    {s === "square" ? "Carré" : s === "round" ? "Rond" : "Rect."}
                  </button>
                ))}
              </div>
            </div>

            {editingTable.shape === "rectangle" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">Orientation</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTable({ ...editingTable, rotation: 0 })}
                    className={`flex-1 py-1.5 rounded text-xs border transition-colors ${
                      (editingTable.rotation ?? 0) === 0
                        ? "bg-zinc-600 border-zinc-500 text-white"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400"
                    }`}
                  >
                    ↔ Horizontal
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTable({ ...editingTable, rotation: 90 })}
                    className={`flex-1 py-1.5 rounded text-xs border transition-colors ${
                      (editingTable.rotation ?? 0) === 90
                        ? "bg-zinc-600 border-zinc-500 text-white"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400"
                    }`}
                  >
                    ↕ Vertical
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Options</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTable({ ...editingTable, movable: !(editingTable.movable ?? true) })}
                  className={`flex-1 py-1.5 rounded text-xs border transition-colors ${
                    (editingTable.movable ?? true)
                      ? "bg-zinc-600 border-zinc-500 text-white"
                      : "bg-zinc-800 border-zinc-700 text-zinc-400"
                  }`}
                >
                  Déplaçable
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTable({ ...editingTable, premium: !(editingTable.premium ?? false) })}
                  className={`flex-1 py-1.5 rounded text-xs border transition-colors ${
                    (editingTable.premium ?? false)
                      ? "bg-amber-600 border-amber-500 text-white"
                      : "bg-zinc-800 border-zinc-700 text-zinc-400"
                  }`}
                >
                  Premium
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleDeleteTable(editingTable.id)}
                className="py-2 px-3 rounded text-sm border border-red-800 text-red-400 hover:border-red-600"
              >
                Supprimer
              </button>
              <button
                onClick={() => setEditingTable(null)}
                className="flex-1 py-2 rounded text-sm border border-zinc-700 text-zinc-400 hover:border-zinc-600"
              >
                Annuler
              </button>
              <button
                onClick={handleUpdateTable}
                className="flex-1 py-2 rounded text-sm bg-white text-zinc-900 font-medium hover:bg-zinc-100"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Gérer les services */}
      {showServicesModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-[420px] flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-white">Services</h3>
            <p className="text-xs text-zinc-500 -mt-2">Définissez les plages horaires de chaque service. Seules les réservations dans la fenêtre horaire seront affichées.</p>

            <div className="flex flex-col gap-2">
              {editingServices.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2">
                  <input
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500"
                    placeholder="Nom du service"
                    value={s.name}
                    onChange={(e) => setEditingServices((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  />
                  <input
                    type="time"
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500 w-24"
                    value={s.startTime}
                    onChange={(e) => setEditingServices((prev) => prev.map((x, j) => j === i ? { ...x, startTime: e.target.value } : x))}
                  />
                  <span className="text-zinc-600 text-xs">→</span>
                  <input
                    type="time"
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500 w-24"
                    value={s.endTime}
                    onChange={(e) => setEditingServices((prev) => prev.map((x, j) => j === i ? { ...x, endTime: e.target.value } : x))}
                  />
                  <button
                    onClick={() => setEditingServices((prev) => prev.filter((_, j) => j !== i))}
                    className="text-zinc-600 hover:text-red-400 text-xs transition-colors px-1"
                    title="Supprimer"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setEditingServices((prev) => [...prev, { id: Date.now().toString(), name: "Nouveau service", startTime: "12:00", endTime: "15:00" }])}
              className="text-xs text-zinc-400 hover:text-white border border-dashed border-zinc-700 hover:border-zinc-500 rounded py-1.5 transition-colors"
            >
              + Ajouter un service
            </button>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowServicesModal(false)}
                className="flex-1 py-2 rounded text-sm border border-zinc-700 text-zinc-400 hover:border-zinc-600"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  const valid = editingServices.filter((s) => s.name.trim() && s.startTime && s.endTime);
                  setServices(valid);
                  saveServicesToStorage(valid);
                  // Reset selection if selected service was removed
                  if (selectedServiceId && !valid.find((s) => s.id === selectedServiceId)) {
                    setSelectedServiceId(null);
                  }
                  setShowServicesModal(false);
                }}
                className="flex-1 py-2 rounded text-sm bg-white text-zinc-900 font-medium hover:bg-zinc-100"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
