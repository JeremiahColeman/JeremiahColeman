import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Family Wishlist",
    short_name: "Wishlist",
    description: "Share gift lists with family and keep the surprise.",
    start_url: "/lists",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf7f0",
    theme_color: "#1f5135",
    categories: ["lifestyle", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My shopping", url: "/shopping" },
      { name: "Shared with me", url: "/shared" },
    ],
  };
}
