import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AGBE Family — Plateforme de Gestion Familiale (PGF)",
  description:
    "Centralisez la gestion des membres, des finances (cotisations, trésorerie) et des projets collaboratifs de votre famille sur une plateforme unique, sécurisée et accessible.",
  keywords: ["gestion familiale", "cotisations", "trésorerie", "registre", "familles", "PGF", "AGBE"],
  authors: [{ name: "AGBE Family" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AGBE Family",
  },
  openGraph: {
    title: "AGBE Family — Plateforme de Gestion Familiale",
    description: "Membres, cotisations, trésorerie et projets familiaux centralisés et sécurisés.",
    siteName: "AGBE Family",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#171B29",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
