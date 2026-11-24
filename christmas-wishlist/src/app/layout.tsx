import type { Metadata, Viewport } from "next";
import { RegisterServiceWorker } from "@/components/register-sw";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Family Wishlist", template: "%s · Family Wishlist" },
  description: "Share gift lists with family and keep the surprise.",
  applicationName: "Family Wishlist",
  appleWebApp: { capable: true, title: "Wishlist", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f5135",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
