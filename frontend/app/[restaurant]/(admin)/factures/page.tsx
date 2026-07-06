"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../../../lib/auth-context";
import {
  fetchInvoices,
  createInvoice,
  updateInvoiceStatus,
  deleteInvoice,
} from "../../../lib/api";
import { SupplierInvoice, InvoiceStatus, InvoiceCategory } from "../../../types";

const CATEGORIES: { value: InvoiceCategory; label: string }[] = [
  { value: "matieres", label: "Matières premières" },
  { value: "exploitation", label: "Charges d'exploitation" },
  { value: "equipement", label: "Équipement / matériel" },
  { value: "hors_resto", label: "Hors restaurant" },
];

const CATEGORY_LABELS: Record<InvoiceCategory, string> = {
  matieres: "Matières",
  exploitation: "Exploitation",
  equipement: "Équipement",
  hors_resto: "Hors resto",
};

const CATEGORY_COLORS: Record<InvoiceCategory, string> = {
  matieres: "bg-emerald-500/15 text-emerald-300",
  exploitation: "bg-sky-500/15 text-sky-300",
  equipement: "bg-violet-500/15 text-violet-300",
  hors_resto: "bg-neutral-500/20 text-neutral-300",
};

// Vues de workflow (par statut). "paid" est un statut hérité (import Tablo)
// affiché comme "Comptabilisée", plus jamais écrit.
type View = "a_comptabiliser" | "comptabilisees" | "litiges" | "toutes";

const VIEWS: { value: View; label: string }[] = [
  { value: "a_comptabiliser", label: "À comptabiliser" },
  { value: "comptabilisees", label: "Comptabilisées" },
  { value: "litiges", label: "Litiges" },
  { value: "toutes", label: "Toutes" },
];

const BOOKED: InvoiceStatus[] = ["validated", "paid"];

function statusDisplay(status: InvoiceStatus): { label: string; color: string } {
  if (status === "pending") return { label: "À comptabiliser", color: "bg-amber-500/15 text-amber-300" };
  if (status === "disputed") return { label: "Litige", color: "bg-red-500/15 text-red-300" };
  return { label: "Comptabilisée", color: "bg-emerald-500/15 text-emerald-300" };
}

function matchView(status: InvoiceStatus, view: View): boolean {
  if (view === "toutes") return true;
  if (view === "a_comptabiliser") return status === "pending";
  if (view === "litiges") return status === "disputed";
  return BOOKED.includes(status); // comptabilisees
}

const TVA_RATES = [
  { label: "20%", value: 20 },
  { label: "10%", value: 10 },
  { label: "5.5%", value: 5.5 },
];

