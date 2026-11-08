export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Chicago";

export function possessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

export function joinNames(names: string[]): string {
  return new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(names);
}

export function formatDay(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: APP_TIMEZONE }).format(d);
}

/** "November 8", plus the year if it isn't this year. */
export function formatDate(d: Date): string {
  const thisYear = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: APP_TIMEZONE }).format(new Date());
  const year = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: APP_TIMEZONE }).format(d);
  return year === thisYear ? formatDay(d) : `${formatDay(d)}, ${year}`;
}

export function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** First number in a price string: "$1,299.99" → 1299.99, "$20–30" → 20. */
export function priceNumber(price: string | null): number | null {
  const m = price?.match(/\d[\d,]*(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function money(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
