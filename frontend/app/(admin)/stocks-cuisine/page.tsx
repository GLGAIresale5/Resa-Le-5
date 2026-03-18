"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  StockItem,
  StockCategory,
  Delivery,
  OrderItem,
  ChatMessage,
  DeliveryScanResult,
  ScannedDeliveryItem,
} from "../../types";
import {
  fetchStockItems,
  createStockItem,
  updateStockItem,
  deleteStockItem,
  updateStockLevel,
  bulkUpdateStock,
  fetchDeliveries,
  scanDeliveryNote,
  createDelivery,
  fetchOrderList,
  stockAgentChat,
} from "../../lib/api";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";

type Tab = "stocks" | "commande" | "agent";

type CuisineCategory = "viandes" | "poissons" | "legumes" | "epicerie" | "laitiers" | "surgeles" | "condiments" | "entretien";

const CATEGORY_LABELS: Record<CuisineCategory, string> = {
  viandes: "Viandes",
  poissons: "Poissons",
  legumes: "Légumes & Fruits",
  laitiers: "Produits laitiers",
  epicerie: "Épicerie",
  surgeles: "Surgelés",
  condiments: "Condiments & Sauces",
  entretien: "Produits d'entretien",
};

const CATEGORY_ORDER: CuisineCategory[] = ["viandes", "poissons", "legumes", "laitiers", "epicerie", "surgeles", "condiments", "entretien"];

const UNIT_OPTIONS = [
  { value: "kg", label: "Kilos" },
  { value: "litre", label: "Litres" },
  { value: "bouteille", label: "Bouteille" },
  { value: "fût", label: "Fûts" },
  { value: "carton", label: "Carton" },
  { value: "colis", label: "Colis" },
  { value: "pièce", label: "Pièce" },
  { value: "botte", label: "Botte" },
];

function isCuisineCategory(cat: string): cat is CuisineCategory {
  return CATEGORY_ORDER.includes(cat as CuisineCategory);
}

function getAlertLevel(item: StockItem): "ok" | "warning" | "critical" {
  if (item.stock_current <= 0) return "critical";
  if (item.stock_current <= item.stock_min) return "warning";
  return "ok";
}

function AlertBadge({ level }: { level: "ok" | "warning" | "critical" }) {
  if (level === "ok") return null;
  if (level === "critical")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
        🔴 Rupture
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
      ⚠️ À commander
    </span>
  );
}

// =====================
// ITEM MODAL
// =====================

const FIELD_CLASS =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600";
const LABEL_CLASS = "mb-1 block text-xs font-semibold text-zinc-700";

