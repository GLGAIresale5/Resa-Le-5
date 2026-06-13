"use client";

import { useEffect, useState, useCallback } from "react";
import { Review } from "../../../types";
import { fetchReviews } from "../../../lib/api";
import ReviewCard from "../../../components/ReviewCard";
import { useAuth } from "../../../lib/auth-context";

type Tab = "pending" | "responded";

export default function AvisPage() {
  const { restaurant } = useAuth();
  const RESTAURANT_ID = restaurant?.id ?? "";
  const [tab, setTab] = useState<Tab>("pending");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoApprove, setAutoApprove] = useState(false);

  const load = useCallback(async () => {
    if (!RESTAURANT_ID) {
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
      <header className="border-b border-neutral-800 bg-neutral-950">
        <div className="flex items-center justify-between px-4 md:px-8 py-4 md:py-5 gap-3">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-white">Avis clients</h1>
            <p className="text-xs text-neutral-500">Gérez et répondez aux avis Google</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoApprove((v) => !v)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                autoApprove
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                  : "border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white"
              }`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${autoApprove ? "bg-emerald-400" : "bg-neutral-600"}`}
              />
              Auto-validation ★3+
            </button>
            <button
              onClick={load}
              className="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-neutral-600 hover:text-white"
            >
              Actualiser
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 md:px-8">
          <nav className="flex gap-0">
            {(["pending", "responded"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
                  tab === t
                    ? "border-white text-white"
                    : "border-transparent text-neutral-400 hover:text-white"
                }`}
              >
                {t === "pending" ? "À traiter" : "Répondus"}
                {t === "pending" && pendingCount !== null && pendingCount > 0 && (
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-xs font-medium text-neutral-950">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 md:px-8 py-6 md:py-8">
        {loading && (
          <div className="flex items-center justify-center py-24 text-sm text-neutral-400">
            <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Chargement…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/15 px-5 py-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && reviews.length === 0 && (
          <div className="py-24 text-center">
            <p className="text-sm text-neutral-400">
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
