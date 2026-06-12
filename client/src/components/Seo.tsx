import { useEffect } from "react";

interface SeoProps {
  title: string;
  description: string;
  path: string;
}

const SITE_NAME = "Claude Agent Template";
const BASE_URL = "https://claude-agent-template.zeabur.app";
const OG_IMAGE = `${BASE_URL}/logo-512.png`;

export default function Seo({ title, description, path }: SeoProps) {
  const fullTitle = `${title} — ${SITE_NAME}`;
  const canonicalUrl = `${BASE_URL}${path}`;

  useEffect(() => {
    document.title = fullTitle;

    const setMeta = (property: string, content: string) => {
      let el =
        document.querySelector(`meta[property="${property}"]`) ||
        document.querySelector(`meta[name="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        if (property.startsWith("og:") || property.startsWith("twitter:")) {
          el.setAttribute("property", property);
        } else {
          el.setAttribute("name", property);
        }
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("description", description);
    setMeta("og:title", fullTitle);
    setMeta("og:description", description);
    setMeta("og:url", canonicalUrl);
    setMeta("og:image", OG_IMAGE);
    setMeta("og:type", "website");
    setMeta("twitter:card", "summary");
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", description);

    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", canonicalUrl);
  }, [fullTitle, description, canonicalUrl]);

  return null;
}
