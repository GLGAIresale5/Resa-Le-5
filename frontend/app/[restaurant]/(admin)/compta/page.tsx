"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../lib/auth-context";
import {
  fetchMonthlyPnL,
  fetchCharges,
  createCharge,
  deleteCharge,
} from "../../../lib/api";
import { MonthlyPnL, ChargeFixe, ChargeCategory } from "../../../types";

const CHARGE_CATEGORIES: { value: ChargeCategory; label: string }[] = [
  { value: "salaires", label: "Salaires" },
  { value: "loyer", label: "Loyer" },
  { value: "assurance", label: "Assurance" },
  { value: "energie", label: "Energie" },
  { value: "divers", label: "Divers" },
];

type Tab = "pnl" | "tva" | "charges";

export default function ComptaPage() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant?.id;

  const [tab, setTab] = useState<Tab>("pnl");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [revenueOverride, setRevenueOverride] = useState<number>(0);
  const [pnl, setPnl] = useState<MonthlyPnL | null>(null);
  const [charges, setCharges] = useState<ChargeFixe[]>([]);
  const [loading, setLoading] = useState(false);

  // New charge form
  const [newLabel, setNewLabel] = useState("");
  const [newAmount, setNewAmount] = useState<number>(0);
  const [newCategory, setNewCategory] = useState<ChargeCategory>("divers");

  const loadPnL = useCallback(async (overrideRevenue?: number) => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const data = await fetchMonthlyPnL(restaurantId, month, overrideRevenue);
      setPnl(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, month]);

  const loadCharges = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const data = await fetchCharges(restaurantId);
      setCharges(data);
    } catch (e) {
      console.error(e);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadPnL();
  }, [loadPnL]);

  useEffect(() => {
    if (tab === "charges") loadCharges();
  }, [tab, loadCharges]);

  const handleAddCharge = async () => {
    if (!restaurantId || !newLabel || newAmount <= 0) return;
    try {
      await createCharge({
        restaurant_id: restaurantId,
        label: newLabel,
        amount: newAmount,
        category: newCategory,
      });
      setNewLabel("");
      setNewAmount(0);
      setNewCategory("divers");
      loadCharges();
      loadPnL(); // refresh P&L with new charges
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCharge = async (chargeId: string) => {
    if (!restaurantId) return;
    try {
      await deleteCharge(chargeId, restaurantId);
      loadCharges();
      loadPnL();
    } catch (e) {
      console.error(e);
    }
  };

  const fmt = (n: number) =>
    n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

  const pctColor = (pct: number) =>
    pct >= 70 ? "text-emerald-300" : pct >= 50 ? "text-amber-300" : "text-red-300";

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-white">Compta simplifiee</h1>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-white focus:border-neutral-500 focus:outline-none"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-full bg-neutral-900 p-1">
        {(["pnl", "tva", "charges"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
              tab === t
                ? "bg-white text-neutral-950"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            {t === "pnl" ? "Resultat" : t === "tva" ? "TVA" : "Charges fixes"}
          </button>
        ))}
      </div>

      {/* Tab: P&L */}
      {tab === "pnl" && (
        <div className="flex flex-col gap-4">
          {/* CA input — auto-fetché depuis revenue_entries, override possible */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <label className="block text-xs text-neutral-400 mb-2">
              CA HT du mois — calculé automatiquement depuis vos saisies de revenus.
              Vous pouvez le forcer manuellement ci-dessous (laissez vide pour utiliser l&apos;auto).
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                step="0.01"
                placeholder="Forcer une valeur..."
                value={revenueOverride || ""}
                onChange={(e) => setRevenueOverride(parseFloat(e.target.value) || 0)}
                className="w-48 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
              />
              <button
                onClick={() => loadPnL(revenueOverride > 0 ? revenueOverride : undefined)}
                className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 transition"
              >
                Recalculer
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-neutral-400">Calcul en cours...</div>
          ) : pnl ? (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-3">
                  <div className="text-xs text-neutral-400">CA HT</div>
                  <div className="text-xl font-semibold text-white mt-1">
                    {fmt(pnl.revenue_ht)}
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-3">
                  <div className="text-xs text-neutral-400">Matières</div>
                  <div className="text-xl font-semibold text-red-300 mt-1">
                    {fmt(pnl.purchases_matieres ?? 0)}
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">
                    Achats totaux: {fmt(pnl.purchases_ht)}
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-3">
                  <div className="text-xs text-neutral-400">Marge brute</div>
                  <div className={`text-xl font-semibold mt-1 ${pnl.gross_margin_ht >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                    {fmt(pnl.gross_margin_ht)}
                  </div>
                  <div className={`text-xs mt-0.5 ${pctColor(pnl.margin_pct)}`}>
                    {pnl.margin_pct.toFixed(1)}% · CA − matières
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-3">
                  <div className="text-xs text-neutral-400">Resultat net</div>
                  <div className={`text-xl font-semibold mt-1 ${pnl.net_result >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                    {fmt(pnl.net_result)}
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">
                    Expl. {fmt(pnl.charges_exploitation ?? 0)} · Fixes {fmt(pnl.fixed_charges)}
                  </div>
                </div>
              </div>

              {/* Dépenses par poste */}
              {(pnl.category_breakdown ?? []).length > 0 && (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
                  <h3 className="text-sm font-medium tracking-tight text-white mb-3">
                    Dépenses par poste (HT)
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {(pnl.category_breakdown ?? []).map((c) => {
                      const pct = pnl.purchases_ht > 0 ? (c.total_ht / pnl.purchases_ht) * 100 : 0;
                      return (
                        <div key={c.category} className="flex items-center gap-3">
                          <span className="text-xs text-white w-32 truncate">{c.label}</span>
                          <div className="flex-1 h-2 rounded-full bg-neutral-950/60 overflow-hidden">
                            <div className="h-full rounded-full bg-white/80" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-neutral-400 w-20 text-right">{fmt(c.total_ht)}</span>
                          <span className="text-[10px] text-neutral-500 w-12 text-right">{c.invoice_count} f.</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-neutral-800 pt-2">
                    <span className="text-xs font-medium text-white">Total achats HT</span>
                    <span className="text-sm font-semibold text-white">{fmt(pnl.purchases_ht)}</span>
                  </div>
                  <p className="mt-2 text-[10px] text-neutral-500">
                    Marge brute = CA − matières. Équipement et hors-restaurant sont exclus du résultat d&apos;exploitation.
                  </p>
                </div>
              )}

              {/* Supplier breakdown */}
              {pnl.supplier_breakdown.length > 0 && (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
                  <h3 className="text-sm font-medium tracking-tight text-white mb-3">
                    Achats par fournisseur
                  </h3>
                  <div className="flex flex-col gap-2">
                    {pnl.supplier_breakdown.map((s) => {
                      const pct =
                        pnl.purchases_ht > 0
                          ? (s.total_ht / pnl.purchases_ht) * 100
                          : 0;
                      return (
                        <div key={s.supplier_name} className="flex items-center gap-3">
                          <span className="text-xs text-white w-28 truncate">
                            {s.supplier_name}
                          </span>
                          <div className="flex-1 h-2 rounded-full bg-neutral-950/60 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-white/80"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-neutral-400 w-20 text-right">
                            {fmt(s.total_ht)}
                          </span>
                          <span className="text-[10px] text-neutral-500 w-12 text-right">
                            {s.invoice_count} fact.
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-8 text-center text-sm text-neutral-400">
              Saisissez votre CA HT pour calculer le resultat du mois.
            </div>
          )}
        </div>
      )}

      {/* Tab: TVA */}
      {tab === "tva" && (
        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-neutral-400">Chargement...</div>
          ) : pnl && pnl.tva_breakdown.length > 0 ? (
            <>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-800 bg-neutral-950/60 text-neutral-400 text-xs">
                      <th className="text-left p-3">Taux TVA</th>
                      <th className="text-right p-3">Base HT</th>
                      <th className="text-right p-3">TVA</th>
                      <th className="text-right p-3">TTC</th>
                      <th className="text-right p-3">Lignes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pnl.tva_breakdown.map((row) => (
                      <tr
                        key={row.tva_rate}
                        className="border-b border-neutral-800 last:border-0"
                      >
                        <td className="p-3 font-medium text-white">
                          {row.tva_rate}%
                        </td>
                        <td className="p-3 text-right text-white">
                          {fmt(row.total_ht)}
                        </td>
                        <td className="p-3 text-right text-white font-medium">
                          {fmt(row.total_tva)}
                        </td>
                        <td className="p-3 text-right text-white">
                          {fmt(row.total_ttc)}
                        </td>
                        <td className="p-3 text-right text-neutral-400">{row.invoice_count}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-neutral-950/60">
                      <td className="p-3 font-semibold text-white">Total</td>
                      <td className="p-3 text-right font-semibold text-white">
                        {fmt(pnl.tva_breakdown.reduce((s, r) => s + r.total_ht, 0))}
                      </td>
                      <td className="p-3 text-right font-semibold text-white">
                        {fmt(pnl.tva_breakdown.reduce((s, r) => s + r.total_tva, 0))}
                      </td>
                      <td className="p-3 text-right font-semibold text-white">
                        {fmt(pnl.tva_breakdown.reduce((s, r) => s + r.total_ttc, 0))}
                      </td>
                      <td className="p-3 text-right text-neutral-400">
                        {pnl.tva_breakdown.reduce((s, r) => s + r.invoice_count, 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-sm text-neutral-400">
              Aucune facture ce mois-ci. La ventilation TVA apparaitra automatiquement.
            </div>
          )}
        </div>
      )}

      {/* Tab: Charges fixes */}
      {tab === "charges" && (
        <div className="flex flex-col gap-4">
          {/* Add charge form */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <h3 className="text-sm font-medium tracking-tight text-white mb-3">
              Ajouter une charge fixe mensuelle
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
              <div>
                <label className="block text-[10px] text-neutral-400 mb-0.5">Libelle</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Ex: Salaire Joao"
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-2 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-neutral-400 mb-0.5">Montant mensuel</label>
                <input
                  type="number"
                  step="0.01"
                  value={newAmount}
                  onChange={(e) => setNewAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-2 py-1.5 text-xs text-white focus:border-neutral-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-neutral-400 mb-0.5">Categorie</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as ChargeCategory)}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950/60 px-2 py-1.5 text-xs text-white focus:border-neutral-500 focus:outline-none"
                >
                  {CHARGE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddCharge}
                disabled={!newLabel || newAmount <= 0}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-neutral-200 transition disabled:opacity-40"
              >
                Ajouter
              </button>
            </div>
          </div>

          {/* Charges list */}
          {charges.length === 0 ? (
            <div className="py-8 text-center text-sm text-neutral-400">
              Aucune charge fixe enregistree.
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
                      <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                        {cat.label}
                      </span>
                      <span className="text-xs text-white font-medium">{fmt(catTotal)}</span>
                    </div>
                    {catCharges.map((charge) => (
                      <div
                        key={charge.id}
                        className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3"
                      >
                        <span className="flex-1 text-sm text-white">{charge.label}</span>
                        <span className="text-sm font-medium text-white">
                          {fmt(charge.amount)}
                        </span>
                        <button
                          onClick={() => handleDeleteCharge(charge.id)}
                          className="text-neutral-500 hover:text-red-300 transition"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.75}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Total */}
              <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-3 mt-2">
                <span className="text-sm font-medium text-white">Total charges fixes</span>
                <span className="text-lg font-semibold text-white">
                  {fmt(charges.reduce((s, c) => s + c.amount, 0))}/mois
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
