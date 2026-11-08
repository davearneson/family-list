import { ImageResponse } from "next/og";
import { iconSvg, svgDataUri } from "@/lib/iconSvg";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      // eslint-disable-next-line jsx-a11y/alt-text
      <img src={svgDataUri(iconSvg({ inset: 0.08 }))} width={180} height={180} />
    ),
    size,
  );
}
