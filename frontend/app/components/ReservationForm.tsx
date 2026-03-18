"use client";

import { useState } from "react";
import { Reservation, ReservationCreate, ReservationSource, RestaurantTable } from "../types";

interface ReservationFormProps {
  restaurantId: string;
  tables: RestaurantTable[];
  initialDate?: string;       // "YYYY-MM-DD"
  reservation?: Reservation;  // if set → edit mode
  onSubmit: (data: ReservationCreate) => Promise<void>;
  onCancel: () => void;
}

const SOURCE_LABELS: Record<ReservationSource, string> = {
  manual: "Saisie directe",
  phone: "Téléphone",
  google: "Google",
  instagram: "Instagram",
  facebook: "Facebook",
  web: "Site web",
};

const TIME_SLOTS: string[] = [];
for (let h = 11; h <= 23; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, "0")}:00`);
  TIME_SLOTS.push(`${String(h).padStart(2, "0")}:30`);
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(" ");
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

export default function ReservationForm({
  restaurantId,
  tables,
  initialDate,
  reservation,
  onSubmit,
  onCancel,
}: ReservationFormProps) {
  const isEdit = !!reservation;

  const parsed = reservation ? splitName(reservation.guest_name) : { first: "", last: "" };
  const [guestFirst, setGuestFirst] = useState(parsed.first);
  const [guestLast, setGuestLast] = useState(parsed.last);
  const [guestPhone, setGuestPhone] = useState(reservation?.guest_phone ?? "");
  const [guestEmail, setGuestEmail] = useState(reservation?.guest_email ?? "");
  const [guestCount, setGuestCount] = useState(reservation?.guest_count ?? 2);
  const [date, setDate] = useState(reservation?.date ?? initialDate ?? "");
  const [time, setTime] = useState((reservation?.time ?? "19:30").slice(0, 5));
  const [duration, setDuration] = useState(reservation?.duration ?? 120);
  const [source, setSource] = useState<ReservationSource>(reservation?.source ?? "phone");
  const [tableId, setTableId] = useState(reservation?.table_id ?? "");
  const [notes, setNotes] = useState(reservation?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneRequired = guestCount > 4;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestFirst.trim()) { setError("Le prénom est obligatoire"); return; }
    if (!date) { setError("La date est obligatoire"); return; }
    if (phoneRequired && !guestPhone.trim()) { setError("Le numéro de téléphone est obligatoire pour les groupes de plus de 4 personnes"); return; }
    setError(null);
    setLoading(true);
    try {
      const fullName = [guestFirst.trim(), guestLast.trim()].filter(Boolean).join(" ");
      await onSubmit({
        restaurant_id: restaurantId,
        guest_name: fullName,
        guest_phone: guestPhone.trim() || undefined,
        guest_email: guestEmail.trim() || undefined,
        guest_count: guestCount,
        date,
        time,
        duration,
        source,
        status: reservation?.status ?? "confirmed",
        table_id: tableId || null,
        notes: notes.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-white">
        {isEdit ? "Modifier la réservation" : "Nouvelle réservation"}
      </h3>

      {error && (
        <div className="text-xs text-red-400 bg-red-950/40 border border-red-800 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Prénom + Nom */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Prénom *</label>
          <input
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            placeholder="Prénom"
            value={guestFirst}
            onChange={(e) => setGuestFirst(e.target.value)}
            autoFocus={!isEdit}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Nom</label>
          <input
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            placeholder="Nom de famille"
            value={guestLast}
            onChange={(e) => setGuestLast(e.target.value)}
          />
        </div>
      </div>

      {/* Couverts + Source */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Couverts *</label>
          <input
            type="number"
            min={1}
            max={30}
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
            value={guestCount}
            onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Source</label>
          <select
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
            value={source}
            onChange={(e) => setSource(e.target.value as ReservationSource)}
          >
            {Object.entries(SOURCE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Téléphone */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-400">
          Téléphone{phoneRequired ? " *" : ""}
          {phoneRequired && <span className="ml-1 text-amber-400/70">(obligatoire pour les groupes)</span>}
        </label>
        <input
          className={`bg-zinc-800 border rounded px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 ${
            phoneRequired ? "border-amber-700/60" : "border-zinc-700"
          }`}
          placeholder="06 00 00 00 00"
          value={guestPhone}
          onChange={(e) => setGuestPhone(e.target.value)}
        />
      </div>

      {/* Heure + Durée */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Date *</label>
          <input
            type="date"
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Heure</label>
          <select
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          >
            {TIME_SLOTS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Durée */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-400">Durée</label>
        <div className="flex gap-2">
          {[60, 90, 120, 150, 180].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className={`flex-1 py-1.5 rounded text-xs border transition-colors ${
                duration === d
                  ? "bg-zinc-600 border-zinc-500 text-white"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {d}min
            </button>
          ))}
        </div>
      </div>

      {/* Table (optionnel) */}
      {tables.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Table (optionnel)</label>
          <select
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
          >
            <option value="">— Non assignée —</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.capacity} pers.)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-400">Notes</label>
        <textarea
          className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
          placeholder="Allergie, anniversaire, demande particulière..."
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 rounded text-sm border border-zinc-700 text-zinc-400 hover:border-zinc-600 transition-colors"
          disabled={loading}
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2 rounded text-sm bg-white text-zinc-900 font-medium hover:bg-zinc-100 transition-colors disabled:opacity-50"
        >
          {loading ? "Enregistrement..." : isEdit ? "Mettre à jour" : "Confirmer"}
        </button>
      </div>
    </form>
  );
}
