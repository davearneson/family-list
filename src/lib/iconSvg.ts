/** The app icon: a white gift box with a red bow on charcoal. `inset` shrinks the glyph (for maskable icons). */
export function iconSvg({ rounded = false, inset = 0 }: { rounded?: boolean; inset?: number } = {}): string {
  const s = 1 - inset * 2;
  const o = 32 * (1 - s);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${rounded ? 14 : 0}" fill="#18181b"/>
  <g transform="translate(${o} ${o + 2}) scale(${s})">
    <g fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round">
      <rect x="14" y="29" width="36" height="23" rx="2.5"/>
      <rect x="11" y="21" width="42" height="9" rx="2.5"/>
      <path d="M32 21v31"/>
    </g>
    <g fill="none" stroke="#ef4444" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M32 20c-2-6-10-9-12-4.5s6 4.5 12 4.5z"/>
      <path d="M32 20c2-6 10-9 12-4.5s-6 4.5-12 4.5z"/>
    </g>
  </g>
</svg>`;
}

export const svgDataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
