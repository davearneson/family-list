import { ImageResponse } from "next/og";
import { iconSvg, svgDataUri } from "@/lib/iconSvg";

// Home-screen icons for Android / the web app manifest: /icons/192 and /icons/512.
export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size } = await ctx.params;
  const px = size === "512" ? 512 : 192;
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
      <img src={svgDataUri(iconSvg({ inset: 0.12 }))} width={px} height={px} />
    ),
    { width: px, height: px, headers: { "Cache-Control": "public, max-age=86400, immutable" } },
  );
}
