/**
 * Multi-layer content safety (Overview §8.2, §14.2).
 *
 * Layer 1 — input: template-only for 3-5 (enforced by zod enums upstream).
 * Layer 2 — prompt hardening: system prompt treats variables as data.
 * Layer 3 — output text screen (below): keyword pass + LLM review pass.
 * Layer 4 — image moderation: provider API on every generated image.
 * Layer 5 — human review queue: anything flagged lands in AuditLog(flagged).
 */

// Deliberately broad; a hit sends the story to review, not to the child.
const BLOCKED_PATTERNS: RegExp[] = [
  /\b(kill|dead|death|die|blood|gun|knife|weapon)\b/i,
  /\b(hate|stupid|dumb|ugly|shut up)\b/i,
  /\b(kiss|boyfriend|girlfriend|dating)\b/i,
  /\b(address|phone number|password|meet me)\b/i,
];

export interface TextSafetyResult {
  ok: boolean;
  hits: string[];
}

export function screenStoryText(fullText: string): TextSafetyResult {
  const hits = BLOCKED_PATTERNS.filter((p) => p.test(fullText)).map(String);
  return { ok: hits.length === 0, hits };
}

/**
 * LLM review pass: a second, cheap model call that grades the story against
 * the safety rubric and returns PASS/REVIEW. Wire to your chosen provider in
 * pipeline.ts. Fails CLOSED: any error → REVIEW, never auto-publish.
 */
export const REVIEW_SYSTEM_PROMPT = [
  "You are a children's content safety reviewer for ages 3-14.",
  "Grade the story STRICTLY. Respond with exactly one word:",
  "PASS — fully appropriate, gentle, positive.",
  "REVIEW — anything scary, violent, romantic, brand-related, or that asks the child for information.",
].join("\n");
