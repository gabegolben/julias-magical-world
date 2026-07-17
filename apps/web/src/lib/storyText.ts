import type { useTranslations } from "next-intl";
import type { StoryRecord } from "./stories";

type Translator = ReturnType<typeof useTranslations>;

/**
 * Resolves a story's title and page text from the locale templates.
 * Two protagonist modes share one call site everywhere (reader, print,
 * library): the named character, or — when a parent added a name — the
 * child, with the character as their story friend (`*Child` variants).
 */
export function storyStrings(t: Translator, story: StoryRecord) {
  // AI-generated stories carry their own text (in their creation language).
  if (story.title && story.pagesText) {
    const pages = story.pagesText;
    return { title: story.title, pageText: (page: number) => pages[page] ?? "" };
  }
  const plot = `storyData.plots.${story.settingKey}`;
  if (story.childName) {
    const child = story.childName;
    const friend = t(`storyData.characters.${story.characterKey}.friend`);
    return {
      title: t(`${plot}.titleChild`, { child }),
      pageText: (page: number) => t(`${plot}.page${page + 1}Child`, { child, friend }),
    };
  }
  const name = t(`storyData.characters.${story.characterKey}.name`);
  const intro = t(`storyData.characters.${story.characterKey}.intro`);
  return {
    title: t(`${plot}.title`, { name }),
    pageText: (page: number) => t(`${plot}.page${page + 1}`, { name, intro }),
  };
}
