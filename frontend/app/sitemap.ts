import type { MetadataRoute } from "next";

const SITE = "https://le-5.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE}/la-carte`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/reserver`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/le-restaurant`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/mentions-legales`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
