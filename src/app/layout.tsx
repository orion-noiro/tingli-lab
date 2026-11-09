import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TīngLì Lab (听力实验室) — Academia de Escuta, Prosódia & Pares Mínimos do Mandarim",
  description:
    "Plataforma minimalista clássica de treinamento auditivo (HVPT), percepção tonal, pares mínimos dissilábicos, frases inteiras em contexto e duelos imperiais para estudantes lusófonos de Chinês Mandarim.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Andika:ital,wght@0,400;0,700;1,400&family=EB+Garamond:ital,wght@0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&family=Noto+Serif+SC:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased selection:bg-[#9E2A2B]/20 selection:text-[#1E1D1B]">
        {children}
      </body>
    </html>
  );
}
