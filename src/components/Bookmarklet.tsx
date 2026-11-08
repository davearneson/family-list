"use client";

import { useEffect, useRef } from "react";
import { Logo } from "./Logo";

/**
 * A "bookmarklet": a bookmark that, when clicked on a product page, reads the page you're
 * looking at (title, picture, price) and opens Family List's add form. Because it runs in your
 * own browser, it works even on sites that block automatic lookups (like Amazon).
 */
export function Bookmarklet({ origin }: { origin: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const code = `javascript:(()=>{const m=n=>{const e=document.querySelector('meta[property="'+n+'"],meta[name="'+n+'"]');return e&&e.content||''};const q=s=>{const e=document.querySelector(s);return e?(e.getAttribute('data-old-hires')||e.getAttribute('src')||e.textContent||'').trim():''};const t=q('#productTitle')||m('og:title')||document.title;const i=q('#landingImage')||m('og:image')||m('twitter:image');const a=m('product:price:amount')||m('og:price:amount');const p=q('#corePrice_feature_div .a-offscreen')||q('.a-price .a-offscreen')||(a?'$'+a:'');window.open(${JSON.stringify(origin)}+'/add?'+new URLSearchParams({url:location.href,title:t.slice(0,200),image:i,price:p.slice(0,40)}),'_blank')})()`;
    // React refuses javascript: links in JSX, so set it directly.
    ref.current?.setAttribute("href", code);
  }, [origin]);

  return (
    <a
      ref={ref}
      href="#"
      onClick={(e) => {
        e.preventDefault();
        alert("Drag this button to your bookmarks bar, then click it while you're on any product page.");
      }}
      className="inline-flex cursor-grab items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-[15px] font-medium shadow-sm active:cursor-grabbing"
    >
      <Logo className="h-5 w-5" />
      + Family List
    </a>
  );
}