function ItemModal({
  item,
  restaurantId,
  defaultCategory,
  onSave,
  onDelete,
  onClose,
}: {
  item?: StockItem;
  restaurantId: string;
  defaultCategory?: CuisineCategory;
  onSave: (saved: StockItem) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    name: item?.name ?? "",
    brand: item?.brand ?? "",
    category: item?.category ?? defaultCategory ?? "viandes",
    unit: item?.unit ?? "kg",
    stock_current: item != null ? String(item.stock_current) : "0",
    stock_min: item != null ? String(item.stock_min) : "1",
    supplier_price: item?.supplier_milliet_price != null ? String(item.supplier_milliet_price) : "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let saved: StockItem;
      if (isEdit) {
        saved = await updateStockItem(item!.id, {
          name: form.name.trim(),
          brand: form.brand.trim() || null,
          unit: form.unit.trim(),
          stock_min: parseFloat(form.stock_min) || 0,
          supplier_milliet_price: form.supplier_price ? parseFloat(form.supplier_price) : null,
        });
        const newStock = parseFloat(form.stock_current);
        if (!isNaN(newStock) && newStock !== item!.stock_current) {
          await updateStockLevel(item!.id, newStock, restaurantId);
          saved = { ...saved, stock_current: newStock };
        }
      } else {
        saved = await createStockItem({
          restaurant_id: restaurantId,
          name: form.name.trim(),
          brand: form.brand.trim() || null,
          category: form.category as StockCategory,
          unit: form.unit.trim(),
          stock_current: parseFloat(form.stock_current) || 0,
          stock_min: parseFloat(form.stock_min) || 0,
          supplier_milliet_price: form.supplier_price ? parseFloat(form.supplier_price) : null,
        });
      }
      onSave(saved);
    } catch {
      setError("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!item || !onDelete) return;
    setDeleting(true);
    try {
      await deleteStockItem(item.id, restaurantId);
      onDelete(item.id);
    } catch {
      setError("Erreur lors de la suppression.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              {isEdit ? "Modifier l'article" : "Nouvel article"}
            </h2>
            {isEdit && (
              <p className="mt-0.5 text-xs text-zinc-500">
                {CATEGORY_LABELS[item!.category as CuisineCategory] ?? item!.category}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={LABEL_CLASS}>Nom du produit</label>
              <input required type="text" value={form.name} onChange={(e) => set("name", e.target.value)} className={FIELD_CLASS} placeholder="ex: Poulet fermier" />
            </div>

            <div>
              <label className={LABEL_CLASS}>Marque / Origine</label>
              <input type="text" value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Optionnel" className={FIELD_CLASS} />
            </div>

            {isEdit ? (
              <>
                <div>
                  <label className={LABEL_CLASS}>Unité</label>
                  <select value={form.unit} onChange={(e) => set("unit", e.target.value)} className={FIELD_CLASS}>
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Stock actuel</label>
                  <input type="number" min="0" step="0.25" value={form.stock_current} onChange={(e) => set("stock_current", e.target.value)} className={FIELD_CLASS} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={LABEL_CLASS}>Catégorie</label>
                  <select value={form.category} onChange={(e) => set("category", e.target.value)} className={FIELD_CLASS}>
                    {CATEGORY_ORDER.map((k) => (
                      <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Unité</label>
                  <select value={form.unit} onChange={(e) => set("unit", e.target.value)} className={FIELD_CLASS}>
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Stock initial</label>
                  <input type="number" min="0" step="0.25" value={form.stock_current} onChange={(e) => set("stock_current", e.target.value)} className={FIELD_CLASS} />
                </div>
              </>
            )}

            <div>
              <label className={LABEL_CLASS}>Seuil de commande</label>
              <input required type="number" min="0" step="0.25" value={form.stock_min} onChange={(e) => set("stock_min", e.target.value)} className={FIELD_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Prix fournisseur (€)</label>
              <input type="number" min="0" step="0.01" value={form.supplier_price} onChange={(e) => set("supplier_price", e.target.value)} placeholder="Optionnel" className={FIELD_CLASS} />
            </div>
          </div>

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}

          <div className="flex items-center justify-between pt-1">
            {isEdit && onDelete && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-red-600">Confirmer ?</span>
                  <button type="button" onClick={handleDelete} disabled={deleting} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
                    {deleting ? "..." : "Oui, supprimer"}
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs text-zinc-500 hover:text-zinc-700">Annuler</button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Supprimer
                </button>
              )
            )}
            {!isEdit && <div />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">Annuler</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-50">
                {saving ? "Enregistrement..." : isEdit ? "Enregistrer" : "Créer l'article"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// =====================
// INLINE STOCK EDITOR
// =====================

function StockCell({ item, onSave }: { item: StockItem; onSave: (id: string, value: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(item.stock_current));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  async function handleSave() {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) { setValue(String(item.stock_current)); setEditing(false); return; }
    setSaving(true);
    try { await onSave(item.id, num); } finally { setSaving(false); setEditing(false); }
  }

  const level = getAlertLevel(item);
  const dotColor = level === "critical" ? "bg-red-500" : level === "warning" ? "bg-amber-400" : "bg-emerald-500";

  if (editing) {
    return (
      <div className="flex items-center gap-2 rounded px-1 py-0.5">
        <span className={`h-2 w-2 rounded-full ${dotColor} shrink-0`} />
        <input ref={inputRef} type="number" min="0" step="0.25" value={value} onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave} onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setValue(String(item.stock_current)); setEditing(false); } }}
          disabled={saving} className="w-14 appearance-none rounded border border-zinc-300 bg-white py-0 text-right text-sm tabular-nums text-zinc-900 focus:border-zinc-500 focus:outline-none [&::-webkit-inner-spin-button]:appearance-auto [&::-webkit-outer-spin-button]:appearance-auto" />
        <span className="text-xs text-zinc-400">{item.unit}</span>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-zinc-50">
      <svg className="h-3 w-3 text-zinc-300 opacity-0 transition group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-2.828 1.172H7v-2a4 4 0 011.172-2.828z" />
      </svg>
      <span className={`h-2 w-2 rounded-full ${dotColor} shrink-0`} />
      <span className="text-sm tabular-nums text-zinc-900">{item.stock_current}</span>
      <span className="text-xs text-zinc-400">{item.unit}</span>
    </button>
  );
}

// =====================
// TABS
// =====================

function TabBar({ tab, setTab, warningCount }: { tab: Tab; setTab: (t: Tab) => void; warningCount: number }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "stocks", label: "Stocks" },
    { key: "commande", label: "Bon de commande" },
    { key: "agent", label: "Contexte service" },
  ];
  return (
    <div className="flex gap-0 border-b border-zinc-200 bg-white px-8">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => setTab(t.key)}
          className={`relative flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${tab === t.key ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-700"}`}>
          {t.label}
          {t.key === "commande" && warningCount > 0 && (
            <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{warningCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// =====================
// ENTREES MODAL
// =====================

function EntreesModal({
  restaurantId,
  stockItems,
  onClose,
  onDeliveryCreated,
}: {
  restaurantId: string;
  stockItems: StockItem[];
  onClose: () => void;
  onDeliveryCreated: () => void;
}) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<DeliveryScanResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [editItems, setEditItems] = useState<ScannedDeliveryItem[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split("T")[0]);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDeliveries = useCallback(() => {
    fetchDeliveries(restaurantId).then(setDeliveries).finally(() => setLoading(false));
  }, [restaurantId]);

  useEffect(() => { loadDeliveries(); }, [loadDeliveries]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await scanDeliveryNote(restaurantId, base64, file.type);
      setScanResult(result);
      setEditItems(result.items);
      setSupplierName(result.supplier_name ?? "");
      setDeliveryDate(result.delivery_date ?? new Date().toISOString().split("T")[0]);
      setConfirming(true);
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function confirmDelivery() {
    if (!scanResult) return;
    setConfirming(false);
    const items = editItems.map((i) => ({
      stock_item_id: i.matched_stock_item_id ?? null,
      item_name: i.item_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
    }));
    await createDelivery({ restaurant_id: restaurantId, supplier_name: supplierName || undefined, delivery_date: deliveryDate, items });
    setScanResult(null);
    loadDeliveries();
    onDeliveryCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="w-full max-w-2xl rounded-t-2xl sm:rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Entrées de stock</h2>
            <p className="text-xs text-zinc-400">{deliveries.length} livraison(s) enregistrée(s)</p>
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <button onClick={() => fileRef.current?.click()} disabled={scanning}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {scanning ? "Analyse..." : "Scanner un BL"}
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 flex-1">
          {confirming && scanResult && (
            <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-semibold text-zinc-900">Vérifier le bon de livraison</h3>
              <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Fournisseur</label>
                  <input type="text" value={supplierName} onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none" placeholder="Nom du fournisseur" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Date</label>
                  <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none" />
                </div>
              </div>
              <div className="mb-4 overflow-hidden rounded-lg border border-zinc-100">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50">
                      <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">Article (BL)</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">Correspondance catalogue</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-zinc-400">Quantité</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {editItems.map((item, idx) => {
                      const matched = stockItems.find((s) => s.id === item.matched_stock_item_id);
                      return (
                        <tr key={idx}>
                          <td className="px-3 py-2 text-sm text-zinc-900">{item.item_name}</td>
                          <td className="px-3 py-2">
                            <select value={item.matched_stock_item_id ?? ""} onChange={(e) => {
                              const updated = [...editItems];
                              updated[idx] = { ...updated[idx], matched_stock_item_id: e.target.value || undefined };
                              setEditItems(updated);
                            }} className="w-full rounded border border-zinc-200 px-2 py-0.5 text-xs text-zinc-900 focus:border-zinc-400 focus:outline-none">
                              <option value="">— Non lié —</option>
                              {stockItems.map((s) => <option key={s.id} value={s.id}>{s.name}{s.brand ? ` (${s.brand})` : ""}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <input type="number" min="0" step="0.25" value={item.quantity} onChange={(e) => {
                                const updated = [...editItems];
                                updated[idx] = { ...updated[idx], quantity: parseFloat(e.target.value) || 0 };
                                setEditItems(updated);
                              }} className="w-16 rounded border border-zinc-200 px-2 py-0.5 text-right text-xs text-zinc-900 focus:border-zinc-400 focus:outline-none" />
                              <span className="text-xs text-zinc-400">{matched?.unit ?? ""}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setConfirming(false); setScanResult(null); }} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50">Annuler</button>
                <button onClick={confirmDelivery} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700">Confirmer et mettre à jour les stocks</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-600" /></div>
          ) : deliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-sm text-zinc-400">Aucune livraison enregistrée</p>
              <p className="mt-1 text-xs text-zinc-400">Scannez votre premier bon de livraison</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deliveries.map((d) => (
                <div key={d.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{d.supplier_name ?? "Fournisseur inconnu"}</p>
                      <p className="text-xs text-zinc-400">{new Date(d.delivery_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">{d.items.length} article(s)</span>
                  </div>
                  {d.items.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {d.items.slice(0, 6).map((item) => (
                        <span key={item.id} className="rounded-full border border-zinc-100 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-500">{item.item_name} × {item.quantity}</span>
                      ))}
                      {d.items.length > 6 && <span className="rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-400">+{d.items.length - 6} autres</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================
// STOCKS TAB
// =====================

function StocksTab({
  items, restaurantId, onSaveStock, onBulkSave, onItemSaved, onItemDeleted, onDeliveryCreated, loading,
}: {
  items: StockItem[];
  restaurantId: string;
  onSaveStock: (id: string, value: number) => Promise<void>;
  onBulkSave: (updates: { id: string; stock_current: number }[]) => Promise<void>;
  onItemSaved: (saved: StockItem, isNew: boolean) => void;
  onItemDeleted: (id: string) => void;
  onDeliveryCreated: () => void;
  loading: boolean;
}) {
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkValues, setBulkValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [creatingInCategory, setCreatingInCategory] = useState<CuisineCategory | null>(null);
  const [entreesOpen, setEntreesOpen] = useState(false);

  function startBulk() {
    const vals: Record<string, string> = {};
    items.forEach((i) => (vals[i.id] = String(i.stock_current)));
    setBulkValues(vals);
    setBulkMode(true);
  }

  async function saveBulk() {
    setSaving(true);
    const updates = Object.entries(bulkValues).map(([id, v]) => ({ id, stock_current: parseFloat(v) || 0 })).filter((u) => !isNaN(u.stock_current));
    try { await onBulkSave(updates); } finally { setSaving(false); setBulkMode(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-600" />
      </div>
    );
  }

  const cuisineItems = items.filter((i) => isCuisineCategory(i.category));

  if (cuisineItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white">
          <svg className="h-5 w-5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        </div>
        <p className="mt-4 text-sm font-medium text-zinc-600">Catalogue vide</p>
        <p className="mt-1 text-xs text-zinc-400">Ajoutez vos premiers produits cuisine via le bouton "+ Ajouter"</p>
        <button onClick={() => setCreatingInCategory("viandes")} className="mt-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700">
          Ajouter un premier produit
        </button>
        {creatingInCategory && (
          <ItemModal restaurantId={restaurantId} defaultCategory={creatingInCategory}
            onSave={(saved) => { onItemSaved(saved, true); setCreatingInCategory(null); }}
            onClose={() => setCreatingInCategory(null)} />
        )}
      </div>
    );
  }

  const grouped = CATEGORY_ORDER.reduce<Record<string, StockItem[]>>((acc, cat) => {
    acc[cat] = cuisineItems.filter((i) => i.category === cat);
    return acc;
  }, {} as Record<string, StockItem[]>);

  return (
    <div className="p-8">
      {editingItem && (
        <ItemModal item={editingItem} restaurantId={restaurantId}
          onSave={(saved) => { onItemSaved(saved, false); setEditingItem(null); }}
          onDelete={(id) => { onItemDeleted(id); setEditingItem(null); }}
          onClose={() => setEditingItem(null)} />
      )}
      {creatingInCategory && (
        <ItemModal restaurantId={restaurantId} defaultCategory={creatingInCategory}
          onSave={(saved) => { onItemSaved(saved, true); setCreatingInCategory(null); }}
          onClose={() => setCreatingInCategory(null)} />
      )}
      {entreesOpen && (
        <EntreesModal restaurantId={restaurantId} stockItems={cuisineItems}
          onClose={() => setEntreesOpen(false)} onDeliveryCreated={() => { onDeliveryCreated(); }} />
      )}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-zinc-500">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> OK</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> À commander</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Rupture</span>
        </div>
        <div className="flex gap-2">
          {bulkMode ? (
            <>
              <button onClick={() => setBulkMode(false)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50">Annuler</button>
              <button onClick={saveBulk} disabled={saving} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50">
                {saving ? "Enregistrement..." : "Enregistrer tout"}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEntreesOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Entrées
              </button>
              <button onClick={startBulk} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                Saisie manuelle
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-8">
        {CATEGORY_ORDER.map((cat) => {
          const catItems = grouped[cat];
          if (!catItems || catItems.length === 0) return null;
          return (
            <div key={cat}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{CATEGORY_LABELS[cat]}</h2>
                {!bulkMode && (
                  <button onClick={() => setCreatingInCategory(cat)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Ajouter
                  </button>
                )}
              </div>
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "21%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "26%" }} />
                    <col style={{ width: "5%" }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="pl-4 py-2.5 text-left text-xs font-medium text-zinc-400">Produit</th>
                      <th className="pl-2 py-2.5 text-left text-xs font-medium text-zinc-400">Marque</th>
                      <th className="py-2.5 text-left text-xs font-medium text-zinc-400 whitespace-nowrap"><span style={{ marginLeft: "55px" }}>Stock actuel</span></th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-400 whitespace-nowrap">Seuil min</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-400 whitespace-nowrap">Statut</th>
                      <th className="py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {catItems.map((item) => {
                      const level = getAlertLevel(item);
                      return (
                        <tr key={item.id} className={`transition ${level === "critical" ? "bg-red-50/40" : level === "warning" ? "bg-amber-50/30" : ""}`}>
                          <td className="pl-4 py-2.5 text-sm font-medium text-zinc-900 truncate">{item.name}</td>
                          <td className="pl-2 py-2.5 text-sm text-zinc-500 truncate">{item.brand ?? "—"}</td>
                          <td className="py-2.5 whitespace-nowrap">
                            {bulkMode ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <input type="number" min="0" step="0.25" value={bulkValues[item.id] ?? "0"}
                                  onChange={(e) => setBulkValues((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                  className="w-24 rounded-md border-2 border-zinc-300 bg-white px-2 py-1 text-right text-sm font-semibold text-zinc-900 focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-100" />
                                <span className="w-8 shrink-0 text-left text-xs text-zinc-400">{item.unit}</span>
                              </div>
                            ) : (
                              <StockCell item={item} onSave={onSaveStock} />
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm text-zinc-400 whitespace-nowrap">{item.stock_min} {item.unit}</td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap"><AlertBadge level={level} /></td>
                          <td className="px-2 py-2.5">
                            {!bulkMode && (
                              <button onClick={() => setEditingItem(item)} className="rounded p-1 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600 transition" title="Modifier">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-2.828 1.172H7v-2a4 4 0 011.172-2.828z" />
                                </svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =====================
// BON DE COMMANDE TAB
// =====================

function CommandeTab({ restaurantId }: { restaurantId: string }) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderList(restaurantId).then((all) => {
      setItems(all.filter((i) => isCuisineCategory(i.category)));
    }).finally(() => setLoading(false));
  }, [restaurantId]);

  if (loading) return <div className="flex items-center justify-center py-32"><div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-600" /></div>;

  if (items.length === 0) return (
    <div className="flex flex-col items-center justify-center py-32">
      <p className="text-sm font-medium text-zinc-600">Tous les stocks sont OK ✓</p>
      <p className="mt-1 text-xs text-zinc-400">Aucun article sous le seuil de commande</p>
    </div>
  );

  const grouped: { cat: string; label: string; items: OrderItem[] }[] = [];
  for (const cat of CATEGORY_ORDER) {
    const catItems = items.filter((i) => i.category === cat);
    if (catItems.length > 0) {
      grouped.push({ cat, label: CATEGORY_LABELS[cat], items: catItems.sort((a, b) => a.name.localeCompare(b.name, "fr")) });
    }
  }

  return (
    <div className="p-8">
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400">Produit</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-400">Stock actuel</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-400">À commander</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-400">Prix fournisseur</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {grouped.map(({ cat, label, items: catItems }) => (
              <>
                <tr key={`header-${cat}`}>
                  <td colSpan={4} className="bg-zinc-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {label}
                  </td>
                </tr>
                {catItems.map((item) => {
                  const isRupture = item.stock_current <= 0;
                  return (
                    <tr key={item.stock_item_id} className={isRupture ? "bg-red-50/40" : ""}>
                      <td className={`px-4 py-2.5 text-sm font-medium ${isRupture ? "text-red-700" : "text-zinc-900"}`}>
                        {item.name}
                        {item.brand && <span className={`ml-1 font-normal ${isRupture ? "text-red-400" : "text-zinc-400"}`}>{item.brand}</span>}
                        {isRupture && <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">Rupture</span>}
                      </td>
                      <td className={`px-4 py-2.5 text-right text-sm ${isRupture ? "font-semibold text-red-600" : "text-zinc-500"}`}>
                        {item.stock_current} {item.unit}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm font-semibold text-zinc-900">
                        {item.suggested_quantity} {item.unit}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm text-zinc-500">
                        {item.supplier_milliet_price ? `${item.supplier_milliet_price} €` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =====================
// CONTEXTE SERVICE TAB
// =====================

function AgentTab({ restaurantId }: { restaurantId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reservations, setReservations] = useState("");
  const [weather, setWeather] = useState("");
  const [notes, setNotes] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await stockAgentChat(restaurantId, newMessages, {
        reservations_count: reservations ? parseInt(reservations) : undefined,
        weather: weather || undefined,
        notes: notes || undefined,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: res.response }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erreur lors de la communication avec l'agent." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-160px)] flex-col">
      <div className="border-b border-zinc-100 bg-zinc-50 px-8 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-zinc-500">Couverts</label>
            <input type="number" placeholder="ex: 45" value={reservations} onChange={(e) => setReservations(e.target.value)} className="w-16 rounded-lg border border-zinc-200 px-2 py-1 text-xs focus:border-zinc-400 focus:outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-zinc-500">Météo</label>
            <input type="text" placeholder="ex: chaud, 28°C" value={weather} onChange={(e) => setWeather(e.target.value)} className="w-36 rounded-lg border border-zinc-200 px-2 py-1 text-xs focus:border-zinc-400 focus:outline-none" />
          </div>
          <div className="flex flex-1 items-center gap-2">
            <label className="text-xs font-medium text-zinc-500 whitespace-nowrap">Remarques</label>
            <input type="text" placeholder="ex: menu du jour poisson, rush du midi..." value={notes} onChange={(e) => setNotes(e.target.value)} className="flex-1 rounded-lg border border-zinc-200 px-2 py-1 text-xs focus:border-zinc-400 focus:outline-none" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900">
              <span className="text-sm font-bold text-white">G</span>
            </div>
            <p className="mt-3 text-sm font-medium text-zinc-700">Agent Stocks Cuisine — GLG AI</p>
            <p className="mt-1 max-w-sm text-xs text-zinc-400">Renseignez le contexte ci-dessus puis posez une question sur vos stocks cuisine.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["Qu'est-ce que je dois commander aujourd'hui ?", "Quels sont mes stocks critiques ?", "Avec 60 couverts ce soir, qu'est-ce qui risque de manquer ?"].map((s) => (
                <button key={s} onClick={() => setInput(s)} className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50">{s}</button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-2xl rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white text-zinc-800"}`}>
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                <div className="flex gap-1">
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "0ms" }} />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "150ms" }} />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-zinc-200 bg-white px-8 py-4">
        <div className="flex items-end gap-3">
          <textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Posez une question sur vos stocks cuisine..."
            className="flex-1 resize-none rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-zinc-400 focus:outline-none" />
          <button onClick={sendMessage} disabled={loading || !input.trim()} className="rounded-xl bg-zinc-900 p-2.5 text-white transition hover:bg-zinc-700 disabled:opacity-40">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================
// HELPER
// =====================

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const result = reader.result as string; resolve(result.split(",")[1]); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// =====================
// PAGE PRINCIPALE
// =====================

export default function StocksCuisinePage() {
  const [tab, setTab] = useState<Tab>("stocks");
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cuisineItems = items.filter((i) => isCuisineCategory(i.category));
  const warningCount = cuisineItems.filter((i) => getAlertLevel(i) !== "ok").length;

  const loadItems = useCallback(async () => {
    if (!RESTAURANT_ID) { setError("NEXT_PUBLIC_RESTAURANT_ID manquant dans .env.local"); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStockItems(RESTAURANT_ID);
      setItems(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  async function handleSaveStock(id: string, value: number) {
    await updateStockLevel(id, value, RESTAURANT_ID);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, stock_current: value } : i)));
  }

  async function handleBulkSave(updates: { id: string; stock_current: number }[]) {
    await bulkUpdateStock(RESTAURANT_ID, updates);
    await loadItems();
  }

  return (
    <div className="flex flex-col">
      <header className="border-b border-zinc-200 bg-white px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-zinc-900">Stocks Cuisine</h1>
            <p className="text-xs text-zinc-400">Suivi des niveaux, alertes de rupture et suggestions de commande</p>
          </div>
          {warningCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-xs font-medium text-red-600">{warningCount} article(s) sous seuil</span>
            </div>
          )}
        </div>
      </header>

      {error && <div className="mx-8 mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <TabBar tab={tab} setTab={setTab} warningCount={warningCount} />

      {tab === "stocks" && (
        <StocksTab
          items={cuisineItems}
          restaurantId={RESTAURANT_ID}
          onSaveStock={handleSaveStock}
          onBulkSave={handleBulkSave}
          onItemSaved={(saved, isNew) =>
            setItems((prev) => isNew ? [...prev, saved] : prev.map((i) => (i.id === saved.id ? saved : i)))
          }
          onItemDeleted={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
          onDeliveryCreated={loadItems}
          loading={loading}
        />
      )}
      {tab === "commande" && <CommandeTab restaurantId={RESTAURANT_ID} />}
      {tab === "agent" && <AgentTab restaurantId={RESTAURANT_ID} />}
    </div>
  );
}