type Tab = "liste" | "nouvelle";

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
  const [view, setView] = useState<View>("a_comptabiliser");
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filtres (s'appliquent sur toutes les vues)
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterCategory, setFilterCategory] = useState<InvoiceCategory | "">("");
  const [filterSupplier, setFilterSupplier] = useState("");

  // New invoice form
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState<InvoiceCategory>("matieres");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);

  // Un seul fetch : on filtre et on trie côté écran (dataset petit) → onglets
  // instantanés et compteurs live.
  const loadInvoices = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const data = await fetchInvoices(restaurantId);
      setInvoices(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Compteurs (sur l'ensemble, indépendants des filtres)
  const pendingCount = useMemo(
    () => invoices.filter((i) => i.status === "pending").length,
    [invoices]
  );
  const litigeCount = useMemo(
    () => invoices.filter((i) => i.status === "disputed").length,
    [invoices]
  );

  // Options de filtres dérivées des données
  const supplierOptions = useMemo(
    () => Array.from(new Set(invoices.map((i) => i.supplier_name))).sort((a, b) => a.localeCompare(b, "fr")),
    [invoices]
  );
  const monthOptions = useMemo(
    () =>
      Array.from(new Set(invoices.map((i) => i.invoice_date.slice(0, 7))))
        .sort()
        .reverse(),
    [invoices]
  );

  const filtersActive = !!(search || filterMonth || filterCategory || filterSupplier);
  const resetFilters = () => {
    setSearch("");
    setFilterMonth("");
    setFilterCategory("");
    setFilterSupplier("");
  };

  // Liste visible = vue + filtres + tri (asc partout, sauf "Toutes" = desc)
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = invoices.filter((inv) => {
      if (!matchView(inv.status, view)) return false;
      if (filterCategory && inv.category !== filterCategory) return false;
      if (filterSupplier && inv.supplier_name !== filterSupplier) return false;
      if (filterMonth && !inv.invoice_date.startsWith(filterMonth)) return false;
      if (q) {
        const hay = `${inv.supplier_name} ${inv.invoice_number ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const dir = view === "toutes" ? -1 : 1; // Toutes : plus récent en haut
    list.sort((a, b) => {
      const d = a.invoice_date.localeCompare(b.invoice_date);
      if (d !== 0) return d * dir;
      return (a.created_at ?? "").localeCompare(b.created_at ?? "") * dir;
    });
    return list;
  }, [invoices, view, search, filterMonth, filterCategory, filterSupplier]);

  const sumHT = useMemo(() => visible.reduce((s, i) => s + i.total_ht, 0), [visible]);
  const sumTTC = useMemo(() => visible.reduce((s, i) => s + i.total_ttc, 0), [visible]);

  // Line management
  const addLine = () => setLines([...lines, emptyLine()]);
  const removeLine = (i: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, idx) => idx !== i));
  };
  const updateLine = <K extends keyof LineForm>(i: number, field: K, value: LineForm[K]) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  };

  const lineTotalTTC = (l: LineForm) =>
    Math.round(l.quantity * l.unit_price_ht * (1 + l.tva_rate / 100) * 100) / 100;

  const formTotalHT = lines.reduce((s, l) => s + Math.round(l.quantity * l.unit_price_ht * 100) / 100, 0);
  const formTotalTVA = lines.reduce(
    (s, l) => s + Math.round((l.quantity * l.unit_price_ht * l.tva_rate) / 100 * 100) / 100,
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
        category,
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
      setCategory("matieres");
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

  const monthLabel = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-white">Factures fournisseurs</h1>
        {tab === "liste" ? (
          <button
            onClick={() => setTab("nouvelle")}
            className="shrink-0 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200"
          >
            + Nouvelle
          </button>
        ) : (
          <button
            onClick={() => setTab("liste")}
            className="shrink-0 rounded-full bg-neutral-900 px-3.5 py-2 text-sm font-medium text-neutral-300 transition hover:text-white"
          >
            ← Retour
          </button>
        )}
      </div>

      {/* ===================== LISTE ===================== */}
      {tab === "liste" && (
        <div className="flex flex-col gap-3">
          {/* Vues par statut */}
          <div className="flex gap-1 overflow-x-auto rounded-full bg-neutral-900 p-1">
            {VIEWS.map((v) => {
              const count = v.value === "a_comptabiliser" ? pendingCount : v.value === "litiges" ? litigeCount : 0;
              const active = view === v.value;
              return (
                <button
                  key={v.value}
                  onClick={() => setView(v.value)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition ${
                    active ? "bg-white text-neutral-950" : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {v.label}
                  {count > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        active
                          ? "bg-neutral-950/10 text-neutral-700"
                          : v.value === "litiges"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Barre de filtres */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un fournisseur, un n°..."
              className="min-w-[180px] flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
            />
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
            >
              <option value="">Tous les mois</option>
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as InvoiceCategory | "")}
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
            >
              <option value="">Tous les postes</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
            >
              <option value="">Tous les fournisseurs</option>
              {supplierOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {filtersActive && (
              <button
                onClick={resetFilters}
                className="rounded-lg px-2 py-2 text-sm text-neutral-400 transition hover:text-white"
              >
                Réinitialiser
              </button>
            )}
          </div>

          {/* Ligne de résumé */}
          {!loading && (
            <div className="flex items-center justify-between px-1 text-xs text-neutral-400">
              <span>
                {visible.length} facture{visible.length > 1 ? "s" : ""} ·{" "}
                <span className="text-white">{fmt(sumHT)}</span> HT · {fmt(sumTTC)} TTC
              </span>
              <span className="hidden text-[11px] text-neutral-500 sm:inline">
                {view === "toutes" ? "Plus récentes en haut" : "Plus anciennes en haut, récentes en bas"}
              </span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-sm text-neutral-400">Chargement...</div>
          ) : visible.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-400">
              {view === "a_comptabiliser" && !filtersActive
                ? "Rien à comptabiliser — tout est à jour."
                : "Aucune facture pour cette vue."}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {visible.map((inv) => {
                const sd = statusDisplay(inv.status);
                const showComptabiliser = inv.status === "pending" || inv.status === "disputed";
                const showRemettre = BOOKED.includes(inv.status) || inv.status === "disputed";
                const showLitige = inv.status !== "disputed";
                return (
                  <div key={inv.id} className="rounded-lg border border-neutral-800 bg-neutral-900">
                    {/* Summary row */}
                    <button
                      onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                      className="flex w-full items-center gap-3 p-3 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-white">{inv.supplier_name}</span>
                          {inv.invoice_number && (
                            <span className="text-xs text-neutral-400">#{inv.invoice_number}</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-neutral-400">
                          {new Date(inv.invoice_date).toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-semibold text-white">{fmt(inv.total_ttc)}</div>
                        <div className="text-[10px] text-neutral-400">HT {fmt(inv.total_ht)}</div>
                      </div>
                      {inv.category && (
                        <span
                          className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline ${CATEGORY_COLORS[inv.category]}`}
                        >
                          {CATEGORY_LABELS[inv.category]}
                        </span>
                      )}
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${sd.color}`}>
                        {sd.label}
                      </span>
                      <svg
                        className={`h-4 w-4 text-neutral-400 transition-transform ${expandedId === inv.id ? "rotate-180" : ""}`}
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
                      <div className="space-y-3 border-t border-neutral-800 p-3">
                        {inv.lines.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-neutral-400">
                                  <th className="py-1 pr-2 text-left">Article</th>
                                  <th className="px-2 py-1 text-right">Qte</th>
                                  <th className="px-2 py-1 text-right">PU HT</th>
                                  <th className="px-2 py-1 text-right">TVA</th>
                                  <th className="py-1 pl-2 text-right">Total TTC</th>
                                </tr>
                              </thead>
                              <tbody>
                                {inv.lines.map((line) => (
                                  <tr key={line.id} className="text-white">
                                    <td className="py-1 pr-2">{line.description}</td>
                                    <td className="px-2 py-1 text-right">
                                      {line.quantity} {line.unit}
                                    </td>
                                    <td className="px-2 py-1 text-right">{fmt(line.unit_price_ht)}</td>
                                    <td className="px-2 py-1 text-right">{line.tva_rate}%</td>
                                    <td className="py-1 pl-2 text-right font-medium">{fmt(line.total_ttc ?? 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <div className="flex justify-end gap-4 text-xs">
                          <span className="text-neutral-400">
                            HT: <span className="font-medium text-white">{fmt(inv.total_ht)}</span>
                          </span>
                          <span className="text-neutral-400">
                            TVA: <span className="font-medium text-white">{fmt(inv.total_tva)}</span>
                          </span>
                          <span className="text-neutral-400">
                            TTC: <span className="font-semibold text-white">{fmt(inv.total_ttc)}</span>
                          </span>
                        </div>

                        {inv.notes && <p className="text-xs italic text-neutral-400">{inv.notes}</p>}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2">
                          {showComptabiliser && (
                            <button
                              onClick={() => handleStatusChange(inv.id, "validated")}
                              className="rounded-md bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/25"
                            >
                              Comptabiliser
                            </button>
                          )}
                          {showRemettre && (
                            <button
                              onClick={() => handleStatusChange(inv.id, "pending")}
                              className="rounded-md bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/25"
                            >
                              Remettre à comptabiliser
                            </button>
                          )}
                          {showLitige && (
                            <button
                              onClick={() => handleStatusChange(inv.id, "disputed")}
                              className="rounded-md bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/25"
                            >
                              Litige
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(inv.id)}
                            className="ml-auto rounded-md bg-neutral-950/60 px-3 py-1.5 text-xs font-medium text-neutral-400 transition hover:text-red-300"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================== NOUVELLE FACTURE ===================== */}
      {tab === "nouvelle" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Fournisseur *</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Ex: Metro, J Milliet..."
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">N de facture</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="FAC-2026-001"
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Date facture *</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Echeance</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-neutral-400">Catégorie de dépense</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as InvoiceCategory)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-neutral-500">
                Seules les « Matières premières » entrent dans la marge brute.
              </p>
            </div>
          </div>

          {/* Lines */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-white">Lignes de facture</label>
              <button onClick={addLine} className="text-xs text-white hover:underline">
                + Ajouter une ligne
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-2">
                  <div className="col-span-12 md:col-span-4">
                    <label className="mb-0.5 block text-[10px] text-neutral-400">Description</label>
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => updateLine(i, "description", e.target.value)}
                      placeholder="Article..."
                      className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <label className="mb-0.5 block text-[10px] text-neutral-400">Quantite</label>
                    <input
                      type="number"
                      step="0.01"
                      value={line.quantity}
                      onChange={(e) => updateLine(i, "quantity", parseFloat(e.target.value) || 0)}
                      className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-white focus:border-neutral-500 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <label className="mb-0.5 block text-[10px] text-neutral-400">PU HT</label>
                    <input
                      type="number"
                      step="0.01"
                      value={line.unit_price_ht}
                      onChange={(e) => updateLine(i, "unit_price_ht", parseFloat(e.target.value) || 0)}
                      className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-white focus:border-neutral-500 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <label className="mb-0.5 block text-[10px] text-neutral-400">TVA</label>
                    <select
                      value={line.tva_rate}
                      onChange={(e) => updateLine(i, "tva_rate", parseFloat(e.target.value))}
                      className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-white focus:border-neutral-500 focus:outline-none"
                    >
                      {TVA_RATES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 flex items-end justify-end md:col-span-1">
                    <span className="text-xs font-medium text-white">{fmt(lineTotalTTC(line))}</span>
                  </div>
                  <div className="col-span-1 flex items-end justify-center">
                    {lines.length > 1 && (
                      <button onClick={() => removeLine(i)} className="text-neutral-400 transition hover:text-red-300">
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
              HT: <span className="font-medium text-white">{fmt(formTotalHT)}</span>
            </span>
            <span className="text-neutral-400">
              TVA: <span className="font-medium text-white">{fmt(formTotalTVA)}</span>
            </span>
            <span className="text-neutral-400">
              TTC: <span className="text-base font-semibold text-white">{fmt(formTotalTTC)}</span>
            </span>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Remarques, ecarts avec le BL..."
              className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !supplierName || lines.every((l) => !l.description)}
            className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Enregistrement..." : "Enregistrer la facture"}
          </button>
        </div>
      )}
    </div>
  );
}
