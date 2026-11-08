import { lookup } from "node:dns/promises";
import net from "node:net";
import { parse, type HTMLElement } from "node-html-parser";

export type LinkPreview = { url: string; title?: string; image?: string; price?: string };

/** Pulls the first web link out of any text ("Check this out! https://a.co/d/xyz"). */
export function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"'`]+/i);
  if (!m) return null;
  return m[0].replace(/[),.;!?]+$/, "");
}

// ── Safety: only fetch public websites (never the server's own network) ─────

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
}

async function assertPublic(u: URL) {
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only web links");
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || /\.(localhost|local|internal)$/.test(host)) throw new Error("Private host");
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("Private address");
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function readLimited(res: Response, limit: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  reader.cancel().catch(() => {});
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}

async function fetchHtml(start: string): Promise<{ finalUrl: URL; html: string }> {
  let current = new URL(start);
  for (let hop = 0; hop < 6; hop++) {
    await assertPublic(current);
    const res = await fetch(current, { redirect: "manual", headers: HEADERS, signal: AbortSignal.timeout(8000) });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current);
      continue;
    }
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return { finalUrl: current, html: "" };
    return { finalUrl: current, html: await readLimited(res, 2_000_000) };
  }
  return { finalUrl: current, html: "" };
}

// ── Parsing ─────────────────────────────────────────────────────────────────

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

const clean = (s: string | undefined | null) => (s ? decode(s).replace(/\s+/g, " ").trim() : "");

function formatPrice(amount: unknown, currency?: unknown): string | undefined {
  const n = Number(String(amount ?? "").replace(/[^0-9.]/g, ""));
  if (!amount || !Number.isFinite(n) || n <= 0) return undefined;
  const cur = typeof currency === "string" ? currency.toUpperCase() : "USD";
  if (cur === "USD" || cur === "") return `$${n.toFixed(2)}`;
  return `${n.toFixed(2)} ${cur}`;
}

type Product = { name?: string; image?: string; price?: string };

function findProduct(node: unknown, depth = 0): Record<string, unknown> | null {
  if (!node || typeof node !== "object" || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const p = findProduct(n, depth + 1);
      if (p) return p;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) return obj;
  return findProduct(obj["@graph"], depth + 1) ?? findProduct(obj["mainEntity"], depth + 1);
}

function firstImage(img: unknown): string | undefined {
  if (typeof img === "string") return img;
  if (Array.isArray(img)) return firstImage(img[0]);
  if (img && typeof img === "object") return firstImage((img as Record<string, unknown>).url);
  return undefined;
}

function jsonLdProduct(root: HTMLElement): Product {
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const p = findProduct(JSON.parse(s.text));
      if (!p) continue;
      let offers = p.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
      if (Array.isArray(offers)) offers = offers[0];
      const spec = offers?.priceSpecification as Record<string, unknown> | undefined;
      return {
        name: typeof p.name === "string" ? p.name : undefined,
        image: firstImage(p.image),
        price: formatPrice(
          offers?.price ?? offers?.lowPrice ?? spec?.price,
          offers?.priceCurrency ?? spec?.priceCurrency,
        ),
      };
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return {};
}

/** Title guessed from the link itself, for sites that block us (Amazon often does). */
function titleFromUrl(u: URL): string | undefined {
  const segments = u.pathname.split("/").map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  const dp = segments.findIndex((s) => s === "dp" || s === "gp");
  const candidates = dp > 0 ? [segments[dp - 1]] : segments;
  const best = candidates
    .filter((s) => /[a-z]/i.test(s) && (s.match(/[-_]/g)?.length ?? 0) >= 2)
    .sort((a, b) => b.length - a.length)[0];
  if (!best) return undefined;
  const words = best.replace(/\.[a-z]+$/i, "").replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Titles of "you've been blocked" / error pages, or just a bare domain name.
const BLOCKED_TITLE =
  /^(amazon(\.com)?|robot check|access denied.*|just a moment.*|attention required.*|.*not found.*|.*unavailable.*|40\d\b.*|50\d\b.*|error.*|sorry!.*|captcha.*|security check.*|pardon our interruption.*|are you a (robot|human).*|[\w.-]+\.(com|net|org|co|io|shop|store|us|ca|uk))$/i;

function tidyTitle(title: string): string {
  return title
    .replace(/^Amazon\.com\s*:\s*/i, "")
    .replace(/\s+:\s+[^:]{2,40}$/, "") // "… : Toys & Games"
    .slice(0, 200)
    .trim();
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  let finalUrl = new URL(url);
  let html = "";
  try {
    ({ finalUrl, html } = await fetchHtml(url));
  } catch {
    // fall through to URL-based guesses
  }

  const result: LinkPreview = { url: finalUrl.toString() };
  if (html) {
    const root = parse(html);
    const meta = (...names: string[]) => {
      for (const n of names) {
        const el =
          root.querySelector(`meta[property="${n}"]`) ??
          root.querySelector(`meta[name="${n}"]`) ??
          root.querySelector(`meta[itemprop="${n}"]`);
        const c = clean(el?.getAttribute("content"));
        if (c) return c;
      }
      return "";
    };
    const product = jsonLdProduct(root);
    const amazonTitle = clean(root.querySelector("#productTitle")?.text);
    const amazonImage =
      root.querySelector("#landingImage")?.getAttribute("data-old-hires") ||
      root.querySelector("#landingImage")?.getAttribute("src") ||
      root.querySelector("#imgBlkFront")?.getAttribute("src");
    const amazonPrice = clean(
      (root.querySelector("#corePrice_feature_div .a-offscreen") ?? root.querySelector(".a-price .a-offscreen"))?.text,
    );

    const title =
      clean(product.name) || amazonTitle || meta("og:title", "twitter:title") || clean(root.querySelector("title")?.text);
    if (title && !BLOCKED_TITLE.test(title)) result.title = tidyTitle(title);

    const image = product.image || amazonImage || meta("og:image", "og:image:url", "twitter:image", "twitter:image:src");
    if (image && !image.startsWith("data:")) {
      try {
        const abs = new URL(image, finalUrl);
        if (abs.protocol === "https:" || abs.protocol === "http:") result.image = abs.toString();
      } catch {
        // ignore bad image urls
      }
    }

    result.price =
      product.price ||
      (amazonPrice && /\d/.test(amazonPrice) ? amazonPrice : undefined) ||
      formatPrice(
        meta("product:price:amount", "og:price:amount", "price"),
        meta("product:price:currency", "og:price:currency", "priceCurrency"),
      );
  }

  if (!result.title) result.title = titleFromUrl(finalUrl) ?? titleFromUrl(new URL(url));
  return result;
}
