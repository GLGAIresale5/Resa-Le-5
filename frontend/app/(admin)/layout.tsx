"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";
import PushNotifications from "../components/PushNotifications";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-sm text-zinc-400">Chargement...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <PushNotifications />
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col overflow-auto pb-14 md:pb-0">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
