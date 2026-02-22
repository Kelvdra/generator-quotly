import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quotly Canvas Generator",
  description: "Generate quotly-like chat images using HTML Canvas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
