import { useEffect } from 'react';
import { APP_NAME, SITE_URL, DEFAULT_OG_IMAGE } from '../lib/constants';

interface SeoOptions {
  /** Page title, combined into "Title · Productivity Maxing". Omit for the bare app name. */
  title?: string;
  /** Meta description, ~120-160 chars. Required so every public page gets an intentional one. */
  description: string;
  /** Path only, e.g. '/' or '/login' - used to build the canonical + og:url. */
  path: string;
  /** Absolute URL to a 1200x630 image. Defaults to the shared brand OG image. */
  image?: string;
  /** Set true for pages that shouldn't be indexed (404s, thank-you pages, etc). */
  noindex?: boolean;
  /** Pre-stringified JSON-LD (use JSON.stringify at the call site, ideally a module-level constant). */
  jsonLd?: string;
}

function setMetaTag(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLinkTag(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

const JSON_LD_ELEMENT_ID = 'seo-json-ld';

// Per-page SEO: title, description, canonical, OpenGraph, Twitter card, robots
// and optional JSON-LD. Deliberately separate from useDocumentTitle (which
// every private/authenticated page already uses) - this is only meant for
// the small set of public pages (Home, Login, Register, legal pages, 404)
// that actually need to be indexable/shareable. Mutates <head> directly
// since this SPA has no react-helmet-style dependency and one extra tiny
// hook is cheaper than pulling one in for ~6 pages.
export default function useSeo({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
  noindex = false,
  jsonLd,
}: SeoOptions) {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${APP_NAME}` : APP_NAME;
    const canonicalUrl = `${SITE_URL}${path}`;

    document.title = fullTitle;

    setMetaTag('name', 'description', description);
    setLinkTag('canonical', canonicalUrl);

    setMetaTag('property', 'og:title', fullTitle);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:image', image);
    setMetaTag('property', 'og:url', canonicalUrl);
    setMetaTag('property', 'og:type', 'website');
    setMetaTag('property', 'og:site_name', APP_NAME);

    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', fullTitle);
    setMetaTag('name', 'twitter:description', description);
    setMetaTag('name', 'twitter:image', image);

    setMetaTag('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');

    const existingJsonLd = document.getElementById(JSON_LD_ELEMENT_ID);
    if (existingJsonLd) {
      existingJsonLd.remove();
    }
    if (jsonLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = JSON_LD_ELEMENT_ID;
      script.textContent = jsonLd;
      document.head.appendChild(script);
    }
  }, [title, description, path, image, noindex, jsonLd]);
}
