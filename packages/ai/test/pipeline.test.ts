import { test } from "node:test";
import assert from "node:assert/strict";
import { runStoryPipeline } from "../src/run.ts";
import { mockImageModel, mockReviewer, mockStoryModel } from "../src/providers/mock.ts";
import { assessLineArt } from "../src/quality.ts";
import type { StoryRequest } from "../src/schemas.ts";

const REQ: StoryRequest = {
  childId: "6f9619ff-8b86-4011-b1e0-9d9c8a3f2a11",
  ageBand: "EARLY_EXPLORER",
  language: "pt-BR",
  characterKey: "unicorn",
  settingKey: "beach",
  style: "CARTOON_BOLD",
  childName: "Julia",
};

test("happy path: schema-valid story, one image per page, READY", async () => {
  const result = await runStoryPipeline(REQ, {
    story: mockStoryModel(),
    image: mockImageModel(),
    reviewer: mockReviewer("PASS"),
  });
  assert.equal(result.status, "READY");
  assert.equal(result.story.pages.length, 4); // EARLY_EXPLORER
  assert.equal(result.images?.length, 4);
  assert.ok(result.story.title.includes("Julia"));
});

test("story generation retries transient schema failures", async () => {
  const result = await runStoryPipeline(REQ, {
    story: mockStoryModel({ failFirst: 2 }), // fails twice, succeeds on 3rd
    image: mockImageModel(),
    reviewer: mockReviewer("PASS"),
  });
  assert.equal(result.status, "READY");
});

test("story generation gives up after 3 attempts", async () => {
  await assert.rejects(
    runStoryPipeline(REQ, {
      story: mockStoryModel({ failFirst: 5 }),
      image: mockImageModel(),
      reviewer: mockReviewer("PASS"),
    }),
    /failed after 3 attempts/,
  );
});

test("keyword screen holds unsafe text for review — no images generated", async () => {
  const result = await runStoryPipeline(REQ, {
    story: mockStoryModel({ poison: true }), // injects a blocked word
    image: mockImageModel(),
    reviewer: mockReviewer("PASS"),
  });
  assert.equal(result.status, "SAFETY_REVIEW");
  assert.equal(result.images, undefined);
  assert.ok(result.flags.some((f) => f.startsWith("keyword:")));
});

test("LLM reviewer REVIEW verdict holds the story", async () => {
  const result = await runStoryPipeline(REQ, {
    story: mockStoryModel(),
    image: mockImageModel(),
    reviewer: mockReviewer("REVIEW"),
  });
  assert.equal(result.status, "SAFETY_REVIEW");
  assert.deepEqual(result.flags, ["llm-review:REVIEW"]);
});

test("reviewer outage FAILS CLOSED into review, never auto-publishes", async () => {
  const result = await runStoryPipeline(REQ, {
    story: mockStoryModel(),
    image: mockImageModel(),
    reviewer: mockReviewer("THROW"),
  });
  assert.equal(result.status, "SAFETY_REVIEW");
  assert.ok(result.flags[0].startsWith("llm-review:error:"));
});

test("invalid request is rejected before any provider call", async () => {
  await assert.rejects(
    runStoryPipeline({ ...REQ, childName: "x".repeat(99) } as StoryRequest, {
      story: mockStoryModel(),
      image: mockImageModel(),
      reviewer: mockReviewer("PASS"),
    }),
  );
});

// ---- Line-art quality gate ---------------------------------------------------

/** Build a synthetic RGBA canvas: white, with black pixels where paint(x,y). */
function raster(width: number, height: number, paint: (x: number, y: number) => boolean) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = paint(x, y) ? 20 : 255;
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return data;
}

test("quality gate passes a well-formed grid of closed regions", () => {
  const size = 200;
  // 4px grid lines every 40px, including the canvas edges → all cells closed.
  const data = raster(size, size, (x, y) => x % 40 < 4 || y % 40 < 4 || x >= size - 4 || y >= size - 4);
  const result = assessLineArt(data, size, size);
  assert.equal(result.ok, true, result.reasons.join("; "));
  assert.ok(result.containedProbeRatio >= 0.8);
});

test("quality gate rejects a blank page", () => {
  const size = 200;
  const data = raster(size, size, () => false);
  const result = assessLineArt(data, size, size);
  assert.equal(result.ok, false);
  assert.ok(result.reasons.some((r) => r.includes("too little line work")));
});

test("quality gate rejects art whose fills flood the page", () => {
  const size = 200;
  // A single small box in the corner; the central probes all flood the page.
  const data = raster(
    size,
    size,
    (x, y) => (x < 30 || y < 30) && (x % 28 < 3 || y % 28 < 3) && x < 34 && y < 34,
  );
  const result = assessLineArt(data, size, size);
  assert.equal(result.ok, false);
  assert.ok(result.reasons.some((r) => r.includes("too little") || r.includes("leak")));
});
