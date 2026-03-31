"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RestaurantOption {
  id: string;
  name: string;
  slug: string;
  modules?: string[];
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  function goToRestaurant(restaurant: RestaurantOption) {
    const firstModule = restaurant.modules?.[0] ?? "reservations";
    router.replace(`/${restaurant.slug}/${firstModule}`);
  }

  async function fetchAndRedirect(token: string): Promise<boolean> {
    const res = await fetch(`${API_URL}/auth/my-restaurants`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    const list: RestaurantOption[] = data.restaurants || [];
    if (list.length === 0) return false;
    if (list.length === 1) {
      goToRestaurant(list[0]);
      return true;
    }
    // Multiple restaurants — show selector
    setRestaurants(list);
    setAccessToken(token);
    return true;
  }

  // Auto-redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.access_token) {
        try {
          const redirected = await fetchAndRedirect(session.access_token);
          if (redirected) return;
        } catch {
          // Session invalid, show login form
        }
      }
      setCheckingSession(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message === "Invalid login credentials"
        ? "Email ou mot de passe incorrect"
        : authError.message);
      setLoading(false);
      return;
    }

    try {
      const redirected = await fetchAndRedirect(data.session!.access_token);
      if (redirected) return;
    } catch {
      // fallback
    }

    setError("Aucun restaurant associé à ce compte.");
    setLoading(false);
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-sm text-zinc-400">Chargement...</div>
      </div>
    );
  }

  // Restaurant selector (multiple restaurants)
  if (restaurants.length > 1) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-zinc-900">GLG AI</h1>
            <p className="mt-1 text-sm text-zinc-500">Choisissez votre restaurant</p>
          </div>
          <div className="space-y-3">
            {restaurants.map((r) => (
              <button
                key={r.id}
                onClick={() => goToRestaurant(r)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left text-sm font-medium text-zinc-900 shadow-sm hover:border-zinc-400 hover:bg-zinc-50 transition-colors"
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900">GLG AI</h1>
          <p className="mt-1 text-sm text-zinc-500">Connectez-vous à votre espace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

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
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
