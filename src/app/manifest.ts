import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "夫妻家庭帳本",
    short_name: "家帳",
    description: "夫妻家庭共同記帳工具",
    start_url: "/",
    display: "standalone",
    background_color: "#F7FAF8",
    theme_color: "#23865F",
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
