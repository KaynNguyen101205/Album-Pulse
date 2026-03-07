import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AlbumPulse",
  description: "Album recommendations and weekly picks",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}