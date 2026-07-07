"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../../lib/auth-context";
import { fetchCharges, createCharge, updateCharge, deleteCharge } from "../../../../lib/api";
import { ChargeFixe, ChargeCategory } from "../../../../types";
import ComptaNav from "../../../../components/ComptaNav";

const CHARGE_CATEGORIES: { value: ChargeCategory; label: string }[] = [
  { value: "salaires", label: "Salaires" },
  { value: "loyer", label: "Loyer" },
  { value: "assurance", label: "Assurance" },
  { value: "energie", label: "Énergie" },
  { value: "divers", label: "Divers" },
];

const parseAmount = (raw: string) => parseFloat(raw.replace(",", ".")) || 0;

export default function ComptaChargesPage() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant?.id;

  const [charges, setCharges] = useState<ChargeFixe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ajout
  const [newLabel, setNewLabel] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState<ChargeCategory>("divers");
  const [adding, setAdding] = useState(false);

  // Édition inline
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const fmtEur = (n: number) =>
    n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

  const load = useCallback(async () => {
    if (!restaurantId) return;
    try {
      setCharges(await fetchCharges(restaurantId));
      setError(null);
    } catch {
      setError("Impossible de charger les charges fixes.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    const amount = parseAmount(newAmount);
    if (!restaurantId || !newLabel.trim() || amount <= 0) return;
    setAdding(true);
    try {
      await createCharge({
        restaurant_id: restaurantId,
        label: newLabel.trim(),
        amount,
        category: newCategory,
      });
      setNewLabel("");
      setNewAmount("");
      setNewCategory("divers");
      await load();
    } catch {
      setError("Erreur lors de l'ajout de la charge.");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (charge: ChargeFixe) => {
    setEditId(charge.id);
    setEditLabel(charge.label);
    setEditAmount(String(charge.amount));
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditLabel("");
    setEditAmount("");
  };

  const handleSave = async (chargeId: string) => {
    const amount = parseAmount(editAmount);
    if (!restaurantId || !editLabel.trim() || amount <= 0) return;
    setSaving(true);
    try {
      await updateCharge(chargeId, restaurantId, {
        label: editLabel.trim(),
        amount,
      });
      cancelEdit();
      await load();
    } catch {
      setError("Erreur lors de la modification de la charge.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (charge: ChargeFixe) => {
    if (!restaurantId) return;
    if (!window.confirm(`Supprimer « ${charge.label} » (${fmtEur(charge.amount)}/mois) ?`)) return;
    try {
      await deleteCharge(charge.id, restaurantId);
      if (editId === charge.id) cancelEdit();
      await load();
    } catch {
      setError("Erreur lors de la suppression de la charge.");
    }
  };

  const total = charges.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-white">Compta</h1>
      </div>

      <ComptaNav />

      {/* Garde-fou anti double-comptage */}
      <p className="text-xs leading-relaxed text-neutral-400">
        Les charges récurrentes SANS facture à scanner (salaire, loyer). Elles sont déduites du
        résultat chaque mois. N&apos;y mettez PAS ce qui arrive déjà en facture (énergie,
        assurance…) pour éviter le double comptage.
      </p>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Ajout d'une charge */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="text-sm font-medium tracking-tight text-white">Nouvelle charge</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-end">
          <div>
            <label className="mb-0.5 block text-[10px] text-neutral-400">Libellé</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Ex : Salaire João"
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] text-neutral-400">Montant mensuel (€)</label>
            <input
              type="text"
              inputMode="decimal"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] text-neutral-400">Catégorie</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as ChargeCategory)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
            >
              {CHARGE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !newLabel.trim() || parseAmount(newAmount) <= 0}
            className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-40"
          >
            {adding ? "Ajout…" : "Ajouter"}
          </button>
        </div>
      </div>

      {/* Liste par catégorie */}
      {loading ? (
        <div className="py-8 text-center text-sm text-neutral-400">Chargement…</div>
      ) : charges.length === 0 ? (
        <div className="py-8 text-center text-sm text-neutral-400">
          Aucune charge fixe enregistrée.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {CHARGE_CATEGORIES.map((cat) => {
            const catCharges = charges.filter((c) => c.category === cat.value);
            if (catCharges.length === 0) return null;
            const catTotal = catCharges.reduce((s, c) => s + c.amount, 0);
            return (
              <div key={cat.value}>
                <div className="flex items-center justify-between px-1 py-1.5">
                  <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                    {cat.label}
                  </span>
                  <span className="text-xs font-medium text-white">{fmtEur(catTotal)}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {catCharges.map((charge) =>
                    editId === charge.id ? (
                      <div
                        key={charge.id}
                        className="flex flex-col gap-2 rounded-xl border border-neutral-700 bg-neutral-900 p-3 sm:flex-row sm:items-center"
                      >
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          placeholder="Libellé"
                          className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          placeholder="Montant"
                          className="w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none sm:w-32"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSave(charge.id)}
                            disabled={saving || !editLabel.trim() || parseAmount(editAmount) <= 0}
                            className="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-40 sm:flex-none"
                          >
                            {saving ? "…" : "Enregistrer"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="rounded-lg border border-neutral-800 px-3 py-2 text-sm text-neutral-300 transition hover:bg-neutral-800/60 hover:text-white"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={charge.id}
                        className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-white">
                          {charge.label}
                        </span>
                        <span className="shrink-0 text-sm font-medium text-white">
                          {fmtEur(charge.amount)}
                        </span>
                        <button
                          onClick={() => startEdit(charge)}
                          title="Modifier"
                          aria-label={`Modifier ${charge.label}`}
                          className="shrink-0 rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-800/60 hover:text-white"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(charge)}
                          title="Supprimer"
                          aria-label={`Supprimer ${charge.label}`}
                          className="shrink-0 rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-800/60 hover:text-red-300"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })}

          {/* Total */}
          <div className="mt-2 flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-3">
            <span className="text-sm font-medium text-white">Total charges fixes</span>
            <span className="text-lg font-semibold text-white">{fmtEur(total)}/mois</span>
          </div>
        </div>
      )}
    </div>
  );
}
