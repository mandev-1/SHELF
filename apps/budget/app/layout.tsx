import type { Metadata } from "next";
import "./globals.css";
// Handoff 007 — ported 1:1 (verbatim). The .notebook-page wrapper is applied in page.tsx.
import "../components/notebook-background.css";

export const metadata: Metadata = {
  title: "Budget",
  description: "Shared budget for friends",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-theme="sap" = the light blue "office" theme the handoff/extension use.
    // data-density="compact" matches the extension's spacing.
    <html lang="en" data-theme="sap" data-density="compact">
      <body>
        {/* DM Sans / DM Mono — budget.css references these by name (its embedded
            font files were stripped during the port). Next hoists these to <head>. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {children}
      </body>
    </html>
  );
}
