"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../../lib/auth-context";
import { fetchMonthlyPnL } from "../../../../lib/api";
import { MonthlyPnL } from "../../../../types";
import ComptaNav from "../../../../components/ComptaNav";

export default function ComptaBilanPage() {
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
      ) : pnl ? (
        <>
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

          {/* Achats par fournisseur */}
          {pnl.supplier_breakdown.length > 0 && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
              <h3 className="text-sm font-medium tracking-tight text-white mb-3">
                Achats par fournisseur
              </h3>
              <div className="flex flex-col gap-2">
                {pnl.supplier_breakdown.map((s) => {
                  const pct = pnl.purchases_ht > 0 ? (s.total_ht / pnl.purchases_ht) * 100 : 0;
                  return (
                    <div key={s.supplier_name} className="flex items-center gap-3">
                      <span className="text-xs text-white w-28 truncate">{s.supplier_name}</span>
                      <div className="flex-1 h-2 rounded-full bg-neutral-950/60 overflow-hidden">
                        <div className="h-full rounded-full bg-white/80" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-neutral-400 w-20 text-right">{fmt(s.total_ht)}</span>
                      <span className="text-[10px] text-neutral-500 w-12 text-right">{s.invoice_count} fact.</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(pnl.category_breakdown ?? []).length === 0 && pnl.supplier_breakdown.length === 0 && (
            <div className="py-8 text-center text-sm text-neutral-400">
              Aucune facture comptabilisée ce mois-ci.
            </div>
          )}
        </>
      ) : (
        <div className="py-8 text-center text-sm text-neutral-400">Chargement...</div>
      )}
    </div>
  );
}
