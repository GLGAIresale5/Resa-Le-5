"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../lib/auth-context";
import {
  fetchInvoices,
  createInvoice,
  updateInvoiceStatus,
  deleteInvoice,
  fetchInvoiceStats,
} from "../../../lib/api";
import { SupplierInvoice, InvoiceStatus, InvoiceStats } from "../../../types";

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  pending: "En attente",
  validated: "Validee",
  paid: "Payee",
  disputed: "Litige",
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  validated: "bg-sky-500/15 text-sky-300",
  paid: "bg-emerald-500/15 text-emerald-300",
  disputed: "bg-red-500/15 text-red-300",
};

const TVA_RATES = [
  { label: "20%", value: 20 },
  { label: "10%", value: 10 },
  { label: "5.5%", value: 5.5 },
];

type Tab = "liste" | "nouvelle" | "stats";

interface LineForm {
  description: string;
  quantity: number;
  unit: string;
  unit_price_ht: number;
  tva_rate: number;
}

const emptyLine = (): LineForm => ({
  description: "",
  quantity: 1,
  unit: "unite",
  unit_price_ht: 0,
  tva_rate: 20,
});

export default function FacturesPage() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant?.id;

  const [tab, setTab] = useState<Tab>("liste");
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New invoice form
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);

  const loadInvoices = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const data = await fetchInvoices(restaurantId, {
        status: filterStatus || undefined,
      });
      setInvoices(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, filterStatus]);

  const loadStats = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const data = await fetchInvoiceStats(restaurantId, currentMonth);
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    if (tab === "stats") loadStats();
  }, [tab, loadStats]);

  // Line management
  const addLine = () => setLines([...lines, emptyLine()]);
  const removeLine = (i: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, idx) => idx !== i));
  };
  const updateLine = (i: number, field: keyof LineForm, value: string | number) => {
    const updated = [...lines];
    (updated[i] as any)[field] = value;
    setLines(updated);
  };

  const lineTotalHT = (l: LineForm) => Math.round(l.quantity * l.unit_price_ht * 100) / 100;
  const lineTotalTTC = (l: LineForm) =>
    Math.round(l.quantity * l.unit_price_ht * (1 + l.tva_rate / 100) * 100) / 100;

  const formTotalHT = lines.reduce((s, l) => s + lineTotalHT(l), 0);
  const formTotalTVA = lines.reduce(
    (s, l) => s + Math.round(l.quantity * l.unit_price_ht * l.tva_rate / 100 * 100) / 100,
    0
  );
  const formTotalTTC = formTotalHT + formTotalTVA;

  const handleSubmit = async () => {
    if (!restaurantId || !supplierName || lines.length === 0) return;
    setSubmitting(true);
    try {
      await createInvoice({
        restaurant_id: restaurantId,
        supplier_name: supplierName,
        invoice_number: invoiceNumber || undefined,
        invoice_date: invoiceDate,
        due_date: dueDate || undefined,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unit_price_ht: l.unit_price_ht,
          tva_rate: l.tva_rate,
        })),
      });
      // Reset form
      setSupplierName("");
      setInvoiceNumber("");
      setInvoiceDate(new Date().toISOString().slice(0, 10));
      setDueDate("");
      setNotes("");
      setLines([emptyLine()]);
      setTab("liste");
      loadInvoices();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (invoiceId: string, newStatus: string) => {
    if (!restaurantId) return;
    try {
      await updateInvoiceStatus(invoiceId, restaurantId, newStatus);
      loadInvoices();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (invoiceId: string) => {
    if (!restaurantId) return;
    try {
      await deleteInvoice(invoiceId, restaurantId);
      loadInvoices();
    } catch (e) {
      console.error(e);
    }
  };

  const fmt = (n: number) =>
    n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-white">Factures fournisseurs</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-full bg-neutral-900 p-1">
        {(["liste", "nouvelle", "stats"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
              tab === t
                ? "bg-white text-neutral-950"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            {t === "liste" ? "Liste" : t === "nouvelle" ? "Nouvelle facture" : "Stats"}
          </button>
        ))}
      </div>

      {/* Tab: Liste */}
      {tab === "liste" && (
        <div className="flex flex-col gap-3">
          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto">
            {["", "pending", "validated", "paid", "disputed"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  filterStatus === s
                    ? "bg-white text-neutral-950"
                    : "bg-neutral-900 text-neutral-400 hover:text-white"
                }`}
              >
                {s === "" ? "Toutes" : STATUS_LABELS[s as InvoiceStatus]}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-neutral-400">Chargement...</div>
          ) : invoices.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-400">
              Aucune facture.{" "}
              <button onClick={() => setTab("nouvelle")} className="text-white underline">
                Creer la premiere
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-lg border border-neutral-800 bg-neutral-900"
                >
                  {/* Summary row */}
                  <button
                    onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate">
                          {inv.supplier_name}
                        </span>
                        {inv.invoice_number && (
                          <span className="text-xs text-neutral-400">#{inv.invoice_number}</span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5">
                        {new Date(inv.invoice_date).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-white">{fmt(inv.total_ttc)}</div>
                      <div className="text-[10px] text-neutral-400">HT {fmt(inv.total_ht)}</div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        STATUS_COLORS[inv.status]
                      }`}
                    >
                      {STATUS_LABELS[inv.status]}
                    </span>
                    <svg
                      className={`h-4 w-4 text-neutral-400 transition-transform ${
                        expandedId === inv.id ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded detail */}
                  {expandedId === inv.id && (
                    <div className="border-t border-neutral-800 p-3 space-y-3">
                      {/* Lines table */}
                      {inv.lines.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-neutral-400">
                                <th className="text-left py-1 pr-2">Article</th>
                                <th className="text-right py-1 px-2">Qte</th>
                                <th className="text-right py-1 px-2">PU HT</th>
                                <th className="text-right py-1 px-2">TVA</th>
                                <th className="text-right py-1 pl-2">Total TTC</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inv.lines.map((line) => (
                                <tr key={line.id} className="text-white">
                                  <td className="py-1 pr-2">{line.description}</td>
                                  <td className="text-right py-1 px-2">
                                    {line.quantity} {line.unit}
                                  </td>
                                  <td className="text-right py-1 px-2">
                                    {fmt(line.unit_price_ht)}
                                  </td>
                                  <td className="text-right py-1 px-2">{line.tva_rate}%</td>
                                  <td className="text-right py-1 pl-2 font-medium">
                                    {fmt(line.total_ttc ?? 0)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Totals */}
                      <div className="flex justify-end gap-4 text-xs">
                        <span className="text-neutral-400">
                          HT: <span className="text-white font-medium">{fmt(inv.total_ht)}</span>
                        </span>
                        <span className="text-neutral-400">
                          TVA: <span className="text-white font-medium">{fmt(inv.total_tva)}</span>
                        </span>
                        <span className="text-neutral-400">
                          TTC: <span className="text-white font-semibold">{fmt(inv.total_ttc)}</span>
                        </span>
                      </div>

                      {inv.notes && (
                        <p className="text-xs text-neutral-400 italic">{inv.notes}</p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap">
                        {inv.status === "pending" && (
                          <button
                            onClick={() => handleStatusChange(inv.id, "validated")}
                            className="rounded-md bg-sky-500/15 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/25 transition"
                          >
                            Valider
                          </button>
                        )}
                        {(inv.status === "pending" || inv.status === "validated") && (
                          <button
                            onClick={() => handleStatusChange(inv.id, "paid")}
                            className="rounded-md bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 transition"
                          >
                            Marquer payee
                          </button>
                        )}
                        {inv.status !== "disputed" && (
                          <button
                            onClick={() => handleStatusChange(inv.id, "disputed")}
                            className="rounded-md bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/25 transition"
                          >
                            Litige
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(inv.id)}
                          className="rounded-md bg-neutral-950/60 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-red-300 transition ml-auto"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Nouvelle facture */}
      {tab === "nouvelle" && (
        <div className="flex flex-col gap-4">
          {/* Header fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Fournisseur *</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Ex: Metro, J Milliet..."
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">N de facture</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="FAC-2026-001"
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Date facture *</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Echeance</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500"
              />
            </div>
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-white">Lignes de facture</label>
              <button
                onClick={addLine}
                className="text-xs text-white hover:underline"
              >
                + Ajouter une ligne
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {lines.map((line, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 gap-2 items-end rounded-lg border border-neutral-800 bg-neutral-900 p-2"
                >
                  <div className="col-span-12 md:col-span-4">
                    <label className="block text-[10px] text-neutral-400 mb-0.5">Description</label>
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => updateLine(i, "description", e.target.value)}
                      placeholder="Article..."
                      className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
                    />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <label className="block text-[10px] text-neutral-400 mb-0.5">Quantite</label>
                    <input
                      type="number"
                      step="0.01"
                      value={line.quantity}
                      onChange={(e) => updateLine(i, "quantity", parseFloat(e.target.value) || 0)}
                      className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-neutral-500"
                    />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <label className="block text-[10px] text-neutral-400 mb-0.5">PU HT</label>
                    <input
                      type="number"
                      step="0.01"
                      value={line.unit_price_ht}
                      onChange={(e) =>
                        updateLine(i, "unit_price_ht", parseFloat(e.target.value) || 0)
                      }
                      className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-neutral-500"
                    />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <label className="block text-[10px] text-neutral-400 mb-0.5">TVA</label>
                    <select
                      value={line.tva_rate}
                      onChange={(e) =>
                        updateLine(i, "tva_rate", parseFloat(e.target.value))
                      }
                      className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-neutral-500"
                    >
                      {TVA_RATES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 md:col-span-1 flex items-end justify-end">
                    <span className="text-xs font-medium text-white">
                      {fmt(lineTotalTTC(line))}
                    </span>
                  </div>
                  <div className="col-span-1 flex items-end justify-center">
                    {lines.length > 1 && (
                      <button
                        onClick={() => removeLine(i)}
                        className="text-neutral-400 hover:text-red-300 transition"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end gap-6 text-sm">
            <span className="text-neutral-400">
              HT: <span className="text-white font-medium">{fmt(formTotalHT)}</span>
            </span>
            <span className="text-neutral-400">
              TVA: <span className="text-white font-medium">{fmt(formTotalTVA)}</span>
            </span>
            <span className="text-neutral-400">
              TTC:{" "}
              <span className="text-white font-semibold text-base">{fmt(formTotalTTC)}</span>
            </span>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Remarques, ecarts avec le BL..."
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 resize-none"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !supplierName || lines.every((l) => !l.description)}
            className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Enregistrement..." : "Enregistrer la facture"}
          </button>
        </div>
      )}

      {/* Tab: Stats */}
      {tab === "stats" && (
        <div className="flex flex-col gap-4">
          {stats ? (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                  <div className="text-xs text-neutral-400">Factures ce mois</div>
                  <div className="text-xl font-semibold text-white mt-1">{stats.count}</div>
                </div>
                <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                  <div className="text-xs text-neutral-400">Total HT</div>
                  <div className="text-xl font-semibold text-white mt-1">{fmt(stats.total_ht)}</div>
                </div>
                <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                  <div className="text-xs text-neutral-400">Total TTC</div>
                  <div className="text-xl font-semibold text-white mt-1">{fmt(stats.total_ttc)}</div>
                </div>
                <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                  <div className="text-xs text-neutral-400">En attente</div>
                  <div className="text-xl font-semibold text-amber-300 mt-1">
                    {stats.by_status.pending}
                  </div>
                </div>
              </div>

              {/* By supplier */}
              {Object.keys(stats.by_supplier).length > 0 && (
                <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
                  <h3 className="text-sm font-medium tracking-tight text-white mb-3">Par fournisseur (HT)</h3>
                  <div className="flex flex-col gap-2">
                    {Object.entries(stats.by_supplier)
                      .sort(([, a], [, b]) => b - a)
                      .map(([name, amount]) => {
                        const pct = stats.total_ht > 0 ? (amount / stats.total_ht) * 100 : 0;
                        return (
                          <div key={name} className="flex items-center gap-3">
                            <span className="text-xs text-white w-28 truncate">{name}</span>
                            <div className="flex-1 h-2 rounded-full bg-neutral-950 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-white/80"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-neutral-400 w-20 text-right">{fmt(amount)}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* By status */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
                <h3 className="text-sm font-medium tracking-tight text-white mb-3">Par statut</h3>
                <div className="flex gap-3 flex-wrap">
                  {(Object.entries(stats.by_status) as [InvoiceStatus, number][]).map(
                    ([status, count]) => (
                      <div
                        key={status}
                        className={`rounded-lg px-3 py-2 text-center ${STATUS_COLORS[status]}`}
                      >
                        <div className="text-lg font-semibold">{count}</div>
                        <div className="text-[10px]">{STATUS_LABELS[status]}</div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-sm text-neutral-400">Chargement des stats...</div>
          )}
        </div>
      )}
    </div>
  );
}
