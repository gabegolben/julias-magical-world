/**
 * Model envs must be API ids ("claude-haiku-4-5"), but a display name like
 * "Haiku 4.5" is an easy dashboard mistake that 404s every request. Treat
 * anything that isn't a plausible id as unset so generation never breaks
 * on a misconfigured env var. Shared by /api/generate and /api/health.
 */
export function validModelId(id: string | undefined): string | null {
  return id && /^claude-[a-z0-9.-]+$/.test(id) ? id : null;
}

export function storyModelFor(tier: "free" | "premium"): string {
  if (tier === "premium") {
    const premium = validModelId(process.env.STORY_MODEL_PREMIUM);
    if (premium) return premium;
  }
  return validModelId(process.env.STORY_MODEL) ?? "claude-haiku-4-5";
}

export function reviewModel(): string {
  return validModelId(process.env.REVIEW_MODEL) ?? "claude-opus-4-8";
}

/** Same display-name guard for OpenAI image ids ("GPT Image 2" would 404). */
function validImageModelId(id: string | undefined): string | null {
  return id && /^[a-z0-9][a-z0-9.-]*$/.test(id) ? id : null;
}

/**
 * Illustration model by tier. Premium falls back to the free model (never
 * silently to a *pricier* default) when ILLUSTRATION_MODEL_PREMIUM is unset.
 * Both unset ⇒ the bake-off winner.
 */
export function illustrationModelFor(tier: "free" | "premium"): string {
  const free = validImageModelId(process.env.ILLUSTRATION_MODEL) ?? "gpt-image-1-mini";
  if (tier === "premium") {
    return validImageModelId(process.env.ILLUSTRATION_MODEL_PREMIUM) ?? free;
  }
  return free;
}
