"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { RestaurantTable, Reservation } from "../types";

const GRID_SIZE = 1; // % — snap grid resolution (1% = 100×100 grid)

function snapToGrid(val: number): number {
  return Math.round(val / GRID_SIZE) * GRID_SIZE;
}

interface FloorPlanProps {
  tables: RestaurantTable[];
  reservations: Reservation[];
  editMode: boolean;
  selectedTableId?: string | null;
  proposedGroupIds?: string[];
  draggingReservationId?: string | null;
  onTableMove?: (tableId: string, x: number, y: number) => void;
  onTableClick?: (table: RestaurantTable) => void;
  onAddTable?: (x: number, y: number) => void;
  onDropReservation?: (tableId: string, reservationId: string) => void;
}

function getTableStatus(
  table: RestaurantTable,
  reservations: Reservation[]
): "free" | "reserved" | "occupied" {
  const reserved = reservations.filter((r) => r.table_id === table.id && r.status === "confirmed");
  if (reserved.length > 0) return "reserved";
  return "free";
}

function TableShape({
  shape,
  width,
  height,
  status,
  selected,
  editMode,
  inMergeGroup,
  inProposedGroup,
  isDropTarget,
}: {
  shape: string;
  width: number;
  height: number;
  status: "free" | "reserved" | "occupied";
  selected: boolean;
  editMode: boolean;
  inMergeGroup?: boolean;
  inProposedGroup?: boolean;
  isDropTarget?: boolean;
}) {
  const borderColor = isDropTarget
    ? "border-blue-400"
    : inProposedGroup
    ? "border-orange-400"
    : inMergeGroup
    ? "border-violet-400"
    : selected
    ? "border-blue-400"
    : editMode
    ? "border-zinc-500"
    : status === "reserved"
    ? "border-amber-400"
    : status === "occupied"
    ? "border-red-400"
    : "border-emerald-400";

  const bgColor = isDropTarget
    ? "bg-blue-900/60"
    : inProposedGroup
    ? "bg-orange-900/50"
    : inMergeGroup
    ? "bg-violet-900/40"
    : selected
    ? "bg-blue-900/60"
    : editMode
    ? "bg-zinc-700/60"
    : status === "reserved"
    ? "bg-amber-900/40"
    : status === "occupied"
    ? "bg-red-900/40"
    : "bg-emerald-900/30";

  const base = `border-2 ${borderColor} ${bgColor} flex items-center justify-center transition-colors`;

  if (shape === "round") {
    return <div className={base} style={{ width, height, borderRadius: "50%" }} />;
  }
  if (shape === "rectangle") {
    return <div className={base} style={{ width: width * 1.5, height, borderRadius: 4 }} />;
  }
  return <div className={base} style={{ width, height, borderRadius: 4 }} />;
}

