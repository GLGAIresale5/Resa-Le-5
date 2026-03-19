"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // 1. Créer le compte Supabase Auth
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // 2. Créer le restaurant lié au user
    if (data.session) {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_URL}/auth/register-restaurant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ name: restaurantName }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.detail ?? "Erreur lors de la création du restaurant");
        setLoading(false);
        return;
      }

      router.push("/avis");
    } else {
      // Email confirmation required — show message
      setError(null);
      setLoading(false);
      router.push("/login?registered=true");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900">GLG AI</h1>
          <p className="mt-1 text-sm text-zinc-500">Créez votre compte restaurant</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="restaurantName" className="block text-sm font-medium text-zinc-700">
              Nom du restaurant
            </label>
            <input
              id="restaurantName"
              type="text"
              required
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              placeholder="Mon Restaurant"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              placeholder="vous@exemple.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Création..." : "Créer mon compte"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          Déjà un compte ?{" "}
          <Link href="/login" className="font-medium text-zinc-900 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
