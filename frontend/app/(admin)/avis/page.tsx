"use client";

import { useEffect, useState, useCallback } from "react";
import { Review } from "../../types";
import { fetchReviews } from "../../lib/api";
import ReviewCard from "../../components/ReviewCard";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";

type Tab = "pending" | "responded";

export default function AvisPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoApprove, setAutoApprove] = useState(false);

  const load = useCallback(async () => {
    if (!RESTAURANT_ID) {
      setError("NEXT_PUBLIC_RESTAURANT_ID manquant dans .env.local");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReviews(RESTAURANT_ID, tab);
      setReviews(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  function handleApproved(reviewId: string) {
    setReviews((prev) => prev.filter((r) => r.id !== reviewId));
  }

  const pendingCount = tab === "pending" ? reviews.length : null;

  return (
    <div className="flex flex-col">
      {/* Page header */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="flex items-center justify-between px-8 py-5">
          <div>
            <h1 className="text-base font-semibold text-zinc-900">Avis clients</h1>
            <p className="text-xs text-zinc-400">Gérez et répondez aux avis Google, TripAdvisor, TheFork</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoApprove((v) => !v)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                autoApprove
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
              }`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${autoApprove ? "bg-emerald-500" : "bg-zinc-300"}`}
              />
              Auto-validation ★3+
            </button>
            <button
              onClick={load}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
            >
              Actualiser
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-8">
          <nav className="flex gap-0">
            {(["pending", "responded"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
                  tab === t
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-400 hover:text-zinc-600"
                }`}
              >
                {t === "pending" ? "À traiter" : "Répondus"}
                {t === "pending" && pendingCount !== null && pendingCount > 0 && (
                  <span className="rounded-full bg-zinc-900 px-1.5 py-0.5 text-xs font-medium text-white">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-8 py-8">
        {loading && (
          <div className="flex items-center justify-center py-24 text-sm text-zinc-400">
            <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Chargement…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && reviews.length === 0 && (
          <div className="py-24 text-center">
            <p className="text-sm text-zinc-400">
              {tab === "pending"
                ? "Aucun avis en attente. Bon travail !"
                : "Aucun avis traité pour l'instant."}
            </p>
          </div>
        )}

        {!loading && !error && reviews.length > 0 && (
          <div className="flex max-w-3xl flex-col gap-4">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                restaurantId={RESTAURANT_ID}
                onApproved={handleApproved}
                autoApprove={autoApprove && (review.rating ?? 0) >= 3}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
