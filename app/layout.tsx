import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beauty OS | CRM beauty con AI",
  description:
    "Dashboard premium per fidelizzazione e recupero clienti di saloni, barber, centri estetici e nail studio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#f7f7f5]">{children}</body>
    </html>
  );
}
