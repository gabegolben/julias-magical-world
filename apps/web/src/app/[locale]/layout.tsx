import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Baloo_2, Nunito } from "next/font/google";
import { routing } from "@/i18n/routing";
import { SwRegister } from "@/components/SwRegister";
import "../globals.css";

const display = Baloo_2({ subsets: ["latin"], variable: "--font-display" });
const body = Nunito({ subsets: ["latin"], variable: "--font-body" });

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Julia's Magical World",
  description: "Every child is the hero of their own story.",
  manifest: `${basePath}/manifest.json`,
  icons: { icon: `${basePath}/icon.svg` },
};

export const viewport: Viewport = { themeColor: "#FFF6E9" };

// Static export: every locale is pre-rendered at build time.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh bg-paper font-body text-ink">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        <SwRegister />
      </body>
    </html>
  );
}