export default function FloorPlan({
  tables,
  reservations,
  editMode,
  selectedTableId,
  proposedGroupIds = [],
  draggingReservationId,
  onTableMove,
  onTableClick,
  onAddTable,
  onDropReservation,
}: FloorPlanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{
    tableId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const didDragRef = useRef(false);
  const tablesRef = useRef(tables);
  useEffect(() => { tablesRef.current = tables; }, [tables]);

  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const [localPositions, setLocalPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const proposedGroupSet = new Set(proposedGroupIds);

  const getPos = (table: RestaurantTable) => {
    const local = localPositions[table.id];
    return local ?? { x: table.x, y: table.y };
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, table: RestaurantTable) => {
      if (!editMode) return;
      e.preventDefault();
      e.stopPropagation();
      didDragRef.current = false;
      const pos = localPositions[table.id] ?? { x: table.x, y: table.y };
      draggingRef.current = {
        tableId: table.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: pos.x,
        origY: pos.y,
      };
      setDraggingTableId(table.id);
    },
    [editMode, localPositions]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingRef.current || !containerRef.current) return;
    const { tableId, startX, startY, origX, origY } = draggingRef.current;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - startX) / rect.width) * 100;
    const dy = ((e.clientY - startY) / rect.height) * 100;

    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      didDragRef.current = true;
    }

    const rawX = Math.min(95, Math.max(2, origX + dx));
    const rawY = Math.min(95, Math.max(2, origY + dy));
    const draggingTable = tablesRef.current.find((t) => t.id === tableId);
    const shouldSnap = draggingTable?.snap !== false;
    const newX = shouldSnap ? snapToGrid(rawX) : rawX;
    const newY = shouldSnap ? snapToGrid(rawY) : rawY;

    setLocalPositions((prev) => ({ ...prev, [tableId]: { x: newX, y: newY } }));
  }, []);

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!draggingRef.current) return;
      const { tableId } = draggingRef.current;
      const pos = localPositions[tableId];
      if (pos && onTableMove) {
        onTableMove(tableId, pos.x, pos.y);
      }
      draggingRef.current = null;
      setDraggingTableId(null);
    },
    [localPositions, onTableMove]
  );

  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (!editMode || !onAddTable || draggingTableId) return;
      if ((e.target as HTMLElement).closest("[data-table]")) return;
      if ((e.target as HTMLElement).closest("[data-merge-badge]")) return;
      const rect = containerRef.current!.getBoundingClientRect();
      const x = snapToGrid(((e.clientX - rect.left) / rect.width) * 100);
      const y = snapToGrid(((e.clientY - rect.top) / rect.height) * 100);
      onAddTable(x, y);
    },
    [editMode, onAddTable, draggingTableId]
  );

  // Whether a reservation drag is in progress (from list or from a table)
  const isReservationDrag = !!draggingReservationId || !!dropTargetId;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full rounded-lg border ${
        editMode ? "border-blue-500/40 bg-zinc-800/60 cursor-crosshair" : "border-zinc-700 bg-zinc-800/40"
      } select-none overflow-hidden`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleContainerClick}
    >
      {/* Grid — visible only in edit mode */}
      {editMode && (
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #71717a 1px, transparent 1px), linear-gradient(to bottom, #71717a 1px, transparent 1px)",
            backgroundSize: `${GRID_SIZE}% ${GRID_SIZE}%`,
          }}
        />
      )}

      {editMode && (
        <div className="absolute top-2 left-2 text-xs text-blue-400/70 pointer-events-none">
          Cliquer pour ajouter · Glisser pour déplacer
        </div>
      )}

      {tables.map((table) => {
        const pos = getPos(table);
        const status = getTableStatus(table, reservations);
        const isSelected = selectedTableId === table.id;
        const isDragging = draggingTableId === table.id;
        const rotation = table.rotation ?? 0;
        const tableW = table.shape === "rectangle" ? table.width * 1.5 : table.width;
        const tableH = table.height;
        const res = reservations.find((r) => r.table_id === table.id && r.status === "confirmed");
        // Edit mode only: violet = movable table. View mode: normal status colors, badges only.
        const inMergeGroup = editMode && (table.movable !== false);
        const inProposedGroup = !editMode && proposedGroupSet.has(table.id);
        const isDropTarget = dropTargetId === table.id;

        return (
          <div
            key={table.id}
            data-table
            draggable={!editMode && !!res}
            className={`absolute flex flex-col items-center justify-center group ${
              editMode
                ? "cursor-grab active:cursor-grabbing"
                : res
                ? "cursor-grab"
                : "cursor-pointer"
            } ${isDragging ? "opacity-80 z-10" : "z-0"} ${inProposedGroup ? "animate-pulse" : ""}`}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
              width: tableW,
              height: tableH,
            }}
            onMouseDown={(e) => handleMouseDown(e, table)}
            onClick={(e) => {
              e.stopPropagation();
              if (didDragRef.current) return;
              onTableClick?.(table);
            }}
            onDragStart={(e) => {
              if (editMode || !res) return;
              e.dataTransfer.setData("reservationId", res.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (editMode) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDropTargetId(table.id);
            }}
            onDragLeave={(e) => {
              // Only clear if leaving the table element itself (not its children)
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDropTargetId(null);
              }
            }}
            onDrop={(e) => {
              if (editMode) return;
              e.preventDefault();
              e.stopPropagation();
              setDropTargetId(null);
              const reservationId = e.dataTransfer.getData("reservationId");
              if (reservationId) onDropReservation?.(table.id, reservationId);
            }}
          >
            <TableShape
              shape={table.shape}
              width={table.width}
              height={table.height}
              status={status}
              selected={isSelected}
              editMode={editMode}
              inMergeGroup={inMergeGroup}
              inProposedGroup={inProposedGroup}
              isDropTarget={isDropTarget}
            />
            <span
              className="absolute text-[10px] font-bold text-white pointer-events-none"
              style={{ transform: `rotate(${-rotation}deg)` }}
            >
              {table.name}
            </span>
            <span
              className="absolute -bottom-4 text-[9px] text-zinc-400 pointer-events-none"
              style={{ transform: `rotate(${-rotation}deg)` }}
            >
              {table.capacity}p
            </span>
            {!editMode && res && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                {res.guest_name} · {res.guest_count}p · {res.time}
              </div>
            )}
          </div>
        );
      })}


      {/* Drag hint — visible while dragging a reservation */}
      {!editMode && isReservationDrag && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-blue-300/80 pointer-events-none bg-zinc-900/80 px-2 py-0.5 rounded-full border border-blue-800/50">
          Déposer sur une table
        </div>
      )}

      {/* Legend */}
      {!editMode && (
        <div className="absolute bottom-2 right-2 flex gap-3 text-[10px] text-zinc-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Libre
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Réservée
          </span>
          {proposedGroupIds.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Groupement proposé
            </span>
          )}
        </div>
      )}
    </div>
  );
}
