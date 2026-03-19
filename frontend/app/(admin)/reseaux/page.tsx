"use client";

import { useState, useRef, useEffect } from "react";
import { PostCaptions, PublishAlert } from "../../types";
import { generatePost, approvePost, publishPost, fetchPublishAlerts } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
];

const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"]; // 0=dim..6=sam
const DAY_NAMES_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

type ActiveTab = "instagram" | "facebook";

interface PublishDefaults {
  days: number[];
  defaultTime: string;
}

function loadDefaults(): PublishDefaults {
  if (typeof window === "undefined") return { days: [], defaultTime: "17:00" };
  try {
    const raw = localStorage.getItem("glg-ai-publish-defaults");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { days: [], defaultTime: "17:00" };
}

function saveDefaults(defaults: PublishDefaults) {
  localStorage.setItem("glg-ai-publish-defaults", JSON.stringify(defaults));
}

/** Calcule le prochain datetime ISO pour un jour donné (0=dim..6=sam) à l'heure choisie. */
function getNextDateForDay(dayOfWeek: number, time: string): string {
  const now = new Date();
  const [hours, minutes] = time.split(":").map(Number);
  const target = new Date(now);
  const currentDay = now.getDay();
  let daysAhead = dayOfWeek - currentDay;
  if (daysAhead < 0) daysAhead += 7;
  if (daysAhead === 0) {
    // Si c'est aujourd'hui mais l'heure est déjà passée, prendre la semaine prochaine
    const todayTarget = new Date(now);
    todayTarget.setHours(hours, minutes, 0, 0);
    if (todayTarget <= now) daysAhead = 7;
  }
  target.setDate(now.getDate() + daysAhead);
  target.setHours(hours, minutes, 0, 0);
  return target.toISOString();
}

/** Trouve le prochain créneau parmi les jours sélectionnés. */
function getNextSlot(selectedDays: number[], time: string): { iso: string; label: string } | null {
  if (selectedDays.length === 0) return null;
  let earliest: Date | null = null;
  let earliestDay = 0;
  for (const day of selectedDays) {
    const iso = getNextDateForDay(day, time);
    const d = new Date(iso);
    if (!earliest || d < earliest) {
      earliest = d;
      earliestDay = day;
    }
  }
  if (!earliest) return null;
  const dayStr = DAY_NAMES_FR[earliestDay];
  const dateStr = earliest.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  return {
    iso: earliest.toISOString(),
    label: `${dayStr.charAt(0).toUpperCase() + dayStr.slice(1)} ${dateStr} à ${time}`,
  };
}

export default function ReseauxPage() {
  const { restaurant } = useAuth();
  const RESTAURANT_ID = restaurant?.id ?? "";
  const [context, setContext] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["instagram", "facebook"]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Résultat de la génération
  const [postId, setPostId] = useState<string | null>(null);
  const [captions, setCaptions] = useState<PostCaptions | null>(null);
  const [editedCaptions, setEditedCaptions] = useState<PostCaptions | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("instagram");
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  // Publication
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishMode, setPublishMode] = useState<"immediate" | "scheduled" | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [publishTime, setPublishTime] = useState("17:00");
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);

  // Alertes
  const [alerts, setAlerts] = useState<PublishAlert[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Charger les defaults au mount
  useEffect(() => {
    const defaults = loadDefaults();
    setSelectedDays(defaults.days);
    setPublishTime(defaults.defaultTime);
  }, []);

  // Charger les alertes au mount et quand les jours changent
  useEffect(() => {
    if (!RESTAURANT_ID || selectedDays.length === 0) {
      setAlerts([]);
      return;
    }
    fetchPublishAlerts(RESTAURANT_ID, selectedDays).then(setAlerts).catch(() => {});
  }, [selectedDays]);

  function handleFileSelect(file: File) {
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFileSelect(file);
  }

  function togglePlatform(id: string) {
    setPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function toggleDay(day: number) {
    setSelectedDays((prev) => {
      const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day];
      // Sauvegarder la règle
      saveDefaults({ days: next, defaultTime: publishTime });
      return next;
    });
  }

  function handleTimeChange(time: string) {
    setPublishTime(time);
    saveDefaults({ days: selectedDays, defaultTime: time });
  }

  function reset() {
    setContext("");
    setPhotoFile(null);
    setPhotoPreview(null);
    setPostId(null);
    setCaptions(null);
    setEditedCaptions(null);
    setApproved(false);
    setPublished(false);
    setPublishMode(null);
    setPublishError(null);
    setPublishSuccess(null);
    setError(null);
    setPlatforms(["instagram", "facebook"]);
  }

  async function handleGenerate() {
    if (!context.trim()) {
      setError("Décris le contexte du post avant de générer.");
      return;
    }
    if (platforms.length === 0) {
      setError("Sélectionne au moins une plateforme.");
      return;
    }

    setGenerating(true);
    setError(null);
    setCaptions(null);
    setPostId(null);
    setApproved(false);
    setPublished(false);
    setPublishMode(null);
    setPublishError(null);
    setPublishSuccess(null);

    try {
      let photoBase64: string | undefined;
      let photoMediaType: string | undefined;

      if (photoFile) {
        photoMediaType = photoFile.type;
        const buffer = await photoFile.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        bytes.forEach((b) => (binary += String.fromCharCode(b)));
        photoBase64 = btoa(binary);
      }

      const result = await generatePost(
        RESTAURANT_ID,
        context,
        platforms,
        photoBase64,
        photoMediaType
      );

      setPostId(result.post_id);
      setCaptions(result.captions);
      setEditedCaptions(result.captions);
      setActiveTab(platforms.includes("instagram") ? "instagram" : "facebook");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove() {
    if (!postId || !editedCaptions) return;
    setApproving(true);
    setError(null);
    try {
      const finalText =
        activeTab === "instagram"
          ? editedCaptions.instagram
          : editedCaptions.facebook;
      await approvePost(postId, finalText);
      setApproved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApproving(false);
    }
  }

  async function handlePublish(mode: "immediate" | "scheduled") {
    if (!postId) return;
    setPublishing(true);
    setPublishError(null);
    setPublishSuccess(null);

    try {
      let scheduledAt: string | undefined;
      if (mode === "scheduled") {
        const slot = getNextSlot(selectedDays, publishTime);
        if (!slot) {
          setPublishError("Sélectionne au moins un jour de publication.");
          setPublishing(false);
          return;
        }
        scheduledAt = slot.iso;
      }

      const result = await publishPost(postId, scheduledAt);
      setPublished(true);
      setPublishMode(mode);

      if (mode === "scheduled" && result.scheduled_at) {
        const d = new Date(result.scheduled_at);
        setPublishSuccess(
          `Programmé pour ${d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} à ${publishTime}`
        );
      } else {
        // Vérifier les résultats par plateforme
        const statuses = Object.entries(result.results || {}).map(
          ([platform, r]) => `${platform}: ${r.status}`
        );
        setPublishSuccess(`Publié — ${statuses.join(", ")}`);
      }
    } catch (e) {
      setPublishError((e as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  const nextSlot = getNextSlot(selectedDays, publishTime);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white px-4 md:px-8 py-4 md:py-5">
        <h1 className="text-base font-semibold text-zinc-900">Réseaux sociaux</h1>
        <p className="text-xs text-zinc-400">
          Génère des captions Instagram et Facebook à partir d'une photo et d'un contexte
        </p>
      </header>

      <main className="px-4 md:px-8 py-6 md:py-8">
        {/* Alertes */}
        {alerts.length > 0 && (
          <div className="mb-6 max-w-5xl">
            {alerts.map((alert) => (
              <div
                key={alert.date}
                className="mb-2 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75h.007v.008H12v-.008z" />
                </svg>
                Aucun post prévu pour {alert.day_name} {new Date(alert.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
              </div>
            ))}
          </div>
        )}

        <div className="grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-2">

          {/* Colonne gauche — formulaire */}
          <div className="flex flex-col gap-6">

            {/* Upload photo */}
            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-700">
                Photo <span className="font-normal text-zinc-400">(optionnelle — Claude l'analyse si fournie)</span>
              </label>
              {photoPreview ? (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Aperçu"
                    className="h-48 w-full rounded-xl object-cover"
                  />
                  <button
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900/70 text-white hover:bg-zinc-900"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition ${
                    dragging
                      ? "border-zinc-400 bg-zinc-100"
                      : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-zinc-100"
                  }`}
                >
                  <svg className="mb-2 h-6 w-6 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 12h.008v.008H13.5V12zm-3 0h.008v.008H13.5V12zm-3 0h.008v.008H10.5V12zM3.75 6h16.5" />
                  </svg>
                  <p className="text-sm text-zinc-400">Glisse une photo ici ou clique pour en choisir une</p>
                  <p className="text-xs text-zinc-300">JPG, PNG, WEBP</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Contexte */}
            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-700">
                Contexte du post <span className="text-red-400">*</span>
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Ex : nouvelle entrée au menu — tartare de saumon maison avec avocat et gingembre. Plat léger et frais, parfait pour l'été."
                rows={4}
                className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            {/* Plateformes */}
            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-700">Plateformes</label>
              <div className="flex gap-3">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      platforms.includes(p.id)
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Erreur */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Bouton générer */}
            <button
              onClick={handleGenerate}
              disabled={generating || !context.trim()}
              className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
            >
              {generating ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Génération en cours…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  Générer les captions
                </>
              )}
            </button>
          </div>

          {/* Colonne droite — résultat */}
          <div className="flex flex-col gap-4">
            {!captions && !generating && (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 py-20 text-center">
                <p className="text-sm text-zinc-400">Les captions générées apparaîtront ici</p>
                <p className="mt-1 text-xs text-zinc-300">Remplis le formulaire et clique sur Générer</p>
              </div>
            )}

            {generating && (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 py-20">
                <svg className="h-5 w-5 animate-spin text-zinc-300" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <p className="mt-3 text-sm text-zinc-400">Claude rédige vos captions…</p>
              </div>
            )}

            {captions && editedCaptions && !generating && (
              <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5">
                {/* Tabs Instagram / Facebook */}
                <div className="flex gap-0 border-b border-zinc-100">
                  {(["instagram", "facebook"] as ActiveTab[])
                    .filter((t) => platforms.includes(t))
                    .map((t) => (
                      <button
                        key={t}
                        onClick={() => setActiveTab(t)}
                        className={`border-b-2 px-4 py-2 text-sm font-medium capitalize transition ${
                          activeTab === t
                            ? "border-zinc-900 text-zinc-900"
                            : "border-transparent text-zinc-400 hover:text-zinc-600"
                        }`}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                </div>

                {/* Caption éditable */}
                <textarea
                  value={
                    activeTab === "instagram"
                      ? editedCaptions.instagram
                      : editedCaptions.facebook
                  }
                  onChange={(e) =>
                    setEditedCaptions((prev) =>
                      prev
                        ? { ...prev, [activeTab]: e.target.value }
                        : prev
                    )
                  }
                  rows={10}
                  disabled={approved}
                  className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-relaxed text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-60"
                />

                {/* Actions pré-approbation */}
                {!approved && (
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={reset}
                      className="text-xs text-zinc-400 hover:text-zinc-600"
                    >
                      Recommencer
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={approving}
                      className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50"
                    >
                      {approving ? "Approbation…" : "Approuver le post"}
                    </button>
                  </div>
                )}

                {/* Panneau de publication — après approbation */}
                {approved && !published && (
                  <div className="flex flex-col gap-4 border-t border-zinc-100 pt-4">
                    {/* Règle de jours */}
                    <div>
                      <label className="mb-2 block text-xs font-medium text-zinc-700">
                        Jours de publication
                      </label>
                      <div className="flex gap-1.5">
                        {DAY_LABELS.map((label, i) => (
                          <button
                            key={i}
                            onClick={() => toggleDay(i)}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition ${
                              selectedDays.includes(i)
                                ? "bg-zinc-900 text-white"
                                : "border border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Heure */}
                    <div>
                      <label className="mb-2 block text-xs font-medium text-zinc-700">
                        Heure de publication
                      </label>
                      <input
                        type="time"
                        value={publishTime}
                        onChange={(e) => handleTimeChange(e.target.value)}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                      />
                    </div>

                    {/* Prochain créneau */}
                    {nextSlot && (
                      <p className="text-xs text-zinc-500">
                        Prochain : {nextSlot.label}
                      </p>
                    )}

                    {/* Erreur publication */}
                    {publishError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                        {publishError}
                      </div>
                    )}

                    {/* Boutons publication */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handlePublish("immediate")}
                        disabled={publishing}
                        className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                      >
                        {publishing && publishMode === null ? "Publication…" : "Publier maintenant"}
                      </button>
                      <button
                        onClick={() => handlePublish("scheduled")}
                        disabled={publishing || selectedDays.length === 0}
                        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
                      >
                        {publishing ? "Programmation…" : "Programmer"}
                      </button>
                    </div>

                    <button
                      onClick={reset}
                      className="self-start text-xs text-zinc-400 hover:text-zinc-600"
                    >
                      Recommencer
                    </button>
                  </div>
                )}

                {/* Succès publication */}
                {published && publishSuccess && (
                  <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {publishSuccess}
                    </div>
                    <button
                      onClick={reset}
                      className="self-start rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
                    >
                      Nouveau post
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
