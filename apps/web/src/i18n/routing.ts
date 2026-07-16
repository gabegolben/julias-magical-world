import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "pt-BR", "es"], // Decision #7: all three from Day 1
  defaultLocale: "en",
});
