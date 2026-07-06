"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../lib/auth-context";
import { fetchMonthlyPnL } from "../../../lib/api";
import { MonthlyPnL } from "../../../types";
import ComptaNav from "../../../components/ComptaNav";

export default function ComptaApercuPage() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant?.id;

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [revenueOverride, setRevenueOverride] = useState<number>(0);
  const [pnl, setPnl] = useState<MonthlyPnL | null>(null);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    loadPnL();
  }, [loadPnL]);

  const fmt = (n: number) =>
    n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

  const pctColor = (pct: number) =>
    pct >= 70 ? "text-emerald-300" : pct >= 50 ? "text-amber-300" : "text-red-300";

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-white">Compta</h1>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-white focus:border-neutral-500 focus:outline-none"
        />
      </div>

      <ComptaNav />

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-3">
            <div className="text-xs text-neutral-400">CA HT</div>
            <div className="text-xl font-semibold text-white mt-1">{fmt(pnl.revenue_ht)}</div>
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
      ) : (
        <div className="py-8 text-center text-sm text-neutral-400">
          Saisissez votre CA HT pour calculer le resultat du mois.
        </div>
      )}
    </div>
  );
}
