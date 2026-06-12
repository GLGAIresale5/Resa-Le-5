import { createClient } from "./supabase";
import { fetchBlocks, createBlock, deleteBlock } from "./api";
import { ReservationBlock } from "../types";

// Fermetures récurrentes hebdomadaires (table recurring_closures, accès direct RLS).
// weekday = convention JS getDay() : 0=dimanche, 1=lundi, ... 6=samedi.
// L'enforcement des résas en ligne est fait CÔTÉ SERVEUR (public_booking lit les règles) ;
// la matérialisation en reservation_blocks sert à l'affichage calendrier et au
// recouvrement tant que le backend n'est pas à jour.

export interface RecurringClosure {
  id: string;
  restaurant_id: string;
  weekday: number;
  service: string | null; // null = journée entière
  created_at?: string;
}

export const HORIZON_DAYS = 182; // ~6 mois
export const REASON_RECURRING = "récurrent"; // marqueur des blocks créés par une règle

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Liste des dates (YYYY-MM-DD) du weekday donné entre aujourd'hui et aujourd'hui+HORIZON_DAYS. */
function upcomingDatesForWeekday(weekday: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0); // midi local — évite tout glissement de jour (DST inclus)
  for (let i = 0; i <= HORIZON_DAYS; i++) {
    if (d.getDay() === weekday) out.push(toDateStr(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Mois (YYYY-MM) couverts par l'horizon. */
function horizonMonths(): string[] {
  const months: string[] = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const end = new Date(d);
  end.setDate(end.getDate() + HORIZON_DAYS);
  const cur = new Date(d.getFullYear(), d.getMonth(), 1, 12);
  while (cur <= end) {
    months.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function sameService(a: string | null, b: string | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Charge tous les blocks de l'horizon (mois en parallèle).
 * PROPAGE les erreurs : on ne matérialise jamais sur un instantané incomplet
 * (sinon re-création massive de blocks déjà existants).
 */
async function fetchHorizonBlocks(restaurantId: string): Promise<ReservationBlock[]> {
  const perMonth = await Promise.all(horizonMonths().map((m) => fetchBlocks(restaurantId, m)));
  return perMonth.flat();
}

// ── CRUD des règles ──────────────────────────────────────────────────────────

export async function fetchRecurring(restaurantId: string): Promise<RecurringClosure[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("recurring_closures")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("weekday");
  if (error) throw error;
  return (data ?? []) as RecurringClosure[];
}

export async function addRecurring(
  restaurantId: string,
  weekday: number,
  service: string | null,
): Promise<RecurringClosure> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("recurring_closures")
    .insert({ restaurant_id: restaurantId, weekday, service })
    .select()
    .single();
  if (error) throw error;
  return data as RecurringClosure;
}

export async function removeRecurring(ruleId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("recurring_closures").delete().eq("id", ruleId);
  if (error) throw error;
}

// ── Matérialisation ──────────────────────────────────────────────────────────

// Verrou anti-runs concurrents (remontages d'onglet, double-mount React)
const inflight = new Map<string, Promise<number>>();

/**
 * Crée les blocks manquants pour toutes les règles sur l'horizon glissant.
 * Idempotent : ne crée que ce qui n'existe pas déjà. Les règles "journée entière"
 * sont traitées en premier pour éviter des blocks service redondants.
 * Retourne le nombre de blocks créés.
 */
export async function materializeRules(
  restaurantId: string,
  rules: RecurringClosure[],
): Promise<number> {
  if (rules.length === 0) return 0;
  const current = inflight.get(restaurantId);
  if (current) return current;

  const run = (async () => {
    const existing = await fetchHorizonBlocks(restaurantId);
    const have = new Set(existing.map((b) => `${b.date}|${(b.service ?? "").toLowerCase()}`));
    const wholeDays = new Set(existing.filter((b) => b.service == null).map((b) => b.date));

    // Journées entières d'abord (les règles service les respectent ensuite)
    const sorted = [...rules].sort((a, b) => Number(a.service != null) - Number(b.service != null));

    let created = 0;
    for (const rule of sorted) {
      for (const date of upcomingDatesForWeekday(rule.weekday)) {
        const key = `${date}|${(rule.service ?? "").toLowerCase()}`;
        if (have.has(key)) continue;
        // inutile de fermer un service si la journée entière est déjà fermée
        if (rule.service != null && wholeDays.has(date)) continue;
        await createBlock(restaurantId, date, rule.service, REASON_RECURRING);
        have.add(key);
        if (rule.service == null) wholeDays.add(date);
        created++;
      }
    }
    return created;
  })();

  inflight.set(restaurantId, run);
  try {
    return await run;
  } finally {
    inflight.delete(restaurantId);
  }
}

/**
 * Supprime les blocks futurs (>= aujourd'hui) créés PAR une règle (reason="récurrent").
 * Les fermetures manuelles du même jour de semaine sont préservées.
 * Retourne le nombre de blocks supprimés.
 */
export async function unmaterializeRule(
  restaurantId: string,
  rule: Pick<RecurringClosure, "weekday" | "service">,
): Promise<number> {
  const existing = await fetchHorizonBlocks(restaurantId);
  const today = toDateStr(new Date());
  let deleted = 0;
  for (const b of existing) {
    if (b.date < today) continue;
    if (b.reason !== REASON_RECURRING) continue; // ne touche pas aux fermetures manuelles
    const d = new Date(b.date + "T12:00:00");
    if (d.getDay() !== rule.weekday) continue;
    if (!sameService(b.service, rule.service)) continue;
    await deleteBlock(b.id);
    deleted++;
  }
  return deleted;
}

// ── Throttle de la matérialisation au montage ────────────────────────────────

const MATERIALIZE_TTL_MS = 6 * 60 * 60 * 1000; // 6 h

/** true si une matérialisation est utile (pas faite récemment). */
export function shouldMaterialize(restaurantId: string): boolean {
  try {
    const ts = localStorage.getItem(`recurring-mat:${restaurantId}`);
    return !ts || Date.now() - Number(ts) > MATERIALIZE_TTL_MS;
  } catch {
    return true;
  }
}

export function markMaterialized(restaurantId: string): void {
  try {
    localStorage.setItem(`recurring-mat:${restaurantId}`, String(Date.now()));
  } catch {
    // stockage indisponible — on re-matérialisera, sans gravité
  }
}
