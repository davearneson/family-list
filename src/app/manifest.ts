import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Family List",
    short_name: "Family List",
    description: "Our family's Christmas lists",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#fafaf9",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Android: lets you Share → Family List from any app once installed.
    ...({
      share_target: { action: "/add", method: "GET", params: { title: "title", text: "text", url: "url" } },
    } as object),
  };
}
