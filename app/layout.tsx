import type { Metadata, Viewport } from "next";
import "@fontsource-variable/figtree";
import "@fontsource/dejavu-mono/latin-400.css";
import "@fontsource/dejavu-mono/latin-700.css";
import "./globals.css";
import "./plate.css";
import "./app.css";
import "./theme.css";

export const metadata: Metadata = {
  title: { default: "Fallow: rest it, or plant again?", template: "%s | Fallow" },
  description:
    "One block of farmland drawn from open data, with every number traced to its source. Wheat on wheat, or a break crop? Fallow shows what the sources say and where they stop.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a0b0a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main-content">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
