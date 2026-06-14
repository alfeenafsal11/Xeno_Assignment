import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Xeno AI CRM — AI Marketing Copilot for D2C Brands",
  description: "AI-Native Marketing CRM: intelligent audience segmentation, personalized campaign generation, and real-time analytics for D2C brands.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
