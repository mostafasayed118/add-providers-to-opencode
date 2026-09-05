import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Opencode Provider Config",
  description: "Configure opencode global provider: base_url, api_key, model_id",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
