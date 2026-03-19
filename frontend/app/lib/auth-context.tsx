"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "./supabase";
import type { User, Session } from "@supabase/supabase-js";

interface Restaurant {
  id: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  restaurant: Restaurant | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  restaurant: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRestaurant(session.access_token);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRestaurant(session.access_token);
      } else {
        setRestaurant(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchRestaurant(accessToken: string) {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRestaurant(data.restaurant);
      }
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRestaurant(null);
  }

  return (
    <AuthContext.Provider value={{ user, session, restaurant, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
