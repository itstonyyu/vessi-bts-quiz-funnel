import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("campaign hero is removed from layout after the welcome screen", () => {
  assert.match(html, /\.shell\.quiz-started \.brand-panel\s*{\s*display: none;/);
  assert.match(html, /shell\.classList\.toggle\("quiz-started", !isLanding\)/);
  assert.match(html, /shell\.dataset\.view = isLanding \? "landing" : "quiz"/);
});

test("question screens reset to the top and use the mobile viewport", () => {
  assert.match(html, /if \(!isLanding\) window\.scrollTo\(\{ top: 0, left: 0, behavior: "instant" \}\)/);
  assert.match(html, /\.shell\.quiz-started \.quiz-card\s*{[\s\S]*?min-height: calc\(100dvh - 24px\)/);
  assert.match(html, /<h2 tabindex="-1">\$\{title\}<\/h2>/);
});

test("Typeform statement images render without cropping", () => {
  assert.match(html, /\.question-accent\s*{[\s\S]*?width: 100%;[\s\S]*?height: auto;[\s\S]*?aspect-ratio: 40 \/ 11;/);
  assert.match(html, /\.question-accent img\s*{[\s\S]*?object-fit: contain;/);
  assert.match(html, /\.shell\.quiz-started \.question-accent\s*{[\s\S]*?height: auto;/);
  assert.match(html, /<figure class="question-accent \$\{mediaClass\}" aria-hidden="true"><img src="\$\{media\}" alt="" loading="lazy" decoding="async"><\/figure>/);
  assert.match(html, /student_statement\(\)[\s\S]*?media: "img\/typeform-student\.jpg"/);
  assert.match(html, /teacher_statement\(\)[\s\S]*?media: "img\/typeform-teacher\.jpg"/);
  assert.match(html, /\.question-accent\.statement-media\s*{[\s\S]*?aspect-ratio: 1 \/ 1;/);
});