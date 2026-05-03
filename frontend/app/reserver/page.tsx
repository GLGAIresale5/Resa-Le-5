import { redirect } from "next/navigation";

/**
 * Backwards compatibility: /reserver redirects to /reserver/le-5
 * (ancien lien sur Google Business Profile, QR codes, etc.)
 * Préserve les query params (notamment ?mode=privatisation).
 */
export default async function ReserverRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
    else if (v) qs.set(k, v);
  }
  const suffix = qs.toString();
  redirect(suffix ? `/reserver/le-5?${suffix}` : "/reserver/le-5");
}
