import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "一起記",
    short_name: "一起記",
    description: "家庭收支記帳工具",
    start_url: "/",
    display: "standalone",
    background_color: "#F5F6F4",
    theme_color: "#2F6F68",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
