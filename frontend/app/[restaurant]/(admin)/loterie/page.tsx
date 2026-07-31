"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../lib/auth-context";
import {
  claimLotteryPlay,
  eraseLotteryPerson,
  fetchLotteryPlays,
  fetchLotteryStats,
  LotteryPlay,
  LotteryStats,
} from "../../../lib/api";

type Tab = "a_remettre" | "tout";

const fmtEur = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR") : "—";

const fmtPhone = (p: string) => p.replace(/(\d{2})(?=\d)/g, "$1 ").trim();

function StatusBadge({ play }: { play: LotteryPlay }) {
  const base = "rounded-full px-2 py-0.5 text-[10px] font-medium";
  if (play.status === "claimed")
    return <span className={`${base} bg-emerald-500/15 text-emerald-300`}>Remis</span>;
  if (play.status === "expired" || play.is_expired)
    return <span className={`${base} bg-neutral-500/20 text-neutral-300`}>Expiré</span>;
  if (play.status === "pending")
    return <span className={`${base} bg-amber-500/15 text-amber-300`}>À remettre</span>;
  return <span className={`${base} bg-neutral-500/20 text-neutral-400`}>Perdu</span>;
}

export default function LoteriePage() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant?.id;

  const [plays, setPlays] = useState<LotteryPlay[]>([]);
  const [stats, setStats] = useState<LotteryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("a_remettre");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    try {
      setError("");
      const [p, s] = await Promise.all([
        fetchLotteryPlays(restaurantId),
        fetchLotteryStats(restaurantId),
      ]);
      setPlays(p);
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/[\s.\-()]/g, "");
    let rows = plays;
    if (tab === "a_remettre") {
      rows = rows.filter((p) => p.status === "pending" && !p.is_expired);
    }
    if (!q) return rows;
    return rows.filter((p) => {
      const hay = `${p.first_name} ${p.phone}`.toLowerCase().replace(/[\s.\-()]/g, "");
      return hay.includes(q);
    });
  }, [plays, search, tab]);

  const handleClaim = async (play: LotteryPlay) => {
    if (!restaurantId) return;
    if (!window.confirm(`Remettre « ${play.prize_label} » à ${play.first_name} ?`)) return;
    setBusyId(play.id);
    try {
      await claimLotteryPlay(play.id, restaurantId);
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusyId(null);
    }
  };

  const handleErase = async () => {
    if (!restaurantId) return;
    const phone = window.prompt(
      "Effacement RGPD — numéro de téléphone du client à supprimer de TOUTES les bases :"
    );
    if (!phone) return;
    if (
      !window.confirm(
        `Supprimer définitivement toutes les données liées au ${phone} ? Cette action est irréversible.`
      )
    )
      return;
    try {
      const res = await eraseLotteryPerson(phone, restaurantId);
      window.alert(
        `Effacé : ${res.plays_deleted} participation(s) et ${res.contacts_deleted} contact(s).`
      );
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Erreur");
    }
  };

  const pendingCount = useMemo(
    () => plays.filter((p) => p.status === "pending" && !p.is_expired).length,
    [plays]
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-white">Loterie</h1>
        <button
          onClick={handleErase}
          className="rounded-lg border border-neutral-800 px-3 py-2 text-sm text-neutral-300 transition hover:border-neutral-600 hover:text-white"
        >
          Effacement RGPD
        </button>
      </div>

      {/* Exposition du mois */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-[10px] uppercase tracking-wider text-neutral-400">
              Participations
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">{stats.plays}</p>
            <p className="text-[11px] text-neutral-500">{stats.wins} gagnantes ce mois</p>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-[10px] uppercase tracking-wider text-neutral-400">
              Coût matière
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {fmtEur(stats.cost_claimed)}
            </p>
            <p className="text-[11px] text-neutral-500">
              {fmtEur(stats.cost_max)} si tout est retiré
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-[10px] uppercase tracking-wider text-neutral-400">Gros lots</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {stats.gros_lot_used}
              <span className="text-base text-neutral-500"> / {stats.gros_lot_cap}</span>
            </p>
            <p className="text-[11px] text-neutral-500">plafond mensuel</p>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-[10px] uppercase tracking-wider text-neutral-400">
              Contacts SMS
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {stats.marketing_contacts}
            </p>
            <p className="text-[11px] text-neutral-500">opt-in actifs</p>
          </div>
        </div>
      )}

      {/* Recherche + filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-neutral-800 bg-neutral-900 p-0.5">
          <button
            onClick={() => setTab("a_remettre")}
            className={`rounded-full px-3.5 py-1.5 text-sm transition ${
              tab === "a_remettre"
                ? "bg-white font-medium text-neutral-950"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            À remettre {pendingCount > 0 && `(${pendingCount})`}
          </button>
          <button
            onClick={() => setTab("tout")}
            className={`rounded-full px-3.5 py-1.5 text-sm transition ${
              tab === "tout"
                ? "bg-white font-medium text-neutral-950"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Tout
          </button>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un prénom ou un numéro…"
          className="min-w-[200px] flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-neutral-400">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-neutral-400">
          {tab === "a_remettre"
            ? "Aucun lot en attente — tout est à jour."
            : "Aucune participation pour l'instant."}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((play) => (
            <div
              key={play.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-white">{play.first_name}</span>
                  <span className="text-sm text-neutral-400">{fmtPhone(play.phone)}</span>
                  <StatusBadge play={play} />
                </div>
                <p className="mt-0.5 text-sm text-neutral-300">
                  {play.prize === "none" ? "—" : play.prize_label}
                  {play.is_alcohol && play.prize !== "none" && (
                    <span
                      className="ml-2 text-[11px] text-amber-300/80"
                      title="Vérifier la majorité — sinon proposer un équivalent sans alcool"
                    >
                      · 18+
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-neutral-500">
                  Joué le {fmtDate(play.created_at)}
                  {play.expires_at && ` · valable jusqu'au ${fmtDate(play.expires_at)}`}
                  {play.claimed_at && ` · remis le ${fmtDate(play.claimed_at)}`}
                </p>
              </div>
              {play.status === "pending" && !play.is_expired && (
                <button
                  onClick={() => handleClaim(play)}
                  disabled={busyId === play.id}
                  className="rounded-md bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-40"
                >
                  {busyId === play.id ? "…" : "Remettre le lot"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
        Les participations sont automatiquement supprimées au bout de 3 mois (RGPD). Les lots
        alcoolisés ne sont jamais remis à un mineur — proposer un équivalent sans alcool.
      </p>
    </div>
  );
}
