"use client";

import { useEffect } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import Sidebar from "../../components/Sidebar";
import BottomNav from "../../components/BottomNav";
import PushNotifications from "../../components/PushNotifications";

// Map route segments to module names
const ROUTE_TO_MODULE: Record<string, string> = {
  reservations: "reservations",
  avis: "avis",
  reseaux: "reseaux",
  stocks: "stocks",
  "stocks-cuisine": "stocks-cuisine",
  parametres: "parametres", // always allowed
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, restaurant: restaurantData, refreshRestaurant } = useAuth();
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const restaurant = params.restaurant as string;

  // Re-fetch restaurant when slug changes (multi-tenant navigation)
  useEffect(() => {
    if (!loading && user && restaurantData?.slug && restaurantData.slug !== restaurant) {
      refreshRestaurant();
    }
  }, [restaurant, loading, user, restaurantData?.slug, refreshRestaurant]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // Redirect to first allowed module if current route is not authorized
  useEffect(() => {
    if (loading || !user || !restaurantData?.modules) return;
    const modules = restaurantData.modules;
    // Extract the route segment after /[restaurant]/
    const segments = pathname.split("/").filter(Boolean);
    const routeSegment = segments[1]; // e.g. "reservations", "avis"
    if (!routeSegment) return;
    const requiredModule = ROUTE_TO_MODULE[routeSegment];
    if (!requiredModule || requiredModule === "parametres") return; // parametres always allowed
    if (!modules.includes(requiredModule)) {
      // Redirect to first allowed module
      router.replace(`/${restaurant}/${modules[0]}`);
    }
  }, [loading, user, restaurantData, pathname, router, restaurant]);

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
