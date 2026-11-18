import type { MetadataRoute } from "next";
import { siteUrl } from "@/components/landing/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/hy/app", "/ru/app", "/en/app", "/hy/themes", "/ru/themes", "/en/themes"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
