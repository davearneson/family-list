type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 " +
  "disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-700",
  secondary: "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-4 text-[15px]",
  sm: "h-9 px-3 text-sm",
};

export const button = (variant: Variant = "primary", size: Size = "md") => `${base} ${variants[variant]} ${sizes[size]}`;

export const input =
  "block w-full rounded-lg border border-zinc-300 bg-white px-3 h-11 text-base text-zinc-900 placeholder:text-zinc-400 " +
  "focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900";

export const textarea = input.replace("h-11", "min-h-20 py-2.5");

export const label = "mb-1.5 block text-sm font-medium text-zinc-700";

export const card = "rounded-xl border border-zinc-200 bg-white";

export const chip = {
  reserved: "inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[13px] font-medium text-amber-800 ring-1 ring-amber-200",
  bought: "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[13px] font-medium text-emerald-800 ring-1 ring-emerald-200",
  idea: "inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[13px] font-medium text-sky-800 ring-1 ring-sky-200",
  wanted: "inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[13px] font-medium text-amber-700 ring-1 ring-amber-300",
  neutral: "inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[13px] font-medium text-zinc-700",
};
