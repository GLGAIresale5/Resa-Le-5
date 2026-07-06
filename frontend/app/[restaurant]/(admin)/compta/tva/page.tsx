"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../../lib/auth-context";
import { fetchMonthlyPnL } from "../../../../lib/api";
import { MonthlyPnL } from "../../../../types";
import ComptaNav from "../../../../components/ComptaNav";

export default function ComptaTvaPage() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant?.id;

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [pnl, setPnl] = useState<MonthlyPnL | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPnL = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      setPnl(await fetchMonthlyPnL(restaurantId, month));
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

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
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

      {loading ? (
        <div className="py-8 text-center text-sm text-neutral-400">Chargement...</div>
      ) : pnl && pnl.tva_breakdown.length > 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
          <div className="overflow-x-auto">
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
                  <tr key={row.tva_rate} className="border-b border-neutral-800 last:border-0">
                    <td className="p-3 font-medium text-white">{row.tva_rate}%</td>
                    <td className="p-3 text-right text-white">{fmt(row.total_ht)}</td>
                    <td className="p-3 text-right text-white font-medium">{fmt(row.total_tva)}</td>
                    <td className="p-3 text-right text-white">{fmt(row.total_ttc)}</td>
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
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-neutral-400">
          Aucune facture comptabilisée ce mois-ci. La ventilation TVA apparaitra automatiquement.
        </div>
      )}
    </div>
  );
}
