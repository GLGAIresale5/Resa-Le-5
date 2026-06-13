"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../lib/auth-context";
import { fetchDashboardSummary } from "../../../lib/api";
import { DashboardSummary } from "../../../types";

// ─── Helpers ─────────────────────────────────────────────────
function fmt(n: number): string {
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  });
}

// ─── Metric Card ─────────────────────────────────────────────
function MetricCard({
  label,
  value,
  sub,
  accent,
  alert,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  alert?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
        {label}
      </span>
      <span
        className={`text-2xl font-semibold tracking-tight ${
          alert ? "text-red-300" : accent ? "text-emerald-300" : "text-white"
        }`}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-neutral-400">{sub}</span>}
    </div>
  );
}

// ─── Bar chart (pure CSS) ────────────────────────────────────
function WeeklyChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <h3 className="text-sm font-medium text-neutral-400 mb-6 tracking-tight">
        Achats par semaine (HT)
      </h3>
      <div className="flex items-end gap-3 h-44">
        {data.map((d) => {
          const pct = (d.value / max) * 100;
          return (
            <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-xs font-medium text-neutral-400">{fmt(d.value)}</span>
              <div className="w-full flex justify-center">
                <div
                  className={`w-10 rounded-t-lg transition-all duration-500 ${
                    d.value > 0 ? "bg-white/80" : "bg-neutral-800"
                  }`}
                  style={{
                    height: `${pct}%`,
                    minHeight: "8px",
                  }}
                />
              </div>
              <span className="text-xs text-neutral-400">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Top suppliers ───────────────────────────────────────────
function TopSuppliers({
  suppliers,
  totalHt,
}: {
  suppliers: { name: string; total_ht: number }[];
  totalHt: number;
}) {
  if (suppliers.length === 0) return null;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <h3 className="text-sm font-medium text-neutral-400 mb-4 tracking-tight">
        Top fournisseurs du mois
      </h3>
      <div className="flex flex-col gap-2.5">
        {suppliers.map((s) => {
          const pct = totalHt > 0 ? (s.total_ht / totalHt) * 100 : 0;
          return (
            <div key={s.name} className="flex items-center gap-3">
              <span className="text-xs text-white w-28 truncate">
                {s.name}
              </span>
              <div className="flex-1 h-2 rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-white/80"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-neutral-400 w-20 text-right">
                {fmt(s.total_ht)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Stock alerts ────────────────────────────────────────────
function StockAlerts({
  critical,
  warning,
}: {
  critical: number;
  warning: number;
}) {
  if (critical === 0 && warning === 0) return null;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <h3 className="text-sm font-medium text-neutral-400 mb-3 tracking-tight">Alertes stocks</h3>
      <div className="flex gap-4">
        {critical > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/15 px-3 py-2">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="text-sm font-medium text-red-300">
              {critical} critique{critical > 1 ? "s" : ""}
            </span>
          </div>
        )}
        {warning > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/15 px-3 py-2">
            <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="text-sm font-medium text-amber-300">
              {warning} a commander
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────
export default function DashboardPage() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant?.id;
  const name = restaurant?.name ?? "Mon restaurant";

  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(false);
    try {
      const summary = await fetchDashboardSummary(restaurantId);
      setData(summary);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-sm text-neutral-400">Chargement du tableau de bord...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Bienvenue, <span className="text-emerald-300">{name}</span>
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Commencez par saisir vos factures fournisseurs et vos stocks pour voir
            apparaitre vos indicateurs ici.
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Achats du mois" value="--" sub="Aucune facture" />
          <MetricCard label="Factures" value="0" sub="Aucune saisie" />
          <MetricCard label="Articles en stock" value="0" sub="Catalogue vide" />
          <MetricCard label="Charges fixes" value="--" sub="Non renseignees" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white tracking-tight">
          Bienvenue, <span className="text-emerald-300">{name}</span>
        </h1>
        <p className="text-sm text-neutral-400 mt-1">
          {data.month.slice(0, 4)}/{data.month.slice(5)} — {data.invoice_count} facture
          {data.invoice_count !== 1 ? "s" : ""} enregistree
          {data.invoice_count !== 1 ? "s" : ""}
        </p>
      </div>

      {/* KPI cards — Performance financière */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <MetricCard
          label="CA du mois"
          value={fmt(data.revenue_ht ?? 0)}
          sub={
            data.revenue_sources && data.revenue_sources.length
              ? `Source ${data.revenue_sources.join("+")}`
              : "Aucune saisie de revenus"
          }
          accent={(data.revenue_ht ?? 0) > 0}
        />
        <MetricCard
          label="Achats du mois"
          value={fmt(data.purchases_ht)}
          sub={`${data.invoice_count} facture${data.invoice_count !== 1 ? "s" : ""}`}
        />
        <MetricCard
          label="Resultat net"
          value={fmt(data.net_result ?? 0)}
          sub={`Marge brute ${(data.margin_pct ?? 0).toFixed(1)}%`}
          alert={(data.net_result ?? 0) < 0}
          accent={(data.net_result ?? 0) > 0}
        />
      </div>

      {/* KPI cards — Operations */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <MetricCard
          label="En attente"
          value={data.pending_invoices.toString()}
          sub="Factures a valider"
          alert={data.pending_invoices > 0}
        />
        <MetricCard
          label="Articles en stock"
          value={data.stock_count.toString()}
          sub={
            data.stock_alerts_critical > 0
              ? `${data.stock_alerts_critical} alerte${data.stock_alerts_critical > 1 ? "s" : ""}`
              : "Tout est bon"
          }
        />
        <MetricCard
          label="Charges fixes"
          value={fmt(data.fixed_charges)}
          sub="Par mois"
        />
      </div>

      {/* Stock alerts */}
      <div className="mb-6">
        <StockAlerts
          critical={data.stock_alerts_critical}
          warning={data.stock_alerts_warning}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <WeeklyChart data={data.weekly_purchases} />
        <TopSuppliers suppliers={data.top_suppliers} totalHt={data.purchases_ht} />
      </div>
    </div>
  );
}
