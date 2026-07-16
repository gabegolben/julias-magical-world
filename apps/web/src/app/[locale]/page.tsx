import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Language names are endonyms on purpose — a child looking for their own
// language should find it written the way they know it.
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  "pt-BR": "Português",
  es: "Español",
};

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6 text-center">
      <h1 className="font-display text-5xl text-ink sm:text-6xl">{t("title")}</h1>
      <p className="max-w-md font-body text-xl text-ink/70">{t("tagline")}</p>
      <div className="flex flex-col gap-5 sm:flex-row">
        <Link
          href="/create"
          className="min-h-tap rounded-wobble border-4 border-ink bg-julia px-10 py-5 font-display text-2xl text-white shadow-[0_8px_0_#37305A] transition-transform motion-safe:active:translate-y-1"
        >
          ✨ {t("newStory")}
        </Link>
        <Link
          href="/library"
          className="min-h-tap rounded-wobble border-4 border-ink/20 bg-white px-10 py-5 font-display text-2xl text-ink shadow-[0_8px_0_rgba(55,48,90,0.15)] transition-transform motion-safe:active:translate-y-1"
        >
          📚 {t("myLibrary")}
        </Link>
      </div>
      <nav aria-label={t("languageLabel")} className="mt-6 flex gap-4">
        {routing.locales.map((l) => (
          <Link
            key={l}
            href="/"
            locale={l}
            className={`rounded-full border-2 px-4 py-1 font-body text-sm ${
              l === locale ? "border-julia bg-julia-soft text-ink" : "border-ink/20 text-ink/60"
            }`}
          >
            {LANGUAGE_NAMES[l]}
          </Link>
        ))}
      </nav>
    </main>
  );
}
