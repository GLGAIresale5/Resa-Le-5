"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function RestaurantHome() {
  const router = useRouter();
  const params = useParams();
  const slug = params.restaurant as string;

  useEffect(() => {
    router.replace(`/${slug}/reservations`);
  }, [router, slug]);

  return null;
}
