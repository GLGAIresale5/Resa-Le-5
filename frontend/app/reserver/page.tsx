import { redirect } from "next/navigation";

/**
 * Backwards compatibility: /reserver redirects to /reserver/le-5
 * (ancien lien sur Google Business Profile, QR codes, etc.)
 */
export default function ReserverRedirectPage() {
  redirect("/reserver/le-5");
}
