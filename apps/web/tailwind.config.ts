import type { Config } from "tailwindcss";

/**
 * Magic Mode design tokens — chosen for the subject (a picture book come to
 * life), not defaults:
 *  paper   #FFF6E9  warm cream of a storybook page
 *  ink     #37305A  twilight purple-navy — soft, readable, night-story mood
 *  julia   #7C4DD8  Julia's purple, the primary action color
 *  sunshine#FFC94D  celebration accents & completion moments
 *  sky     #8AD4F0  secondary surfaces
 *  meadow  #74C98F  success / "all done"
 * Type: Baloo 2 (chunky rounded display — reads like storybook lettering),
 * Nunito (friendly rounded body).
 * Signature element: "wobbly" hand-drawn borders on every tappable card
 * (asymmetric border-radius), so the UI itself feels crayon-drawn.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FFF6E9",
        ink: "#37305A",
        julia: { DEFAULT: "#7C4DD8", soft: "#EDE4FB" },
        sunshine: "#FFC94D",
        sky: "#8AD4F0",
        meadow: "#74C98F",
      },
      fontFamily: {
        display: ["var(--font-display)", "'Baloo 2'", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "Nunito", "system-ui", "sans-serif"],
      },
      borderRadius: {
        wobble: "255px 15px 225px 15px / 15px 225px 15px 255px",
      },
      minHeight: { tap: "88px" }, // toddler-sized tap targets (>= 2x WCAG)
      minWidth: { tap: "88px" },
    },
  },
  plugins: [],
};
export default config;
