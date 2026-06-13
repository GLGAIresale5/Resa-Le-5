"use client";

import { useState } from "react";
import { Review } from "../types";
import StarRating from "./StarRating";
import { generateResponse, approveResponse } from "../lib/api";

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  google: { label: "Google", color: "bg-blue-500/15 text-blue-300" },
  tripadvisor: { label: "TripAdvisor", color: "bg-green-500/15 text-green-300" },
  thefork: { label: "TheFork", color: "bg-orange-500/15 text-orange-300" },
};

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface ReviewCardProps {
  review: Review;
  restaurantId: string;
  onApproved: (reviewId: string) => void;
  autoApprove?: boolean;
}

export default function ReviewCard({
  review,
  restaurantId,
  onApproved,
  autoApprove = false,
}: ReviewCardProps) {
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(review.status === "responded");

  const source = SOURCE_LABELS[review.source] ?? {
    label: review.source,
    color: "bg-neutral-800 text-neutral-300",
  };

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateResponse(review.id, restaurantId);
      setResponseId(result.response_id);
      setResponseText(result.generated_text);

      if (autoApprove) {
        await approveResponse(review.id, result.response_id, result.generated_text);
        setApproved(true);
        onApproved(review.id);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove() {
    if (!responseId) return;
    setApproving(true);
    setError(null);
    try {
      await approveResponse(review.id, responseId, responseText);
      setApproved(true);
      onApproved(review.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApproving(false);
    }
  }

  return (
    <div
      className={`rounded-xl border border-neutral-800 bg-neutral-900 transition-opacity ${approved ? "opacity-60" : ""}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${source.color}`}
            >
              {source.label}
            </span>
            {review.rating !== undefined && (
              <StarRating rating={review.rating} />
            )}
          </div>
          <p className="text-sm font-semibold text-white">
            {review.author_name ?? "Anonyme"}
          </p>
        </div>
        <p className="shrink-0 text-xs text-neutral-500">
          {formatDate(review.review_date)}
        </p>
      </div>

      {/* Avis */}
      {review.content && (
        <p className="px-5 pb-4 text-sm leading-relaxed text-neutral-300">
          {review.content}
        </p>
      )}

      {/* Réponse générée */}
      {responseText && (
        <div className="mx-5 mb-4 rounded-lg border border-neutral-800 bg-neutral-950 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Réponse générée
          </p>
          <textarea
            className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
            rows={5}
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
          />
        </div>
      )}

      {/* Erreur */}
      {error && (
        <p className="mx-5 mb-3 rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 border-t border-neutral-800 px-5 py-3">
        {approved ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-300">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Approuvé
          </span>
        ) : responseText ? (
          <button
            onClick={handleApprove}
            disabled={approving}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50"
          >
            {approving ? "Approbation…" : "Approuver"}
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 rounded-lg border border-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:text-white disabled:opacity-50"
          >
            {generating ? (
              <>
                <svg className="h-4 w-4 animate-spin text-neutral-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Génération…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                Générer la réponse
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
